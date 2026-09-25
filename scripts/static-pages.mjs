import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const base=readFileSync('dist-public/index.html','utf8');
const pages={music:['Music studio','Compose eight notes. Hear a virtual rat play them through real target hits. Save, share and remix the recorded attempt.'],create:['Mission studio','Design eight targets. Submit a real neural experiment and share its saved result.'],live:['Live experiment','Watch RAT LAB neural inference, recorded sessions and replay verification.'],buyback:['Buyback ledger','Trace simulated BNB allocations from verified neural runs. Real purchases are disabled.'],challenge:['Aim Eight challenge','Try the same eight targets as R-01. Compare your local practice score to a recorded neural run.']};
for(const [route,[title,description]] of Object.entries(pages)){
 const html=base.replace(/<title>.*?<\/title>/,`<title>RAT LAB · ${title}</title>`).replace(/(<meta name="description" content=")[^"]*/,`$1${description}`).replace(/(<meta property="og:title" content=")[^"]*/,`$1RAT LAB · ${title}`).replace(/https:\/\/rat-lab\.fun\/(?=")/g,`https://rat-lab.fun/${route}`);
 mkdirSync(`dist-public/${route}`,{recursive:true});writeFileSync(`dist-public/${route}/index.html`,html);
}
