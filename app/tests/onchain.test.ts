import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { parseOnchain } from '../scripts/onchain-manifest.ts';
import data from '../src/data/onchain.json' with {type:'json'};
import { readArc,usdc } from '../src/data/arc-read.ts';
const root=new URL('../../contracts/',import.meta.url),read=(path:string)=>readFile(new URL(path,root),'utf8');
const deployment=JSON.parse(await read('deployments/5042002.json'));
const runs=await Promise.all((await readdir(new URL('deployments/',root))).filter(f=>/^demo-5042002-.*\.json$/.test(f)).map(async f=>JSON.parse(await read(`deployments/${f}`))));
const report=await read('deployments/testnet-demo-run.md'),readme=await read('README.md'),source=await read('src/CascadeVault.sol');
test('manifest parser selects the complete reported run without duplicating resumed receipts',()=>{
  const parsed=parseOnchain(deployment,runs,report,readme,source);
  assert.deepEqual(parsed,data);assert.equal(data.transactions.length,16);assert.equal(new Set(data.transactions.map(t=>t.hash)).size,16);
  assert.deepEqual(data.actors.map(a=>a.name),['Apple','Foxconn','TSMC','Corning','Glass supplier']);
  assert.equal(data.transactions[0].amount,'0.1');assert.equal(data.transactions[14].date,'Run day +90 → +120');
  assert.equal(data.supplyView,'eb274347');assert.equal(data.recorded.deficit,'0');assert.equal(data.recorded.principalMatched,true);
  assert.ok(readme.includes(data.command.split('\n')[1]));assert.ok(data.transactions.every(t=>t.url.endsWith(t.hash)));
});
test('parser fails closed on incomplete, failed, wrong-chain or mismatched evidence',()=>{
  assert.throws(()=>parseOnchain({...deployment,chainId:1},runs,report,readme,source));
  assert.throws(()=>parseOnchain(deployment,[],report,readme,source));
  assert.throws(()=>parseOnchain(deployment,runs,report.replace('deficit == 0','unknown'),readme,source));
  const failed=structuredClone(runs);failed.forEach(r=>r.transactions[0].status='failed');
  assert.throws(()=>parseOnchain(deployment,failed,report,readme,source));
});
const word=(n:number)=>n.toString(16).padStart(64,'0');
test('live read decodes actual date IDs and pins all view calls to one block',async()=>{
  const calls:{method:string;params:any[]}[]=[];
  const request=(async (_url:any,init:any)=>{
    const q=JSON.parse(init.body);calls.push(q);
    const result=q.method==='eth_chainId'?'0x'+data.chainId.toString(16):q.method==='eth_blockNumber'?'0x123':q.method==='eth_getTransactionByHash'?{to:data.vault,input:'0x8147343a'+word(10000000)+word(21000)+word(21030)}:'0x'+word(10000000);
    return new Response(JSON.stringify({result}));
  }) as typeof fetch;
  const result=await readArc(new AbortController().signal,request);
  assert.deepEqual(result.supplies.map(s=>s.id),[21000,21030]);assert.equal(result.usdc,'10000000');
  assert.ok(calls.filter(c=>c.method==='eth_call').every(c=>c.params[1]==='0x123'));
  assert.equal(calls.filter(c=>c.method==='eth_call').length,4);
  assert.equal(usdc('10000001'),'10.000001');
});
test('RPC failure or malformed data rejects so the panel retains recorded values',async()=>{
  await assert.rejects(readArc(new AbortController().signal,(async()=>new Response('{}',{status:502})) as typeof fetch));
  await assert.rejects(readArc(new AbortController().signal,(async()=>new Response(JSON.stringify({result:'0x1'}))) as typeof fetch));
});
