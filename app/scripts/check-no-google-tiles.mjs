import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const endpoint = 'tile.googleapis.com';
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (/\.(?:m?js|map|html)$/i.test(path)) result.push(path);
  }
  return result;
}

/** Assert both variants: enabled builds retain the lazy renderer, disabled builds exclude it. */
export async function checkTilesBundle(directory, enabled) {
  const compiled = await files(directory);
  const endpointFiles = [];
  for (const file of compiled) {
    if ((await readFile(file)).includes(Buffer.from(endpoint))) endpointFiles.push(file);
  }
  const rendererFiles = compiled.filter(file => /^site-scene(?:[.-]).*\.js$/.test(basename(file)));
  if (enabled) {
    if (!endpointFiles.length || !rendererFiles.length) throw new Error('Tiles-enabled bundle is missing its site-scene renderer or Google endpoint');
  } else if (endpointFiles.length || rendererFiles.length) {
    throw new Error('Tiles-disabled bundle unexpectedly includes the Google tiles renderer');
  }
  return { enabled, rendererChunks: rendererFiles.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const enabled = process.env.VITE_ENABLE_TILES === '1';
  await checkTilesBundle('dist', enabled);
  console.log(enabled ? 'Tiles-enabled bundle includes the optional Google site renderer.' : 'Tiles-disabled bundle excludes the Google site renderer.');
}
