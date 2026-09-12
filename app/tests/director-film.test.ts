import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SHOTS,FILM_SECONDS,playFilm,playShot,COMPOSABLE_BEATS,COIN_BEATS} from '../src/director/shots.ts';
import {PlaybackEngine} from '../src/playback/engine.ts';
import {createIndex,appendEvent,finishIndex} from '../src/data/index.ts';
import {parseLine} from '../src/data/adapters.ts';
import {easeAt,longitudeDelta,orbitAt,splineAt,sampleCamera,EARTH_METERS,SUBSURFACE_INTERIOR_CAMERA_HOOK} from '../src/camera/primitives.ts';
const index=createIndex();(await readFile(new URL('./fixtures/events-v1.ndjson',import.meta.url),'utf8')).trim().split('\n').forEach(l=>appendEvent(index,parseLine(l)));finishIndex(index);
test('17 scenes cover narration v6, preserve API IDs and connect every declared boundary',()=>{
 assert.ok(Math.abs(FILM_SECONDS-258.2)<1e-7);assert.equal(new Set(SHOTS.map(s=>s.id)).size,17);
 assert.deepEqual(SHOTS.map(s=>s.seconds),[6.6,16.2,19.8,20.2,16.6,8.2,23,13,18.2,27.8,20.6,11.8,12.2,17.8,11.4,10.2,4.6]);
 for(let i=0;i<SHOTS.length;i++){
  const shot=SHOTS[i];assert.ok(shot.motion && !shot.motion.includes('hold'));
  if(i){assert.deepEqual(shot.start,SHOTS[i-1].end);assert.equal(shot.startTime,SHOTS[i-1].endTime);}
 }
 assert.equal(SHOTS.find(s=>s.id===6)?.scene,10);assert.equal(SHOTS.find(s=>s.id===9)?.scene,12);
 assert.equal(SHOTS.find(s=>s.id===10)?.scene,15);assert.equal(SHOTS.find(s=>s.id===11)?.seconds,17.8);
 assert.equal(COMPOSABLE_BEATS.at(-1)?.title,'Derivatives');assert.ok(COIN_BEATS.every((b,i)=>!i||b.at-COIN_BEATS[i-1].at<=8));
});
test('cubic and bezier moves are monotone, bounded and respect forced hemisphere travel',()=>{
 for(const ease of [{kind:'cubic'} as const,{kind:'bezier',points:[.12,.65,.18,1]} as const]){
  let previous=0;
  for(let i=0;i<=100;i++){const value=easeAt(i/100,ease as Parameters<typeof easeAt>[1]);assert.ok(value>=previous&&value<=1);previous=value;}
  assert.ok(easeAt(0,ease as Parameters<typeof easeAt>[1])<1e-7);assert.ok(easeAt(1,ease as Parameters<typeof easeAt>[1])>1-1e-7);
 }
 assert.equal(longitudeDelta(127.06,-84.85,'west'),-211.91);
 assert.ok(longitudeDelta(-157,127.06,'west')<0);
});
test('orbit uses real meters and spline preserves waypoint positions and endpoint tangents',()=>{
 const center={lat:0,lng:0,altitude:.001};const pose=orbitAt(center,1000,.002,0);
 assert.ok(Math.abs(pose.lat-1000/EARTH_METERS*180/Math.PI)<1e-10);assert.equal(pose.altitude,.002);
 const keys=[{lat:0,lng:0,altitude:.001,t:0,tangent:{lat:0,lng:0,altitude:0}},{lat:1,lng:2,altitude:.002,t:.5},{lat:0,lng:4,altitude:.0001,t:1,tangent:{lat:0,lng:0,altitude:0}}];
 assert.deepEqual(splineAt(keys,.5),{lat:1,lng:2,altitude:.002});assert.equal(splineAt(keys,1).lng,4);
 assert.ok(Math.abs(splineAt(keys,.00001).lng)<1e-7);
});
test('film advances exact boundaries without zero-duration camera cuts and exposes interior hook',()=>{
 const e=new PlaybackEngine(index);playFilm(e);
 const changes:{id:number;duration:number}[]=[];let camera=-1;
 e.subscribe(()=>{if(e.state.camera.id!==camera){camera=e.state.camera.id;changes.push({id:camera,duration:e.state.camera.duration});}});
 for(let i=0;i<SHOTS.length;i++){
  assert.equal(e.state.shot,SHOTS[i].id);e.tick(SHOTS[i].seconds);
  if(i<SHOTS.length-1)assert.equal(e.state.shotElapsed,0);
 }
 assert.equal(e.state.shotRunning,false);assert.equal(e.state.shot,12);
 assert.ok(changes.every(c=>c.duration>0));assert.equal(SUBSURFACE_INTERIOR_CAMERA_HOOK,'subsurface-interior-camera');
});
test('large ticks match frame-by-frame film timing; flash and pause preserve the camera clock',()=>{
 const a=new PlaybackEngine(index),b=new PlaybackEngine(index);playFilm(a);playFilm(b);
 a.tick(FILM_SECONDS);for(let i=0;i<Math.round(FILM_SECONDS*30);i++)b.tick(1/30);
 assert.equal(a.state.shot,b.state.shot);assert.ok(Math.abs(a.state.shotElapsed-b.state.shotElapsed)<1e-7);
 const e=new PlaybackEngine(index);playFilm(e);e.tick(SHOTS[2].startTime+1.3);assert.equal(e.state.shot,13);assert.equal(e.state.exposure,1);
 e.tick(.7);assert.ok(e.state.exposure<1e-8);playShot(e,3);e.tick(1);e.toggle();const before=sampleCamera(e.state.camera,e.state.cameraElapsed);e.tick(2);assert.deepEqual(sampleCamera(e.state.camera,e.state.cameraElapsed),before);
});

