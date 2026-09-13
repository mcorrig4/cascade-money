import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createIndex, finishIndex } from '../src/data/index.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { playFilm, playShot, SHOTS } from '../src/director/shots.ts';
import { siteFrame } from '../src/globe/site-math.ts';
import { cameraAllowsRoll, normalizeBookmarks } from '../src/camera/primitives.ts';
import { setRecordingMode } from '../src/director/recording.ts';
import { worldNorth, applyCameraOrientation } from '../src/camera/orientation.ts';

const emptyIndex=()=>{const index=createIndex();finishIndex(index);return index;};
const angle=(a:Vector3,b:Vector3)=>a.angleTo(b)*180/Math.PI;

test('stage18: all authored film scenes remain north-up at starts and every thirty frames',async()=>{
 const engine=new PlaybackEngine(emptyIndex()),camera=new PerspectiveCamera(),target=new Vector3();
 const starts:number[]=[],sampleCounts=new Map<number,number>();
 await playFilm(engine);
 let previous:number|null=null;
 // All actual authored scenes, with their real transition scheduler and durations.
 const budget=Math.ceil(SHOTS.reduce((total,shot)=>total+shot.seconds,0)*60)+120;
 for(let frame=0;frame<budget;frame++){
  const shot=SHOTS.find(shot=>shot.id===engine.state.shot)!;
  const start=shot.id!==previous;
  if(start){starts.push(shot.id);previous=shot.id;camera.up.set(.8,-.2,.5).normalize();}
  const pose=engine.currentCamera();
  camera.position.copy(siteFrame(pose.lat,pose.lng,100*(1+pose.altitude)).position);
  // Exercise the production resolver with deliberately contaminated incoming up.
  applyCameraOrientation(camera,target,cameraAllowsRoll(engine.state.camera,engine.state.cameraElapsed));
  if(start||frame%30===0){
   assert.equal(engine.state.allowRoll,shot.allowRoll===true,`shot ${shot.id} roll policy`);
   if(!shot.allowRoll){
    const expected=siteFrame(pose.lat,pose.lng,100).north;
    assert.ok(angle(worldNorth(camera.position,target),expected)<1e-5,'North agrees with the geographic site convention');
    assert.ok(angle(camera.up,expected)<1,`shot ${shot.id}, frame ${frame}: camera is north-up`);
    sampleCounts.set(shot.id,(sampleCounts.get(shot.id)??0)+1);
   }
  }
  if(!engine.state.film)break;
  engine.tick(1/60);
 }
 assert.deepEqual(starts,SHOTS.map(shot=>shot.id),'The complete authored sequence must run, including its last scene');
 for(const shot of SHOTS.filter(shot=>!shot.allowRoll))assert.ok((sampleCounts.get(shot.id)??0)>1,`Repeated samples for shot ${shot.id}`);
});

test('stage18: a local target uses its geographic north and intentional roll is opt-in',()=>{
 const camera=new PerspectiveCamera(),frame=siteFrame(37.3349,-122.009,100);
 const target=frame.position.clone();camera.position.copy(target).addScaledVector(frame.up,10).addScaledVector(frame.east,5);
 camera.up.copy(frame.east);applyCameraOrientation(camera,target,true);
 assert.ok(angle(camera.up,frame.east)<1e-6,'Opt-in retains authored orientation');
 applyCameraOrientation(camera,target);
 assert.ok(angle(camera.up,frame.north)<1e-6,'Unset policy resets to target north');
 for(const position of [new Vector3(0,100,0),new Vector3(0,-100,0),new Vector3()]){
  const north=worldNorth(position,new Vector3());assert.ok(north.toArray().every(Number.isFinite));assert.ok(Math.abs(north.length()-1)<1e-6);
 }
});

test('stage18: repeated starts and timeline seeks publish an orientation reset',()=>{
 const engine=new PlaybackEngine(emptyIndex());playShot(engine,1);
 const first=engine.state.orientationRevision;playShot(engine,1);
 assert.ok(engine.state.orientationRevision>first);
 engine.resetOrientation(true);const beforeSeek=engine.state.orientationRevision;engine.seek(30);
 assert.ok(engine.state.orientationRevision>beforeSeek);assert.equal(engine.state.allowRoll,false);
 assert.equal(engine.state.shot,null);
});

test('stage18: opening and California hook stay on the globe and share their handoffs',()=>{
 const engine=new PlaybackEngine(emptyIndex()),opening=SHOTS[0],hook=SHOTS[1],third=SHOTS[2];
 assert.equal(opening.id,1);assert.equal(hook.id,2);
 assert.equal(opening.site,undefined);assert.equal(hook.site,undefined);assert.notEqual(hook.allowRoll,true);
 playShot(engine,1);const start=engine.currentCamera();engine.tick(.5);const rotating=engine.currentCamera();
 assert.ok(start.altitude>1&&rotating.altitude>1);assert.notEqual(start.lng,rotating.lng);
 playShot(engine,2);let minimum=Infinity;
 for(let i=0;i<Math.ceil(hook.seconds*60);i++){minimum=Math.min(minimum,engine.currentCamera().altitude);assert.equal(engine.state.camera.site,undefined);engine.tick(1/60);}
 assert.ok(minimum<1,'California receives a closer framing');assert.ok(engine.currentCamera().altitude>1,'Hook returns to the wide globe');
 assert.deepEqual(hook.start,opening.end);assert.deepEqual(third.start,hook.end);
 const cues=third.orderCues!;assert.deepEqual(cues.map(cue=>cue.word),['Samsung','Corning','Sony']);
});


test('stage18: generic primitives and bookmarks default north-up; recording entry resets before drawing',()=>{
 const engine=new PlaybackEngine(emptyIndex());
 engine.fly(25,-100,1.8,1000);assert.equal(cameraAllowsRoll(engine.state.camera),false);
 engine.orbit({lat:25,lng:-100},1000,.4,1,1000);assert.equal(cameraAllowsRoll(engine.state.camera),false);
 engine.splinePath([{lat:25,lng:-100,altitude:1,t:0},{lat:35,lng:-120,altitude:1,t:1}],1000);
 assert.equal(cameraAllowsRoll(engine.state.camera),false);
 const bookmarks=[{lat:25,lng:-100,altitude:1,sceneId:null,time:0,holdMs:0,travelMs:1000},{lat:35,lng:-120,altitude:1,sceneId:null,time:1,holdMs:0,travelMs:1000}];
 engine.playBookmarkPath(bookmarks);assert.equal(cameraAllowsRoll(engine.state.camera,500),false);
 engine.playBookmarkPath(bookmarks.map(bookmark=>({...bookmark,allowRoll:true})));assert.equal(cameraAllowsRoll(engine.state.camera,500),true);
 engine.playBookmarkPath([{...bookmarks[0],allowRoll:true},bookmarks[1]]);assert.equal(cameraAllowsRoll(engine.state.camera,1000),false);
 // Shot 10 ("New York") is cut (scene-11-delete pass, 2026-09-13); shot 19
 // ("Beneath it") is now the allowRoll:true fifth-avenue shot exercised here.
 playShot(engine,19);engine.playBookmarkPath(bookmarks);assert.equal(cameraAllowsRoll(engine.state.camera,500),true);
 assert.throws(()=>normalizeBookmarks([{...bookmarks[0],allowRoll:'yes'}]),/roll|orientation|bookmark/i);
 playShot(engine,1);const revision=engine.state.orientationRevision;
 setRecordingMode(engine,true);assert.ok(engine.state.orientationRevision>revision);assert.equal(engine.state.allowRoll,false);
});
