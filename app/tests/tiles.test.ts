import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { canUseTiles, enoughTiles, fetchOptionalTile, medianGroundHeight, shouldHoldForTiles, tileOpacity, tilePlan } from '../src/globe/tiles-policy.ts';

test('optional tiles require configuration and fail closed on request failure', () => {
  assert.equal(canUseTiles(false, 'local-key'), false);
  assert.equal(canUseTiles(true, ''), false);
  assert.equal(canUseTiles(true, undefined), false);
  assert.equal(canUseTiles(true, 'local-key', true), false);
  assert.equal(canUseTiles(true, 'local-key'), true);
  assert.equal(enoughTiles(.99, 8, 1), false);
  assert.equal(enoughTiles(.11, 8, 0), false);
  assert.equal(enoughTiles(.95, 0, 0), false);
  assert.equal(enoughTiles(.95, 80, 0), true);
});

test('only authored site shots prefetch imagery; opening and California remain on the globe', () => {
  for(const shot of [1,2])for(const shotElapsed of [0,3,8,14.35]){
    assert.deepEqual(tilePlan({shot,shotElapsed},37.3349,-122.009,shot===1?1.9:.18),{site:null,prefetch:false,blend:0});
  }
  // Shot 10 ("New York", the store flight + stair descent) is cut
  // (scene-11-delete pass, 2026-09-13) — it no longer exists as an
  // authored shot, so its enter/leave fade special-case is retired with
  // it. Shot 19 (Beneath it) now opens the fifth-avenue site itself and
  // gets full blend immediately, same as any other authored-site shot.
  assert.deepEqual(tilePlan({shot:10,shotElapsed:0},0,0,2),{site:null,prefetch:false,blend:0});
  for(const shot of [19,12])assert.deepEqual(tilePlan({shot,shotElapsed:0},0,0,2),{site:'fifth-avenue',prefetch:true,blend:1});
});

test('optional tiles never hold choreography, whether pending, ready, failed or missing', () => {
  assert.equal(shouldHoldForTiles({shot:1,shotElapsed:.1,shotRunning:true},false,false,true),false);
  assert.equal(shouldHoldForTiles({shot:1,shotElapsed:.25,shotRunning:true},false,false,true),false);
  assert.equal(shouldHoldForTiles({shot:10,shotElapsed:.25,shotRunning:true},false,false,true),false);
  assert.equal(shouldHoldForTiles({shot:10,shotElapsed:3.2,shotRunning:true},false,false,true),false);
  assert.equal(shouldHoldForTiles({shot:10,shotElapsed:.25,shotRunning:true},true,false,true),false);
  assert.equal(shouldHoldForTiles({shot:10,shotElapsed:.25,shotRunning:true},false,true,true),false);
  assert.equal(shouldHoldForTiles({shot:10,shotElapsed:.25,shotRunning:true},false,false,false),false);
});

test('free exploration prefetches near a hero and ground alignment rejects outliers', () => {
  const near=tilePlan({shot:null,shotElapsed:0},37.3349,-122.009,.001);
  assert.equal(near.site,'apple-park'); assert.equal(near.prefetch,true); assert.equal(near.blend,1);
  assert.deepEqual(tilePlan({shot:null,shotElapsed:0},0,0,.001),{site:null,prefetch:false,blend:0});
  assert.equal(medianGroundHeight([0,1,2,3,90].map(y=>new Vector3(0,y,0))),2);
  assert.equal(medianGroundHeight([]),null);
});

test('manual HUD jumps prefetch the destination before arriving near the site',()=>{
  const camera={site:'fifth-avenue'} as any;
  assert.deepEqual(tilePlan({shot:null,shotElapsed:0,camera},0,0,2),{site:'fifth-avenue',prefetch:true,blend:0});
  assert.deepEqual(tilePlan({shot:null,shotElapsed:0,camera},40.7638,-73.973,.001),{site:'fifth-avenue',prefetch:true,blend:1});
  const campus=tilePlan({shot:null,shotElapsed:0,camera:{site:'apple-park'} as any},37.3349,-122.009,.002);
  assert.equal(campus.site,'apple-park');assert.ok(campus.blend>0&&campus.blend<1);
});
test('tile presentation has no accumulated phase and failures reveal the globe immediately',()=>{
  const plan={site:'apple-park' as const,prefetch:true,blend:.6};
  assert.equal(tileOpacity(plan,true,false,false,12.5),.6);
  assert.equal(tileOpacity(plan,false,false,false,12.5),0);
  assert.equal(tileOpacity(plan,true,true,false,12.5),0);
  assert.equal(tileOpacity(plan,true,false,true,12.5),0);
  assert.equal(tileOpacity(plan,true,false,false,null),0);
  assert.equal(tileOpacity(plan,true,false,false,12.5),.6);
});

test('403, 404, and network errors silently select fallback without propagating credentials',async()=>{
  for(const failure of [403,404,'network']){
    let fellBack=0;
    const request=async()=>{if(failure==='network')throw Error('secret-url');return new Response('',{status:failure as number});};
    await assert.rejects(fetchOptionalTile(request,'https://tiles.invalid?key=secret',{},()=>fellBack++),error=>{
      assert.equal((error as Error).name,'AbortError');assert.equal((error as Error).message,'Optional imagery unavailable');return true;
    });
    assert.equal(fellBack,1);
  }
  const controller=new AbortController();controller.abort();let fellBack=0;
  await assert.rejects(fetchOptionalTile(async()=>{throw new DOMException('Aborted','AbortError');},'https://tiles.invalid',{signal:controller.signal},()=>fellBack++));
  assert.equal(fellBack,0,'normal LOD cancellation must not discard a healthy site scene');
  const response=await fetchOptionalTile(async(_url,options)=>{assert.equal(options.cache,'no-store');return new Response('{}');},'https://tiles.invalid',{},()=>fellBack++);
  assert.equal(response.status,200);assert.equal(fellBack,0);
});
