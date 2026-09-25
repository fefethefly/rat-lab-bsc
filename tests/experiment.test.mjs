import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/experiment.ts',import.meta.url),'utf8').replace(/import\s+\{[^}]*\}\s+from\s+['"]react['"];?/, '');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {isExperiment}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const record=JSON.parse(readFileSync(new URL('../public/experiment/baseline.json',import.meta.url),'utf8'));
test('accepts a replay-verified neural result',()=>assert.equal(isExperiment(record),true));
test('never renders a real purchase claim from the simulation feed',()=>{
 for(const patch of [{mode:'LIVE'},{executionEnabled:true},{wallet:'0x'+'a'.repeat(40)}])assert.equal(isExperiment({...record,buyback:{...record.buyback,...patch}}),false);
});
test('rejects partial records, invalid samples and malformed fingerprints',()=>{
 for(const value of [null,{},[],{...record,latest:{...record.latest,samples:{}}},{...record,latest:{...record.latest,proof:'broken'}},{...record,rules:{...record.rules,targets:[]}}])assert.equal(isExperiment(value),false);
});
