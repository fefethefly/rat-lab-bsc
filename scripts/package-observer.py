"""Build an allowlisted private deployment bundle, separate from the public repository."""
import argparse
import shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',required=True);args=p.parse_args()
out=Path(args.out).resolve()
if out.exists() and any(out.iterdir()):raise SystemExit('Choose a new empty output directory.')
out.mkdir(parents=True,exist_ok=True)
shutil.copytree(ROOT/'observer',out/'observer',ignore=shutil.ignore_patterns('__pycache__','railway.json'))
shutil.copy(ROOT/'observer/Dockerfile',out/'Dockerfile')
runtime=out/'runtime';runtime.mkdir()
for name in ['session.py','env.py','cursor_env.py','steer_env.py','ptload.py']:
 shutil.copy(ROOT/'vendor/labrat'/name,runtime/name)
shutil.copytree(ROOT/'vendor/labrat/assets',runtime/'assets')
(runtime/'runs/final').mkdir(parents=True)
for name in ['policy.pt','steer.pt']:shutil.copy(ROOT/'vendor/labrat/runs/final'/name,runtime/'runs/final'/name)
(runtime/'live/assets').mkdir(parents=True)
shutil.copy(ROOT/'vendor/labrat/live/labrat_frame.py',runtime/'live/labrat_frame.py')
shutil.copy(ROOT/'vendor/labrat/live/assets/rat.json',runtime/'live/assets/rat.json')
print('Created observer-only bundle at',out)
