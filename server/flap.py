"""Flap BSC Tax Token V3: public metadata, deterministic calldata and read-only simulation.
No wallet secrets or transaction broadcasting live in this module.
"""
import asyncio
import hashlib
import json
import re
import secrets
import time
from eth_abi import encode, decode
from eth_utils import keccak, to_checksum_address, is_address
import httpx
from pydantic import BaseModel, ConfigDict, Field, field_validator

PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0'
TOKEN_IMPL = '0x024f18294970B5c76c0691b87f138A0317156422'
ZERO = '0x' + '00' * 20
UPLOAD = 'https://funcs.flap.sh/api/upload'
GATEWAY = 'https://flap.mypinata.cloud/ipfs/'
PARAM_TYPES = ['string','string','string','uint8','bytes32','uint8','address','uint256','address','bytes','bytes32','bytes','uint8','uint8','uint16','uint16','uint64','uint64','uint16','uint16','uint16','uint16','uint256','address','address','uint8']
TUPLE = '(' + ','.join(PARAM_TYPES) + ')'
SELECTOR = keccak(text='newTokenV6(' + TUPLE + ')')[:4]
# Native BNB + zero launch buy: current official construct-tx guide specifies msg.value = 0.
CREATION_VALUE = 0

class FlapTax(BaseModel):
    model_config = ConfigDict(extra='forbid')
    buyBps: int = Field(default=200, ge=1, le=1000)
    sellBps: int = Field(default=200, ge=1, le=1000)
    beneficiary: str
    taxDuration: int = Field(default=3153600000, ge=86400, le=3153600000)
    antiFarmerDuration: int = Field(default=3600, ge=0, le=86400)

    @field_validator('beneficiary')
    @classmethod
    def address(cls, v):
        if not is_address(v) or int(v,16)==0: raise ValueError('A nonzero Flap beneficiary is required')
        return to_checksum_address(v)


def cid(value):
    if not isinstance(value,str) or not re.fullmatch(r'(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,120})',value):
        raise ValueError('Invalid IPFS CID')
    return value


def predict(salt):
    init = bytes.fromhex('3d602d80600a3d3981f3363d3d373d3d3d363d73'+TOKEN_IMPL[2:]+'5af43d82803e903d91602b57fd5bf3')
    return to_checksum_address(keccak(b'\xff'+bytes.fromhex(PORTAL[2:])+salt+keccak(init))[-20:])


def find_salt():
    salt = secrets.token_bytes(32)
    for _ in range(2000000):
        address = predict(salt)
        if address.lower().endswith('7777'): return '0x'+salt.hex(), address
        salt = keccak(salt)
    raise ValueError('Vanity search exhausted; retry preparation')


def metadata(m, address, brain):
    return {'website':m.webUrl or None,'twitter':m.twitterUrl or None,'telegram':m.telegramUrl or None,
            'description':m.description+' | brain sha256 '+brain,'creator':to_checksum_address(address)}


async def upload_metadata(m,address,brain,raw,mime='image/png'):
    from .chain import digest
    meta=metadata(m,address,brain)
    operations={'query':'mutation Create($file: Upload!, $meta: MetadataInput!) { create(file: $file, meta: $meta) }','variables':{'file':None,'meta':meta}}
    async with httpx.AsyncClient(timeout=60) as client:
        response=await client.post(UPLOAD,data={'operations':json.dumps(operations),'map':json.dumps({'0':['variables.file']})},files={'0':('rat.png',raw,mime)})
        if response.status_code==403: raise ValueError('Flap upload denied access; resolve platform access conditions before continuing')
        response.raise_for_status(); result=response.json()
        if result.get('errors'): raise ValueError('Flap metadata upload rejected')
        meta_cid=cid(result.get('data',{}).get('create'))
    return {'metaCid':meta_cid,'metadata':meta,'metadataHash':digest(meta),'imageSha256':hashlib.sha256(raw).hexdigest()}


