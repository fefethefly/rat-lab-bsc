import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/music.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const {takeEvents,previewEvents,pendingEvents,validNotes,musicRecording,encodeWav}=await import(url);
const baseRecord=JSON.parse(readFileSync(new URL('../public/experiment/duel/run.json',import.meta.url),'utf8'));
const notes=[0,1,2,3,2,1,0,2];
test('only actual successful clicks sound; misses and unfinished notes stay silent',()=>{
 const run={firstTargetMs:2800,clicks:[{hit:false,atMs:3100,targetIndex:0},{hit:true,atMs:3300,targetIndex:0},{hit:false,atMs:4500,targetIndex:1},{hit:true,atMs:5100,targetIndex:1}]};
 assert.deepEqual(takeEvents(notes,run),[{atMs:500,note:0,step:0},{atMs:2300,note:1,step:1}]);
 assert.deepEqual(pendingEvents(takeEvents(notes,run),501),[{atMs:2300,note:1,step:1}]);
 assert.notDeepEqual(takeEvents(notes,run),previewEvents(notes).slice(0,2));
});
test('rejects invalid pitches and binds verified music to its own saved artifacts',()=>{
 assert.equal(validNotes([0,1,2,3,4,0,1,2]),false);assert.equal(validNotes([0,1,2]),false);
 const m={id:'0123456789abcdef0123',state:'complete',...structuredClone(baseRecord)};
 m.rules.id='music-eight-v1';m.rules.music={notes,pitches:['C4','D4','E4','G4'],instrument:'soft-keys-v1',previewStepMs:650};m.run.replay.metaUrl=`/challenges/${m.id}/poses.json`;m.run.replay.binaryUrl=`/challenges/${m.id}/poses.bin`;
 const origin='https://observer-production-0b15.up.railway.app';
 assert.ok(musicRecording(m,origin));
 for(const change of [d=>d.run.verified=false,d=>d.run.replay.binaryUrl='https://evil.example/a',d=>d.run.hits=3,d=>d.run.rulesHash='bad',d=>d.rules.music.notes[0]=10]){const d=structuredClone(m);change(d);assert.equal(musicRecording(d,origin),null)}
 m.state='incomplete';m.run.complete=false;m.run.hits=2;m.run.clicks=m.run.clicks.filter(c=>c.targetIndex<2);assert.ok(musicRecording(m,origin));
});
test('WAV export is mono PCM16 with correct lengths and clipping',()=>{
 const bytes=encodeWav(new Float32Array([-2,0,2]),22050),v=new DataView(bytes);
 assert.equal(new TextDecoder().decode(new Uint8Array(bytes,0,4)),'RIFF');assert.equal(v.getUint32(4,true),42);assert.equal(v.getUint32(24,true),22050);assert.equal(v.getUint32(40,true),6);assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(48,true),32767);
});
const synthSource=readFileSync(new URL('../src/lib/softKeys.ts',import.meta.url),'utf8');
const synthCode=ts.transpileModule(synthSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/['"]\.\/music['"]/,JSON.stringify(url));
const {SoftKeys}=await import('data:text/javascript;base64,'+Buffer.from(synthCode).toString('base64'));
test('audio uses recorded times on one clock; pause cancels scheduled notes',async()=>{
 const voices=[];class Context{currentTime=10;state='running';destination={};createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}createOscillator(){const v={frequency:{value:0},starts:[],stops:[],connect(){},disconnect(){},start(t){this.starts.push(t)},stop(t){this.stops.push(t)}};voices.push(v);return v}close(){this.state='closed';return Promise.resolve()}resume(){return Promise.resolve()}}
 const previous=globalThis.AudioContext;globalThis.AudioContext=Context;
 try{const keys=new SoftKeys();assert.equal(voices.length,0);await keys.enable();const origin=keys.schedule([{atMs:500,note:0,step:0},{atMs:2300,note:1,step:1}],1000);assert.equal(voices.length,3);assert.ok(voices.every(v=>Math.abs(v.starts[0]-(origin+1.3))<1e-8));keys.stop();assert.ok(voices.every(v=>v.stops.at(-1)===undefined));keys.dispose();await assert.rejects(()=>keys.enable());}finally{globalThis.AudioContext=previous}
});

const {phraseComparison}=await import(url);
test('comparison keeps original score spacing and the actual recorded pauses, including missing notes',()=>{
 const run={firstTargetMs:2800,clicks:[{hit:false,atMs:3000,targetIndex:0},{hit:true,atMs:3200,targetIndex:0},{hit:true,atMs:4440,targetIndex:1}]};
 const rows=phraseComparison(notes,run);
 assert.equal(rows.length,8);assert.equal(rows[0].atMs,0);assert.equal(rows[1].atMs,650);
 assert.equal(rows[0].recordedAtMs,400);assert.equal(rows[1].recordedAtMs,1640);assert.equal(rows[1].gapMs,1240);
 assert.equal(rows[2].recordedAtMs,null);assert.equal(rows[2].gapMs,null);assert.equal(rows[7].atMs,4550);
});
test('featured music page contains a verified operator recording and uses its original eight-note score',()=>{
 const featured=JSON.parse(readFileSync(new URL('../public/experiment/music-featured.json',import.meta.url),'utf8'));
 const recording=musicRecording(featured.mission,featured.base);
 assert.ok(recording);assert.equal(featured.mission.id,'a9cfcf042e75987cebb8');
 assert.deepEqual(featured.mission.rules.music.notes,notes);
 assert.deepEqual(takeEvents(notes,recording.run).map(e=>e.atMs),[400,1640,3120,4420,5740,7080,8420,9860]);
 assert.equal(recording.run.hits,8);assert.equal(recording.run.misses,0);
});
