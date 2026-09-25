"""Read-only public status and a bounded viewer socket. No POST or wallet endpoints."""
import asyncio
import os
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .engine import Experiment

experiment = Experiment(interval=int(os.getenv('RAT_INTERVAL', '120')))
@asynccontextmanager
async def lifespan(app):
    worker = threading.Thread(target=experiment.loop, daemon=True); worker.start()
    yield
    experiment.stop_event.set()

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['https://rat-lab.fun','http://127.0.0.1:5173','http://127.0.0.1:4173'], allow_methods=['GET'])
@app.get('/health')
def health(): return {'ok': True}
@app.get('/status')
def status(): return JSONResponse(experiment.status(), headers={'Cache-Control':'no-store'})
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
    await ws.send_json({'type':'status','live':snapshot['phase']=='running','hello':{'source':'inference','task':'steer','run':cur['id'] if cur else None,'fps':25,'label':'RAT LAB Aim Eight · neural inference'}})
    try:
        while True:
            try: packet=await asyncio.wait_for(queue.get(), 15)
            except asyncio.TimeoutError:
                await ws.send_json({'type':'ping'}); continue
            if isinstance(packet, bytes): await ws.send_bytes(packet)
            else: await ws.send_json(packet)
    except (WebSocketDisconnect, RuntimeError, OSError): pass
    finally: experiment.listeners.discard(listener)
