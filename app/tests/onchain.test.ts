import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseOnchain } from '../scripts/onchain-manifest.ts';
import data from '../src/data/onchain.json' with {type:'json'};
import fixtureRun from '../src/data/demo-run.json' with {type:'json'};
import { readArc,usdc } from '../src/data/arc-read.ts';
import { decodeAbiString,decodeDateMetadata,midnightCountdown,snapshotUtcMs,tokenLabel,utcDate,utcDayId,UTC_DAY_MS } from '../src/data/date-token.ts';
const root=new URL('../../contracts/',import.meta.url),read=(path:string)=>readFile(new URL(path,root),'utf8');
const deployment=JSON.parse(await read('deployments/5042002.json'));
const runs=[fixtureRun];
const report=await read('deployments/testnet-demo-run.md'),readme=await read('README.md'),source=await read('src/CascadeVault.sol');
test('manifest parser selects the complete reported run without duplicating resumed receipts',()=>{
  const parsed=parseOnchain(deployment,runs,report,readme,source);
  assert.deepEqual(parsed,data);assert.equal(data.transactions.length,16);assert.equal(new Set(data.transactions.map(t=>t.hash)).size,16);
  assert.deepEqual(data.actors.map(a=>a.name),['Apple','Samsung Display','Corning','Silica supplier','Freight carrier']);
  assert.equal(data.transactions[0].amount,'0.1');assert.equal(data.transactions[14].date,'Run day +90 → +120');
  assert.equal(data.supplyView,'eb274347');assert.equal(data.recorded.deficit,'0');assert.equal(data.recorded.principalMatched,true);
  assert.ok(readme.includes(data.command.split('\n')[1]));assert.ok(data.transactions.every(t=>t.url.endsWith(t.hash)));
});
test('parser fails closed on incomplete, failed, wrong-chain, wrong-vault, short, or mismatched evidence',()=>{
  assert.throws(()=>parseOnchain({...deployment,chainId:1},runs,report,readme,source));
  assert.throws(()=>parseOnchain(deployment,[],report,readme,source));
  assert.throws(()=>parseOnchain(deployment,runs,report.replaceAll('deficit == 0','unknown'),readme,source));
  const failed=structuredClone(runs);failed.forEach(r=>r.transactions[0].status='failed');
  assert.throws(()=>parseOnchain(deployment,failed,report,readme,source));
  const wrongVault=structuredClone(runs);wrongVault.forEach(r=>r.vault='0x0000000000000000000000000000000000000000');
  assert.throws(()=>parseOnchain(deployment,wrongVault,report,readme,source));
  const fewerSteps=structuredClone(runs);fewerSteps.forEach(r=>r.transactions=r.transactions.slice(0,15));
  assert.throws(()=>parseOnchain(deployment,fewerSteps,report,readme,source));
});
const word=(n:number)=>n.toString(16).padStart(64,'0');
const metadata=(name:string)=>'data:application/json;base64,'+Buffer.from(JSON.stringify({name,description:'Cascade dated dollar. Maturity: 2026-09-13 (UTC).',decimals:6,image:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64')})).toString('base64');
const abi=(text:string)=>'0x'+word(32)+word(Buffer.byteLength(text))+Buffer.from(text).toString('hex').padEnd(Math.ceil(Buffer.byteLength(text)/32)*64,'0');

test('live read decodes actual date IDs and pins all view calls to one block',async()=>{
  const calls:{method:string;params:any[]}[]=[];
  const request=(async (_url:any,init:any)=>{
    const q=JSON.parse(init.body);calls.push(q);
    const result=q.method==='eth_chainId'?'0x'+data.chainId.toString(16):q.method==='eth_blockNumber'?'0x123':q.method==='eth_getTransactionByHash'?{to:data.vault,input:'0x8147343a'+word(10000000)+word(21000)+word(21030)}:q.method==='eth_getBlockByNumber'?{number:'0x123',timestamp:'0x'+(20000*86400+86399).toString(16)}:q.params[0].data.startsWith('0x0e89341c')?abi(metadata(tokenLabel(Number(BigInt('0x'+q.params[0].data.slice(10))),20000))):'0x'+word(10000000);
    return new Response(JSON.stringify({result}));
  }) as typeof fetch;
  const result=await readArc(new AbortController().signal,request);
  assert.deepEqual(result.supplies.map(s=>s.id),[21000,21030]);assert.equal(result.usdc,'10000000');
  assert.ok(calls.filter(c=>c.method==='eth_call').every(c=>c.params[1]==='0x123'));
  assert.equal(calls.filter(c=>c.method==='eth_call').length,8);
  assert.equal(result.blockUtcMs,20000*UTC_DAY_MS+86399000);
  assert.deepEqual(result.tokens.map(t=>[t.id,t.metadata.name]),[[20000,'USD spot'],[20001,'USD+1'],[20030,'USD+30'],[20090,'USD+90']]);
  assert.equal(usdc('10000001'),'10.000001');
});
test('RPC failure or malformed data rejects so the panel retains recorded values',async()=>{
  await assert.rejects(readArc(new AbortController().signal,(async()=>new Response('{}',{status:502})) as typeof fetch));
  await assert.rejects(readArc(new AbortController().signal,(async()=>new Response(JSON.stringify({result:'0x1'}))) as typeof fetch));
});

test('UTC day IDs and midnight countdown match Solidity at exact UTC boundaries',()=>{
  const midnight=Date.parse('2026-09-13T00:00:00Z');
  assert.equal(utcDayId(midnight),20709);
  assert.equal(utcDayId(midnight-1),20708);
  assert.equal(utcDayId(midnight+UTC_DAY_MS),20710);
  assert.equal(utcDate(20709),'2026-09-13');
  assert.equal(utcDate(utcDayId(Date.parse('2024-02-29T23:59:59Z'))),'2024-02-29');
  assert.equal(midnightCountdown(midnight),'24:00:00');
  assert.equal(midnightCountdown(midnight-1),'00:00:01');
  assert.equal(midnightCountdown(midnight+1000),'23:59:59');
  assert.equal(snapshotUtcMs(midnight,4000,1000),midnight+3000);
  assert.equal(snapshotUtcMs(midnight,0,1000),midnight);
  for(const bad of [-1,NaN,Infinity,(0x100000000)*UTC_DAY_MS])assert.throws(()=>utcDayId(bad));
  assert.equal(tokenLabel(20709,20710),'USD spot');
  assert.equal(tokenLabel(20739,20709),'USD+30');
  assert.equal(tokenLabel(20739,20710),'USD+29');
});
test('metadata decoder reads name, ABI string and base64 JSON without inventing symbol',()=>{
  const decoded=decodeDateMetadata(decodeAbiString(abi(metadata('USD+30'))));
  assert.equal(decoded.name,'USD+30');assert.equal(decoded.decimals,6);assert.equal('symbol' in decoded,false);
  assert.equal(decodeDateMetadata(metadata('USD spot')).name,'USD spot');
  assert.throws(()=>decodeAbiString('0x'+word(64)+word(1)+'61'.padEnd(64,'0')));
  assert.throws(()=>decodeAbiString(abi('hello').slice(0,-2)));
  assert.throws(()=>decodeAbiString('0x'+word(32)+word(1000001)));
  assert.throws(()=>decodeDateMetadata('https://example.invalid/token.json'));
  assert.throws(()=>decodeDateMetadata('data:application/json;base64,%%%='));
  assert.throws(()=>decodeDateMetadata('data:application/json;base64,'+Buffer.from('{broken').toString('base64')));
  assert.throws(()=>decodeDateMetadata('data:application/json;base64,'+Buffer.from(JSON.stringify({name:'USD+30',symbol:'USD+30'})).toString('base64')));
});
test('recorded absolute ladder IDs are corroborated by both report metadata reads',()=>{
  assert.equal(data.recorded.day,20709);
  assert.deepEqual(data.recorded.supplies.map(s=>s.id),[20799,20829]);
  assert.equal(data.owner,deployment.owner);assert.equal(data.deploymentTransaction,deployment.transactionHash);
  const withoutMetadata=parseOnchain(deployment,runs,report.replace('Maturity: 2026-10-13','Maturity: 2026-10-14'),readme,source);
  assert.equal(withoutMetadata.recorded.day,null);assert.ok(withoutMetadata.recorded.supplies.every(s=>s.id===null));
});
