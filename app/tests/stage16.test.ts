import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, PlaneGeometry, MeshBasicMaterial } from 'three';
import { RenderReadiness } from '../src/globe/readiness.ts';
import { separateSiteSurfaces } from '../src/globe/site-surfaces.ts';
import { clampCamera, cameraClearance, cameraGround, splineAt, orbitAt, EARTH_METERS } from '../src/camera/primitives.ts';
import { createIndex, finishIndex } from '../src/data/index.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { playFilm, playShot, sceneTextAt } from '../src/director/shots.ts';
import { calloutMotion } from '../src/director/cues.ts';
import { companyCues } from '../src/director/company-cues.ts';

const index=createIndex();finishIndex(index);
test('readiness holds film and recording clock until the render generation completes',async()=>{
 const engine=new PlaybackEngine(index),gate=engine.prepareScene();
 let resolved=false;const start=Promise.resolve(playFilm(engine)).then(()=>{resolved=true;});
 engine.tick(30);await Promise.resolve();assert.equal(resolved,false);assert.equal(engine.state.shot,null);
 assert.equal(engine.state.tMs,0);gate.finish();await start;
 assert.equal(engine.state.shot,1);engine.tick(.1);assert.equal(engine.state.shotElapsed,.1);
 const failed=new RenderReadiness();failed.fail(Error('decode failed'));failed.finish();
 await assert.rejects(failed.promise,/decode failed/);assert.equal(failed.complete,false);
});
test('every spline and orbit sample clears the actual campus tangent floor',()=>{
 const center={lat:37.3349,lng:-122.009},keys=[{...center,altitude:-.001,t:0},{lat:37.338,lng:-122.013,altitude:.0002,t:1},{...center,altitude:-.001,t:2}];
 for(let i=0;i<=400;i++)for(const pose of [splineAt(keys,i/200),orbitAt(center,950,-.001,i*.9)]){
  const clearance=cameraClearance(pose);assert.equal(clearance.groundMeters,3.2);assert.ok(clearance.actualMeters>=12-1e-7);
 }
 const bare=clampCamera({lat:-20,lng:35,altitude:-.3});assert.ok(bare.altitude*EARTH_METERS>=12-1e-7);
});
test('only the loaded modeled hall permits a camera below the globe',()=>{
 const pose={lat:40.7638,lng:-73.973,altitude:-4.85/EARTH_METERS};
 assert.ok(clampCamera(pose).altitude>0);
 const reference=cameraGround(pose,true);assert.equal(reference.groundMeters,-6.45);assert.equal(reference.minimumMeters,1.5);
 assert.deepEqual(clampCamera(pose,reference),pose);
 assert.equal(cameraGround({...pose,lng:pose.lng+.01},true).minimumMeters,12);
});
test('campus surfaces separate once without changing shared wall material',()=>{
 const root=new Group(),shared=new MeshBasicMaterial();
 const plate=new Mesh(new PlaneGeometry(),shared),floor=new Mesh(new PlaneGeometry(),shared),wall=new Mesh(new PlaneGeometry(),shared);
 plate.name='RegionalGround';floor.name='CourtyardGround';root.add(plate,floor,wall);
 separateSiteSurfaces(root,'apple-park');separateSiteSurfaces(root,'apple-park');
 assert.equal(root.position.y,2);assert.equal(plate.position.y,-.7);assert.equal(floor.position.y,.8);
 assert.ok(plate.renderOrder<floor.renderOrder&&floor.renderOrder<wall.renderOrder);
 assert.equal(plate.material.polygonOffset,true);assert.equal(plate.material.depthWrite,true);
 assert.notEqual(plate.material,shared);assert.equal(wall.material,shared);assert.equal(shared.polygonOffset,false);
 for(const mesh of [plate,floor,wall]){mesh.geometry.dispose();mesh.material.dispose();}
});
test('rewind finishes in two seconds and explicit date cues override authored times',()=>{
 const engine=new PlaybackEngine(index);playShot(engine,13);assert.equal(engine.state.position,364.999);
 engine.tick(1);assert.ok(Math.abs(engine.state.position-182.4995)<1e-8);
 engine.tick(1);assert.equal(engine.state.position,0);assert.equal(engine.state.timelapse?.elapsed,2000);
 engine.cue('date-card',undefined,5000);assert.equal(sceneTextAt(13,2.6,engine.state.cues),null);
 assert.equal(sceneTextAt(13,5.1,engine.state.cues)?.text,'September 9, 2025');
 assert.equal(sceneTextAt(13,5,engine.state.cues)?.opacity,0);
 assert.throws(()=>engine.cue('invalid' as 'date-card'),/Unknown cue/);
});
test('company cues retain explicit legacy brand support and freeze at sampled time',()=>{
 const engine=new PlaybackEngine(index);playShot(engine,3);
 assert.deepEqual(new Set(companyCues(engine.state).map(c=>c.company)),new Set(['Apple','Samsung Display','Corning']));
 engine.cue('company','TSMC',500);assert.ok(companyCues(engine.state).some(c=>c.company==='TSMC'));
 assert.equal(calloutMotion(499,500).visible,false);assert.equal(calloutMotion(1000,500).alpha,1);
 assert.deepEqual(calloutMotion(750,500),calloutMotion(750,500));assert.equal(calloutMotion(4050,500).visible,false);
 engine.stopShot();engine.tick(2);engine.cue('company','Apple');
 const cue=engine.state.companyCues[0];assert.equal(cue.atMs,engine.state.tMs);
 engine.tick(.4);assert.equal(calloutMotion(engine.state.tMs,cue.atMs).alpha,1);
});
