import asyncio
import io
import json
import os
import secrets
import threading
import time
import httpx
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from PIL import Image
from eth_account import Account
from eth_account.messages import encode_defunct
from .brain import BrainRun, STEPS, ROOT
from .chain import four, select_bnb_config, build_transaction, preflight, digest, validate_transaction, rpc, MANAGER, wei, verify_receipt
from .launch_plan import Manifest, approval_hash, check_plan, payload_for

DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
app = FastAPI(title='RAT LAB BSC control plane', docs_url='/api/docs')
OWNER = secrets.token_urlsafe(32)
clients = set()
run = None
state = {'status': 'standby', 'events': [], 'runId': None, 'hits': 0, 'step': -1, 'commit': None}
auth = {}
plans = {}
# Recover the latest saved session for local inspection after a server restart.
latest = DATA / 'latest.json'
if latest.exists():
    try:
        run_id = json.loads(latest.read_text())['runId']
        if not run_id.startswith('bsc_') or '/' in run_id or '..' in run_id: raise ValueError('Invalid run id')
        folder = DATA / run_id
        saved = folder / 'result.json'
        if saved.exists():
            state.update(json.loads(saved.read_text()))
            state['events'] = [json.loads(line) for line in (folder / 'events.jsonl').read_text().splitlines() if line]
            if (folder / 'plan.json').exists():
                p = json.loads((folder / 'plan.json').read_text()); plans[p['id']] = p
            if (folder / 'receipt.json').exists(): state['receipt'] = json.loads((folder / 'receipt.json').read_text())
    except (ValueError, KeyError, OSError): pass


def allowed_origin(origin):
    u = urlparse(origin or '')
    return u.scheme == 'http' and u.hostname in ('localhost', '127.0.0.1') and u.port in (5173, 8000, 4173)


@app.middleware('http')
async def guard(req: Request, call_next):
    if req.url.path.startswith('/api/four/'):
        return JSONResponse({'detail': 'Four.meme retired for this project; use Flap.'}, status_code=410)
    if req.url.path.startswith('/api'):
        if req.url.hostname not in ('localhost', '127.0.0.1'):
            return JSONResponse({'detail': 'Local control plane only'}, status_code=403)
        origin = req.headers.get('origin')
        if origin and not allowed_origin(origin):
            return JSONResponse({'detail': 'Origin refused'}, status_code=403)
        if req.method not in ('GET', 'HEAD', 'OPTIONS'):
            if not secrets.compare_digest(req.headers.get('x-rat-owner', ''), OWNER):
                return JSONResponse({'detail': 'Owner session required'}, status_code=403)
    return await call_next(req)


@app.exception_handler(ValueError)
async def invalid(req, exc):
    return JSONResponse({'detail': str(exc)[:300]}, status_code=400)


@app.exception_handler(httpx.HTTPError)
async def upstream_unavailable(req, exc):
    return JSONResponse({'detail': 'Flap or BSC RPC is currently unreachable. No transaction was signed by this server.'}, status_code=502)


@app.get('/api/status')
async def status():
    return {**state, 'ownerToken': OWNER, 'mainnetEnabled': os.getenv('ENABLE_MAINNET_PREPARE') == '1',
            'steps': STEPS, 'chainId': 56, 'runtime': 'MuJoCo + two PPO networks'}


@app.get('/api/launch-draft')
async def launch_draft():
    return json.loads((ROOT / 'config/mainnet-draft.json').read_text())


class DraftUpdate(BaseModel):
    manifest: Manifest


@app.post('/api/launch-draft')
async def save_launch_draft(body: DraftUpdate):
    # Saving a draft never prepares, signs or authorizes a transaction.
    import tempfile
    target = ROOT / 'config/mainnet-draft.json'
    saved = json.loads(target.read_text())
    saved.update(manifest=body.manifest.pinned(), status='draft_saved_not_authorized',
                 pending=['final operator review', 'fresh platform plan and simulation'],
                 updatedAt=time.time())
    with tempfile.NamedTemporaryFile(mode='w', dir=target.parent, prefix='.draft-', delete=False) as f:
        json.dump(saved, f, indent=2, ensure_ascii=False); f.flush(); os.fsync(f.fileno())
        temp = f.name
    os.replace(temp, target)
    return saved


@app.get('/api/readiness')
async def readiness(address: str):
    from .doctor import diagnose
    return await diagnose(address)


