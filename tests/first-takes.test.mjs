import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{deriveEvents,packEvents,unpackEvents,renderWav,coverSvg}from'../src/lib/firstTakesCore.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const index=JSON.parse(readFileSync('public/first-takes/index.json'));
test('four genuine records reconstruct the archived score, exact WAV and cover',()=>{
 assert.equal(index.tracks.length,4);assert.equal(new Set(index.tracks.map(t=>t.wavSha256)).size,4);
 for(const t of index.tracks){const base='public/first-takes/'+t.id+'/',raw=readFileSync(base+'source.json'),source=JSON.parse(raw),events=deriveEvents(source);assert.equal(hash(raw),t.sourceSha256);assert.deepEqual(events,t.events);assert.deepEqual(unpackEvents(packEvents(events)),events);assert.equal(hash(packEvents(events)),t.scoreSha256);assert.equal(hash(renderWav(events)),t.wavSha256);assert.equal(hash(readFileSync(base+'audio.wav')),t.wavSha256);assert.equal(hash(coverSvg(events,t.title.toUpperCase())),t.coverSha256);assert.equal(source.run.verified,true);}
});
test('mapping uses cursor behavior rather than a supplied musical score',()=>{
 const base={run:{verified:true,firstTargetMs:0,durationMs:1000,samples:[{atMs:0,cursor:[.5,.3]},{atMs:200,cursor:[.5,.7]},{atMs:400,cursor:[.5,.3]}]}};
 const a=deriveEvents(base),b=deriveEvents({...base,notes:[0,0,0,0]});assert.deepEqual(a,b);assert.notEqual(a[0][1],a[1][1]);const altered=structuredClone(base);altered.run.samples[0].cursor[0]=.8;assert.notEqual(deriveEvents(altered)[0][3],a[0][3]);
});
test('rejects malformed, unordered, unverified sources and malicious event lengths',()=>{
 assert.throws(()=>deriveEvents({run:{verified:false,samples:[]}}));assert.throws(()=>deriveEvents({run:{verified:true,firstTargetMs:0,durationMs:500,samples:[{atMs:100,cursor:[0,0]},{atMs:100,cursor:[0,0]}]}}));assert.throws(()=>renderWav([[Infinity,60,300,90,1]]));assert.throws(()=>renderWav(Array(65).fill([0,60,300,90,1])));assert.throws(()=>unpackEvents(new Uint8Array(11)));assert.throws(()=>renderWav([[0,127,300,90,1]]));
});
test('integer renderer has stable independent regression vector and valid PCM lengths',()=>{
 const wav=renderWav([[0,60,300,75,0]]),v=new DataView(wav.buffer);assert.equal(new TextDecoder().decode(wav.slice(0,4)),'RIFF');assert.equal(v.getUint32(24,true),22050);assert.equal(v.getUint32(40,true),wav.length-44);assert.equal(wav.length,22094);assert.equal(hash(wav),'ea87e79b1eaab55d775504d7cdeb5100af94ba7e4f231f0b111d4c870bf61aa8');
});
test('offline player contains its renderer and score, no remote dependencies',()=>{
 for(const t of index.tracks){const html=readFileSync('public/first-takes/'+t.id+'/player.html','utf8');assert.ok(html.includes("connect-src 'none'"));assert.ok(!/<(?:script|link|audio)[^>]+(?:src|href)=["']https?:/i.test(html));assert.ok(html.includes('function renderWav'));assert.ok(html.includes(t.wavSha256));assert.ok(Buffer.byteLength(html)<=23000);assert.equal(hash(html),t.playerSha256);}
});
