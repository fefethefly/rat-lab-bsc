"""Bounded, persistent community experiments. No wallet or financial actions."""
import hashlib
import json
import math
import re
import secrets
import sqlite3
import time
from pathlib import Path
from .engine import RULES

class SubmissionError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message); self.status = status

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'))

def validate(payload):
    musical = isinstance(payload, dict) and payload.get('kind') == 'music'
    fields = {'title', 'notes', 'requestId', 'kind'} if musical else {'title', 'targets', 'requestId'}
    if not isinstance(payload, dict) or set(payload) != fields:
        raise SubmissionError('Provide a title, a supported eight-step design and a request ID.')
    title = payload['title']
    if not isinstance(title, str) or not 3 <= len(title.strip()) <= 48 or any(ord(c) < 32 for c in title):
        raise SubmissionError('Use a title of 3–48 characters.')
    key = payload['requestId']
    if not isinstance(key, str) or not re.fullmatch(r'[a-f0-9-]{36}', key):
        raise SubmissionError('Invalid request ID.')
    if musical:
        notes = payload['notes']
        if not isinstance(notes, list) or len(notes) != 8 or any(type(n) is not int or not 0 <= n <= 3 for n in notes):
            raise SubmissionError('Choose exactly eight notes from C, D, E and G.')
        targets = [[.5, [.36,.45,.54,.63][n], .16, .035] for n in notes]
    else:
        targets = payload['targets']
    if not isinstance(targets, list) or len(targets) != 8:
        raise SubmissionError('A mission needs exactly eight targets.')
    for t in targets:
        if not isinstance(t, list) or len(t) != 4 or any(type(n) not in (int, float) or (type(n) is float and not math.isfinite(n)) for n in t):
            raise SubmissionError('Targets must contain four finite numbers.')
        x, y, w, h = t
        if not (.42 <= x <= .58 and .35 <= y <= .64 and .14 <= w <= .20 and .035 <= h <= .055):
            raise SubmissionError('Keep targets within the editor’s supported area and sizes.')
    rules = {**RULES, 'id': 'community-eight-v1', 'targets': targets, 'targetTimeoutMs': 12000, 'sessionTimeoutMs': 60000}
    if musical:
        rules.update(id='music-eight-v1', music={'notes': notes, 'pitches': ['C4','D4','E4','G4'], 'instrument': 'soft-keys-v1', 'previewStepMs': 650})
    return title.strip(), key, rules