async def broadcast(msg):
    if isinstance(msg, dict):
        msg = {**msg, 'at': time.time()}
        kind = msg['type']
        if kind == 'telemetry': state['telemetry'] = msg
        if kind == 'brain': state['commit'] = msg['commit']
        if kind == 'step':
            state['step'] = msg['step']
            if msg['state'] == 'done':
                state['hits'] = msg['step'] + 1
                m = state['manifest']
                prepared = plans.get(m.get('planId'))
                staged = state.setdefault('stagedIntent', {})
                values = [('image', prepared['payload'].get('metaCid', prepared['payload'].get('imgUrl')) if prepared else 'rehearsal-only'),
                          ('name', m['name']), ('symbol', m['symbol']),
                          ('description', m['description'] + ' | brain sha256 ' + (state.get('commit') or '')),
                          ('chainId', 56), ('economics', {'preBuyBnb': m.get('preBuyBnb', '0'), 'flapTax': m.get('flapTax'), 'maxTotalBnb': m.get('maxTotalBnb')})]
                if msg['step'] < 6:
                    key, value = values[msg['step']]; staged[key] = value
                elif msg['step'] == 6:
                    state['intentHash'] = digest(staged)
                elif msg['step'] == 7:
                    state['launchRequested'] = state.get('intentHash') == digest(staged) and len(staged) == 6
        if kind in ('complete', 'aborted', 'error'):
            state['status'] = 'complete' if kind == 'complete' else 'aborted'
            state['proof'] = msg.get('proof')
        if kind not in ('telemetry', 'hello', 'bye'):
            state['events'].append(msg)
            if state.get('runId'):
                with (DATA / state['runId'] / 'events.jsonl').open('a') as f: f.write(json.dumps(msg) + '\n')
        if kind in ('complete', 'aborted'):
            (DATA / state['runId'] / 'result.json').write_text(json.dumps({k: v for k, v in state.items() if k != 'events'}, indent=2))
    stale = []
    for ws in list(clients):
        try:
            if isinstance(msg, bytes): await asyncio.wait_for(ws.send_bytes(msg), .3)
            else: await asyncio.wait_for(ws.send_json(msg), .3)
        except Exception: stale.append(ws)
    for ws in stale: clients.discard(ws)


@app.websocket('/ws/live')
async def stream(ws: WebSocket):
    if not allowed_origin(ws.headers.get('origin')):
        await ws.close(code=1008); return
    await ws.accept(); clients.add(ws)
    await ws.send_json({'type': 'status', 'live': state['status'] == 'running',
                        'hello': {'source': 'inference', 'task': 'steer', 'run': state.get('runId'),
                                  'label': 'BSC rehearsal · live neural inference', 'fps': 25}})
    try:
        while True: await ws.receive_text()
    except (WebSocketDisconnect, RuntimeError): pass
    finally: clients.discard(ws)


@app.post('/api/run')
async def start(body: Manifest):
    global run
    if state['status'] == 'running' or (run and run.is_alive()): raise HTTPException(409, 'A session is already running')
    if body.mode == 'mainnet':
        p = plans.get(body.planId)
        if not p or p['expires'] < time.time(): raise ValueError('Prepare a fresh Flap plan first')
        if p.get('schemaVersion') != 3: raise ValueError('Old Four plan cannot be launched')
        check_plan(p, p['approvalHash'], p['transaction']['from'])
        if p['manifest'] != body.pinned():
            raise ValueError('Manifest changed after preparation')
    run_id = 'bsc_' + time.strftime('%Y%m%dT%H%M%S') + '_' + secrets.token_hex(3)
    out = DATA / run_id; out.mkdir()
    latest.write_text(json.dumps({'runId': run_id}))
    state.clear(); state.update({'status': 'running', 'events': [], 'runId': run_id, 'hits': 0, 'step': -1,
                                'commit': None, 'manifest': body.model_dump(), 'proof': None})
    (out / 'manifest.json').write_text(body.model_dump_json(indent=2))
    if body.mode == 'mainnet':
        (out / 'plan.json').write_text(json.dumps(plans[body.planId], indent=2))
    loop = asyncio.get_running_loop()
    # A bounded queue serializes events and frames; no concurrent websocket sends.
    queue = asyncio.Queue(maxsize=256)
    def enqueue(msg):
        if queue.full():
            if isinstance(msg, bytes): return
            # Make room for terminal events; a dropped video frame is recoverable.
            queue.get_nowait()
        queue.put_nowait(msg)
    async def consume():
        while True:
            item = await queue.get()
            if item is None: break
            await broadcast(item)
    asyncio.create_task(consume())
    engine = BrainRun(run_id, body.seed, lambda msg: loop.call_soon_threadsafe(enqueue, msg), out)
    def worker():
        try: engine.run()
        except Exception as exc:
            loop.call_soon_threadsafe(enqueue, {'type': 'error', 'message': f'Brain runtime failed: {type(exc).__name__}: {str(exc)[:180]}'})
        finally: loop.call_soon_threadsafe(enqueue, None)
    run = threading.Thread(target=worker, daemon=True)
    run.engine = engine
    run.start()
    return {'runId': run_id}


