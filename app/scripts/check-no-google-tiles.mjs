import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const needle = 'tile.googleapis.com';
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}

for (const file of await files('dist')) {
  if ((await readFile(file)).includes(Buffer.from(needle))) {
    throw new Error(`Production bundle contains forbidden local-only tiles endpoint: ${file}`);
  }
}
console.log('Production bundle is free of the Google tiles endpoint.');
