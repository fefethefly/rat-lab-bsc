"""Read-only BSC / Flap readiness report. Never logs in, signs, uploads or sends."""
import argparse
import asyncio
import json
import time
from decimal import Decimal
from eth_utils import is_address, to_checksum_address, keccak
from .brain import ROOT
from .chain import rpc
from .flap import PORTAL as MANAGER, network_check


async def diagnose(address):
    if not is_address(address): raise ValueError('Invalid BSC public address')
    address = to_checksum_address(address)
    report = {'checkedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'creator': address,
              'readyToLaunch': False, 'checks': {}, 'blockers': [], 'transactionBroadcast': False}
    async def bsc():
        chain, balance, latest, pending, code = await asyncio.gather(
            rpc('eth_chainId', []), rpc('eth_getBalance', [address, 'latest']),
            rpc('eth_getTransactionCount', [address, 'latest']), rpc('eth_getTransactionCount', [address, 'pending']),
            rpc('eth_getCode', [MANAGER, 'latest']))
        report['checks']['bsc'] = {'chainId': int(chain, 16), 'balanceBNB': str(Decimal(int(balance, 16)) / 10**18),
            'latestNonce': int(latest, 16), 'pendingNonce': int(pending, 16), 'tokenManager': MANAGER,
            'managerCodeHash': '0x' + keccak(bytes.fromhex(code[2:])).hex()}
        if int(chain, 16) != 56: report['blockers'].append('RPC chain is not BSC mainnet')
        if code in ('0x', '0x0'): report['blockers'].append('TokenManager bytecode is missing')
        if latest != pending: report['blockers'].append('Creator has pending transactions')
    async def platform():
        try:
            report['checks']['flap'] = await network_check()
        except Exception as exc:
            message = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
            report['checks']['flap'] = {'available': False, 'reason': message}
            report['blockers'].append('Flap contract checks failed')
    results = await asyncio.gather(bsc(), platform(), return_exceptions=True)
    if isinstance(results[0], Exception):
        report['checks']['bsc'] = {'available': False, 'reason': type(results[0]).__name__}
        report['blockers'].append('BSC RPC checks failed')
    draft = json.loads((ROOT / 'config/mainnet-draft.json').read_text())
    if draft['creator'].lower() == address.lower():
        report['blockers'].extend('Awaiting ' + item for item in draft.get('pending', []))
    report['blockers'].append('A fresh Flap calldata plan, successful simulation, and local neural run are still required')
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--address', required=True)
    p.add_argument('--out')
    args = p.parse_args()
    report = asyncio.run(diagnose(args.address))
    content = json.dumps(report, indent=2, ensure_ascii=False)
    if args.out:
        from pathlib import Path
        path = Path(args.out); path.parent.mkdir(parents=True, exist_ok=True); path.write_text(content)
    print(content)
