import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SHOTS,FILM_SECONDS,playFilm,playShot,COMPOSABLE_BEATS,COIN_BEATS} from '../src/director/shots.ts';
import {PlaybackEngine} from '../src/playback/engine.ts';
import {createIndex,appendEvent,finishIndex} from '../src/data/index.ts';
import {parseLine} from '../src/data/adapters.ts';
import {easeAt,longitudeDelta,orbitAt,splineAt,sampleCamera,EARTH_METERS,SUBSURFACE_INTERIOR_CAMERA_HOOK} from '../src/camera/primitives.ts';
const index=createIndex();(await readFile(new URL('./fixtures/events-v1.ndjson',import.meta.url),'utf8')).trim().split('\n').forEach(l=>appendEvent(index,parseLine(l)));finishIndex(index);
test('12 scenes cover narration v6, preserve API IDs and connect every declared boundary',()=>{
 // Scene-11-delete pass (2026-09-13, Liam 04:15 EDT): shot 10 ("New York",
 // the store flight + stair descent) is cut — the store beat is dropped.
 // Scene 8 ("Underneath it", shot 18) STAYS. 12 shots remain: ids 1, 2, 3,
 // 16, 4, 17, 6, 18, 5, 11, 19, 12 (in play order).
 // Scene 3 carries an authored bookmark flight (33.6s of travel and holds,
 // timed to the recorded take), and buildShots floors a shot's duration at its
 // path length — so its provisional 20.2s word-count estimate is superseded and
 // the film's provisional total moves with it (186.4 - 20.2 + 33.6).
 assert.ok(Math.abs(FILM_SECONDS-199.8)<1e-7);assert.equal(new Set(SHOTS.map(s=>s.id)).size,12);
 assert.deepEqual(SHOTS.map(s=>s.seconds),[6.6,16.2,33.6,8.2,23,13,27.8,20.6,18.2,17.8,10.2,4.6]);
 for(let i=0;i<SHOTS.length;i++){
  // Stage 18's scene 2 (California zoom -> Apple marker approach -> pull-out)
  // legitimately names a hold beat in its motion string; every other shot
  // still must not describe itself as holding.
  const shot=SHOTS[i];assert.ok(shot.motion && (shot.id===2||!shot.motion.includes('hold')));
  if(i){assert.deepEqual(shot.start,SHOTS[i-1].end);assert.equal(shot.startTime,SHOTS[i-1].endTime);}
 }
 assert.equal(SHOTS.find(s=>s.id===6)?.scene,7);assert.equal(SHOTS.find(s=>s.id===18)?.scene,8);
 assert.equal(SHOTS.find(s=>s.id===19)?.scene,11);assert.equal(SHOTS.find(s=>s.id===11)?.seconds,17.8);
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
test('large ticks match frame-by-frame film timing; pause preserves the camera clock',()=>{
 // The old Rewind shot (id 13's global reverse-timelapse + flash) was cut
 // long before the scene-11-delete pass and has no table entry any more —
 // dropped the flash/exposure assertions that exercised its now-dead
 // playShot branch (removed alongside this test update) along with it.
 const a=new PlaybackEngine(index),b=new PlaybackEngine(index);playFilm(a);playFilm(b);
 a.tick(FILM_SECONDS);for(let i=0;i<Math.round(FILM_SECONDS*30);i++)b.tick(1/30);
 assert.equal(a.state.shot,b.state.shot);assert.ok(Math.abs(a.state.shotElapsed-b.state.shotElapsed)<1e-7);
 const e=new PlaybackEngine(index);playShot(e,3);e.tick(1);e.toggle();const before=sampleCamera(e.state.camera,e.state.cameraElapsed);e.tick(2);assert.deepEqual(sampleCamera(e.state.camera,e.state.cameraElapsed),before);
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

test('opening shot rotates from its first frame and remains at whole-Earth scale',async()=>{
 const {siteFrame}=await import('../src/globe/site-math.ts');
 const {OPENING_ROTATION}=await import('../src/director/shots.ts');
 const e=new PlaybackEngine(index);playShot(e,1);
 const opening=sampleCamera(e.state.camera,0),next=sampleCamera(e.state.camera,1000/60);
 assert.ok(opening.altitude>1);assert.equal(e.state.camera.site,undefined);
 assert.equal(e.state.camera.bookmarkPath,undefined);
 assert.ok(Math.abs((next.lng-opening.lng)*60-OPENING_ROTATION)<1e-8,'First visible frame already has the authored angular velocity');
 for(let frame=0;frame<=Math.floor(SHOTS[0].seconds*60);frame++){
  const pose=sampleCamera(e.state.camera,frame*1000/60);
  assert.ok(Math.abs(pose.altitude-opening.altitude)<1e-12);assert.ok(Math.abs(pose.lat-opening.lat)<1e-12);
  const eye=siteFrame(pose.lat,pose.lng,EARTH_METERS).position.multiplyScalar(1+pose.altitude);
  assert.ok(eye.length()>2*EARTH_METERS,'Wide scene cannot enter a campus model');
 }
 e.tick(SHOTS[0].seconds);
 assert.deepEqual(sampleCamera(e.state.camera,e.state.cameraElapsed),SHOTS[0].end);
 assert.deepEqual(SHOTS[1].start,SHOTS[0].end,'The California take inherits the opening boundary');
});

test('scene 2 continuously zooms to California, holds, and returns wide at every narration scale',async()=>{
 const {applyNarrationDurations,CALIFORNIA_HOLD,APPLE_MARKER_APPROACH}=await import('../src/director/shots.ts');
 try{
  for(const scale of [1,.8,1.25]){
   applyNarrationDurations({'2':16.2*scale});
   const e=new PlaybackEngine(index);playShot(e,2);const shot=SHOTS[1],command=e.state.camera;
   assert.equal(command.primitive?.kind,'spline');assert.equal(command.site,undefined);assert.equal(command.landmarkPath,undefined);
   assert.deepEqual(sampleCamera(command,0),shot.start);
   let previous=shot.start.altitude;
   for(let sample=1;sample<=30;sample++){
    const pose=sampleCamera(command,command.duration*sample/100);
    assert.ok(pose.altitude<=previous+1e-12,'Zoom-in stays monotonic');previous=pose.altitude;
   }
   for(const fraction of [.3,.4,.5])for(const field of ['lat','lng','altitude'] as const)assert.ok(Math.abs(sampleCamera(command,command.duration*fraction)[field]-CALIFORNIA_HOLD[field])<1e-10);
   previous=APPLE_MARKER_APPROACH.altitude;
   assert.deepEqual(sampleCamera(command,command.duration*.75),APPLE_MARKER_APPROACH);
   assert.ok(shot.end.altitude<shot.start.altitude);
   for(let sample=76;sample<=100;sample++){
    const pose=sampleCamera(command,command.duration*sample/100);
    assert.ok(pose.altitude>=previous-1e-12,'Final clause zooms back out monotonically');previous=pose.altitude;
   }
   e.tick(shot.seconds);assert.equal(e.state.shotRunning,false);
   assert.deepEqual(sampleCamera(command,e.state.cameraElapsed),shot.end);
   assert.deepEqual(SHOTS[2].start,shot.end,'Next scene inherits wide framing');
  }
 }finally{applyNarrationDurations({});}
});

test('recording visibility defaults to the product HUD with an explicit clean-frame option',async()=>{
 const {recordingVisibility}=await import('../src/director/recording.ts');
 const e=new PlaybackEngine(index);
 assert.equal(e.state.hud,true);
 for(const recording of [false,true])for(const hud of [false,true]){
  e.update({recording,hud});
  assert.deepEqual(recordingVisibility(recording,hud),{hud:!recording||hud,director:!recording,story:!recording,network:!recording});
 }
 e.update({recording:true,hud:false});assert.equal(e.state.hud,false);
});

test('bookmarks append immutable camera snapshots and export the same JSON',async()=>{
 const {CameraBookmarks}=await import('../src/director/bookmarks.ts');
 const book=new CameraBookmarks(),pose={lat:37,lng:-122,altitude:.001};
 book.append(pose,2,3);pose.lat=0;
 book.append({lat:38,lng:-121,altitude:.002},2,6);
 let downloaded='';
 let logged='';
 const json=await book.export(async value=>{downloaded=value;},value=>{logged=value;});
 assert.equal(logged,json);assert.equal(book.items[0].holdMs,0);assert.equal(book.items[0].travelMs,2500);
 assert.equal(downloaded,json);assert.deepEqual(JSON.parse(json),book.items);
 assert.equal(book.items[0].lat,37);assert.equal(book.items.length,2);
});

test('bookmark spline uses editable timing, unwraps longitude and rejects invalid poses',async()=>{
 const {fromBookmarks}=await import('../src/camera/primitives.ts');
 const a={lat:1,lng:179,altitude:1,time:5,sceneId:2};
 const b={lat:2,lng:-179,altitude:2,time:8,sceneId:2};
 const keys=fromBookmarks([a,b]);
 assert.deepEqual(keys,[{lat:1,lng:179,altitude:1,t:0},{lat:2,lng:181,altitude:2,t:2.5}]);
 assert.deepEqual(splineAt(keys,3),{lat:2,lng:181,altitude:2});
 assert.throws(()=>fromBookmarks([a]));
 assert.equal(fromBookmarks([a,{...b,time:5,sceneId:10}]).at(-1)!.t,2.5);
 assert.throws(()=>fromBookmarks([a,{...b,lat:NaN}]));
});

test('edited bookmarks replace in memory atomically and preserve defaults',async()=>{
 const {CameraBookmarks}=await import('../src/director/bookmarks.ts');
 const book=new CameraBookmarks(),reference=book.items;
 book.append({lat:1,lng:2,altitude:1},1,0);
 book.load(JSON.stringify([{lat:3,lng:4,altitude:2,sceneId:10,time:0,holdMs:1200,travelMs:4000}]));
 assert.equal(book.items,reference);assert.equal(book.items.length,1);
 assert.equal(book.items[0].holdMs,1200);assert.equal(book.items[0].travelMs,4000);
 assert.throws(()=>book.load('[{"lat":0}]'));assert.equal(book.items[0].lat,3);
});

test('bookmark flight has continuous velocity between legs and exact stationary dwell',async()=>{
 const {fromBookmarks}=await import('../src/camera/primitives.ts');
 const list=[0,1,2].map((lat,i)=>({lat,lng:lat,altitude:1,sceneId:1,time:i,holdMs:0,travelMs:i===2?4000:2000}));
 let keys=fromBookmarks(list);
 const epsilon=.00001;
 const before=(splineAt(keys,2).lat-splineAt(keys,2-epsilon).lat)/epsilon;
 const after=(splineAt(keys,2+epsilon).lat-splineAt(keys,2).lat)/epsilon;
 assert.ok(Math.abs(before-after)<.0001);assert.ok(after>0);
 list[1].holdMs=1000;keys=fromBookmarks(list);
 assert.equal(keys.at(-1)!.t,7);
 for(const t of [2,2.3,2.9,3])assert.deepEqual(splineAt(keys,t),{lat:1,lng:1,altitude:1});
 const e=new PlaybackEngine(index);assert.equal(e.playBookmarkPath(list),7000);
 assert.equal(e.state.camera.primitive?.kind,'spline');
});

test('shot bookmark path supersedes initial and scheduled authored moves',()=>{
 const shot=SHOTS.find(s=>s.id===2)!;
 shot.path=[0,1,2].map((n)=>({lat:37+n*.01,lng:-122,altitude:.001,sceneId:2,time:n,holdMs:0,travelMs:2000}));
 try{
  const e=new PlaybackEngine(index);playShot(e,2);
  const id=e.state.camera.id;
  assert.equal(e.state.camera.bookmarkPath,true);
  e.tick(14);
  assert.equal(e.state.camera.id,id,'Scheduled arch and pull-out do not replace edited path');
  assert.equal(e.state.camera.primitive?.kind,'spline');
  playShot(e,6);assert.notEqual(e.state.camera.id,id,'Next scene restores authored camera');
 }finally{delete shot.path;}
});
