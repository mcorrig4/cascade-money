import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SHOTS, buildShots, applyNarrationDurations, parseNarrationDurations, loadNarrationDurations, playFilm, playShot, nextShot, narrationTime, DEFAULT_CASCADE, CASCADE_FIGURES, straightProofPayments, proofMaturity } from '../src/director/shots.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { createIndex, appendEvent, finishIndex } from '../src/data/index.ts';
import { parseLine } from '../src/data/adapters.ts';
import { ArcPool } from '../src/globe/arc-pool.ts';
const index=createIndex();
(await readFile(new URL('./fixtures/events-v1.ndjson',import.meta.url),'utf8')).trim().split('\n').forEach(line=>appendEvent(index,parseLine(line)));
finishIndex(index);

test('each v6 scene title, word count and provisional duration comes from its narration',async()=>{
 const script=await readFile(new URL('../../docs/script-v6-liam.md',import.meta.url),'utf8');
 const allScenes=[...script.matchAll(/Scene (\d+) — ([^\n]+)\n([\s\S]*?)(?=\nScene |$)/g)];
 assert.equal(allScenes.length,17);
 // Scenes 3 (Rewind), 5 (The contradiction), 12 (Stress test) and 13 (The
 // rules survive) were cut before the reorder-to-13 pass; scene 15 (New
 // York) is cut by the scene-11-delete pass (2026-09-13, Liam 04:15 EDT).
 // The surviving 12 play in SHOTS' own order, which is the REORDERED play
 // order (reorder-to-13 pass), not the script doc's own scene order — e.g.
 // "A dollar with a date" now plays before "Run the year", the reverse of
 // the script — so look each SHOTS title up by name rather than zipping by
 // position.
 const cutTitles=new Set(['Rewind','The contradiction','Stress test','The rules survive','New York']);
 const byTitle=new Map(allScenes.filter(scene=>!cutTitles.has(scene[2])).map(scene=>[scene[2],scene]));
 assert.equal(byTitle.size,12);assert.equal(SHOTS.length,12);
 for(const shot of SHOTS){
  const scene=byTitle.get(shot.title);
  assert.ok(scene,`no script scene named "${shot.title}"`);
  const words=scene![3].match(/\b[\w]+(?:[’'-][\w]+)*\b/g)?.length??0;
  assert.equal(shot.words,words);
  assert.equal(shot.baseSeconds,Math.round((words*.4+1)*10)/10);
 }
 const scriptWords=[...byTitle.values()].reduce((n,scene)=>n+(scene[3].match(/\b[\w]+(?:[’'-][\w]+)*\b/g)?.length??0),0);
 assert.equal(SHOTS.reduce((n,s)=>n+s.words,0),scriptWords);
});

test('duration maps validate scene keys, units and positivity; partial takes retain fallback scenes',()=>{
 // Scenes run 1-12 (scene-11-delete pass, 2026-09-13) — '13' (valid before
 // it) now joins '18' as an out-of-range key.
 assert.deepEqual(parseNarrationDurations({durations:{'1':8.25,'12':6}}),{'1':8.25,'12':6});
 assert.deepEqual(parseNarrationDurations({'1':8.25}),{'1':8.25});
 for(const value of [null,[],{durations:[]},{durations:{'0':2}},{durations:{'13':2}},{durations:{'18':2}},{'1':0},{'1':-2},{'1':NaN},{'1':Infinity},{'1':'8s'}])assert.throws(()=>parseNarrationDurations(value));
 const shots=buildShots({'1':8.25});assert.equal(shots[0].seconds,8.25);
 assert.equal(shots[1].seconds,16.2);assert.equal(shots[1].startTime,8.25);
});

test('recorded durations retime camera cues, reveals, captures and transitions together',()=>{
 try{
  applyNarrationDurations(Object.fromEntries(SHOTS.map(s=>[String(s.scene),s.baseSeconds*.6])));
  const engine=new PlaybackEngine(index);engine.setClockMode('manual');playFilm(engine);
  let clock=0;
  for(const shot of SHOTS){
   const target=shot.startTime+shot.captureAt;
   engine.tick(target-clock,'manual');clock=target;
   assert.equal(engine.state.shot,shot.id);
   assert.ok(Math.abs(engine.state.shotElapsed-shot.captureAt)<1e-7);
   // Narration-scale factor is .6 for every shot in this synthetic run, EXCEPT
   // a shot with a recorded `path` (shot 1's whole-Earth-to-Apple-Park bookmark
   // flight): its playback duration floors at the flight's own real-time length
   // (engine.beginShot's Math.max, exposed as state.shotDuration) rather than
   // shrinking with the narration scale — so derive the expected value from
   // shotDuration itself, which reduces to captureAt/.6 for every non-path shot.
   assert.ok(Math.abs(narrationTime(engine.state)-shot.captureAt*shot.baseSeconds/engine.state.shotDuration)<1e-7);
   assert.ok(engine.state.camera.duration>0);
   if(shot.scene>1)assert.deepEqual(shot.start,SHOTS[shot.scene-2].end);
  }
 }finally{applyNarrationDurations({});}
});

test('missing or malformed optional narration leaves the film usable; a valid take is applied',async()=>{
 try{
  assert.equal(await loadNarrationDurations('/narration.json',async()=>new Response('',{status:404})),false);
  assert.equal(await loadNarrationDurations('/narration.json',async()=>new Response('bad json')),false);
  assert.equal(SHOTS[0].seconds,6.6);
  assert.equal(await loadNarrationDurations('/narration.json',async()=>Response.json({durations:{'1':7.7}})),true);
  assert.equal(SHOTS[0].seconds,7.7);
 }finally{applyNarrationDurations({});}
});

test('straight proof uses four existing connected events, real amounts with branched default totals',()=>{
 const proof=straightProofPayments(index);
 assert.equal(proof.length,4);assert.ok(proof.every(e=>index.payments.includes(e)));
 const e=new PlaybackEngine(index);playShot(e,4);e.tick(20);
 assert.equal(e.storyEvents?.length,4);assert.deepEqual(e.totals(),{committed:10000000000n,settled:40000000000n});
 assert.equal(e.state.paymentMaturity,null);
 playShot(e,17);assert.deepEqual(e.totals(),DEFAULT_CASCADE);
 assert.equal(DEFAULT_CASCADE.companies,8);assert.equal(CASCADE_FIGURES.branched.settled,45000000000n);
 assert.equal(CASCADE_FIGURES.branched.companies,8);
});

test('unpaid arcs grow then stay dashed without retiring or incrementing settlement',()=>{
 const e=new PlaybackEngine(index);playShot(e,3);e.tick(18);
 assert.equal(e.state.paymentPresentation,'waiting');assert.equal(e.totals().settled,0n);
 const pool=new ArcPool();pool.add(index.payments[0],index,0,3500);
 pool.tick(100,true);assert.ok(pool.arcs[0].clipEnd<1);
 pool.tick(20000,true);assert.equal(pool.arcs.length,1);
 assert.equal(pool.arcs[0].clipStart,0);assert.equal(pool.arcs[0].clipEnd,1);assert.equal(pool.arcs[0].alpha,1);
 pool.tick(20000,false);assert.equal(pool.arcs.length,0);
});

test('vault glimpse is bounded by its scene and Beneath it invokes the calibrated descent',()=>{
 // Shot 10 ("New York", the store flight + stair descent) is cut
 // (scene-11-delete pass, 2026-09-13) — shot 19 (Beneath it) now performs
 // this same fly-in + interior-camera-hook choreography unconditionally,
 // since there's no longer a preceding shot to hand off from.
 const e=new PlaybackEngine(index);playShot(e,18);e.tick(16);
 assert.equal(e.state.onchainGlimpse,true);playShot(e,nextShot(18));assert.equal(e.state.onchainGlimpse,false);
 let duration=0;e.subsurfaceInteriorCameraHook=ms=>{duration=ms;return true;};
 playShot(e,19);e.tick(e.state.shotDuration*.28);
 assert.ok(Math.abs(duration-10.2*1000*.72)<1e-7);
 assert.equal(e.state.camera.site,'fifth-avenue');
});

test('branched default follows every connected source payment without inflating amounts',()=>{
 const branch=createIndex(),base=index.payments[0];
 const pairs=[['Apple','Samsung Display'],['Samsung Display','Corning'],['Corning','Silica'],['Silica','Refining'],['Silica','Pacific Freight']];
 const amounts=[100n,100n,60n,40n,20n];
 const events=pairs.map(([from,to],i)=>({...base,seq:i+1,from,to,amount:amounts[i],type:i?'pay':'issue',invoiceId:'apple:'+i}));
 branch.payments=events;branch.days[0].events=events;
 branch.stories=events.map(e=>({storyId:'apple',beat:String(e.seq),event:e,payment:e,cameraAccounts:[]}));
 const e=new PlaybackEngine(branch);playShot(e,4);e.tick(20);
 assert.deepEqual(e.storyEvents?.map(e=>e.to),['Samsung Display','Corning','Silica','Refining','Pacific Freight']);
 assert.deepEqual(branch.payments.map(e=>e.amount),amounts);
 assert.equal(e.totals().settled,320n);
 e.stopShot();assert.equal(e.state.paymentAmount,null);
});
