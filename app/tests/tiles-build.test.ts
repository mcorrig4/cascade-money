import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error build-time JS utility deliberately has no browser declaration
import { checkTilesBundle } from '../scripts/check-no-google-tiles.mjs';

test('bundle guard follows the exact endpoint across merged chunks', async()=>{
  const root=await mkdtemp(join(tmpdir(),'cascade-tiles-guard-'));
  try {
    await mkdir(join(root,'assets'));
    await writeFile(join(root,'assets','index-a.js'),'console.log("globe")');
    await checkTilesBundle(root,false);
    await assert.rejects(checkTilesBundle(root,true),/missing/);
    await writeFile(join(root,'assets','index-a.js'),'const url="https://tile.googleapis.com/v1/3dtiles/root.json"');
    assert.deepEqual(await checkTilesBundle(root,true),{enabled:true,rendererChunks:1});
    await assert.rejects(checkTilesBundle(root,false),/unexpectedly/);
    // W4 chunk-merge incident: innocent pieces and a renderer-like filename are not an endpoint.
    await writeFile(join(root,'assets','index-a.js'),'console.log("globe")');
    await writeFile(join(root,'assets','site-scene-merged.js'),'const a="tile",b="googleapis",c="com";console.log(a,b,c)');
    await assert.rejects(checkTilesBundle(root,true),/missing/);
    assert.deepEqual(await checkTilesBundle(root,false),{enabled:false,rendererChunks:0});
  } finally { await rm(root,{recursive:true,force:true}); }
});
