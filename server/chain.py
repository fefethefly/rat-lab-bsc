"""Four.meme integration. No private key is accepted by the HTTP server."""
import hashlib
import asyncio
import json
import os
from decimal import Decimal, InvalidOperation
import httpx
from eth_abi import encode, decode
from eth_utils import keccak, is_address, to_checksum_address

CHAIN_ID = 56
MANAGER = '0x5c952063c7fc8610FFDB798152D69F0B9550762b'
BASE = 'https://four.meme/meme-api/v1'
SELECTOR = keccak(text='createToken(bytes,bytes)')[:4]


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def wei(value):
    try:
        d = Decimal(str(value))
        if not d.is_finite() or d < 0 or d > 1 or d * 10**18 != int(d * 10**18):
            raise ValueError('Invalid BNB amount')
        return int(d * 10**18)
    except (InvalidOperation, TypeError):
        raise ValueError('Invalid BNB amount') from None


def hexbytes(value):
    if not isinstance(value, str):
        raise ValueError('Missing encoded creation payload')
    s = value.removeprefix('0x')
    if not s or len(s) % 2 or len(s) > 131072:
        raise ValueError('Invalid encoded creation payload')
    try:
        return bytes.fromhex(s)
    except ValueError:
        raise ValueError('Invalid hex payload') from None


def build_transaction(address, arg, signature, value):
    if not is_address(address):
        raise ValueError('Invalid creator wallet')
    args, sig = hexbytes(arg), hexbytes(signature)
    if len(sig) != 65:
        raise ValueError('Invalid platform signature length')
    return {'chainId': CHAIN_ID, 'from': to_checksum_address(address), 'to': MANAGER,
            'data': '0x' + (SELECTOR + encode(['bytes', 'bytes'], [args, sig])).hex(),
            'value': hex(wei(value))}


def validate_transaction(tx, expected):
    from .flap import PORTAL, validate_transaction as validate_flap
    if tx.get('to') == PORTAL: return validate_flap(tx, expected)
    if set(tx) != {'chainId', 'from', 'to', 'data', 'value'}:
        raise ValueError('Unexpected transaction fields')
    if tx != expected or tx['chainId'] != CHAIN_ID or tx['to'] != MANAGER:
        raise ValueError('Transaction does not match the pinned plan')
    raw = hexbytes(tx['data'])
    if raw[:4] != SELECTOR:
        raise ValueError('Not a Four.meme createToken call')
    a, s = decode(['bytes', 'bytes'], raw[4:])
    if raw != SELECTOR + encode(['bytes', 'bytes'], [a, s]):
        raise ValueError('Non-canonical calldata')
    if not is_address(tx['from']) or len(s) != 65 or not 0 <= int(tx['value'], 16) <= wei('1'):
        raise ValueError('Creation value exceeds the hard cap')


def select_bnb_config(data):
    """Select the published BSC BNB preset, never synthesize internal raise parameters."""
    found = []
    def walk(v):
        if isinstance(v, dict):
            if v.get('symbol') == 'BNB' and v.get('networkCode') == 'BSC' and 'totalBAmount' in v:
                if v.get('status') == 'PUBLISH':
                    found.append(v)
            else:
                for child in v.values(): walk(child)
        elif isinstance(v, list):
            for child in v: walk(child)
    walk(data)
    unique = {digest(v): v for v in found}
    if len(unique) != 1:
        raise ValueError('Four.meme BNB preset missing or ambiguous; refusing to guess')
    preset = next(iter(unique.values()))
    if 'deployCost' not in preset:
        raise ValueError('Four.meme did not publish the creation cost')
    wei(preset['deployCost'])
    return preset


async def four(path, body=None, token=None, files=None):
    headers = {'meme-web-access': token} if token else {}
    async with httpx.AsyncClient(timeout=25, follow_redirects=False) as client:
        if files:
            r = await client.post(BASE + path, files=files, headers=headers)
        elif body is not None:
            r = await client.post(BASE + path, json=body, headers=headers)
        else:
            r = await client.get(BASE + path, headers=headers)
        if r.status_code == 403:
            raise ValueError('Four.meme denied access (403). Check platform availability for your location; no launch plan was created.')
        r.raise_for_status()
        payload = r.json()
    if str(payload.get('code')) != '0' or 'data' not in payload:
        raise ValueError('Four.meme rejected the request: ' + str(payload.get('msg', 'unknown error'))[:200])
    return payload['data']