async def verify_metadata(payload):
    from .chain import digest
    from .network import read_request
    async with httpx.AsyncClient(timeout=30) as client:
        r=await read_request(client,'GET',GATEWAY+cid(payload['metaCid']));r.raise_for_status(); actual=r.json()
        for key,value in payload['metadata'].items():
            observed = actual.get(key)
            if key in ('website','twitter','telegram') and value is None and observed == '': observed = None
            if observed!=value: raise ValueError('IPFS metadata differs from the approved fields: '+key)
        image=cid(actual['image'])
        r=await read_request(client,'GET',GATEWAY+image);r.raise_for_status()
        if len(r.content)>4*1024*1024 or hashlib.sha256(r.content).hexdigest()!=payload['imageSha256']:
            raise ValueError('IPFS image differs from the approved token artwork')
    if digest(payload['metadata'])!=payload['metadataHash']: raise ValueError('Metadata digest changed')


def params(m,meta,salt):
    if m.tax is not None or not m.flapTax: raise ValueError('Use Flap tax parameters, not Four.meme allocations')
    if m.preBuyBnb not in ('0','0.0'): 
        from .chain import wei
        if wei(m.preBuyBnb): raise ValueError('This launch requires zero pre-buy')
    t=m.flapTax
    return [m.name,m.symbol,cid(meta),1,bytes.fromhex(salt.removeprefix('0x')),1,ZERO,0,t.beneficiary,b'',bytes(32),b'',0,0,t.buyBps,t.sellBps,t.taxDuration,t.antiFarmerDuration,10000,0,0,0,0,ZERO,ZERO,6]


def build_transaction(address,m,meta,salt):
    if not is_address(address): raise ValueError('Invalid creator')
    return {'chainId':56,'from':to_checksum_address(address),'to':PORTAL,'data':'0x'+(SELECTOR+encode([TUPLE],[params(m,meta,salt)])).hex(),'value':hex(CREATION_VALUE)}


def validate_transaction(tx,expected):
    if set(tx)!={'chainId','from','to','data','value'} or tx!=expected or tx['chainId']!=56 or tx['to']!=PORTAL or not is_address(tx['from']):
        raise ValueError('Flap transaction differs from the pinned plan')
    raw=bytes.fromhex(tx['data'].removeprefix('0x'))
    if raw[:4]!=SELECTOR: raise ValueError('Expected Flap newTokenV6')
    p=decode([TUPLE],raw[4:])[0]
    if raw!=SELECTOR+encode([TUPLE],[p]): raise ValueError('Non-canonical Flap calldata')
    if int(tx['value'],16)!=CREATION_VALUE or p[7]!=0 or p[25]!=6 or p[5]!=1 or p[6]!=ZERO or p[10]!=bytes(32) or p[9]!=b'' or p[11]!=b'' or p[24]!=ZERO:
        raise ValueError('Unsupported Flap launch path or nonzero pre-buy')
    if len(p[4])!=32 or not predict(p[4]).lower().endswith('7777'): raise ValueError('Invalid Flap vanity salt')


async def network_check():
    from .chain import rpc
    results=await asyncio.gather(rpc('eth_chainId',[]),rpc('eth_getCode',[PORTAL,'latest']),rpc('eth_getCode',[TOKEN_IMPL,'latest']),rpc('eth_call',[{'to':PORTAL,'data':'0x'+keccak(text='version()')[:4].hex()},'latest']))
    if int(results[0],16)!=56 or results[1] in ('0x','0x0') or results[2] in ('0x','0x0'): raise ValueError('Flap BSC contract deployment check failed')
    return {'available':True,'portal':PORTAL,'tokenImplementation':TOKEN_IMPL,'version':decode(['string'],bytes.fromhex(results[3][2:]))[0], 'portalCodeHash':'0x'+keccak(bytes.fromhex(results[1][2:])).hex(),'implementationCodeHash':'0x'+keccak(bytes.fromhex(results[2][2:])).hex()}


async def check_live_plan(plan):
    from .chain import rpc
    current=await network_check()
    if current!=plan['payload']['deployment']: raise ValueError('Flap deployment changed since plan approval')
    if await rpc('eth_getCode',[plan['payload']['predictedToken'],'pending']) not in ('0x','0x0'): raise ValueError('Predicted token already exists; inspect previous launch')
    await verify_metadata(plan['payload'])


