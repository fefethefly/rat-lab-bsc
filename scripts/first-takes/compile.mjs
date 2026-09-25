import solc from 'solc';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
const filename='contracts/first-takes/FirstTakesTestnet.sol';
const input={language:'Solidity',sources:{[filename]:{content:readFileSync(filename,'utf8')}},settings:{optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>{try{return{contents:readFileSync('node_modules/'+p,'utf8')}}catch{return{error:'Missing '+p}}}}));
for(const e of output.errors||[])if(e.severity==='error')throw Error(e.formattedMessage);
const c=output.contracts[filename].FirstTakesTestnet;
mkdirSync('public/first-takes/testnet',{recursive:true});
writeFileSync('public/first-takes/testnet/contract.json',JSON.stringify({compiler:solc.version(),evmVersion:'paris',abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtimeBytes:c.evm.deployedBytecode.object.length/2},null,2));
console.log('Test-only contract compiled:',c.evm.deployedBytecode.object.length/2,'runtime bytes');
