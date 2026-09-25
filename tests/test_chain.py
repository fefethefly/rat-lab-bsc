import copy
import time
import unittest
from eth_account import Account
from fastapi.testclient import TestClient
from server.chain import build_transaction, validate_transaction, select_bnb_config, digest, wei, MANAGER
from server.launch_plan import check_plan, approval_hash, Manifest, payload_for
from server.app import app, state

ADDRESS = '0x1111111111111111111111111111111111111111'


class ChainSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tx = build_transaction(ADDRESS, '0x'+'ab'*160, '0x'+'cd'*65, '0')

    def test_canonical_creation(self):
        validate_transaction(self.tx, self.tx)
        self.assertEqual(self.tx['chainId'], 56)
        self.assertEqual(self.tx['to'], MANAGER)

    def test_mutated_plan_rejected(self):
        for field, value in [('chainId', 97), ('to', ADDRESS), ('from', MANAGER), ('value', '0x10'), ('data', self.tx['data']+'00')]:
            tx = {**self.tx, field: value}
            with self.subTest(field=field), self.assertRaises(ValueError): validate_transaction(tx, self.tx)

    def test_wrong_selector_and_extra_bytes(self):
        for data in ['0x00000000'+self.tx['data'][10:], self.tx['data']+'00'*32]:
            tx = {**self.tx, 'data': data}
            with self.assertRaises(ValueError): validate_transaction(tx, tx)

    def test_value_cap_and_invalid_numbers(self):
        tx = {**build_transaction(ADDRESS, '0xab', '0x'+'ab'*65, '1'), 'value': hex(10**18+1)}
        with self.assertRaises(ValueError): validate_transaction(tx, tx)
        for value in ['-1', 'NaN', 'Infinity', '0.0000000000000000001']:
            with self.subTest(value=value), self.assertRaises(ValueError): wei(value)

    def test_no_guessed_platform_config(self):
        preset = {'symbol':'BNB','networkCode':'BSC','totalBAmount':'24','deployCost':'0','status':'PUBLISH'}
        self.assertEqual(select_bnb_config({'raise':[preset]}), preset)
        for payload in [{}, {'raise':[preset, {**preset, 'deployCost':'0.01'}]}, {**preset, 'status':'CLOSED'}]:
            with self.assertRaises(ValueError): select_bnb_config(payload)

    def test_operator_approval_binds_every_input(self):
        m = Manifest(maxTotalBnb='0.005')
        plan = {'schemaVersion':2,'transaction':self.tx,'transactionHash':digest(self.tx),
                'payload':payload_for(m,'https://static.four.meme/rat.png','abc',{'totalBAmount':'24','deployCost':'0'},1),
                'manifest':m.pinned(),'brainCommit':'abc','expires':time.time()+60}
        approved = approval_hash(plan)
        check_plan(plan, approved, ADDRESS)
        for field,value in [('expires',0),('brainCommit','changed'),('manifest',{'name':'OTHER'}),('payload',{'preSale':'1'})]:
            modified={**plan,field:value}
            with self.subTest(field=field), self.assertRaises(ValueError): check_plan(modified, approved, ADDRESS)
        with self.assertRaises(ValueError): check_plan(plan, approved, MANAGER)


class ControlPlaneTests(unittest.TestCase):
    def setUp(self):
        self.previous=copy.deepcopy(state)
        state.clear(); state.update({'status':'standby','runId':None,'hits':0,'events':[],'step':-1,'commit':None})
        self.client=TestClient(app,base_url='http://127.0.0.1:8000')
        self.token=self.client.get('/api/status').json()['ownerToken']

    def tearDown(self):
        state.clear(); state.update(self.previous)

    def test_csrf_and_host_protection(self):
        self.assertEqual(self.client.post('/api/stop',json={}).status_code,403)
        self.assertEqual(self.client.get('/api/status',headers={'Origin':'https://evil.example'}).status_code,403)
        self.assertEqual(self.client.get('/api/status',headers={'Host':'evil.example'}).status_code,403)
        self.assertEqual(self.client.post('/api/stop',json={},headers={'x-rat-owner':self.token}).status_code,200)

    def test_mainnet_cannot_start_without_a_plan(self):
        r=self.client.post('/api/run',json={'mode':'mainnet'},headers={'x-rat-owner':self.token})
        self.assertEqual(r.status_code,400)

    def test_no_unsigned_transaction_before_neural_completion(self):
        self.assertEqual(self.client.get('/api/transaction').status_code,409)

    def test_validation_and_mainnet_disabled(self):
        r=self.client.post('/api/run',json={'symbol':'bad ticker'},headers={'x-rat-owner':self.token})
        self.assertEqual(r.status_code,422)
        r=self.client.post('/api/four/nonce',json={'address':ADDRESS},headers={'x-rat-owner':self.token})
        self.assertEqual(r.status_code,410)

if __name__=='__main__': unittest.main()