class ChallengeStore:
    def __init__(self, folder):
        Path(folder).mkdir(parents=True, exist_ok=True)
        self.path = str(Path(folder) / 'challenges.sqlite3')
        with self.connect() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS challenges (
                id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, payload_hash TEXT NOT NULL,
                client TEXT NOT NULL, created REAL NOT NULL, title TEXT NOT NULL, rules TEXT NOT NULL,
                rules_hash TEXT NOT NULL, state TEXT NOT NULL, result TEXT, meta TEXT, poses BLOB, error TEXT)''')
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15); db.row_factory = sqlite3.Row
        return db
    def recover(self):
        # Never silently rerun a previously started experiment after process death.
        with self.connect() as db:
            db.execute("UPDATE challenges SET state='interrupted', error='The worker restarted during this attempt. Your design is saved; fork it to try again.' WHERE state='running'")
    def submit(self, payload, client):
        title, key, rules = validate(payload)
        fingerprint = hashlib.sha256(canonical({'title': title, 'rules': rules}).encode()).hexdigest()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            previous = db.execute('SELECT id,payload_hash FROM challenges WHERE request_key=?', (key,)).fetchone()
            if previous:
                if previous['payload_hash'] != fingerprint: raise SubmissionError('This request ID belongs to another design.', 409)
                return previous['id']
            now = time.time()
            if db.execute('SELECT count(*) FROM challenges').fetchone()[0] >= 500:
                raise SubmissionError('This beta archive is full. Saved missions remain available.', 503)
            if db.execute("SELECT count(*) FROM challenges WHERE state IN ('queued','running')").fetchone()[0] >= 4:
                raise SubmissionError('The experiment queue is full. Try again after a run finishes.', 429)
            if db.execute('SELECT count(*) FROM challenges WHERE created>?', (now-86400,)).fetchone()[0] >= 24:
                raise SubmissionError('Today’s 24 experiment slots are used. Try again tomorrow.', 429)
            if db.execute('SELECT count(*) FROM challenges WHERE client=? AND created>?', (client,now-3600)).fetchone()[0] >= 3:
                raise SubmissionError('Three experiments per network per hour. Try again later.', 429)
            identifier = secrets.token_hex(10)
            rules_hash = hashlib.sha256(canonical(rules).encode()).hexdigest()
            db.execute('INSERT INTO challenges (id,request_key,payload_hash,client,created,title,rules,rules_hash,state) VALUES (?,?,?,?,?,?,?,?,?)',
                (identifier,key,fingerprint,client,now,title,canonical(rules),rules_hash,'queued'))
            return identifier
    def get(self, identifier):
        with self.connect() as db:
            row = db.execute('SELECT id,created,title,rules,rules_hash,state,result,error FROM challenges WHERE id=?',(identifier,)).fetchone()
            if not row: return None
            ahead = db.execute("SELECT count(*) FROM challenges WHERE state IN ('queued','running') AND created<?",(row['created'],)).fetchone()[0]
            return {'id':row['id'], 'createdAt':row['created'], 'title':row['title'], 'rules':json.loads(row['rules']),
                'rulesHash':row['rules_hash'], 'state':row['state'], 'ahead':ahead, 'error':row['error'],
                'run':json.loads(row['result']) if row['result'] else None}
    def claim(self):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute("SELECT id FROM challenges WHERE state='queued' ORDER BY created LIMIT 1").fetchone()
            if not row: return None
            db.execute("UPDATE challenges SET state='running' WHERE id=?",(row['id'],))
        return self.get(row['id'])
    def finish(self, identifier, result, meta, poses):
        state = 'complete' if result['complete'] and result['verified'] else 'incomplete'
        with self.connect() as db:
            db.execute('UPDATE challenges SET state=?,result=?,meta=?,poses=? WHERE id=?',
                (state,canonical(result),canonical(meta),poses,identifier))
    def fail(self, identifier):
        with self.connect() as db:
            db.execute("UPDATE challenges SET state='error',error='The experiment could not finish. Your design is saved; fork it to try again.' WHERE id=?",(identifier,))
    def artifact(self, identifier, kind):
        column = 'meta' if kind == 'poses.json' else 'poses'
        with self.connect() as db:
            row = db.execute(f'SELECT {column} FROM challenges WHERE id=?', (identifier,)).fetchone()
            return row[0] if row else None

def archive(run, rules, packets, prefix):
    """Capture only this experiment's frames; click packets win duplicate timestamps."""
    import struct
    unique = {}
    for raw in packets:
        t = round(struct.unpack_from('<f', raw, 4)[0], 5)
        if t not in unique or struct.unpack_from('<f', raw, 16)[0] == 1: unique[t] = raw
    frames = [unique[t] for t in sorted(unique)]
    binary = b''.join(frames); origin = min(unique, default=0)
    clicks = [c for c in run['clicks'] if c['hit']]
    end = max(unique, default=0)
    meta = {'label':'RAT LAB · community mission recording', 'fps':25, 'loop_end':end-origin,
        'brain_on_at':0, 'targets':[], 'resets':[], 'timeline':[], 'runId':run['id'], 'proof':run['proof'],
        'binarySha256':hashlib.sha256(binary).hexdigest()}
    for i, target in enumerate(rules['targets']):
        if i > len(clicks): break
        lit = run['firstTargetMs'] if i == 0 else clicks[i-1]['atMs'] + rules['betweenDelayMs']
        hit = clicks[i]['atMs']/1000-origin if i < len(clicks) else None
        meta['targets'].append({'label':f'Target {i+1:02}', 'norm':target, 'lit_at':lit/1000-origin, 'hit_at':hit})
        if hit is not None: meta['resets'].append(hit)
    run['replay'] = {'metaUrl':prefix+'/poses.json', 'binaryUrl':prefix+'/poses.bin',
                     'timeOriginMs':round(origin*1000), 'sha256':meta['binarySha256']}
    return meta, binary
