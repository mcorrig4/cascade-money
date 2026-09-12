import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { canUseTiles, enoughTiles, medianGroundHeight, tilePlan } from '../src/globe/tiles-policy.ts';

test('local-only gate and failed-request fallback are fail closed', () => {
  assert.equal(canUseTiles(false, 'local-key'), false);
  assert.equal(canUseTiles(true, ''), false);
  assert.equal(canUseTiles(true, undefined), false);
  assert.equal(canUseTiles(true, 'local-key', true), false);
  assert.equal(canUseTiles(true, 'local-key'), true);
  assert.equal(enoughTiles(.99, 8, 1), false);
  assert.equal(enoughTiles(.11, 8, 0), false);
  assert.equal(enoughTiles(.95, 0, 0), false);
  assert.equal(enoughTiles(.95, 8, 0), true);
});

test('shot crossfades prefetch before display and hold the requested sites', () => {
  assert.deepEqual(tilePlan({shot:1,shotElapsed:0},0,0,2),{site:'apple-park',prefetch:true,blend:1});
  assert.ok(tilePlan({shot:1,shotElapsed:8.35},0,0,2).blend > 0 && tilePlan({shot:1,shotElapsed:8.35},0,0,2).blend < 1);
  assert.deepEqual(tilePlan({shot:10,shotElapsed:0},0,0,2),{site:'fifth-avenue',prefetch:true,blend:0});
  assert.equal(tilePlan({shot:10,shotElapsed:6.2},0,0,2).blend,1);
  assert.equal(tilePlan({shot:10,shotElapsed:8.3},0,0,2).blend,1);
  assert.equal(tilePlan({shot:10,shotElapsed:9},0,0,2).blend,0);
});

test('free exploration prefetches near a hero and ground alignment rejects outliers', () => {
  const near=tilePlan({shot:null,shotElapsed:0},37.3349,-122.009,.001);
  assert.equal(near.site,'apple-park'); assert.equal(near.prefetch,true); assert.equal(near.blend,1);
  assert.deepEqual(tilePlan({shot:null,shotElapsed:0},0,0,.001),{site:null,prefetch:false,blend:0});
  assert.equal(medianGroundHeight([0,1,2,3,90].map(y=>new Vector3(0,y,0))),2);
  assert.equal(medianGroundHeight([]),null);
});
