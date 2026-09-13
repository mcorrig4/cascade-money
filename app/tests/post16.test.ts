import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readStream } from '../src/data/ndjson.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { SHOTS, playShot, appleOrders, sceneThreeOrders, californiaPath, CALIFORNIA_HOLD, APPLE_MARKER_APPROACH, OPENING_ROTATION, branchedProofPayments, cascadeBeats, proofMaturity, ORDER_SITES, DEFAULT_CASCADE } from '../src/director/shots.ts';
import { ArcPool } from '../src/globe/arc-pool.ts';
import { sampleCamera, splineAt } from '../src/camera/primitives.ts';

// Read the supplied live fixture; no synthetic or edited simulation data.
const bytes=await readFile(new URL('../public/events.ndjson',import.meta.url));
const index=await readStream(new ReadableStream({start(c){c.enqueue(bytes);c.close();}}));

test('live narrated orders retain their individual amounts, due dates and word cues',()=>{
 const orders=sceneThreeOrders(index),apple=appleOrders(index);
 assert.deepEqual(orders.map(e=>[e.day,e.from,e.to,e.amount,proofMaturity(e)]),[
  [0,'Apple','Samsung Display',10000000000n,90],[1,'Samsung Display','Corning',10000000000n,90],[0,'Apple','Sony',5000000000n,90],
 ]);
 assert.deepEqual(apple.map(e=>e.to),['Samsung Display','Sony']);
 assert.ok(apple.every(e=>e.type==='issue'));
 const engine=new PlaybackEngine(index);playShot(engine,3);
 const shot=SHOTS.find(s=>s.id===3)!,scale=shot.seconds/shot.baseSeconds;
 let previous=0;
 for(const [at,count] of [[4.4,1],[9.2,2],[13.4,3]]){
  engine.tick(at*scale-previous-.001);assert.equal(engine.storyEvents!.length,count-1);
  engine.tick(.001);previous=at*scale;assert.deepEqual(engine.storyEvents,orders.slice(0,count));
 }
 assert.equal(engine.state.day,0,'Narrated juxtaposition keeps the simulation day');
 assert.equal(engine.state.paymentAmount,null);assert.equal(engine.state.paymentMaturity,null);
 const pool=new ArcPool();
 for(const event of orders){
  const firm=index.firms.get(event.to!)!,site=firm.sites?.find(s=>s.id===ORDER_SITES[event.invoiceId!])??firm.sites?.[0];
  assert.ok(site,`A real mapped site for ${event.to}`);
  pool.add(event,index,0,3500,proofMaturity(event)!,undefined,site.id);
  const arc=pool.arcs.at(-1)!;assert.equal(arc.endLat,site.lat);assert.equal(arc.endLng,site.lng);
 }
 pool.tick(20000,true);
 assert.equal(pool.arcs.length,3);assert.ok(pool.arcs.every(a=>a.clipStart===0&&a.clipEnd===1&&a.alpha===1));
 engine.tick(shot.seconds-previous);assert.equal(engine.storyEvents!.length,3,'Each narrated order reveals exactly once');
});

test('recorded word timestamps suppress fallback order reveals and never duplicate an order',()=>{
 const engine=new PlaybackEngine(index);playShot(engine,3);
 engine.cue('Samsung',undefined,15000);engine.cue('Corning',undefined,16000);engine.cue('Sony',undefined,17000);
 engine.tick(14);assert.deepEqual(engine.storyEvents,[],'All three default narration times have passed, but explicit cues own the timing');
 for(const [word,count] of [['Samsung',1],['Corning',2],['Sony',3]] as const){
  engine.tick(1);assert.equal(engine.storyEvents!.length,count,word);
 }
 assert.deepEqual(engine.storyEvents,sceneThreeOrders(index));
 engine.cue('Sony',undefined,17500);engine.tick(.5);
 assert.equal(engine.storyEvents!.length,3,'Re-cueing an already revealed order cannot duplicate its invoice');
});

