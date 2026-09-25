"""Verify a completed launch and publish only a static, allowlisted website bundle."""
import argparse
import asyncio
import json
import shutil
import subprocess
from pathlib import Path
from .brain import ROOT, VENDOR
from .autolaunch import inspect_journal
from .chain import verify_receipt

async def publish(journal, deploy=False):
    journal=Path(journal).resolve()
    record=json.loads(journal.read_text())
    if record.get('state')!='confirmed': raise ValueError('A confirmed launch journal is required before website release')
    plan=inspect_journal(record,record['approval'])
    if plan.get('schemaVersion')!=3: raise ValueError('Only a verified Flap release can be published')
    receipt=await verify_receipt(plan,record['hash'])
    if not receipt or receipt['state']!='confirmed': raise ValueError('Current BSC receipt verification did not confirm the launch')
    from session import replay
    ok,details=await asyncio.to_thread(replay,str(journal.parent))
    if not ok or record.get('sessionProof')!=details.get('proof'): raise ValueError('Release neural proof does not match the recorded session')
    m=plan['manifest']
    release={'name':m['name'],'symbol':m['symbol'],'description':m['description'],'website':m['webUrl'],'twitter':m['twitterUrl'],
             'token':receipt['token'],'hash':receipt['hash'],'block':receipt['block'],'buyTaxBps':receipt['buyTaxBps'],'sellTaxBps':receipt['sellTaxBps'],
             'proof':record['sessionProof'],'brainCommit':plan['brainCommit'],'hits':8}
    subprocess.run(['npm','run','build:public'],cwd=ROOT,check=True)
    bundle=ROOT/'data/public-site';bundle.mkdir(parents=True,exist_ok=True)
    # Only Vite's static output is sent to Vercel. No source server, journal, private config or key files.
    for item in bundle.iterdir():
        if item.name in ('.vercel', '.env.local', '.vercelignore', '.gitignore'):continue
        if item.is_dir():shutil.rmtree(item)
        else:item.unlink()
    shutil.copytree(ROOT/'dist-public',bundle,dirs_exist_ok=True)
    (bundle/'release.json').write_text(json.dumps(release,indent=2)+'\n')
    (bundle/'vercel.json').write_text(json.dumps({'version':2,'framework':None,'buildCommand':None,'outputDirectory':'.','rewrites':[{'source':'/'+p,'destination':'/'+p+'/index.html'} for p in ('live','buyback','challenge')],'headers':[{'source':'/(.*)','headers':[{'key':'X-Content-Type-Options','value':'nosniff'},{'key':'Referrer-Policy','value':'strict-origin-when-cross-origin'}]},{'source':'/release.json','headers':[{'key':'Cache-Control','value':'public, max-age=60'}]}]},indent=2))
    if deploy:
        scope='caonanya-6913s-projects'
        subprocess.run(['vercel','link','--yes','--project','rat-lab','--scope',scope],cwd=bundle,check=True)
        result=subprocess.run(['vercel','deploy','--prod','--yes','--scope',scope],cwd=bundle,check=True,capture_output=True,text=True)
        print(result.stdout.strip())
        (ROOT/'data/vercel-deployment.txt').write_text(result.stdout)
        draft=json.loads((ROOT/'config/mainnet-draft.json').read_text())
        if draft.get('deployment',{}).get('domainOwnershipVerified'):
            if not draft['deployment'].get('domainAttached'):
                subprocess.run(['vercel','domains','add','rat-lab.fun','rat-lab','--scope',scope],cwd=bundle,check=True)
            checked = subprocess.run(['vercel','domains','verify','rat-lab.fun','--scope',scope],cwd=bundle,check=False)
            if checked.returncode: print('Production deployment succeeded; domain DNS still needs configuration.')
        else: print('Vercel deployed. rat-lab.fun binding waits for domain ownership / DNS information.')
    return release

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--journal',required=True);p.add_argument('--deploy',action='store_true');args=p.parse_args()
    try:print(json.dumps(asyncio.run(publish(args.journal,args.deploy)),indent=2))
    except Exception as e:print('Publish stopped: '+str(e)[:300]);raise SystemExit(1)
if __name__=='__main__':main()
