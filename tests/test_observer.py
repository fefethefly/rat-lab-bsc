import unittest
from observer.engine import paper_ledger, PER_HIT_WEI, CAP_WEI, RULES

class ObserverTests(unittest.TestCase):
    def run_record(self, proof='a', **kw):
        return {'id':'run-1','proof':proof,'verified':True,'hits':8,'endedAt':'2026-09-25T00:00:00Z',**kw}
    def test_replay_and_duplicate_proofs_never_double_count(self):
        ledger=paper_ledger([self.run_record(),self.run_record()])
        self.assertEqual(len(ledger['records']),1)
        self.assertEqual(ledger['allocatedBnb'],'0.00000800')
        self.assertFalse(ledger['executionEnabled'])
        self.assertIsNone(ledger['records'][0]['txHash'])
    def test_unverified_results_never_earn_budget(self):
        self.assertEqual(paper_ledger([self.run_record(verified=False)])['records'],[])
    def test_cap_is_applied_in_integer_units(self):
        ledger=paper_ledger([self.run_record(str(i)) for i in range(200)])
        eligible=sum(row['eligibleHits'] for row in ledger['records'])
        self.assertEqual(eligible*PER_HIT_WEI,CAP_WEI)
        self.assertEqual(ledger['confirmedBuys'],0)
    def test_shared_targets_stay_inside_board(self):
        for x,y,w,h in RULES['targets']:
            self.assertTrue(0<=x-w<x+w<=1 and 0<=y-h<y+h<=1)
    def test_status_is_read_only_and_exposes_no_signing_endpoint(self):
        from fastapi.testclient import TestClient
        from observer.app import app
        client=TestClient(app)
        data=client.get('/status').json()
        self.assertEqual(client.post('/status',json={}).status_code,405)
        self.assertEqual(client.get('/api/status').status_code,404)
        self.assertNotIn('ownerToken',data)
        self.assertFalse(data['buyback']['executionEnabled'])
if __name__=='__main__':unittest.main()
