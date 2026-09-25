import asyncio
import copy
import json
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from eth_account import Account
from eth_abi import encode
from eth_utils import keccak
from server.chain import build_transaction, digest, verify_receipt, MANAGER
from server.launch_plan import Manifest, TaxConfig, approval_hash, check_plan, payload_for
from server import autolaunch


def plan_for(address):
    m = Manifest(maxTotalBnb='0.005')
    tx = build_transaction(address, '0x'+'ab'*160, '0x'+'cd'*65, '0')
    p = {'schemaVersion':2, 'manifest':m.pinned(), 'transaction':tx, 'transactionHash':digest(tx),
         'brainCommit':'abc', 'expires':time.time()+300,
         'payload':payload_for(m,'https://static.four.meme/rat.png','abc',{'totalBAmount':'24','deployCost':'0'},1)}
    p['approvalHash'] = approval_hash(p)
    return p


class ManifestTests(unittest.TestCase):
    def test_tax_allocation_and_recipient(self):
        args = dict(feeRate=3, burnRate=0, divideRate=0, liquidityRate=0, recipientRate=100,
                    recipientAddress='0x1111111111111111111111111111111111111111')
        self.assertEqual(TaxConfig(**args).feeRate, 3)
        for part in [{'feeRate':2}, {'recipientRate':99}, {'recipientAddress':''}, {'minSharing':123456}]:
            with self.subTest(part=part), self.assertRaises(ValueError): TaxConfig(**{**args,**part})

    def test_budget_seed_and_tax_are_bound(self):
        p = plan_for(Account.create().address)
        for part in [{'seed':2},{'maxTotalBnb':'1'},{'preBuyBnb':'0.01'},{'webUrl':'https://example.org'}]:
            altered=copy.deepcopy(p); altered['manifest'].update(part)
            with self.assertRaises(ValueError): check_plan(altered,p['approvalHash'],p['transaction']['from'])

    def test_nonzero_prebuy_is_blocked_even_if_reapproved(self):
        p=plan_for(Account.create().address)
        p['manifest']['preBuyBnb']='0.01';p['payload']['preSale']='0.01'
        with self.assertRaisesRegex(ValueError,'Pre-buy'): check_plan(p,approval_hash(p),p['transaction']['from'])

    def test_payload_metadata_must_match_manifest(self):
        p=plan_for(Account.create().address);p['payload']['shortName']='OTHER'
        with self.assertRaisesRegex(ValueError,'payload differs'): check_plan(p,approval_hash(p),p['transaction']['from'])


class ReceiptTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.p=plan_for(Account.create().address);self.h='0x'+'12'*32;self.block='0x'+'34'*32
        self.token='0x2222222222222222222222222222222222222222'
        tx=self.p['transaction']
        self.tx={**tx,'hash':self.h,'input':tx['data']}
        event=encode(['address','address','uint256','string','string','uint256','uint256','uint256'],
                     [tx['from'],self.token,42,'RAT LAB','RAT',10**27,1,0])
        topic='0x'+keccak(text='TokenCreate(address,address,uint256,string,string,uint256,uint256,uint256)').hex()
        self.receipt={'transactionHash':self.h,'blockHash':self.block,'blockNumber':'0x64','status':'0x1',
                      'logs':[{'address':MANAGER,'topics':[topic],'data':'0x'+event.hex()}]}
        self.height='0x65'
    async def rpc(self,method,params):
        return {'eth_chainId':'0x38','eth_getTransactionByHash':self.tx,'eth_getTransactionReceipt':self.receipt,
                'eth_blockNumber':self.height,'eth_getBlockByNumber':{'hash':self.block}}[method]
    async def test_confirmed_matching_event(self):
        with patch('server.chain.rpc',side_effect=self.rpc):
            result=await verify_receipt(self.p,self.h)
        self.assertEqual(result['token'].lower(),self.token)
        self.assertEqual(result['state'],'confirmed')
    async def test_success_status_without_event_is_not_launch(self):
        self.receipt['logs']=[]
        with patch('server.chain.rpc',side_effect=self.rpc), self.assertRaises(ValueError):
            await verify_receipt(self.p,self.h)
    async def test_missing_confirmations_and_reorg(self):
        self.height='0x64'
        with patch('server.chain.rpc',side_effect=self.rpc): self.assertIsNone(await verify_receipt(self.p,self.h))
        self.height='0x65';self.receipt['blockHash']='0x'+'ff'*32
        with patch('server.chain.rpc',side_effect=self.rpc): self.assertIsNone(await verify_receipt(self.p,self.h))
    async def test_reverted_is_terminal(self):
        self.receipt['status']='0x0'
        with patch('server.chain.rpc',side_effect=self.rpc):
            self.assertEqual((await verify_receipt(self.p,self.h))['state'],'reverted')
    async def test_wrong_transaction_is_rejected(self):
        self.tx['value']='0x1'
        with patch('server.chain.rpc',side_effect=self.rpc), self.assertRaises(ValueError):
            await verify_receipt(self.p,self.h)


