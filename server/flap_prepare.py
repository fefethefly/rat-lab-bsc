"""Prepare or simulate Flap creation without reading any wallet secret or broadcasting."""
import argparse
import asyncio
import json
from pathlib import Path
from .brain import ROOT, VENDOR
from .launch_plan import Manifest
from .flap import upload_metadata, verify_metadata, metadata, find_salt, build_transaction, prepare_plan, network_check
from .chain import digest, preflight

async def prepare(args):
    draft=json.loads((ROOT/'config/mainnet-draft.json').read_text())
    if draft['platform']!='Flap': raise ValueError('Draft platform must be Flap')
    m=Manifest(**draft['manifest'])
    if args.max_total_bnb: m=Manifest(**{**m.pinned(),'maxTotalBnb':args.max_total_bnb})
    if not args.simulate_only and not m.maxTotalBnb: raise ValueError('Provide --max-total-bnb before creating an authorizable plan')
    from session import Session
    brain=Session(str(VENDOR/'runs/final/steer.pt'),m.seed)
    raw=(ROOT/'public/brand/rat-avatar.png').read_bytes()
    cache=ROOT/'data/flap-metadata.json'
    uploaded=json.loads(cache.read_text()) if cache.exists() else None
    expected=metadata(m,draft['creator'],brain.commit)
    import hashlib
    if not uploaded or uploaded['metadata']!=expected or uploaded['imageSha256']!=hashlib.sha256(raw).hexdigest():
        uploaded=await upload_metadata(m,draft['creator'],brain.commit,raw)
        cache.write_text(json.dumps(uploaded,indent=2))
    print('Checking uploaded Flap metadata and logo...', flush=True)
    await verify_metadata(uploaded)
    print('Checking BSC contracts and estimating gas...', flush=True)
    if args.simulate_only:
        salt,predicted=await asyncio.to_thread(find_salt)
        tx=build_transaction(draft['creator'],m,uploaded['metaCid'],salt)
        result={'kind':'read_only_simulation_not_authorized','platform':'Flap','manifest':m.pinned(),'metadata':uploaded,'deployment':await network_check(),'transaction':tx,'predictedToken':predicted,'checks':await preflight(tx),'transactionBroadcast':False}
    else: result=await prepare_plan(m,draft['creator'],brain.commit,uploaded)
    out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2))
    print(json.dumps({'output':str(out.resolve()),'checks':result['checks'],'approvalHash':result.get('approvalHash'),'transactionBroadcast':False},indent=2))

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--max-total-bnb');p.add_argument('--simulate-only',action='store_true')
    p.add_argument('--out',default='data/flap-launch-plan.json')
    args=p.parse_args()
    try:asyncio.run(prepare(args))
    except Exception as exc: print('Preparation stopped: '+str(exc)[:300]);raise SystemExit(1)
if __name__=='__main__':main()
