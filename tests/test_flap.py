import copy
import time
import unittest
from unittest.mock import patch, AsyncMock
from eth_abi import encode, decode
from eth_utils import keccak
from server import flap
from server.chain import digest, validate_transaction, verify_receipt, preflight
from server.launch_plan import Manifest, approval_hash, check_plan

ADDRESS='0x1111111111111111111111111111111111111111'
CID='bafkreieen6w7ejjkxml4reegco6vid4lbkol2yut3w7noooay2n6vsa7pu'
SALT='0x506a3fc68a984b52b7549e99ccd8eea4a6f910c922d17c5a5dca5fc8a8d1848e'

def flap_plan(address=ADDRESS):
    m=Manifest(maxTotalBnb='0.005',flapTax={'beneficiary':address})
    meta=flap.metadata(m,address,'abc')
    payload={'platform':'flap','salt':SALT,'predictedToken':flap.predict(bytes.fromhex(SALT[2:])),
             'metaCid':CID,'metadata':meta,'metadataHash':digest(meta),'imageSha256':'ab'*32,'deployment':{}}
    tx=flap.build_transaction(address,m,CID,SALT)
    p={'schemaVersion':3,'manifest':m.pinned(),'payload':payload,'transaction':tx,'transactionHash':digest(tx),'brainCommit':'abc','expires':time.time()+900}
    p['approvalHash']=approval_hash(p)
    return p

class FlapPlanTests(unittest.TestCase):
    def test_decode_economics_and_zero_value(self):
        p=flap_plan();m=check_plan(p,p['approvalHash'],ADDRESS)
        fields=decode([flap.TUPLE],bytes.fromhex(p['transaction']['data'][10:]))[0]
        self.assertEqual(fields[3],1);self.assertEqual(fields[7],0)
        self.assertEqual(fields[14:16],(200,200));self.assertEqual(fields[18:22],(10000,0,0,0))
        self.assertEqual(fields[24],flap.ZERO);self.assertEqual(fields[25],6)
        self.assertEqual(int(p['transaction']['value'],16),0)
        self.assertTrue(p['payload']['predictedToken'].endswith('7777'))
    def test_changed_manifest_or_metadata_rejected_even_rehashed(self):
        for field,value in [('symbol','OTHER'),('preBuyBnb','0.01'),('webUrl','https://changed.example')]:
            p=flap_plan();p['manifest'][field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):check_plan(p,approval_hash(p),ADDRESS)
    def test_no_arbitrary_target_or_value(self):
        for field,value in [('to',ADDRESS),('value','0x1'),('chainId',1)]:
            p=flap_plan();p['transaction'][field]=value
            with self.assertRaises(ValueError):validate_transaction(p['transaction'],p['transaction'])
    def test_expiry_and_prediction(self):
        p=flap_plan();p['expires']=0
        with self.assertRaisesRegex(ValueError,'expired'):check_plan(p,approval_hash(p),ADDRESS)
        p=flap_plan();p['payload']['predictedToken']=ADDRESS
        with self.assertRaisesRegex(ValueError,'Predicted'):check_plan(p,approval_hash(p),ADDRESS)
    def test_no_legacy_allocations(self):
        p=flap_plan();p['manifest']['tax']={'feeRate':1,'burnRate':100,'divideRate':0,'liquidityRate':0,'recipientRate':0}
        with self.assertRaisesRegex(ValueError,'Flap tax'):check_plan(p,approval_hash(p),ADDRESS)

class FlapReceiptTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.p=flap_plan();self.h='0x'+'12'*32;self.block='0x'+'34'*32;self.tax=200
        self.tx={**self.p['transaction'],'hash':self.h,'input':self.p['transaction']['data']}
        event=encode(['uint256','address','uint256','address','string','string','string'],[1,ADDRESS,1,self.p['payload']['predictedToken'],'RAT LAB','RAT',CID])
        self.receipt={'transactionHash':self.h,'blockHash':self.block,'blockNumber':'0x64','status':'0x1','logs':[{'address':flap.PORTAL,'topics':['0x'+keccak(text='TokenCreated(uint256,address,uint256,address,string,string,string)').hex()],'data':'0x'+event.hex()}]}
    async def rpc(self,method,params):
        if method=='eth_call':return '0x'+encode(['uint16'],[self.tax]).hex()
        return {'eth_chainId':'0x38','eth_getTransactionByHash':self.tx,'eth_getTransactionReceipt':self.receipt,'eth_blockNumber':'0x65','eth_getBlockByNumber':{'hash':self.block}}[method]
    async def test_confirmed_flap_event_and_tax(self):
        with patch('server.chain.rpc',side_effect=self.rpc):r=await verify_receipt(self.p,self.h)
        self.assertEqual(r['token'],self.p['payload']['predictedToken']);self.assertTrue(r['taxVerified'])
    async def test_wrong_tax_or_missing_event_fails(self):
        self.tax=300
        with patch('server.chain.rpc',side_effect=self.rpc),self.assertRaisesRegex(ValueError,'tax rates'):await verify_receipt(self.p,self.h)
        self.tax=200;self.receipt['logs']=[]
        with patch('server.chain.rpc',side_effect=self.rpc),self.assertRaisesRegex(ValueError,'TokenCreated'):await verify_receipt(self.p,self.h)
    async def test_upgrade_stops_live_plan(self):
        with patch('server.flap.network_check',new=AsyncMock(return_value={'version':'changed'})),self.assertRaisesRegex(ValueError,'deployment changed'):
            await flap.check_live_plan(self.p)

class FlapApiTests(unittest.TestCase):
    def test_missing_budget_never_uploads(self):
        import json
        from fastapi.testclient import TestClient
        from server import app as control
        client=TestClient(control.app,base_url='http://127.0.0.1:8000')
        with patch.dict('os.environ',{'ENABLE_MAINNET_PREPARE':'1'}), patch('server.flap.upload_metadata',new=AsyncMock()) as upload:
            r=client.post('/api/flap/prepare',headers={'x-rat-owner':control.OWNER},data={'address':'0xA86881412c2E4583bfB0Db7a8B39155C2661d2D9','manifest':json.dumps({'flapTax':{'beneficiary':ADDRESS}})},files={'file':('rat.png',b'not-read','image/png')})
            self.assertEqual(r.status_code,400);upload.assert_not_awaited()
    def test_disabled_preparation_never_uploads(self):
        import json
        from fastapi.testclient import TestClient
        from server import app as control
        client=TestClient(control.app,base_url='http://127.0.0.1:8000')
        with patch.dict('os.environ',{'ENABLE_MAINNET_PREPARE':'0'}), patch('server.flap.upload_metadata',new=AsyncMock()) as upload:
            r=client.post('/api/flap/prepare',headers={'x-rat-owner':control.OWNER},data={'address':ADDRESS,'manifest':'{}'},files={'file':('rat.png',b'not-read','image/png')})
            self.assertEqual(r.status_code,403);upload.assert_not_awaited()