@app.post('/api/stop')
async def stop():
    if run and run.is_alive(): run.engine.stop()
    return {'stopping': True}


@app.get('/api/proof')
async def proof():
    if not state.get('runId'): raise HTTPException(404, 'No session recorded yet')
    return {**state, 'manifestHash': digest(state['manifest']), 'txBroadcast': bool(state.get('receipt')),
            'note': 'A session digest is not an on-chain receipt. Replay validation is a separate command.'}


def enabled():
    if os.getenv('ENABLE_MAINNET_PREPARE') != '1':
        raise HTTPException(403, 'Mainnet preparation is disabled. Set ENABLE_MAINNET_PREPARE=1 on the local server.')


class Login(BaseModel):
    address: str
    signature: str | None = None


@app.post('/api/four/nonce')
async def nonce(body: Login):
    enabled()
    from eth_utils import is_address
    if not is_address(body.address): raise ValueError('Invalid wallet address')
    n = await four('/private/user/nonce/generate', {'accountAddress': body.address, 'verifyType': 'LOGIN', 'networkCode': 'BSC'})
    auth[body.address.lower()] = {'nonce': n, 'expires': time.time() + 300}
    return {'message': f'You are sign in Meme {n}'}


@app.post('/api/four/login')
async def login(body: Login):
    enabled(); a = auth.get(body.address.lower())
    if not a or a['expires'] < time.time() or not a.get('nonce'): raise ValueError('Login nonce expired')
    recovered = Account.recover_message(encode_defunct(text=f"You are sign in Meme {a['nonce']}"), signature=body.signature)
    if recovered.lower() != body.address.lower(): raise ValueError('Wallet signature mismatch')
    token = await four('/private/user/login/dex', {'region': 'WEB', 'langType': 'EN', 'loginIp': '', 'inviteCode': '',
                      'verifyInfo': {'address': body.address, 'networkCode': 'BSC', 'signature': body.signature, 'verifyType': 'LOGIN'}, 'walletName': 'MetaMask'})
    auth[body.address.lower()] = {'token': token, 'expires': time.time() + 1800}
    return {'authenticated': True}


def authenticated(address):
    a = auth.get(address.lower())
    if not a or not a.get('token') or a['expires'] < time.time(): raise HTTPException(401, 'Connect and sign in to Four.meme first')
    return a


@app.post('/api/four/image')
async def upload(address: str, file: UploadFile = File(...)):
    enabled(); a = authenticated(address)
    raw = await file.read(4 * 1024 * 1024 + 1)
    if len(raw) > 4 * 1024 * 1024: raise ValueError('Image must be under 4 MB')
    image = Image.open(io.BytesIO(raw)); image.verify()
    if image.format not in ('PNG', 'JPEG', 'WEBP'): raise ValueError('Use PNG, JPEG or WebP')
    extension = {'PNG': 'png', 'JPEG': 'jpg', 'WEBP': 'webp'}[image.format]
    mime = {'PNG': 'image/png', 'JPEG': 'image/jpeg', 'WEBP': 'image/webp'}[image.format]
    image_url = await four('/private/token/upload', token=a['token'], files={'file': ('rat.' + extension, raw, mime)})
    a['image'] = image_url
    return {'imageUrl': image_url}


def require_reference_compatibility():
    draft = json.loads((ROOT / 'config/mainnet-draft.json').read_text())
    if draft.get('referenceEconomics', {}).get('status') == 'blocked_pending_platform_compatibility':
        raise ValueError('Original launch used 2% creator tax. Resolve Four.meme compatibility or explicitly choose an alternative before preparing a transaction.')


class Prepare(BaseModel):
    address: str
    manifest: Manifest