test('live branch lights each generation and finishes at $100M / $450M / eight payees',()=>{
 const branch=branchedProofPayments(index);
 assert.deepEqual(branch.map(e=>e.invoiceId),Array.from({length:10},(_,i)=>`story:${i}`));
 assert.deepEqual(cascadeBeats(branch).map(g=>g.length),[1,1,2,4,2]);
 assert.equal(branch.reduce((sum,e)=>sum+e.amount,0n),45000000000n);
 assert.equal(new Set(branch.map(e=>e.to)).size,8);
 assert.equal(branch.filter(e=>e.type==='pay').length,9,'Sony issue is outside the Samsung descendant payment tree');
 assert.ok(!branch.some(e=>e.to==='Sony'));
 const original=branch.map(e=>[e.seq,e.day,e.amount,e.dates]);
 const engine=new PlaybackEngine(index);playShot(engine,4);
 let previous=0;
 for(const [at,count] of [[.4,1],[5.2,2],[9.6,4],[13.8,8],[17.4,10]]){
  engine.tick(at-previous);previous=at;assert.equal(engine.storyEvents!.length,count);
 }
 assert.deepEqual(engine.totals(),{committed:10000000000n,settled:45000000000n});
 assert.equal(engine.invoicesSettled(),9);
 playShot(engine,17);assert.deepEqual(engine.totals(),DEFAULT_CASCADE);assert.equal(DEFAULT_CASCADE.companies,8);
 assert.deepEqual(branch.map(e=>[e.seq,e.day,e.amount,e.dates]),original);
});

test('California zoom is one continuous eased globe take with a stationary coastal hold',()=>{
 const engine=new PlaybackEngine(index),shot=SHOTS.find(s=>s.id===2)!;
 playShot(engine,2);const command=engine.state.camera;
 assert.equal(command.site,undefined);assert.equal(command.landmarkPath,undefined);
 assert.equal(command.primitive?.kind,'spline');
 assert.deepEqual(sampleCamera(command,0),shot.start);
 for(const fraction of [.3,.4,.5])assert.deepEqual(sampleCamera(command,shot.seconds*1000*fraction),CALIFORNIA_HOLD);
 assert.deepEqual(sampleCamera(command,command.duration),shot.end);
 const path=californiaPath(shot.start,shot.seconds,OPENING_ROTATION),epsilon=1e-5;
 const initial=splineAt(path,0),next=splineAt(path,epsilon);
 assert.ok(Math.abs((next.lng-initial.lng)/epsilon-OPENING_ROTATION)<.0001,'Opening angular velocity enters the hook without a snap');
 for(const t of [shot.seconds*.3,shot.seconds*.5,shot.seconds*.75]){
  const before=splineAt(path,t-epsilon),at=splineAt(path,t),after=splineAt(path,t+epsilon);
  for(const field of ['lat','lng','altitude'] as const){
   assert.ok(Math.abs((at[field]-before[field])/epsilon)<.0001,`${field} settles into the hold`);
   assert.ok(Math.abs((after[field]-at[field])/epsilon)<.0001,`${field} leaves the hold smoothly`);
  }
 }
 assert.ok(shot.start.altitude>1&&shot.end.altitude>1&&CALIFORNIA_HOLD.altitude<1);
 assert.deepEqual(SHOTS[2].start,shot.end);
});

test('actual scene components render three dated orders, no app location card, and $100M / $450M / 9 invoices',async()=>{
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
 const orders=renderToStaticMarkup(createElement(SceneLabels,{shot:3,elapsed:8,orders:sceneThreeOrders(index)}));
 assert.equal((orders.match(/class="scene-location"/g)??[]).length,0);
 assert.ok(!orders.includes('September 9, 2025 · Cupertino'));
 for(const text of ['Samsung Display','Corning','Sony','$100M','$50M','December 8, 2025'])assert.ok(orders.includes(text),text);
 const {ShotOverlays}=await component('ShotOverlays');
 const engine=new PlaybackEngine(index);playShot(engine,17);engine.tick(11);
 const totals=renderToStaticMarkup(createElement(ShotOverlays,{engine,state:engine.state}));
 assert.deepEqual([...totals.matchAll(/<strong>(.*?)<\/strong>/g)].map(m=>m[1]),['$100M','$450M','9']);
 assert.ok(!totals.includes('opacity:0'));
});

test('year-end settlement count excludes partial payments and agrees with the frozen fixture total', () => {
  const engine=new PlaybackEngine(index);engine.seek(364.999);
  const complete=new Set(index.payments.filter(e=>['issue','pay'].includes(e.type)&&e.data.outstanding_cents!=null&&Number(e.data.outstanding_cents)===0).map(e=>e.invoiceId));
  // Pinned against the frozen public/events.ndjson fixture (DATA FREEZE, no
  // sim reruns): 6,923 invoices reach outstanding_cents===0 by day 365. This
  // replaces a stale 6,943 left over from a since-superseded data generation,
  // which made this assertion throw before the engine parity check below
  // ever ran — masking whether invoicesSettled() itself still agreed.
  assert.equal(complete.size,6923);
  assert.equal(engine.invoicesSettled(),complete.size);
  const missing=index.payments.find(e=>e.type==='issue')!;
  engine.storyEvents=[{...missing,data:{...missing.data,outstanding_cents:undefined}}];
  assert.equal(engine.invoicesSettled(),0,'Missing balance is not evidence of full settlement');
});
