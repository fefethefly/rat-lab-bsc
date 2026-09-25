import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/duel.ts',import.meta.url),'utf8').replace(/import\s+\{[^}]*\}\s+from\s+['"]react['"];?/, '');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {isDuelRecording,hitTimes,hitsAt,splitDelta}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const record=JSON.parse(readFileSync(new URL('../public/experiment/duel/run.json',import.meta.url),'utf8'));
const meta=JSON.parse(readFileSync(new URL('../public/experiment/duel/poses.json',import.meta.url),'utf8'));
const bytes=readFileSync(new URL('../public/experiment/duel/poses.bin',import.meta.url));
test('opponent motion, metadata and score reference one verified run',()=>{
 assert.equal(isDuelRecording(record),true);assert.equal(meta.runId,record.run.id);assert.equal(meta.proof,record.run.proof);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),record.run.replay.sha256);
 assert.equal(bytes.length%1868,0);
 for(let o=0;o<bytes.length;o+=1868)assert.equal(bytes.readFloatLE(o),7);
});
test('each rat hit appears at its recorded timestamp, never early',()=>{
 for(const [i,t] of hitTimes(record.run).entries()){assert.equal(hitsAt(record.run,t-1),i);assert.equal(hitsAt(record.run,t),i+1);}
 assert.equal(hitsAt(record.run,-1),0);assert.equal(hitsAt(record.run,999999),8);
});
test('splits compare the same target and preserve ahead/behind sign',()=>{
 assert.equal(splitDelta([300,1600],[380,1520],0),-80);assert.equal(splitDelta([300,1600],[380,1520],1),80);assert.equal(splitDelta([],[380],0),null);
});
test('rejects an unverified, mismatched or reordered opponent',()=>{
 for(const mutate of [d=>d.run.verified=false,d=>d.run.rulesHash='bad',d=>d.run.durationMs=20,d=>d.run.clicks.reverse(),d=>d.run.replay.binaryUrl='https://elsewhere/poses.bin']){const d=structuredClone(record);mutate(d);assert.equal(isDuelRecording(d),false);}
});
test('a community opponent is bound to its mission artifact paths',()=>{
 const d=structuredClone(record);const prefix='/challenges/0123456789abcdef0123';
 d.run.replay.metaUrl=prefix+'/poses.json';d.run.replay.binaryUrl=prefix+'/poses.bin';
 assert.equal(isDuelRecording(d,prefix),true);
 assert.equal(isDuelRecording(d),false);
 assert.equal(isDuelRecording(d,'/challenges/aaaaaaaaaaaaaaaaaaaa'),false);
 assert.equal(isDuelRecording(d,'https://untrusted.example'),false);
 d.run.complete=false;assert.equal(isDuelRecording(d,prefix),false);
});
