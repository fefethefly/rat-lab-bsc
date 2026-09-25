"""Operator-only launch/recovery. The HTTP server never imports or unlocks this signer."""
import argparse
import asyncio
import getpass
import json
import os
import stat
import time
from pathlib import Path
import rlp
from eth_account import Account
from eth_utils import keccak
from .brain import BrainRun, ROOT, STEPS
from .chain import preflight, rpc, wei, verify_receipt
from .launch_plan import approval_hash, check_plan


def persist(path, value):
    path = Path(path)
    temp = path.with_name(path.name + '.tmp')
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(value, f, indent=2); f.flush(); os.fsync(f.fileno())
    os.replace(temp, path)
    fd = os.open(path.parent, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)


def reserve(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(value, f); f.flush(); os.fsync(f.fileno())
    fd = os.open(path.parent, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)


def unlock(path, expected):
    path = Path(path).expanduser()
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError('Keystore permissions must be 600; restrict access before unlocking')
    encrypted = json.loads(path.read_text())
    address = '0x' + encrypted.get('address', '').removeprefix('0x')
    if address.lower() != expected.lower(): raise ValueError('Keystore address differs from approved creator')
    password = getpass.getpass('Local keystore password (hidden): ')
    try: account = Account.from_key(Account.decrypt(encrypted, password))
    except Exception: raise ValueError('Unable to unlock this keystore') from None
    finally: del password
    if account.address.lower() != expected.lower(): raise ValueError('Decrypted signer differs from approved creator')
    return account


def inspect_journal(record, approved):
    plan = record['plan']
    check_plan(plan, approved, plan['transaction']['from'], allow_expired=True)
    if record['approval'] != approved: raise ValueError('Journal approval does not match')
    raw = bytes.fromhex(record['raw'].removeprefix('0x'))
    if '0x' + keccak(raw).hex() != record['hash']: raise ValueError('Signed transaction hash changed')
    if Account.recover_transaction(raw).lower() != plan['transaction']['from'].lower():
        raise ValueError('Signed transaction belongs to a different creator')
    fields = rlp.decode(raw)
    if len(fields) != 9: raise ValueError('Expected a legacy BSC transaction')
    nonce, price, gas, to, value, data, v = fields[:7]
    integer = lambda x: int.from_bytes(x, 'big')
    tx = plan['transaction']
    if ((integer(v) - 35) // 2 != 56 or '0x' + to.hex() != tx['to'].lower()
        or '0x' + data.hex() != tx['data'].lower() or integer(value) != int(tx['value'], 16)
        or integer(nonce) != record['nonce']):
        raise ValueError('Signed bytes differ from approved transaction')
    if integer(price) * integer(gas) + integer(value) > wei(plan['manifest']['maxTotalBnb']):
        raise ValueError('Signed bytes exceed approved budget')
    return plan


async def observe(journal, record, attempts=90):
    for _ in range(attempts):
        result = await verify_receipt(record['plan'], record['hash'])
        if result:
            record.update(state=result['state'], receipt=result); persist(journal, record)
            print(json.dumps(result), flush=True)
            return result
        if attempts > 1: await asyncio.sleep(2)
    print('Receipt pending. Preserve this journal and use recover; do not start a second launch.')
    return None


async def recover(args):
    journal = Path(args.journal)
    record = json.loads(journal.read_text())
    if not record.get('raw'): raise ValueError('This journal has no signed transaction; nothing to broadcast')
    plan = inspect_journal(record, args.approve)
    result = await observe(journal, record, attempts=1)
    if result or not args.rebroadcast: return
    # Explicit operator recovery reuses the exact signed bytes and nonce, never signs again.
    check_plan(plan, args.approve, plan['transaction']['from'])
    latest = int(await rpc('eth_getTransactionCount', [plan['transaction']['from'], 'latest']), 16)
    if latest > record['nonce']: raise ValueError('Nonce already consumed; inspect the existing transaction')
    result_hash = await rpc('eth_sendRawTransaction', [record['raw']])
    if result_hash.lower() != record['hash'].lower(): raise ValueError('RPC returned an unexpected hash')
    record['state'] = 'submitted'; persist(journal, record)
    await observe(journal, record)


async def execute(args):
    plan = json.loads(Path(args.plan).read_text())
    if plan.get('schemaVersion') != 3: raise ValueError('This project now requires a Flap version-3 plan')
    print('Checking approved plan...', flush=True)
    m = check_plan(plan, args.approve, plan['transaction']['from'])
    if wei(args.max_total_bnb) != wei(m.maxTotalBnb): raise ValueError('CLI budget must equal the approved plan budget')
    if plan.get('schemaVersion') == 3:
        from .flap import check_live_plan
        print('Checking live Flap contracts and metadata...', flush=True)
        await check_live_plan(plan)
    print('Simulating creation transaction...', flush=True)
    checks = await preflight(plan['transaction'])
    if int(checks['maxCostWei']) > wei(m.maxTotalBnb): raise ValueError('Current gas exceeds approved budget')
    if getattr(args, 'env_file', None):
        from .signer_env import load_env_wallet
        print('Checking local signer configuration (values are never displayed)...', flush=True)
        account = load_env_wallet(args.env_file, plan['transaction']['from'], m.maxTotalBnb)
    else:
        account = unlock(args.keystore, plan['transaction']['from'])
    check_plan(plan, args.approve, account.address)
    out = ROOT / 'data' / ('autolaunch_' + args.approve[:16]); out.mkdir(parents=True, exist_ok=True)
    lock_dir = ROOT / 'data' / 'launch-locks'; lock_dir.mkdir(exist_ok=True)
    wallet_lock = lock_dir / (account.address.lower() + '.json')
    record = {'state': 'reserved', 'approval': args.approve, 'plan': plan, 'createdAt': time.time()}
    reserve(wallet_lock, {'approval': args.approve, 'journal': str(out / 'journal.json')})
    journal = out / 'journal.json'
    signed_once = False
    reserved_here = False
    engine = None
    try:
        reserve(journal, record)
        reserved_here = True
        print('Plan reserved. Eight neural targets and a matching replay are required before signing.', flush=True)
        terminal = {}; commit = None
        def emit(event):
            nonlocal commit
            if not isinstance(event, dict): return
            with (out / 'events.jsonl').open('a') as log: log.write(json.dumps(event) + '\n')
            if event['type'] == 'brain': commit = event['commit']
            if event['type'] in ('complete', 'aborted', 'error'): terminal.update(event)
            if event['type'] in ('step', 'complete', 'aborted', 'error'): print(json.dumps(event), flush=True)
        engine = BrainRun(out.name, m.seed, emit, out)
        await asyncio.to_thread(engine.run)
        if terminal.get('type') != 'complete' or terminal.get('hits') != len(STEPS):
            raise ValueError('The rat did not complete the neural session')
        if commit != plan['brainCommit']: raise ValueError('Loaded brain differs from the approved plan')
        from session import replay
        ok, _ = await asyncio.to_thread(replay, str(out))
        if not ok: raise ValueError('Session replay did not match')
        check_plan(plan, args.approve, account.address)
        if plan.get('schemaVersion') == 3: await check_live_plan(plan)
        checks = await preflight(plan['transaction'])
        if int(checks['maxCostWei']) > wei(m.maxTotalBnb): raise ValueError('Gas plus value exceeds approved budget')
        latest, pending = await asyncio.gather(rpc('eth_getTransactionCount', [account.address, 'latest']),
                                              rpc('eth_getTransactionCount', [account.address, 'pending']))
        if latest != pending: raise ValueError('Creator has pending transactions; resolve them before launching')
        nonce = int(pending, 16)
        tx = {**plan['transaction'], 'gas': checks['gas'], 'gasPrice': checks['gasPrice'], 'nonce': nonce}
        tx.pop('from'); tx['value'] = int(tx['value'], 16)
        check_plan(plan, args.approve, account.address)
        signed = account.sign_transaction(tx)
        signed_once = True
        raw = '0x' + bytes(signed.raw_transaction).hex()
        tx_hash = '0x' + keccak(bytes(signed.raw_transaction)).hex()
        record.update(state='signed', raw=raw, hash=tx_hash, nonce=nonce, sessionProof=terminal['proof'])
        inspect_journal(record, args.approve)
        persist(journal, record)  # Durable bytes before any network submission.
        result = await rpc('eth_sendRawTransaction', [raw])
        if result.lower() != tx_hash.lower(): raise ValueError('RPC returned an unexpected transaction hash')
        record['state'] = 'submitted'; persist(journal, record)
        print('Submitted: https://bscscan.com/tx/' + tx_hash, flush=True)
        await observe(journal, record)
    except BaseException:
        if reserved_here and not signed_once:
            record['state'] = 'stopped_before_signing'; persist(journal, record)
        raise
    finally:
        if engine: engine.stop()
        # Once signed, a wallet reservation is retained even on ambiguous RPC failures.
        if not signed_once: wallet_lock.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    launch = commands.add_parser('launch', help='Actual mainnet launch; run locally only after reviewing the plan')
    launch.add_argument('--plan', required=True)
    launch.add_argument('--approve', required=True)
    launch.add_argument('--max-total-bnb', required=True)
    signer = launch.add_mutually_exclusive_group(required=True)
    signer.add_argument('--keystore', help='Encrypted local Ethereum V3 keystore; password is prompted privately')
    signer.add_argument('--env-file', help='Explicit local signer configuration outside the repository; never shell-executed')
    recovery = commands.add_parser('recover', help='Read existing receipt; only --rebroadcast sends saved bytes')
    recovery.add_argument('--journal', required=True)
    recovery.add_argument('--approve', required=True)
    recovery.add_argument('--rebroadcast', action='store_true')
    args = parser.parse_args()
    try: asyncio.run(execute(args) if args.command == 'launch' else recover(args))
    except (KeyboardInterrupt, Exception) as exc:
        # Never print opaque wallet/RPC exception contents or signed raw bytes.
        print('Stopped: ' + type(exc).__name__ + '. No automatic retry. Preserve the launch journal.')
        raise SystemExit(1)


if __name__ == '__main__': main()