async def rpc(method, params):
    async with httpx.AsyncClient(timeout=20) as client:
        from .network import read_request
        url = os.getenv('BSC_RPC_URL', 'https://bsc-dataseed.bnbchain.org')
        body = {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}
        readonly = {'eth_chainId', 'eth_getCode', 'eth_call', 'eth_estimateGas', 'eth_gasPrice',
                    'eth_getBalance', 'eth_getTransactionCount', 'eth_getTransactionByHash',
                    'eth_getTransactionReceipt', 'eth_getBlockByNumber', 'eth_blockNumber'}
        if method in readonly:
            r = await read_request(client, 'POST', url, json=body)
        else:
            r = await client.post(url, json=body)
        r.raise_for_status()
        payload = r.json()
    if 'error' in payload:
        raise ValueError('BSC RPC: ' + str(payload['error'].get('message', 'request failed'))[:240])
    return payload['result']


async def preflight(tx):
    if int(await rpc('eth_chainId', []), 16) != CHAIN_ID:
        raise ValueError('RPC is not BSC mainnet')
    validate_transaction(tx, tx)
    if await rpc('eth_getCode', [tx['to'], 'latest']) in ('0x', '0x0'):
        raise ValueError('TokenManager2 has no deployed bytecode')
    call = {k: tx[k] for k in ('from', 'to', 'data', 'value')}
    simulated = await rpc('eth_call', [call, 'pending'])
    from .flap import PORTAL, TUPLE, predict
    if tx['to'] == PORTAL:
        fields = decode([TUPLE], bytes.fromhex(tx['data'][10:]))[0]
        predicted = predict(fields[4])
        if decode(['address'], bytes.fromhex(simulated[2:]))[0].lower() != predicted.lower():
            raise ValueError('Flap simulation returned an unexpected token address')
    gas = int(await rpc('eth_estimateGas', [call]), 16)
    price = int(await rpc('eth_gasPrice', []), 16)
    balance = int(await rpc('eth_getBalance', [tx['from'], 'pending']), 16)
    gas_limit = gas * 125 // 100
    if balance < gas_limit * price + int(tx['value'], 16):
        raise ValueError('Wallet has insufficient BNB for creation and gas')
    return {'gas': gas_limit, 'gasPrice': price, 'maxCostWei': str(gas_limit * price + int(tx['value'], 16))}


async def verify_receipt(plan, tx_hash, confirmations=2):
    """Only a matching, canonically included TokenCreate is a verified launch."""
    if int(await rpc('eth_chainId', []), 16) != CHAIN_ID: raise ValueError('RPC is not BSC mainnet')
    transaction, receipt = await asyncio.gather(rpc('eth_getTransactionByHash', [tx_hash]),
                                               rpc('eth_getTransactionReceipt', [tx_hash]))
    if not transaction or not receipt: return None
    expected = plan['transaction']
    if (transaction['hash'].lower() != tx_hash.lower() or receipt['transactionHash'].lower() != tx_hash.lower()
        or transaction['from'].lower() != expected['from'].lower()
        or (transaction.get('to') or '').lower() != expected['to'].lower()
        or transaction['input'].lower() != expected['data'].lower()
        or int(transaction['value'], 16) != int(expected['value'], 16)):
        raise ValueError('Receipt does not belong to the pinned transaction')
    height, block = await asyncio.gather(rpc('eth_blockNumber', []),
                                        rpc('eth_getBlockByNumber', [receipt['blockNumber'], False]))
    if not block or block['hash'].lower() != receipt['blockHash'].lower(): return None
    if int(height, 16) - int(receipt['blockNumber'], 16) + 1 < confirmations: return None
    if int(receipt['status'], 16) != 1:
        return {'state': 'reverted', 'hash': tx_hash, 'block': str(int(receipt['blockNumber'], 16))}
    if plan.get('schemaVersion') == 3:
        from .flap import receipt_event
        return await receipt_event(plan, receipt, tx_hash)
    topic = '0x' + keccak(text='TokenCreate(address,address,uint256,string,string,uint256,uint256,uint256)').hex()
    matches = []
    for log in receipt['logs']:
        if log.get('removed') or log['address'].lower() != MANAGER.lower() or log['topics'] != [topic]: continue
        event = decode(['address', 'address', 'uint256', 'string', 'string', 'uint256', 'uint256', 'uint256'], hexbytes(log['data']))
        if (event[0].lower() == expected['from'].lower() and event[3] == plan['manifest']['name']
            and event[4] == plan['manifest']['symbol'] and int(event[1], 16) != 0):
            matches.append(event)
    if len(matches) != 1: raise ValueError('Exactly one matching TokenCreate event is required')
    event = matches[0]
    return {'state': 'confirmed', 'hash': tx_hash, 'token': to_checksum_address(event[1]),
            'requestId': str(event[2]), 'block': str(int(receipt['blockNumber'], 16)),
            'taxVerified': False, 'note': 'Creation event verified; tax configuration requires a separate on-chain read.'}
