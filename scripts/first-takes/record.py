"""Record the four predeclared inference attempts. Requires separately licensed runtime."""
import hashlib, json, sys
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from observer.engine import Experiment, RULES
out=ROOT/'data/first-takes'
plan={'version':'first-takes-pilot-v2', 'calibration':'An earlier four-seed baseline checked the pipeline. This batch varies target routes; all four planned attempts are retained.', 'mappingCodeSha256':hashlib.sha256((ROOT/'src/lib/firstTakesCore.js').read_bytes()).hexdigest(), 'routes':[[.35,.40,.45,.50,.55,.60,.64,.50],[.35,.64,.40,.59,.45,.55,.50,.35],[.50,.50,.40,.40,.60,.60,.50,.50],[.64,.59,.54,.49,.44,.39,.35,.50]],'seeds':[7101,7102,7103,7104], 'mapping':'trajectory-keys-v1', 'selection':'All four predeclared attempts retained, including incomplete attempts.', 'createdAt':datetime.now(timezone.utc).isoformat(), 'rules':{**RULES,'id':'first-takes-motion-v1','targetTimeoutMs':12000,'sessionTimeoutMs':30000}}
planfile=out/'plan.json'
if planfile.exists(): plan=json.loads(planfile.read_text())
else: planfile.write_text(json.dumps(plan,indent=2)+'\n')
print(json.dumps({'planSha256':hashlib.sha256(planfile.read_bytes()).hexdigest(),'seeds':plan['seeds']}),flush=True)
for i,seed in enumerate(plan['seeds']):
 target=out/f'source-{i+1:02}.json'
 if target.exists(): print('Already recorded',target.name,flush=True); continue
 e=Experiment(output=out/'temporary')
 rules={**plan['rules'],'targets':[[.5,y,.16,.045] for y in plan['routes'][i]]}
 run=e.run_once(seed=seed,realtime=False,rules=rules,challenge_id=f'first-takes-{i+1}')
 record={'planSha256':hashlib.sha256(planfile.read_bytes()).hexdigest(),'run':run,'rules':rules}
 target.write_text(json.dumps(record,separators=(',',':'))+'\n')
 print(json.dumps({k:run[k] for k in ['id','hits','misses','complete','durationMs','verified']}),flush=True)
