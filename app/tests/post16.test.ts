import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readStream } from '../src/data/ndjson.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { SHOTS, playShot, appleOrders, branchedProofPayments, cascadeBeats, proofMaturity, ORDER_SITES, DEFAULT_CASCADE } from '../src/director/shots.ts';
import { ArcPool } from '../src/globe/arc-pool.ts';
import { easeAt, sampleCamera } from '../src/camera/primitives.ts';

// Read the supplied live fixture; no synthetic or edited simulation data.
const bytes=await readFile(new URL('../public/events.ndjson',import.meta.url));
const index=await readStream(new ReadableStream({start(c){c.enqueue(bytes);c.close();}}));

test('live Apple orders retain their story identities, individual amounts, due dates and sites',()=>{
 const orders=appleOrders(index);
 assert.deepEqual(orders.map(e=>[e.invoiceId,e.day,e.to,e.amount,proofMaturity(e)]),[
  ['story:0',0,'Samsung Display',10000000000n,90],['story:10',10,'TSMC',8000000000n,100],['story:17',120,'Foxconn',5000000000n,210],
 ]);
 const engine=new PlaybackEngine(index);playShot(engine,3);engine.tick(4.4);
 assert.deepEqual(engine.storyEvents,orders);
 assert.equal(engine.state.day,0,'Juxtaposition does not seek the explorer into day 120');
 assert.equal(engine.state.paymentAmount,null);assert.equal(engine.state.paymentMaturity,null);
 const pool=new ArcPool();
 for(const event of orders){
  const site=index.firms.get(event.to!)!.sites!.find(s=>s.id===ORDER_SITES[event.invoiceId!])!;
  assert.ok(site,ORDER_SITES[event.invoiceId!]);
  pool.add(event,index,0,3500,proofMaturity(event)!,undefined,site.id);
  const arc=pool.arcs.at(-1)!;assert.equal(arc.endLat,site.lat);assert.equal(arc.endLng,site.lng);
 }
 pool.tick(20000,true);
 assert.equal(pool.arcs.length,3);assert.ok(pool.arcs.every(a=>a.clipStart===0&&a.clipEnd===1&&a.alpha===1));
 engine.tick(12);
 assert.equal(engine.storyEvents!.length,12,'Three orders plus nine Corning downstream payments');
});

test('live branch lights each generation and finishes at $100M / $450M / eight payees',()=>{
 const branch=branchedProofPayments(index);
 assert.deepEqual(branch.map(e=>e.invoiceId),Array.from({length:10},(_,i)=>`story:${i}`));
 assert.deepEqual(cascadeBeats(branch).map(g=>g.length),[1,1,2,4,2]);
 assert.equal(branch.reduce((sum,e)=>sum+e.amount,0n),45000000000n);
 assert.equal(new Set(branch.map(e=>e.to)).size,8);
 const original=branch.map(e=>[e.seq,e.day,e.amount,e.dates]);
 const engine=new PlaybackEngine(index);playShot(engine,4);
 let previous=0;
 for(const [at,count] of [[.4,1],[5.2,2],[9.6,4],[13.8,8],[17.4,10]]){
  engine.tick(at-previous);previous=at;assert.equal(engine.storyEvents!.length,count);
 }
 assert.deepEqual(engine.totals(),{committed:10000000000n,settled:45000000000n});
 playShot(engine,17);assert.deepEqual(engine.totals(),DEFAULT_CASCADE);assert.equal(DEFAULT_CASCADE.companies,8);
 assert.deepEqual(branch.map(e=>[e.seq,e.day,e.amount,e.dates]),original);
});

test('pull-out preserves the spline endpoint and velocity, then joins cubic ease-out continuously',()=>{
 const engine=new PlaybackEngine(index);playShot(engine,2);engine.tick(10);
 const arch=engine.state.camera,span=arch.duration;
 const end=sampleCamera(arch,span),before=sampleCamera(arch,span-.01);
 engine.tick(3.6);
 const pull=engine.state.camera;
 assert.deepEqual(pull.from,end);
 assert.equal(pull.ease?.kind,'cubic-out');assert.ok(Math.abs(pull.duration-2600)<1e-7);
 const after=sampleCamera(pull,.000001);
 for(const field of ['lat','lng','altitude'] as const){
  assert.ok(Math.abs((after[field]-end[field])/.000001-(end[field]-before[field])/.01)<1e-7,field);
 }
 const h=.25,epsilon=1e-6,ease={kind:'cubic-out' as const,handoff:h};
 assert.ok(Math.abs((easeAt(h,ease)-easeAt(h-epsilon,ease))/epsilon-(easeAt(h+epsilon,ease)-easeAt(h,ease))/epsilon)<.0001);
 assert.equal(easeAt(.5,ease),1-(1-.5)**3);
 engine.tick(2.6);assert.equal(engine.state.shotRunning,false);
 for(const field of ['lat','lng','altitude'] as const)assert.ok(Math.abs(sampleCamera(pull,span)[field]-SHOTS[1].end[field])<1e-10);
});

test('actual scene components render three dated orders, no app location card, and $100M / $450M / 10 invoices',async()=>{
 const {transpileModule,JsxEmit,ModuleKind,ScriptTarget}=await import('typescript');
 const {createElement}=await import('react');
 const {renderToStaticMarkup}=await import('react-dom/server');
 // Compile the real TSX components for a DOM-free render. This checks their
 // output without claiming CSS, WebGL, or screenshot acceptance.
 const component=async(name:string)=>{
  const file=new URL(`../src/director/${name}.tsx`,import.meta.url);
  const source=(await readFile(file,'utf8')).replaceAll('import.meta.env',JSON.stringify({VITE_PUBLIC_APP_URL:'http://cascade.test/'}));
  const code=transpileModule(source,{compilerOptions:{jsx:JsxEmit.ReactJSX,module:ModuleKind.ESNext,target:ScriptTarget.ESNext}}).outputText
   .replace(/from (["'])([^"']+)\1/g,(_match,quote,specifier)=>`from ${quote}${specifier.startsWith('.')?new URL(specifier,file).href:import.meta.resolve(specifier)}${quote}`);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 };
 const {SceneLabels}=await component('SceneLabels');
 const orders=renderToStaticMarkup(createElement(SceneLabels,{shot:3,elapsed:8,orders:appleOrders(index)}));
 assert.equal((orders.match(/class="scene-location"/g)??[]).length,0);
 assert.ok(!orders.includes('September 9, 2025 · Cupertino'));
 for(const text of ['Samsung Display','TSMC','Foxconn','$100M','$80M','$50M','December 8, 2025','December 18, 2025','April 7, 2026'])assert.ok(orders.includes(text),text);
 const {ShotOverlays}=await component('ShotOverlays');
 const engine=new PlaybackEngine(index);playShot(engine,17);engine.tick(11);
 const totals=renderToStaticMarkup(createElement(ShotOverlays,{engine,state:engine.state}));
 assert.deepEqual([...totals.matchAll(/<strong>(.*?)<\/strong>/g)].map(m=>m[1]),['$100M','$450M','10']);
 assert.ok(!totals.includes('opacity:0'));
});
