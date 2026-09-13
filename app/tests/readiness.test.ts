import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group, Mesh, BufferGeometry, MeshBasicMaterial } from 'three';
import { WebGLProperties } from 'three/src/renderers/webgl/WebGLProperties.js';
import { updateArcMaterials } from '../src/globe/arc-material.ts';
import type { LiveArc } from '../src/globe/arc-pool.ts';
import { finishFirstFrame, RenderReadiness } from '../src/globe/readiness.ts';
import { loadNarrationDurations, FILM_SECONDS } from '../src/director/shots.ts';
import { jumpToSite } from '../src/camera/site-navigation.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { createIndex, finishIndex } from '../src/data/index.ts';

test('installed Three compileAsync poller throws isReady after app arc replacement and leaves its promise pending', async () => {
  // Execute the installed library function, with its real property store and the
  // app's real material replacement. Only GPU compilation and timer scheduling
  // are substituted; this identifies the throwing read without requiring Chrome.
  const source = readFileSync(new URL('../node_modules/three/src/renderers/WebGLRenderer.js', import.meta.url), 'utf8');
  const begin = source.indexOf('this.compileAsync = function');
  const method = source.slice(begin, source.indexOf('// Animation Loop', begin));
  const properties = WebGLProperties(), pending: (()=>void)[] = [];
  const material = new MeshBasicMaterial(), geometry = new BufferGeometry();
  const mesh = new Mesh(geometry, material), group = new Group(); group.add(mesh);
  properties.get(material).currentProgram = { isReady:()=>false };
  material.addEventListener('dispose',()=>properties.remove(material));
  const renderer = { compile:()=>new Set([material]), compileAsync:undefined as unknown as ()=>Promise<void> };
  new Function('properties','extensions','setTimeout',method).call(renderer,properties,{get:()=>({})},(callback:()=>void)=>pending.push(callback));
  let settled = false;
  void renderer.compileAsync().then(()=>{settled=true;},()=>{settled=true;});
  assert.equal(pending.length,1);
  updateArcMaterials([{__threeObjArc:group,groundKm:1,clipStart:0,clipEnd:1,alpha:1,phaseKm:0} as unknown as LiveArc],100);
  assert.notEqual(mesh.material,material);
  assert.equal(properties.get(material).currentProgram,undefined);
  assert.throws(()=>pending.shift()!(),/reading 'isReady'/);
  await Promise.resolve(); assert.equal(settled,false);
  geometry.dispose();mesh.material.dispose();
});

test('first frame renders and completes GPU work before releasing readiness',async()=>{
  const gate=new RenderReadiness(),order:string[]=[];
  finishFirstFrame(()=>order.push('full frame'),{isContextLost:()=>false,finish:()=>order.push('GPU complete')});
  gate.finish();await gate.promise;order.push('ready');
  assert.deepEqual(order,['full frame','GPU complete','ready']);
});

test('render failures, lost contexts, and deadlines reject readiness instead of hanging',async()=>{
  for(const during of [false,true]){
    const gate=new RenderReadiness();let rendered=false;
    try{finishFirstFrame(()=>{rendered=true;},{isContextLost:()=>during?rendered:true,finish:()=>{}});gate.finish();}catch(error){gate.fail(error as Error);}
    await assert.rejects(gate.promise,/WebGL context lost/);
  }
  const failed=new RenderReadiness();
  try{finishFirstFrame(()=>{throw Error('render failed');},{isContextLost:()=>false,finish:()=>{}});}catch(error){failed.fail(error as Error);}
  await assert.rejects(failed.promise,/render failed/);
  await assert.rejects(new RenderReadiness(5).promise,/timed out/);
});

test('missing optional narration manifest keeps fallback timings and does not fail startup',async()=>{
  const before=FILM_SECONDS;
  assert.equal(await loadNarrationDurations('/narration/narration.json',async()=>new Response('',{status:404})),false);
  assert.equal(FILM_SECONDS,before);
});

test('site HUD flights retain site identity and complete using the explicit camera clock',()=>{
  const index=createIndex();finishIndex(index);const engine=new PlaybackEngine(index);engine.setClockMode('manual');
  for(const site of ['apple-park','fifth-avenue','globe'] as const){
    jumpToSite(engine,site);assert.equal(engine.state.shot,null);
    assert.equal(engine.state.camera.duration,3000);
    assert.equal(engine.state.camera.site,site==='globe'?undefined:site);
    engine.tick(3,'manual');assert.equal(engine.state.cameraElapsed,3000);
    const pose=engine.currentCamera();assert.ok(pose.altitude>0);
    if(site==='globe')assert.equal(pose.altitude,2.15);
    else assert.ok(pose.altitude<.002);
  }
});