@app.post('/api/four/prepare')
async def prepare(body: Prepare):
    enabled()
    require_reference_compatibility()
    m = body.manifest
    if not m.maxTotalBnb or wei(m.maxTotalBnb) <= 0: raise ValueError('Enter your maximum total BNB budget')
    if wei(m.preBuyBnb): raise ValueError('Pre-buy payment requirements have not been verified; this launch path is blocked until verification')
    a = authenticated(body.address)
    if not a.get('image'): raise ValueError('Upload the token image to Four.meme first')
    from session import Session
    from .brain import VENDOR
    brain = Session(str(VENDOR / 'runs/final/steer.pt'), body.manifest.seed)
    preset = select_bnb_config(await four('/public/config'))
    m = body.manifest
    payload = payload_for(m, a['image'], brain.commit, preset, int(time.time() * 1000))
    creation = await four('/private/token/create', payload, token=a['token'])
    tx = build_transaction(body.address, creation['createArg'], creation['signature'], preset['deployCost'])
    validate_transaction(tx, tx)
    checks = await preflight(tx)
    plan_id = secrets.token_hex(16)
    if int(checks['maxCostWei']) > wei(m.maxTotalBnb): raise ValueError('Creation and gas exceed your total BNB budget')
    plan = {'id': plan_id, 'schemaVersion': 2, 'manifest': m.pinned(),
            'payload': payload, 'transaction': tx, 'transactionHash': digest(tx), 'checks': checks,
            'brainCommit': brain.commit, 'expires': time.time() + 300,
            'notice': 'Four.meme createArg is opaque. Platform signature and successful simulation do not independently prove every metadata field. Review the pinned payload and transaction before authorizing.'}
    plan['approvalHash'] = approval_hash(plan)
    check_plan(plan, plan['approvalHash'], body.address)
    plans[plan_id] = plan
    return plan


@app.post('/api/flap/prepare')
async def prepare_flap(address: str = Form(...), manifest: str = Form(...), file: UploadFile = File(...)):
    enabled()
    from .flap import upload_metadata, prepare_plan
    m = Manifest.model_validate_json(manifest)
    draft = json.loads((ROOT / 'config/mainnet-draft.json').read_text())
    if address.lower() != draft['creator'].lower(): raise ValueError('Use the configured creator wallet')
    if not m.maxTotalBnb or wei(m.maxTotalBnb) <= 0: raise ValueError('Enter an explicit BNB budget')
    if not m.flapTax or m.tax or wei(m.preBuyBnb): raise ValueError('Flap tax settings and zero pre-buy required')
    raw = await file.read(4 * 1024 * 1024 + 1)
    if len(raw) > 4 * 1024 * 1024: raise ValueError('Image must be under 4 MB')
    image = Image.open(io.BytesIO(raw)); image.verify()
    mime = {'PNG':'image/png','JPEG':'image/jpeg','WEBP':'image/webp'}.get(image.format)
    if not mime: raise ValueError('Use PNG, JPEG or WebP')
    from session import Session
    from .brain import VENDOR
    brain = Session(str(VENDOR / 'runs/final/steer.pt'), m.seed)
    uploaded = await upload_metadata(m, address, brain.commit, raw, mime)
    p = await prepare_plan(m, address, brain.commit, uploaded)
    plans[p['id']] = p
    return p


@app.get('/api/transaction')
async def transaction():
    if state['status'] != 'complete' or state['hits'] != len(STEPS) or not state.get('launchRequested'):
        raise HTTPException(409, 'All neural targets must be completed')
    p = plans.get(state['manifest'].get('planId'))
    if not p or p['expires'] < time.time(): raise ValueError('Plan expired; prepare and run again')
    if state['commit'] != p['brainCommit']: raise ValueError('Brain changed after preparation')
    wallet_lock = DATA / 'launch-locks' / (p['transaction']['from'].lower() + '.json')
    if wallet_lock.exists(): raise ValueError('The autonomous runner reserved this wallet; inspect its journal before any wallet submission')
    m = check_plan(p, p['approvalHash'], p['transaction']['from'])
    if p.get('schemaVersion') != 3: raise ValueError('Prepare a fresh Flap plan')
    from .flap import check_live_plan
    await check_live_plan(p)
    p['checks'] = await preflight(p['transaction'])
    if int(p['checks']['maxCostWei']) > wei(m.maxTotalBnb): raise ValueError('Current fees exceed the approved budget')
    return p


class ReceiptRequest(BaseModel):
    hash: str = Field(pattern=r'^0x[0-9a-fA-F]{64}$')


@app.post('/api/receipt')
async def record_receipt(body: ReceiptRequest):
    if state['status'] != 'complete' or state['hits'] != len(STEPS): raise HTTPException(409, 'No completed neural session')
    p = plans.get(state['manifest'].get('planId'))
    if not p: raise ValueError('No prepared mainnet plan')
    result = await verify_receipt(p, body.hash)
    if not result: raise ValueError('Waiting for two canonical BSC confirmations')
    if result['state'] != 'confirmed': raise ValueError('Transaction reverted')
    state['receipt'] = result
    (DATA / state['runId'] / 'receipt.json').write_text(json.dumps(result, indent=2))
    return result


if (ROOT / 'dist').exists():
    app.mount('/', StaticFiles(directory=ROOT / 'dist', html=True), name='frontend')

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8000)
