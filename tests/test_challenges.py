import copy
import json
import tempfile
import unittest
import uuid
from observer.challenges import ChallengeStore, SubmissionError, validate
from observer.engine import RULES, Experiment

class ChallengeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.store = ChallengeStore(self.temp.name)
    def payload(self): return {'title':'Zigzag study', 'targets':copy.deepcopy(RULES['targets']), 'requestId':str(uuid.uuid4())}
    def test_idempotent_and_immutable(self):
        p = self.payload(); identifier = self.store.submit(p,'a')
        self.assertEqual(self.store.submit(p,'b'),identifier)
        p['title']='Changed design'
        with self.assertRaises(SubmissionError): self.store.submit(p,'a')
        self.assertEqual(self.store.get(identifier)['title'],'Zigzag study')
    def test_validation_rejects_unbounded_and_nonfinite_inputs(self):
        for target in [[.1,.5,.14,.05],[.5,.5,1,.05],[.5,.5,.14,float('nan')],[True,.5,.14,.05],[10**500,.5,.14,.05]]:
            p=self.payload(); p['targets'][0]=target
            with self.assertRaises(SubmissionError): validate(p)
        p=self.payload(); p['targets'].pop()
        with self.assertRaises(SubmissionError): validate(p)
    def test_restarts_preserve_archive_and_interrupt_running_once(self):
        identifier=self.store.submit(self.payload(),'a'); self.assertEqual(self.store.claim()['id'],identifier)
        new=ChallengeStore(self.temp.name); new.recover()
        self.assertEqual(new.get(identifier)['state'],'interrupted'); self.assertIsNone(new.claim())
        next_id=new.submit(self.payload(),'a'); new.claim()
        new.finish(next_id,{'complete':True,'verified':True}, {'runId':'test'}, b'poses')
        newer=ChallengeStore(self.temp.name); newer.recover()
        self.assertEqual(newer.get(next_id)['state'],'complete'); self.assertEqual(newer.artifact(next_id,'poses.bin'),b'poses')
    def test_queue_order_and_global_cap_cannot_be_bypassed_by_new_clients(self):
        ids=[self.store.submit(self.payload(),str(i)) for i in range(4)]
        with self.assertRaises(SubmissionError): self.store.submit(self.payload(),'fifth')
        self.assertEqual(self.store.get(ids[3])['ahead'],3)
        for identifier in ids:
            self.assertEqual(self.store.claim()['id'],identifier); self.store.fail(identifier)
        for i in range(20):
            identifier=self.store.submit(self.payload(),str(i+4)); self.store.claim(); self.store.fail(identifier)
        with self.assertRaises(SubmissionError): self.store.submit(self.payload(),'new')
    def test_public_api_size_cors_idempotency_and_not_found(self):
        from fastapi.testclient import TestClient
        from observer import app as module
        old=module.challenges; module.challenges=self.store; self.addCleanup(setattr,module,'challenges',old)
        client=TestClient(module.app); p=self.payload()
        a=client.post('/challenges',json=p); b=client.post('/challenges',json=p)
        self.assertEqual(a.status_code,201); self.assertEqual(a.json(),b.json())
        record=client.get('/challenges/'+a.json()['id']).json()
        self.assertNotIn('client',record); self.assertEqual(record['state'],'queued')
        self.assertEqual(client.post('/challenges',content=b'x'*4097).status_code,413)
        self.assertEqual(client.get('/challenges/unknown').status_code,404)
        self.assertEqual(client.get('/challenges/'+a.json()['id']+'/poses.bin').status_code,404)
        preflight=client.options('/challenges',headers={'Origin':'https://rat-lab.fun','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'})
        self.assertEqual(preflight.status_code,200)
    def test_unverified_completion_cannot_be_raced(self):
        identifier=self.store.submit(self.payload(),'a'); self.store.claim()
        self.store.finish(identifier,{'complete':True,'verified':False},{},b'')
        self.assertEqual(self.store.get(identifier)['state'],'incomplete')
