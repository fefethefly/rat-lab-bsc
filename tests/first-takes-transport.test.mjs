import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createTransport} from '../scripts/first-takes/compatible-transport.mjs';
function setup() {
  const nodes=[];
  const context={currentTime:0,state:'running',destination:{},resume:async()=>{},close:async()=>{context.state='closed';},createBufferSource(){
    const n={connect(){},disconnect(){this.disconnected=true;},start(when,offset){this.offset=offset;},stop(){this.stopped=true;},onended:null};nodes.push(n);return n;
  }};
  return {context,nodes,transport:createTransport(context,{duration:10})};
}
test('transport pauses at correct offset, seeks, restarts and stops at end',async()=>{
  const {context,nodes,transport:t}=setup();
  await t.play();context.currentTime=3;assert.equal(t.state().position,3);
  t.pause();context.currentTime=8;assert.deepEqual(t.state(),{playing:false,position:3,duration:10});
  await t.play();assert.equal(nodes[1].offset,3);context.currentTime=9;
  t.seek(6);assert.equal(nodes[1].stopped,true);assert.equal(t.state().position,6);assert.equal(t.state().playing,false);
  await t.play();assert.equal(nodes[2].offset,6);nodes[2].onended();assert.equal(t.state().position,10);
  await t.play();assert.equal(nodes[3].offset,0);t.seek(0);assert.equal(t.state().position,0);
  t.seek(50);assert.equal(t.state().position,10);assert.throws(()=>t.seek(NaN));await t.dispose();
});
test('a pending resume cannot start audio after pause, seek, or disposal',async()=>{
  for(const action of ['pause','seek','dispose']){
    const {context,nodes,transport:t}=setup();let resume;
    context.resume=()=>new Promise(r=>{resume=r;});const pending=t.play();
    if(action==='seek')t.seek(2);else await t[action]();
    resume();await pending;assert.equal(nodes.length,0);assert.equal(t.state().playing,false);
  }
});
test('rapid play calls never create overlapping sources and interruption pauses',async()=>{
  const {context,nodes,transport:t}=setup();await Promise.all([t.play(),t.play()]);assert.equal(nodes.length,1);
  context.currentTime=2;context.state='suspended';context.onstatechange();assert.equal(t.state().playing,false);assert.equal(nodes[0].stopped,true);assert.equal(t.state().position,2);
});
test('compatibility players preserve archive identity and have no native media controls or remote dependencies',()=>{
  const original=JSON.parse(readFileSync('public/first-takes/index.json'));
  const compatible=JSON.parse(readFileSync('public/first-takes/listen-v2/index.json'));
  const hash=b=>createHash('sha256').update(b).digest('hex');
  for(const t of compatible.tracks){
    const archived=original.tracks.find(a=>a.id===t.id);
    const html=readFileSync('public'+t.path,'utf8');
    assert.equal(hash(html),t.playerSha256);assert.equal(t.wavSha256,archived.wavSha256);
    assert.equal(hash(readFileSync('public/first-takes/'+t.id+'/player.html')),t.archivedPlayerSha256);
    assert.equal(hash(readFileSync('public/first-takes/'+t.id+'.zip')),archived.zipSha256);
    assert.ok(html.includes("connect-src 'none'"));assert.ok(html.includes(archived.wavSha256));assert.ok(html.includes('function renderWav'));
    assert.ok(!/<audio\b/i.test(html));assert.ok(!/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(html));
  }
});
