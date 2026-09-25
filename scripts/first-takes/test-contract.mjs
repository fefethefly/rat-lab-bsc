import{createPublicClient,createWalletClient,http,toHex}from'viem';
import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const artifact=JSON.parse(readFileSync('public/first-takes/testnet/contract.json')),index=JSON.parse(readFileSync('public/first-takes/index.json'));
const c=createPublicClient({transport:http('http://127.0.0.1:18545')}),w=createWalletClient({transport:http('http://127.0.0.1:18545')});
assert.equal(await c.getChainId(),31337);const [issuer,other]=await w.getAddresses();
const receipt=await c.waitForTransactionReceipt({hash:await w.deployContract({abi:artifact.abi,bytecode:artifact.bytecode,account:issuer,chain:null})});assert.equal(receipt.status,'success');const address=receipt.contractAddress;
const checks=[];const ok=name=>{checks.push(name);console.log('PASS',name)};
const read=(fn,args=[])=>c.readContract({address,abi:artifact.abi,functionName:fn,args});
const send=async(fn,args,account=issuer)=>{const {request}=await c.simulateContract({address,abi:artifact.abi,functionName:fn,args,account});const r=await c.waitForTransactionReceipt({hash:await w.writeContract({...request,chain:null})});assert.equal(r.status,'success');return r};
const argsFor=t=>{const base='public/first-takes/'+t.id+'/';return[issuer,'0x'+t.sourceSha256,'0x'+t.scoreSha256,'0x'+t.wavSha256,toHex(readFileSync(base+'score.bin')),toHex(readFileSync(base+'player.html')),toHex(readFileSync(base+'cover.svg')),t.title]};
await assert.rejects(()=>c.simulateContract({address,abi:artifact.abi,functionName:'archive',args:argsFor(index.tracks[0]),account:other}));ok('unauthorized issuance rejected');
const wrong=argsFor(index.tracks[0]);wrong[2]='0x'+'11'.repeat(32);await assert.rejects(()=>c.simulateContract({address,abi:artifact.abi,functionName:'archive',args:wrong,account:issuer}));ok('score hash mismatch rejected');
for(let i=0;i<4;i++){const t=index.tracks[i];await send('archive',argsFor(t));assert.equal((await read('ownerOf',[BigInt(i+1)])).toLowerCase(),issuer.toLowerCase());assert.equal(await read('scoreData',[BigInt(i+1)]),argsFor(t)[4]);const uri=await read('tokenURI',[BigInt(i+1)]),metadata=JSON.parse(Buffer.from(uri.split(',')[1],'base64'));const html=Buffer.from(metadata.animation_url.split(',')[1],'base64');assert.equal(createHash('sha256').update(html).digest('hex'),t.playerSha256);assert.equal(await read('playerHTML',[BigInt(i+1)]),toHex(html));}
ok('four archive tokens recover exact music scores and complete players from chain alone');
await assert.rejects(()=>c.simulateContract({address,abi:artifact.abi,functionName:'archive',args:argsFor(index.tracks[0]),account:issuer}));ok('duplicate source rejected');
const badTitle=argsFor(index.tracks[0]);badTitle[1]='0x'+'33'.repeat(32);badTitle[7]='Bad " title';await assert.rejects(()=>c.simulateContract({address,abi:artifact.abi,functionName:'archive',args:badTitle,account:issuer}));ok('metadata injection rejected');
await send('transferFrom',[issuer,other,1n]);assert.equal((await read('ownerOf',[1n])).toLowerCase(),other.toLowerCase());ok('standard ERC721 ownership transfer');
for(let i=5;i<=16;i++){const args=argsFor(index.tracks[0]);args[1]=toHex(BigInt(i),{size:32});await send('archive',args)}
const extra=argsFor(index.tracks[0]);extra[1]=toHex(17n,{size:32});await assert.rejects(()=>c.simulateContract({address,abi:artifact.abi,functionName:'archive',args:extra,account:issuer}));assert.equal(await read('totalSupply'),16n);ok('fixed 16-token ceiling enforced');
const main=createPublicClient({transport:http('http://127.0.0.1:18546')});assert.equal(await main.getChainId(),56);await assert.rejects(()=>main.estimateGas({account:issuer,data:artifact.bytecode}));ok('constructor rejects BSC mainnet chain ID (local simulation)');
writeFileSync('public/first-takes/testnet/local-verification.json',JSON.stringify({network:'LOCAL ANVIL — not a public deployment',chainId:31337,at:new Date().toISOString(),checks,independentlyAudited:false},null,2)+'\n');
