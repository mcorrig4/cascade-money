import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error build-time JS utility deliberately has no browser declaration
import { checkTilesBundle } from '../scripts/check-no-google-tiles.mjs';

test('bundle guard requires the optional renderer when enabled and excludes it when disabled', async()=>{
  const root=await mkdtemp(join(tmpdir(),'cascade-tiles-guard-'));
  try {
    await mkdir(join(root,'assets'));
    await writeFile(join(root,'assets','index-a.js'),'console.log("globe")');
    await checkTilesBundle(root,false);
    await assert.rejects(checkTilesBundle(root,true),/missing/);
    await writeFile(join(root,'assets','site-scene-a.js'),'const url="https://tile.googleapis.com/v1/3dtiles/root.json"');
    assert.deepEqual(await checkTilesBundle(root,true),{enabled:true,rendererChunks:1});
    await assert.rejects(checkTilesBundle(root,false),/unexpectedly/);
    await writeFile(join(root,'assets','site-scene-a.js'),'const noEndpoint=true');
    await assert.rejects(checkTilesBundle(root,true),/missing/);
    await assert.rejects(checkTilesBundle(root,false),/unexpectedly/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
