export type TaxConfig={feeRate:1|3|5|10;burnRate:number;divideRate:number;liquidityRate:number;recipientRate:number;recipientAddress:string;minSharing:number};
export type FlapTax={buyBps:number;sellBps:number;beneficiary:string;taxDuration:number;antiFarmerDuration:number};
export type Manifest = {name:string;symbol:string;description:string;seed:number;mode:'dry'|'mainnet';planId?:string;webUrl?:string;twitterUrl?:string;telegramUrl?:string;preBuyBnb?:string;maxTotalBnb?:string|null;tax?:TaxConfig|null;flapTax?:FlapTax|null};
export type LabEvent = {type:string;at?:number;step?:number;state?:string;label?:string;message?:string;commit?:string;proof?:string;hits?:number;misses?:number;simTime?:number;lever?:number;hit?:boolean;cursor?:number[]};
export type LabStatus = {status:string;runId:string|null;hits:number;step:number;commit:string|null;proof?:string;events:LabEvent[];ownerToken:string;mainnetEnabled:boolean;manifest?:Manifest;telemetry?:LabEvent;receipt?:{hash:string;token?:string;block?:string}};
export type Plan = {id:string;approvalHash:string;transaction:{chainId:number;from:`0x${string}`;to:`0x${string}`;data:`0x${string}`;value:`0x${string}`};transactionHash:string;checks:{gas:number;gasPrice:number;maxCostWei:string};notice:string;expires:number};
let owner = '';
export async function api<T>(path:string, body?:unknown, file?:FormData):Promise<T> {
 if((body!==undefined||file)&&!owner) await api('/status');
 const r=await fetch('/api'+path,{method:body!==undefined||file?'POST':'GET',headers:{...(file?{}:{'Content-Type':'application/json'}),'x-rat-owner':owner},body:file|| (body!==undefined?JSON.stringify(body):undefined)});
 let data; try{data=await r.json();}catch{throw new Error('Local lab is offline. Start the Python server.');}
 if(!r.ok) throw new Error(typeof data.detail==='string'?data.detail:Array.isArray(data.detail)?data.detail.map((d:{loc?:string[];msg?:string})=>(d.loc?.slice(1).join('.')||'Field')+': '+d.msg).join(' / '):'The request was not accepted. Check the fields and try again.');
 if(data.ownerToken) owner=data.ownerToken;
 return data;
}
export function download(data:unknown,name:string){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