class RunnerTests(unittest.IsolatedAsyncioTestCase):
    async def run_mocked(self,root,*,complete=True,replay_ok=True,ambiguous=False):
        account=Account.create()  # Disposable test account, no real funds or external requests.
        from test_flap import flap_plan
        p=flap_plan(account.address);file=root/'plan.json';file.write_text(json.dumps(p))
        args=SimpleNamespace(plan=str(file),approve=p['approvalHash'],max_total_bnb='0.005',keystore='unused')
        calls=[]
        async def fake_rpc(method,params):
            calls.append((method,params))
            if method=='eth_getTransactionCount':return '0x4'
            if method=='eth_sendRawTransaction':
                if ambiguous: raise ConnectionError('Simulated lost RPC response')
                return '0x'+keccak(bytes.fromhex(params[0][2:])).hex()
            raise AssertionError(method)
        class Brain:
            def __init__(self,run_id,seed,emit,out):self.emit=emit
            def run(self):
                self.emit({'type':'brain','commit':'abc'})
                self.emit({'type':'complete' if complete else 'aborted','hits':8 if complete else 1,'proof':'proof'})
            def stop(self):pass
        async def observed(journal,record):
            return None  # Network receipt verification is covered independently above.
        with patch.object(autolaunch,'ROOT',root),patch.object(autolaunch,'unlock',return_value=account),\
             patch.object(autolaunch,'preflight',new=AsyncMock(return_value={'gas':100000,'gasPrice':1000000000,'maxCostWei':'100000000000000'})),\
             patch.object(autolaunch,'rpc',side_effect=fake_rpc),patch.object(autolaunch,'BrainRun',Brain),\
             patch('server.flap.check_live_plan',new=AsyncMock()),patch('session.replay',return_value=(replay_ok,{})),patch.object(autolaunch,'observe',side_effect=observed):
            try: await autolaunch.execute(args)
            except (ValueError,ConnectionError) as exc: error=exc
            else:error=None
        journal=root/'data'/('autolaunch_'+p['approvalHash'][:16])/'journal.json'
        return p,calls,json.loads(journal.read_text()),error

    async def test_single_signed_transaction_and_durable_recovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            p,calls,record,error=await self.run_mocked(Path(tmp),ambiguous=True)
            self.assertIsInstance(error,ConnectionError)
            self.assertEqual(record['state'],'signed')
            self.assertEqual(len([c for c in calls if c[0]=='eth_sendRawTransaction']),1)
            autolaunch.inspect_journal(record,p['approvalHash'])
            self.assertTrue((Path(tmp)/'data'/'launch-locks'/(p['transaction']['from'].lower()+'.json')).exists())
            record['raw']=record['raw'][:-2]+'00'
            with self.assertRaises(ValueError):autolaunch.inspect_journal(record,p['approvalHash'])
    async def test_no_broadcast_when_rat_or_replay_fails(self):
        for completed,matched in [(False,True),(True,False)]:
            with self.subTest(completed=completed,matched=matched), tempfile.TemporaryDirectory() as tmp:
                p,calls,record,error=await self.run_mocked(Path(tmp),complete=completed,replay_ok=matched)
                self.assertIsInstance(error,ValueError)
                self.assertNotIn('eth_sendRawTransaction',[c[0] for c in calls])
                self.assertEqual(record['state'],'stopped_before_signing')
                self.assertNotIn('raw',record)
    async def test_success_broadcasts_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            p,calls,record,error=await self.run_mocked(Path(tmp))
            self.assertIsNone(error)
            self.assertEqual(record['state'],'submitted')
            self.assertEqual(len([c for c in calls if c[0]=='eth_sendRawTransaction']),1)
    def test_exclusive_reservation_preserves_existing_journal(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'journal.json'
            autolaunch.reserve(path,{'state':'signed'})
            with self.assertRaises(FileExistsError):autolaunch.reserve(path,{'state':'reserved'})
            self.assertEqual(json.loads(path.read_text())['state'],'signed')

if __name__=='__main__': unittest.main()