test('every camera command inherits the preceding sampled pose at its exact cue boundary',()=>{
 const e=new PlaybackEngine(index);playFilm(e);
 let previous=sampleCamera(e.state.camera,e.state.cameraElapsed),id=e.state.camera.id;
 e.subscribe(()=>{
   if(e.state.camera.id!==id){
     const from=e.state.camera.from!;
     assert.ok(Math.abs(from.lat-previous.lat)<1e-7);
     assert.ok(Math.abs(longitudeDelta(from.lng,previous.lng))<1e-7);
     assert.ok(Math.abs(from.altitude-previous.altitude)<1e-7);
     id=e.state.camera.id;
   }
   previous=sampleCamera(e.state.camera,e.state.cameraElapsed);
 });
 e.tick(FILM_SECONDS);
});

test('capture offsets stay inside every scene and ignore intervening real-time frames',()=>{
 const e=new PlaybackEngine(index);
 e.setClockMode('manual');
 // Repeat on the same engine, as the two viewport passes do.
 for(let pass=0;pass<2;pass++){
  playFilm(e);
  let playing=e.state.playing,clock=0;
  e.update({playing:false,shotRunning:false});
  for(const shot of SHOTS){
   assert.ok(shot.captureAt>0&&shot.captureAt<shot.seconds);
   const target=shot.startTime+shot.captureAt;
   // A slow browser can spend longer than the entire opening rendering.
   e.tick(10);
   e.update({playing,shotRunning:true});
   e.tick(target-clock,'manual');
   playing=e.state.playing;
   e.update({playing:false,shotRunning:false});
   const snapshot=e.state;
   e.tick(30);
   assert.equal(e.state,snapshot);
   assert.equal(e.state.shot,shot.id);
   assert.ok(Math.abs(e.state.shotElapsed-shot.captureAt)<1e-7);
   clock=target;
  }
 }
 // Clock ownership, rather than paused flags, protects the startup window.
 playFilm(e);e.tick(10);assert.equal(e.state.shotElapsed,0);
 e.setClockMode('realtime');e.tick(SHOTS[0].seconds);assert.equal(e.state.shot,2);
});

test('opening orbit uses the authored Apple Park eye and fits the accepted tile radius',async()=>{
 const {appleParkShotCamera,siteFrame}=await import('../src/globe/site-math.ts');
 const authored=appleParkShotCamera(EARTH_METERS,0),e=new PlaybackEngine(index);playShot(e,1);
 const pose=sampleCamera(e.state.camera,0),eye=siteFrame(pose.lat,pose.lng,EARTH_METERS).position.multiplyScalar(1+pose.altitude);
 assert.ok(eye.distanceTo(authored.position)<.001,'Opening eye matches the site camera within a millimeter');
 assert.deepEqual(pose,SHOTS[0].start);
 const origin=siteFrame(37.3349,-122.009,EARTH_METERS).position;
 assert.ok(eye.distanceTo(origin)<2500,'Inside even the stricter 2.5 km gate, and therefore the accepted 5 km campus radius');
 e.tick(SHOTS[0].seconds);
 assert.deepEqual(sampleCamera(e.state.camera,e.state.cameraElapsed),SHOTS[1].start);
});

test('scene 2 stays in orbit for ten seconds, swoops, and pulls out only on the last clause',async()=>{
 const {applyNarrationDurations}=await import('../src/director/shots.ts');
 try{
  for(const scale of [1,.8,1.25]){
   applyNarrationDurations({'2':16.2*scale});
   const e=new PlaybackEngine(index);playShot(e,2);
   e.tick(9.999*scale);assert.equal(e.state.camera.primitive?.kind,'orbit');
   assert.ok(e.state.camera.altitude<.00004);
   e.tick(.001*scale);assert.equal(e.state.camera.primitive?.kind,'spline');
   assert.equal(e.state.camera.landmarkPath,'apple-park-arch');
   e.tick(3.599*scale);assert.equal(e.state.camera.primitive?.kind,'spline');
   e.tick(.001*scale);assert.equal(e.state.camera.primitive?.kind,'fly');
   assert.equal(e.state.camera.altitude,2.5);
   e.tick(2.6*scale);
   assert.ok(Math.abs(sampleCamera(e.state.camera,e.state.cameraElapsed).altitude-2.5)<1e-7);
   assert.equal(e.state.shotRunning,false);
  }
 }finally{applyNarrationDurations({});}
});
