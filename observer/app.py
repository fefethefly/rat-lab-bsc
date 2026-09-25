"""Public observation and bounded community experiments. No wallet endpoints."""
import asyncio
import hashlib
import json
import re
import os
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from .challenges import ChallengeStore, SubmissionError
from .engine import Experiment

experiment = Experiment(interval=int(os.getenv('RAT_INTERVAL', '120')))
challenges = ChallengeStore(experiment.output)
@asynccontextmanager
async def lifespan(app):
    worker = threading.Thread(target=experiment.loop, daemon=True); worker.start()
    yield
    experiment.stop_event.set()

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['https://rat-lab.fun','http://127.0.0.1:5173','http://127.0.0.1:4173'], allow_methods=['GET','POST'], allow_headers=['Content-Type','Range'])
@app.get('/health')
def health(): return {'ok': True}
@app.get('/status')
def status(): return JSONResponse(experiment.status(), headers={'Cache-Control':'no-store'})
@app.post('/challenges', status_code=201)
async def create_challenge(request: Request):
    # Bound the streamed body, including chunked requests without Content-Length.
    raw = bytearray()
    async for part in request.stream():
        raw.extend(part)
        if len(raw) > 4096: raise HTTPException(413, 'Design exceeds the request size limit.')
    try:
        payload = json.loads(raw)
        address = request.headers.get('x-forwarded-for', request.client.host if request.client else 'unknown').split(',')[-1].strip()
        client = hashlib.sha256(('ratlab-community-v1:' + address).encode()).hexdigest()
        identifier = challenges.submit(payload, client)
        return {'id': identifier}
    except (json.JSONDecodeError, UnicodeDecodeError): raise HTTPException(400, 'Invalid design JSON.')
    except SubmissionError as exc: raise HTTPException(exc.status, str(exc))

@app.get('/challenges/{identifier}')
def challenge(identifier: str):
    if not re.fullmatch(r'[a-f0-9]{20}', identifier): raise HTTPException(404, 'Mission not found.')
    record = challenges.get(identifier)
    if not record: raise HTTPException(404, 'Mission not found.')
    return JSONResponse(record, headers={'Cache-Control':'no-store'})

@app.get('/challenges/{identifier}/{kind}')
def artifact(identifier: str, kind: str):
    if not re.fullmatch(r'[a-f0-9]{20}', identifier) or kind not in ('poses.json', 'poses.bin'):
        raise HTTPException(404, 'Recording not found.')
    content = challenges.artifact(identifier, kind)
    if content is None: raise HTTPException(404, 'Recording is not ready.')
    return Response(content, media_type='application/json' if kind.endswith('json') else 'application/octet-stream',
                    headers={'Cache-Control':'public, max-age=31536000, immutable'})

@app.websocket('/ws/live')
async def stream(ws: WebSocket):
    if ws.headers.get('origin') not in ('https://rat-lab.fun','http://127.0.0.1:5173','http://127.0.0.1:4173'):
        await ws.close(code=1008); return
    await ws.accept()
    loop=asyncio.get_running_loop(); queue=asyncio.Queue(maxsize=8)
    def enqueue(packet):
        if queue.full(): queue.get_nowait()
        queue.put_nowait(packet)
    def listener(packet): loop.call_soon_threadsafe(enqueue, packet)
    experiment.listeners.add(listener)
    snapshot=experiment.status(); cur=snapshot.get('current')
    await ws.send_json({'type':'state','live':snapshot['phase']=='running','hello':{'source':'inference','task':'steer','run':cur['id'] if cur else None,'fps':25,'label':'RAT LAB Aim Eight · neural inference'}})
    try:
        while True:
            try: packet=await asyncio.wait_for(queue.get(), 15)
            except asyncio.TimeoutError:
                await ws.send_json({'type':'ping'}); continue
            if isinstance(packet, bytes): await ws.send_bytes(packet)
            else: await ws.send_json(packet)
    except (WebSocketDisconnect, RuntimeError, OSError): pass
    finally: experiment.listeners.discard(listener)
