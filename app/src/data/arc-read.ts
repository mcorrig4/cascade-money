import evidence from './onchain.json' with { type: 'json' };
import { decodeAbiString, decodeDateMetadata, utcDayId } from './date-token.ts';
import type { DateTokenMetadata } from './date-token.ts';
export const usdc = (value:string) => { const n=BigInt(value); return `${n/1000000n}.${(n%1000000n).toString().padStart(6,'0').replace(/0+$/,'')||'0'}`; };
export type ArcReading={usdc:string;totalSupply:string;supplies:{id:number;amount:string}[];timestamp:string;block:string;blockUtcMs:number;today:number;tokens:{id:number;metadata:DateTokenMetadata}[]};
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
  const header=await rpc('eth_getBlockByNumber',[block,false]);
  if(header.number!==block || !/^0x[0-9a-f]+$/i.test(header.timestamp)) throw Error('Invalid Arc block timestamp');
  const blockUtcMs=Number(BigInt(header.timestamp))*1000,today=utcDayId(blockUtcMs),tokenIds=[today,today+1,today+30,today+90];
  async function call(to:string,data:string) { const value=await rpc('eth_call',[{to,data},block]); if(!/^0x[0-9a-f]{64}$/i.test(value)) throw Error('Invalid uint256 response'); return BigInt(value).toString(); }
  const [balance,totalSupply,amounts,tokens]=await Promise.all([
    call(evidence.usdc,`0x70a08231${evidence.vault.slice(2).padStart(64,'0')}`),
    call(evidence.vault,'0x18160ddd'),
    Promise.all(evidence.supplyView?ids.map(n=>call(evidence.vault,`0x${evidence.supplyView}${n.toString(16).padStart(64,'0')}`)):[]),
    Promise.all(tokenIds.map(async id=>({id,metadata:decodeDateMetadata(decodeAbiString(await rpc('eth_call',[{to:evidence.vault,data:`0x0e89341c${id.toString(16).padStart(64,'0')}`},block])))}))),
  ]);
  return {usdc:balance,totalSupply,supplies:amounts.map((amount,i)=>({id:ids[i],amount})),block,blockUtcMs,today,tokens,timestamp:new Date(blockUtcMs).toISOString()};
}
