"""Public, read-only neural experiment. This process has no signer or owner API."""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
os.environ.setdefault('OMP_NUM_THREADS', '1')
import copy
import hashlib
import json
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = Path(os.getenv('RAT_RUNTIME', str(ROOT / 'vendor/labrat')))
TARGETS = [(0.50, .35, .14, .055), (.50, .43, .20, .035), (.50, .50, .20, .035),
           (.50, .57, .20, .045), (.50, .45, .16, .045), (.50, .52, .16, .045),
           (.50, .59, .16, .045), (.50, .64, .16, .045)]
# Identical settle periods and target rectangles are used in the browser challenge.
RULES = {'id': 'aim-eight-v1', 'targets': [list(t) for t in TARGETS],
         'initialDelayMs': 2800, 'betweenDelayMs': 960, 'targetTimeoutMs': 35000,
         'clock': 'elapsed from first target to final hit, including settle periods',
         'note': 'Human pointer versus neural head/lever control; different input devices, same targets.'}
RULES_HASH = hashlib.sha256(json.dumps(RULES, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
PER_HIT_WEI = 10**12  # Illustrative allocation only. Never a quote or funded obligation.
CAP_WEI = 10**15

def utc():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

def bnb(wei):
    return f'{wei / 10**18:.8f}'

def paper_ledger(runs):
    """Recompute from unique verified proofs: reloads and replays cannot earn twice."""
    seen = set(); rows = []; used = 0
    for run in reversed(runs):
        proof = run.get('proof')
        if not run.get('verified') or not proof or proof in seen: continue
        seen.add(proof)
        eligible = max(0, min(run['hits'], (CAP_WEI - used) // PER_HIT_WEI))
        amount = eligible * PER_HIT_WEI; used += amount
        rows.append({'id': proof[:16], 'runId': run['id'], 'at': run['endedAt'], 'hits': run['hits'],
                     'eligibleHits': eligible, 'amountBnb': bnb(amount), 'proof': proof,
                     'state': 'simulated', 'txHash': None})
    return {'mode': 'SIMULATION', 'executionEnabled': False, 'wallet': None,
            'perHitBnb': bnb(PER_HIT_WEI), 'windowCapBnb': bnb(CAP_WEI),
            'allocatedBnb': bnb(used), 'confirmedBnb': '0', 'confirmedBuys': 0,
            'scope': 'Current service window, up to 24 retained sessions; resets on restart.',
            'note': 'Illustrative BNB budget only. No swap quote, token purchase, or funds reserved.',
            'records': list(reversed(rows))}

class Experiment:
    def __init__(self, output=None, interval=120):
        self.lock = threading.RLock(); self.interval = max(30, interval)
        self.output = Path(output or os.getenv('RAT_DATA', '/tmp/ratlab-observer'))
        self.output.mkdir(parents=True, exist_ok=True)
        self.started = utc(); self.latest = None; self.history = []; self.current = None
        self.phase = 'standby'; self.error = None; self.next_at = None; self.listeners = set()
        self.stop_event = threading.Event()

    def status(self):
        with self.lock:
            return copy.deepcopy({'schemaVersion': 1, 'updatedAt': utc(), 'serviceStartedAt': self.started,
                'phase': self.phase, 'source': 'neural-inference', 'training': False,
                'current': self.current, 'latest': self.latest, 'history': self.history,
                'nextRunAt': self.next_at, 'error': self.error, 'rules': RULES, 'rulesHash': RULES_HASH,
                'buyback': paper_ledger(self.history)})

    def emit(self, packet):
        for listener in list(self.listeners):
            try: listener(packet)
            except Exception: pass

    def run_once(self, seed=2026, realtime=True):
        sys.path[:0] = [str(VENDOR), str(VENDOR / 'live')]
        from session import Session, replay
        import labrat_frame as lf
        import shutil
        run_id = 'aim-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + str(seed)
        folder = self.output / run_id
        s = Session(str(VENDOR / 'runs/final/steer.pt'), seed)
        index = 0; lit = False; ready = 2.8; target_at = 0.; first_at = None
        clicks = []; samples = []; hits = 0; misses = 0; pose = None; count = 0; fail = None
        started = utc()
        with self.lock:
            self.phase = 'running'; self.error = None; self.next_at = None
            self.current = {'id': run_id, 'startedAt': started, 'seed': seed, 'brainCommit': s.commit,
                'hits': 0, 'misses': 0, 'elapsedMs': 0, 'cursor': [.5, .5], 'targetIndex': -1, 'target': None}
        self.emit({'type': 'hello', 'source': 'inference', 'task': 'steer', 'run': run_id,
                   'label': 'RAT LAB Aim Eight · neural inference', 'fps': 25})
        def on_click(event, inner):
            nonlocal index, lit, ready, hits, misses, pose
            if not lit: return
            step, x, y, hit = event
            at = round(inner.t * 20)
            if pose is None: pose = lf.PoseReader(inner.m)
            self.emit(lf.pack(inner.t * .02, index, inner.lever_angle(), True,
                (float(x), float(y)), TARGETS[index], pose(inner.d.qpos)))
            clicks.append({'atMs': at, 'x': float(x), 'y': float(y), 'hit': bool(hit), 'targetIndex': index})
            if hit:
                hits += 1; index += 1; lit = False; ready = inner.t * .02 + .96; s.hold()
            else: misses += 1
        def frame(inner, phase, info, obs):
            nonlocal lit, first_at, target_at, pose, count, fail
            if self.stop_event.is_set(): s.stop(); return
            t = inner.t * .02
            if phase == 'brain' and not lit and t >= ready:
                if index >= 8: s.stop(); return
                s.target(*TARGETS[index]); lit = True; target_at = t
                if first_at is None: first_at = round(t * 1000)
            if lit and t - target_at > 35:
                fail = 'Target timed out'; s.stop()
            count += 1
            target = TARGETS[index] if lit and index < 8 else None
            if count % 2 == 0:
                if pose is None: pose = lf.PoseReader(inner.m)
                self.emit(lf.pack(t, index, inner.lever_angle(), bool((info or {}).get('click')),
                    tuple(float(v) for v in inner.cursor), target, pose(inner.d.qpos)))
            if count % 5 == 0 and phase == 'brain':
                sample = {'atMs': round(t * 1000), 'cursor': [round(float(v), 5) for v in inner.cursor],
                          'targetIndex': index if target else -1, 'hits': hits, 'misses': misses}
                samples.append(sample)
                with self.lock:
                    self.current.update(sample, elapsedMs=max(0, round(t * 1000) - (first_at or round(t * 1000))), target=target)
        proof, info = s.run(on_step=frame, on_click=on_click, realtime=realtime, max_steps=15000)
        s.save(str(folder))
        with self.lock: self.phase = 'verifying'
        self.emit({'type': 'bye'})
        ok, verification = replay(str(folder))
        result = {'id': run_id, 'startedAt': started, 'endedAt': utc(), 'seed': seed,
                  'hits': hits, 'misses': misses, 'complete': hits == 8 and not info.get('fell') and not fail,
                  'durationMs': max(0, clicks[-1]['atMs'] - first_at) if clicks and first_at is not None else 0,
                  'firstTargetMs': first_at or 2800, 'proof': proof, 'brainCommit': s.commit,
                  'rulesHash': RULES_HASH, 'verified': bool(ok), 'verification': verification,
                  'failure': fail or ('Subject fell' if info.get('fell') else None),
                  'samples': samples, 'clicks': clicks}
        with self.lock:
            self.latest = result
            summary = {k:v for k,v in result.items() if k not in ('samples','clicks','verification')}
            self.history.insert(0, summary); self.history = self.history[:24]
            self.current = None; self.phase = 'standby'
            (self.output / 'latest-public.json').write_text(json.dumps(result))
        # Session arrays are temporary for replay verification; no growing disk archive.
        shutil.rmtree(folder)
        return result

    def loop(self):
        count = 0
        while not self.stop_event.is_set():
            try:
                self.run_once(seed=2026 + count, realtime=True); count += 1
            except Exception:
                import logging
                logging.exception('Observer experiment failed')
                with self.lock: self.phase = 'error'; self.current = None; self.error = 'Experiment unavailable. Retrying next window.'
                self.emit({'type': 'bye'})
            with self.lock: self.next_at = datetime.fromtimestamp(time.time()+self.interval, timezone.utc).isoformat()
            self.stop_event.wait(self.interval)
