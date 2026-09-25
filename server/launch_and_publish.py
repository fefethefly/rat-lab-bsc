"""Local operator entry point. Never run this command through an assistant tool."""
import asyncio
import json
import subprocess
from types import SimpleNamespace
from .brain import ROOT
from .flap_prepare import prepare
from .autolaunch import execute
from .publish import publish
from .signer_env import SignerConfigError

async def main():
    draft=json.loads((ROOT/'config/mainnet-draft.json').read_text())
    if draft['manifest']['maxTotalBnb']!='0.02': raise ValueError('Expected the explicitly approved 0.02 BNB budget')
    m=draft['manifest']
    print('RAT LAB / RAT · Flap · BSC mainnet')
    print('Creator:',draft['creator'])
    print('Maximum creation + gas: 0.02 BNB. Pre-buy: 0 BNB.')
    print('Buy / sell tax:',m['flapTax']['buyBps']/100,m['flapTax']['sellBps']/100)
    print('Beneficiary:',m['flapTax']['beneficiary'])
    print('Tax duration / anti-farmer seconds:',m['flapTax']['taxDuration'],m['flapTax']['antiFarmerDuration'])
    print('Fill ~/.rat-lab/mainnet.env locally: private key, RAT_MAX_TOTAL_BNB=0.02, RAT_LIVE=1.')
    print('After confirmed issuance, publish the static site to the existing Vercel rat-lab project.')
    if input('Type LAUNCH to start the real transaction workflow: ').strip()!='LAUNCH':return
    plan_path=ROOT/'data/flap-launch-plan.json'
    await prepare(SimpleNamespace(max_total_bnb='0.02',simulate_only=False,out=str(plan_path)))
    p=json.loads(plan_path.read_text())
    print('Approval:',p['approvalHash'],'Estimated maximum BNB:',int(p['checks']['maxCostWei'])/1e18)
    await execute(SimpleNamespace(plan=str(plan_path),approve=p['approvalHash'],max_total_bnb='0.02',env_file=str(ROOT.home()/'.rat-lab/mainnet.env'),keystore=None))
    journal=ROOT/'data'/('autolaunch_'+p['approvalHash'][:16])/'journal.json'
    await publish(journal,deploy=True)

if __name__=='__main__':
    try:asyncio.run(main())
    except SignerConfigError as e:
        print('Stopped before signing: ' + str(e), flush=True)
        print('Correct ~/.rat-lab/mainnet.env locally. Never send its contents or private key.', flush=True)
        raise SystemExit(1)
    except Exception as e:
        # Signing failures must not expose wallet contents or raw signed transaction bytes.
        print('Stopped:',type(e).__name__,'. Preserve the launch journal; do not start a second launch.')
        raise SystemExit(1)
