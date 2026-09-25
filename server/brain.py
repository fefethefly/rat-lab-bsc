"""A real MuJoCo/PPO run. Only successful physical lever clicks advance the rig."""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
os.environ.setdefault('OMP_NUM_THREADS', '1')
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'vendor/labrat'
sys.path[:0] = [str(VENDOR), str(VENDOR / 'live')]

STEPS = ['Token image', 'Token name', 'Ticker symbol', 'Description', 'BNB Chain', 'Tax & pre-buy', 'Review manifest', 'Request launch']
# Normalized coordinates of the fixed virtual launch surface. Not Flap's DOM.
TARGETS = [(0.50, 0.35, 0.14, 0.055), (0.50, 0.43, 0.20, 0.035),
           (0.50, 0.50, 0.20, 0.035), (0.50, 0.57, 0.20, 0.045),
           (0.50, 0.45, 0.16, 0.045), (0.50, 0.52, 0.16, 0.045),
           (0.50, 0.59, 0.16, 0.045), (0.50, 0.64, 0.16, 0.045)]


class BrainRun:
    def __init__(self, run_id, seed, emit, out, realtime=True):
        self.run_id, self.seed, self.emit, self.out = run_id, seed, emit, out
        self.realtime = realtime
        self.stop_event = threading.Event()
        self.session = None
        self.hits = 0

    def stop(self):
        self.stop_event.set()
        if self.session: self.session.stop()

    def run(self):
        from session import Session
        import labrat_frame as lf
        s = Session(str(VENDOR / 'runs/final/steer.pt'), self.seed)
        self.session = s
        index, lit, held_until, pose, frame_count, target_at = 0, False, 2.8, None, 0, 0.0
        self.emit({'type': 'brain', 'commit': s.commit, 'source': 'neural', 'seed': self.seed})
        self.emit({'type': 'hello', 'source': 'inference', 'task': 'steer', 'run': self.run_id,
                   'label': 'BSC launch rehearsal · real PPO inference', 'fps': 25})

        def click(event, inner):
            nonlocal index, lit, held_until
            if not lit or self.stop_event.is_set(): return
            _, x, y, hit = event
            self.emit({'type': 'click', 'step': index, 'x': float(x), 'y': float(y), 'hit': bool(hit)})
            if hit:
                self.hits += 1
                self.emit({'type': 'step', 'step': index, 'state': 'done', 'label': STEPS[index]})
                index += 1
                lit = False
                held_until = inner.t * .02 + .95
                s.hold()

        def frame(inner, phase, info, obs):
            nonlocal lit, pose, frame_count, target_at
            if self.stop_event.is_set(): s.stop(); return
            frame_count += 1
            t = inner.t * .02
            if pose is None: pose = lf.PoseReader(inner.m)
            if phase == 'brain' and not lit and t >= held_until:
                if index == len(STEPS): s.stop(); return
                s.target(*TARGETS[index]); lit = True; target_at = t
                self.emit({'type': 'step', 'step': index, 'state': 'active', 'label': STEPS[index]})
            if lit and t - target_at > 35:
                self.emit({'type': 'error', 'message': 'Target timeout. No launch request was signed.'})
                s.stop()
            if frame_count % 2 == 0:
                target = TARGETS[index] if lit and index < len(STEPS) else None
                packet = lf.pack(float(inner.d.time), index, inner.lever_angle(), bool((info or {}).get('click')),
                                 tuple(float(v) for v in inner.cursor), target, pose(inner.d.qpos))
                self.emit(packet)
            if frame_count % 10 == 0:
                self.emit({'type': 'telemetry', 'simTime': round(t, 2), 'hits': self.hits,
                           'misses': sum(not bool(c[3]) for c in s.clicks),
                           'lever': round(float(inner.lever_angle()), 4), 'cursor': [float(v) for v in inner.cursor]})
        proof, info = s.run(on_step=frame, on_click=click, realtime=self.realtime, max_steps=18000)
        complete = self.hits == len(STEPS) and not self.stop_event.is_set() and not info.get('fell')
        s.save(str(self.out), {'bsc_run_id': self.run_id, 'chain_id': 56,
                             'surface': 'RAT LAB virtual launch surface', 'all_targets_hit': complete})
        self.emit({'type': 'complete' if complete else 'aborted', 'proof': proof,
                   'hits': self.hits, 'message': 'All neural targets hit' if complete else 'Session stopped before completion'})
        self.emit({'type': 'bye'})
