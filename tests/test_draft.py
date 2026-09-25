import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from server import app as control

class DraftTests(unittest.TestCase):
    def test_unresolved_reference_tax_blocks_preparation(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'config').mkdir()
            (root / 'config/mainnet-draft.json').write_text(json.dumps({
                'referenceEconomics': {'status': 'blocked_pending_platform_compatibility'}
            }))
            with patch.object(control, 'ROOT', root), patch.object(control, 'four') as four:
                with self.assertRaisesRegex(ValueError, '2% creator tax'):
                    control.require_reference_compatibility()
                four.assert_not_called()

    def test_save_is_local_and_does_not_authorize_launch(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'config').mkdir()
            target=root/'config/mainnet-draft.json'
            target.write_text(json.dumps({'creator':'0x1111111111111111111111111111111111111111','manifest':{},'status':'awaiting_parameters'}))
            with patch.object(control,'ROOT',root):
                client=TestClient(control.app,base_url='http://127.0.0.1:8000')
                self.assertEqual(client.post('/api/launch-draft',json={'manifest':{}}).status_code,403)
                headers={'x-rat-owner':control.OWNER}
                with patch.object(control,'four') as four,patch.object(control,'rpc') as rpc:
                    result=client.post('/api/launch-draft',headers=headers,json={'manifest':{'preBuyBnb':'0.02','maxTotalBnb':'0.025'}})
                    self.assertEqual(result.status_code,200)
                    self.assertEqual(result.json()['status'],'draft_saved_not_authorized')
                    self.assertEqual(client.get('/api/launch-draft').json()['manifest']['preBuyBnb'],'0.02')
                    four.assert_not_called();rpc.assert_not_called()
                before=target.read_text()
                invalid=client.post('/api/launch-draft',headers=headers,json={'manifest':{'tax':{'feeRate':3,'burnRate':0,'divideRate':0,'liquidityRate':0,'recipientRate':10}}})
                self.assertEqual(invalid.status_code,422)
                self.assertEqual(target.read_text(),before)

if __name__=='__main__':unittest.main()
