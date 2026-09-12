import evidence from './onchain.json' with { type: 'json' };
export const usdc = (value:string) => { const n=BigInt(value); return `${n/1000000n}.${(n%1000000n).toString().padStart(6,'0').replace(/0+$/,'')||'0'}`; };
export type ArcReading={usdc:string;totalSupply:string;supplies:{id:number;amount:string}[];timestamp:string;block:string};
export async function readArc(signal:AbortSignal, request:typeof fetch=fetch):Promise<ArcReading> {
  let id=0;
  async function rpc(method:string,params:unknown[]) {
    const response=await request(evidence.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal});
    if(!response.ok) throw Error('Arc RPC unavailable');
    const body=await response.json(); if(body.error || body.result==null) throw Error('Arc RPC read failed'); return body.result;
  }
  const [chain,block,transaction]=await Promise.all([rpc('eth_chainId',[]),rpc('eth_blockNumber',[]),rpc('eth_getTransactionByHash',[evidence.extensionTransaction])]);
  if(BigInt(chain)!==BigInt(evidence.chainId)||!/^0x[0-9a-f]+$/i.test(block)) throw Error('Unexpected Arc chain');
  if(transaction.to?.toLowerCase()!==evidence.vault.toLowerCase() || !/^0x8147343a[0-9a-f]{192}$/i.test(transaction.input)) throw Error('Unexpected extension calldata');
  const ids=[Number(BigInt(`0x${transaction.input.slice(74,138)}`)),Number(BigInt(`0x${transaction.input.slice(138,202)}`))];
  if(ids.some(n=>!Number.isSafeInteger(n)||n<0||n>1000000)||ids[1]-ids[0]!==30) throw Error('Unexpected demo dates');
  async function call(to:string,data:string) { const value=await rpc('eth_call',[{to,data},block]); if(!/^0x[0-9a-f]{64}$/i.test(value)) throw Error('Invalid uint256 response'); return BigInt(value).toString(); }
  const [balance,totalSupply,...amounts]=await Promise.all([
    call(evidence.usdc,`0x70a08231${evidence.vault.slice(2).padStart(64,'0')}`),
    call(evidence.vault,'0x18160ddd'),
    ...(evidence.supplyView?ids.map(n=>call(evidence.vault,`0x${evidence.supplyView}${n.toString(16).padStart(64,'0')}`)):[]),
  ]);
  return {usdc:balance,totalSupply,supplies:amounts.map((amount,i)=>({id:ids[i],amount})),block,timestamp:new Date().toISOString()};
}
