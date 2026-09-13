import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatedDollar } from '../src/components/DatedDollar.ts';
import { datedUnit, extensionAt, sameDateSwapAt } from '../src/director/dated-dollar.ts';
import { shotOverlayVisible, sceneCaptureRanges } from '../src/director/recording.ts';
import { SHOTS, playFilm, DEFAULT_CASCADE } from '../src/director/shots.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { createIndex } from '../src/data/index.ts';
import { dateForDay } from '../src/data/types.ts';
import evidence from '../src/data/onchain.json' with {type:'json'};

test('dated units count down across month/year boundaries without changing maturity ISO',()=>{
 const maturityDay=120;
 for(const simulationDay of [0,30,90,119,120]){
  const unit=datedUnit(maturityDay,simulationDay);
  assert.equal(unit.days,maturityDay-simulationDay);
  assert.equal(unit.isoDate,'2026-01-07');
 }
 assert.deepEqual(datedUnit(120,121),{days:0,isoDate:'2026-01-07'});
});
test('coin renders approved geometry with dynamic number and size-dependent ISO, including spot',()=>{
 const render=(size:number,days:number|null)=>renderToStaticMarkup(createElement(DatedDollar,{size,days,isoDate:'2026-01-07'}));
 assert.match(render(96,90),/>90<\/text>/);
 assert.match(render(96,30),/>30<\/text>/);
 assert.match(render(72,30),/>2026-01-07<\/text>/);
 assert.doesNotMatch(render(71,30),/>2026-01-07<\/text>/);
 assert.doesNotMatch(render(96,null),/<rect|>90<\/text>|>2026-01-07<\/text>/);
});
test('extension fills only the new half-open interval and advances the date and N together',()=>{
 for(const tMs of [-1,0,250,500,750,1000,2000]){
  const extension=extensionAt(tMs,0,1000);
  assert.equal(extension.ticks.filter(t=>t.filled).length,extension.addedDays);
  assert.ok(extension.ticks.every(t=>t.filled===(t.day>=30&&t.day<extension.maturityDay)));
  assert.equal(datedUnit(extension.maturityDay,0).isoDate,dateForDay(extension.maturityDay));
 }
 assert.equal(extensionAt(500,0,1000).maturityDay,60);
 assert.equal(extensionAt(1000,0,1000).addedDays,60);
});
test('same-date exchange travels on opposite arcs, swaps at midpoint, and returns deterministically',()=>{
 const start=sameDateSwapAt(0,0,2000),middle=sameDateSwapAt(1000,0,2000),over=sameDateSwapAt(500,0,2000),end=sameDateSwapAt(2000,0,2000);
 assert.equal(start[0].x,middle[1].x);assert.equal(start[1].x,middle[0].x);
 assert.ok(over[0].y<0&&over[1].y>0);
 assert.ok(Math.abs(end[0].x-start[0].x)<1e-9&&Math.abs(end[0].y)<1e-9);
 assert.deepEqual(sameDateSwapAt(500,0,2000),over);
});
test('all overlays require their own nonnegative shot and film time',()=>{
 for(const shot of SHOTS){
  const state={shot:shot.id,shotElapsed:0,tMs:shot.startTime*1000};
  assert.equal(shotOverlayVisible(state,shot),true);
  assert.equal(shotOverlayVisible({...state,shotElapsed:-.001},shot),false);
  assert.equal(shotOverlayVisible({...state,tMs:state.tMs-1},shot),false);
  assert.equal(shotOverlayVisible({...state,shot:null},shot),false);
 }
});
test('19→12 transition publishes eligible overlay state atomically and capture splits use that event',()=>{
 const engine=new PlaybackEngine(createIndex()),close=SHOTS.find(s=>s.id===12)!;
 const transitions:{sceneIndex:number;sceneId:number;tMs:number}[]=[];
 let last:number|null=null;
 engine.subscribe(()=>{
  const shot=SHOTS.find(s=>s.id===engine.state.shot);
  if(shot&&shot.id!==last&&shotOverlayVisible(engine.state,shot)){
   last=shot.id;transitions.push({sceneIndex:shot.scene,sceneId:shot.id,tMs:engine.state.tMs+2000});
  }
 });
 playFilm(engine);engine.tick(close.startTime-.001);
 assert.equal(engine.state.shot,19);assert.equal(shotOverlayVisible(engine.state,close),false);
 engine.tick(.001);assert.equal(engine.state.shot,12);assert.equal(shotOverlayVisible(engine.state,close),true);
 const ranges=sceneCaptureRanges(transitions,2000,engine.state.tMs+6600);
 assert.equal(ranges.at(-2)!.endMs,ranges.at(-1)!.startMs);
 assert.ok(Math.abs(ranges.at(-1)!.startMs-close.startTime*1000)<1e-6);
});
test('branched invoice count distinguishes repeated suppliers; on-chain demo passes principal in full',()=>{
 assert.equal(DEFAULT_CASCADE.invoices,9);assert.equal(DEFAULT_CASCADE.companies,8);
 const hops=evidence.transactions.filter(t=>/ issues to | pays /.test(t.label));
 assert.equal(hops.length,4);assert.ok(hops.every(t=>t.amount==='10'&&t.unit==='USDC'));
 assert.equal(BigInt(evidence.recorded.principal)*BigInt(hops.length),BigInt(evidence.recorded.settled));
});

test('primitive holds the simulation day; invoice counter counts invoices rather than suppliers',async()=>{
 const {playShot}=await import('../src/director/shots.ts');
 const engine=new PlaybackEngine(createIndex());playShot(engine,6);engine.tick(20);
 assert.equal(engine.state.day,0);
 const base={schema:1,seq:1,type:'issue',day:0,date:'2025-09-09',amount:100n,accounts:[],data:{outstanding_cents:0},balanceSheet:{},checks:{hard:{},breaches:{}},cutoff:{day:0,value:'0'},invoiceId:'one',to:'same-supplier'} as const;
 engine.storyEvents=[base,{...base,seq:2,type:'pay',invoiceId:'two'},{...base,seq:3,type:'pay',invoiceId:'two'}];
 assert.equal(engine.invoicesSettled(),2);
 engine.update({paymentPresentation:'waiting'});assert.equal(engine.invoicesSettled(),0);
});

test('recording mode consumes scene events and preserves actual timing across a stalled Close boundary',async()=>{
 const {SceneRecording}=await import('../src/director/recording.ts');
 const recording=new SceneRecording();
 const previous={sceneIndex:16,sceneId:19,tMs:2000,filmTMs:240000};
 recording.begin(3000,previous);
 // Wall-clock stalls must lengthen the preceding captured scene; nominal durations are irrelevant.
 const close={sceneIndex:17,sceneId:12,tMs:15000,filmTMs:250200};
 recording.consume(close);recording.consume(close);
 const take=recording.end(19000)!;
 assert.deepEqual(take.ranges.map(r=>[r.sceneId,r.startMs,r.endMs]),[[19,0,12000],[12,12000,16000]]);
 recording.consume({...close,sceneId:1,tMs:20000});assert.deepEqual(recording.snapshot(21000),take);
});
