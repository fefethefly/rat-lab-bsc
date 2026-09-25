/** Read-only recovery. No wallet, website API or private runtime required. */
import{createPublicClient,http,hexToBytes}from'viem';import{bscTestnet}from'viem/chains';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{createHash}from'node:crypto';
import{unpackEvents,renderWav}from'../../src/lib/firstTakesCore.js';
const deployment=JSON.parse(readFileSync('public/first-takes/testnet/deployment.json')),artifact=JSON.parse(readFileSync('public/first-takes/testnet/contract.json')),index=JSON.parse(readFileSync('public/first-takes/index.json'));
if(deployment.status!=='deployed'||deployment.chainId!==97)throw Error('No confirmed public testnet deployment.');
const c=createPublicClient({chain:bscTestnet,transport:http('https://bsc-testnet-rpc.publicnode.com',{timeout:20000,retryCount:2})});
if(await c.getChainId()!==97)throw Error('Wrong network.');
const hash=b=>createHash('sha256').update(b).digest('hex');const read=(fn,id)=>c.readContract({address:deployment.address,abi:artifact.abi,functionName:fn,args:[BigInt(id)]});
const results=[];
for(const token of deployment.tokens){
 const t=index.tracks.find(t=>t.id===token.id),[htmlHex,scoreHex,svgHex,work]=await Promise.all([read('playerHTML',token.tokenId),read('scoreData',token.tokenId),read('coverSVG',token.tokenId),read('work',token.tokenId)]);
 const html=hexToBytes(htmlHex),score=hexToBytes(scoreHex),svg=hexToBytes(svgHex),wav=renderWav(unpackEvents(score));
 if(hash(html)!==t.playerSha256||hash(score)!==t.scoreSha256||hash(svg)!==t.coverSha256||hash(wav)!==t.wavSha256||work.sourceHash!=='0x'+t.sourceSha256||work.wavHash!=='0x'+t.wavSha256)throw Error('Chain archive differs from published work.');
 const out='output/first-takes-recovered/'+t.id;mkdirSync(out,{recursive:true});writeFileSync(out+'/player.html',html);writeFileSync(out+'/score.bin',score);writeFileSync(out+'/cover.svg',svg);writeFileSync(out+'/reconstructed.wav',wav);
 results.push({id:t.id,tokenId:token.tokenId,playerSha256:hash(html),scoreSha256:hash(score),wavSha256:hash(wav),matched:true});console.log('RECOVERED',t.id,'all fingerprints match');
}
writeFileSync('public/first-takes/testnet/recovery.json',JSON.stringify({chainId:97,address:deployment.address,checkedAt:new Date().toISOString(),method:'Direct contract reads; WAV regenerated from recovered score. Operator-run verification, not independent audit.',results},null,2)+'\n');