def check_plan(plan,approved,address,allow_expired=False):
    from .launch_plan import Manifest,approval_hash
    from .chain import digest,wei
    if approval_hash(plan)!=approved: raise ValueError('Approval digest does not match Flap plan')
    if not allow_expired and time.time()>=plan['expires']: raise ValueError('Flap plan expired; prepare again')
    m=Manifest(**plan['manifest']);p=plan['payload'];tx=plan['transaction']
    if p.get('platform')!='flap' or tx['from'].lower()!=address.lower(): raise ValueError('Wrong Flap platform or creator')
    if not m.maxTotalBnb or wei(m.maxTotalBnb)<=0: raise ValueError('Set an explicit BNB budget')
    expected=build_transaction(address,m,p['metaCid'],p['salt']);validate_transaction(tx,expected)
    if digest(tx)!=plan['transactionHash'] or int(tx['value'],16)>wei(m.maxTotalBnb): raise ValueError('Flap transaction hash or budget mismatch')
    if p['metadata']!=metadata(m,address,plan['brainCommit']) or p['metadataHash']!=digest(p['metadata']): raise ValueError('Flap metadata differs from manifest')
    if predict(bytes.fromhex(p['salt'][2:]))!=p['predictedToken']: raise ValueError('Predicted token address changed')
    return m


async def prepare_plan(m,address,brain,uploaded):
    from .chain import digest,wei,preflight
    from .launch_plan import approval_hash
    if not m.maxTotalBnb or wei(m.maxTotalBnb)<=0: raise ValueError('Set the maximum total BNB budget')
    if uploaded['metadata']!=metadata(m,address,brain): raise ValueError('Metadata changed; upload again')
    deployment=await network_check()
    salt, predicted=await asyncio.to_thread(find_salt)
    payload={**uploaded,'platform':'flap','salt':salt,'predictedToken':predicted,'deployment':deployment}
    await verify_metadata(payload)
    tx=build_transaction(address,m,payload['metaCid'],salt)
    checks=await preflight(tx)
    if int(checks['maxCostWei'])>wei(m.maxTotalBnb): raise ValueError('Flap creation and gas exceed budget')
    plan={'id':secrets.token_hex(16),'schemaVersion':3,'manifest':m.pinned(),'payload':payload,'transaction':tx,'transactionHash':digest(tx),'checks':checks,'brainCommit':brain,'expires':time.time()+900,'notice':'Flap Tax Token V3. Zero pre-buy. Buy/sell tax, beneficiary and tax duration are encoded in calldata. Platform deductions apply before beneficiary payout; this is not a promise of 2% net creator revenue.'}
    plan['approvalHash']=approval_hash(plan);check_plan(plan,plan['approvalHash'],address)
    return plan


async def receipt_event(plan,receipt,tx_hash):
    from .chain import rpc
    topic='0x'+keccak(text='TokenCreated(uint256,address,uint256,address,string,string,string)').hex()
    matches=[]
    for log in receipt['logs']:
        if log.get('removed') or log['address'].lower()!=PORTAL.lower() or log['topics']!=[topic]: continue
        event=decode(['uint256','address','uint256','address','string','string','string'],bytes.fromhex(log['data'][2:]))
        if event[1].lower()==plan['transaction']['from'].lower() and event[3].lower()==plan['payload']['predictedToken'].lower() and list(event[4:])==[plan['manifest']['name'],plan['manifest']['symbol'],plan['payload']['metaCid']]: matches.append(event)
    if len(matches)!=1: raise ValueError('Exactly one matching Flap TokenCreated event required')
    token=to_checksum_address(matches[0][3]); values={}
    for method in ('buyTaxRate()','sellTaxRate()'):
        data=await rpc('eth_call',[{'to':token,'data':'0x'+keccak(text=method)[:4].hex()},receipt['blockNumber']]);values[method]=decode(['uint16'],bytes.fromhex(data[2:]))[0]
    tax=plan['manifest']['flapTax']
    if values['buyTaxRate()']!=tax['buyBps'] or values['sellTaxRate()']!=tax['sellBps']: raise ValueError('On-chain Flap tax rates differ from approved rates')
    return {'state':'confirmed','hash':tx_hash,'token':token,'block':str(int(receipt['blockNumber'],16)),'taxVerified':True,'buyTaxBps':values['buyTaxRate()'],'sellTaxBps':values['sellTaxRate()'],'note':'Creation and token tax rates verified. Net beneficiary proceeds depend on Flap protocol deductions.'}
