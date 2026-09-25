/** Add a new listening client; do not rebuild or modify the minted archives. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createTransport } from './compatible-transport.mjs';
const root = new URL('../../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const hash = b => createHash('sha256').update(b).digest('hex');
const index = JSON.parse(read('public/first-takes/index.json'));
const core = read('src/lib/firstTakesCore.js');
const license = read('public/first-takes/LICENSE.txt');
const out = new URL('public/first-takes/listen-v2/', root);
mkdirSync(out, { recursive: true });
const tracks = [];
for (const track of index.tracks) {
  if (hash(core) !== track.rendererSha256) throw Error('Archived renderer changed.');
  if (hash(read('public/first-takes/' + track.id + '/player.html')) !== track.playerSha256) throw Error('Archived player changed.');
  const html = player(track);
  writeFileSync(new URL(track.id + '.html', out), html);
  tracks.push({ id: track.id, path: `/first-takes/listen-v2/${track.id}.html`, playerSha256: hash(html), archivedPlayerSha256: track.playerSha256, wavSha256: track.wavSha256, scoreSha256: track.scoreSha256 });
}
writeFileSync(new URL('index.json', out), JSON.stringify({ version: 'listen-v2', note: 'Off-chain compatibility player. Original on-chain HTML, score, WAV and ZIP fingerprints remain unchanged.', tracks }, null, 2) + '\n');
console.log('Built four self-contained compatibility players; original archive fingerprints preserved.');
function player(m) {
  const data = JSON.stringify(m).replaceAll('<', '\\u003c');
  return `<!doctype html>
<!-- ${license} -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; media-src blob:; img-src data:; connect-src 'none'">
<title>${m.title} · RAT LAB listening room</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#110d18;color:#f6effb;font:16px system-ui,sans-serif}main{max-width:940px;margin:auto;padding:clamp(24px,6vw,72px) 24px}header{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #3a2c48;padding-bottom:24px}small,.eyebrow{font:11px monospace;letter-spacing:.1em;color:#ddbf62}h1{font-size:clamp(40px,8vw,80px);line-height:1.06;letter-spacing:-.055em;margin:45px 0 20px}p{color:#bbafc9;line-height:1.7;max-width:65ch}#art{border:1px solid #473352;background:#1a1224;margin:30px 0}#art svg{display:block;width:100%;max-height:340px}.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap}button,.download{font:inherit;min-height:48px;padding:13px 22px;border:1px solid #665135;border-radius:4px;background:#efc54b;color:#1a1224;cursor:pointer}#restart{background:transparent;color:#e8daee;border-color:#4a3859}button:disabled{opacity:.35;cursor:default}button:hover:enabled{filter:brightness(1.08)}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid #f6d877;outline-offset:5px}#clock{margin-left:auto;font:13px monospace;font-variant-numeric:tabular-nums;color:#c7b8d4}input{width:100%;accent-color:#efc54b;min-height:40px}#status{font-size:13px;min-height:44px}.downloads{display:flex;gap:24px;flex-wrap:wrap;border-top:1px solid #3a2c48;padding-top:24px}a{color:#efc54b;text-underline-offset:5px}a[hidden]{display:none}details{margin-top:35px;border-top:1px solid #3a2c48;padding:24px 0}summary{cursor:pointer}code{font:11px monospace;overflow-wrap:anywhere}#progress{height:3px;background:#efc54b;transform-origin:left;transform:scaleX(0)}footer{margin-top:35px;color:#a99bb8;font-size:12px;line-height:1.7}@media(max-width:480px){#clock{width:100%;margin:10px 0}header{font-size:12px}h1{margin-top:30px}}
</style></head><body><main>
<header><small>RAT LAB / FIRST TAKES</small><span class="eyebrow">LISTENING ROOM 02</span></header>
<h1>${m.title}</h1><p>A movement, kept as music. Rebuild the exact recording here, then listen without a website, wallet or network connection.</p>
<div id="art"></div><div id="progress"></div>
<p class="eyebrow">${m.events.length} NOTES / ${m.mappingVersion.toUpperCase()}</p>
<div class="controls"><button id="build">Rebuild & verify</button><button id="play" disabled>Play recording</button><button id="restart" disabled>Restart</button><span id="clock">0.00s / ${(m.durationMs / 1000).toFixed(2)}s</span></div>
<label for="position">Playback position</label><input type="range" id="position" min="0" max="${m.durationMs / 1000}" step="0.02" value="0" disabled>
<p id="status" role="status">Ready to rebuild. Playback starts only when you press Play.</p>
<div class="downloads"><a id="wav" hidden download="${m.id}.wav">Save verified WAV</a><a href="https://rat-lab.fun/first-takes?take=${m.id}">Explore the source recording</a></div>
<details><summary>What is preserved?</summary><p>This compatibility player uses Web Audio and custom controls. It rebuilds the same archived score and exact WAV; it is a new off-chain listening client, not a replacement for the immutable on-chain HTML.</p><p>Behavior sonification maps recorded movement to pitch, timing and velocity. This is not a trained music policy. Local hash checks establish consistency, not independent proof of neural execution.</p><p>Score SHA-256<br><code>${m.scoreSha256}</code></p><p>WAV SHA-256<br><code>${m.wavSha256}</code></p><p>Original on-chain player SHA-256<br><code>${m.playerSha256}</code></p><p>The original ZIP and its source-verification script remain available on the work page. Keep this HTML using your browser’s Save action, or download it from the collection page.</p></details>
<footer>Free research preview · BSC testnet archive · No sale or copyright transfer.<br>Original synthesis and player code © RAT LAB contributors, MIT licensed. <a href="https://github.com/fefethefly/rat-lab-bsc">Source & license</a></footer>
<script type="module">
${core.replaceAll('export ', '')}
${createTransport.toString()}
const manifest=${data};
const $=id=>document.getElementById(id);
$('art').innerHTML=coverSvg(manifest.events,manifest.title);
let transport, wav, wavUrl, frame=0;
function paint() { if(!transport)return;const s=transport.state();$('play').textContent=s.playing?'Pause recording':'Play recording';$('position').value=s.position;$('clock').textContent=s.position.toFixed(2)+'s / '+s.duration.toFixed(2)+'s';$('progress').style.transform='scaleX('+(s.position/s.duration)+')';if(!s.playing&&s.position>=s.duration)$('status').textContent='Recording finished. Press Play to listen again.';cancelAnimationFrame(frame);if(s.playing)frame=requestAnimationFrame(paint); }
$('build').onclick=async()=>{const b=$('build');b.disabled=true;try{const bytes=renderWav(manifest.events);if(await sha256(bytes)!==manifest.wavSha256||await sha256(packEvents(manifest.events))!==manifest.scoreSha256)throw Error('Fingerprint mismatch');wav=bytes;if(wavUrl)URL.revokeObjectURL(wavUrl);wavUrl=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));$('wav').href=wavUrl;$('wav').hidden=false;$('play').disabled=false;b.textContent='Fingerprints verified';$('status').textContent='Verified locally. Exact score and WAV match the archive. Press Play to listen.';}catch(e){$('status').textContent='Rebuild failed: '+e.message;b.disabled=false;}};
$('play').onclick=async()=>{const b=$('play');b.disabled=true;try{if(!transport){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio is unavailable. Use Save verified WAV.');const context=new C();try{await context.resume();const buffer=await context.decodeAudioData(wav.slice().buffer);transport=createTransport(context,buffer,paint);$('restart').disabled=false;$('position').disabled=false;}catch(e){await context.close();throw e;}}if(transport.state().playing)transport.pause();else if(!document.hidden)await transport.play();$('status').textContent=transport.state().playing?'Playing the verified recording.':'Recording paused.';paint();}catch(e){$('status').textContent='Playback could not start: '+e.message;}finally{b.disabled=false;}};
$('position').oninput=()=>{transport.seek(Number($('position').value));$('status').textContent='Position selected. Press Play to continue.';paint();};
$('restart').onclick=()=>{transport.seek(0);$('status').textContent='Back to the beginning. Press Play to listen.';paint();};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&transport){transport.pause();$('status').textContent='Paused while this page is hidden. Press Play to continue.';}});
window.addEventListener('pagehide',()=>{if(transport)transport.pause();cancelAnimationFrame(frame);});
</script></main></body></html>`;
}
