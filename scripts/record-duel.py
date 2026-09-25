"""Record one genuine Aim Eight run and its synchronized body poses. Requires private runtime."""
import json
import sys
import hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from observer.engine import Experiment, RULES, RULES_HASH
out=ROOT/'public/experiment/duel'
out.mkdir(parents=True,exist_ok=True)
frames=[]
e=Experiment(output=ROOT/'data/duel-recording')
e.listeners.add(lambda packet: frames.append(packet) if isinstance(packet,bytes) else None)
run=e.run_once(seed=2026,realtime=False)
assert run['verified'] and run['complete'] and run['hits']==8
# Two packets can share a clock tick; retain the click packet at that instant.
unique={}
for raw in frames:
 f=np.frombuffer(raw,dtype='<f4'); t=round(float(f[1]),5)
 if t not in unique or f[4]==1: unique[t]=raw
frames=[unique[t] for t in sorted(unique)]
binary=b''.join(frames)
t0=float(np.frombuffer(frames[0],dtype='<f4')[1])
clicks=[c for c in run['clicks'] if c['hit']]
meta={'label':'RAT LAB Aim Eight · verified recording','fps':25,'loop_end':(run['firstTargetMs']+run['durationMs']+500)/1000-t0,'brain_on_at':0,'targets':[],'resets':[], 'timeline':[],'runId':run['id'],'proof':run['proof'],'binarySha256':hashlib.sha256(binary).hexdigest()}
for i,(target,click) in enumerate(zip(RULES['targets'],clicks)):
 lit=run['firstTargetMs'] if i==0 else clicks[i-1]['atMs']+RULES['betweenDelayMs']
 meta['targets'].append({'label':f'Target {i+1:02}','norm':target,'lit_at':lit/1000-t0,'hit_at':click['atMs']/1000-t0})
 meta['resets'].append(click['atMs']/1000-t0)
run['replay']={'metaUrl':'/experiment/duel/poses.json','binaryUrl':'/experiment/duel/poses.bin','timeOriginMs':round(t0*1000),'sha256':meta['binarySha256']}
(out/'poses.bin').write_bytes(binary)
(out/'poses.json').write_text(json.dumps(meta))
(out/'run.json').write_text(json.dumps({'run':run,'rules':RULES,'rulesHash':RULES_HASH}))
print(json.dumps({'id':run['id'],'hits':run['hits'],'durationMs':run['durationMs'],'verified':run['verified'],'poses':len(frames),'bytes':len(binary),'timeOriginMs':round(t0*1000)}))
