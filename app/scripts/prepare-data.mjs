import { createReadStream } from 'node:fs';
import { mkdir, copyFile, rename, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline';
const source = new URL('../../events.ndjson', import.meta.url);
const temporary = new URL('../public/events.ndjson.tmp', import.meta.url);
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
// Validate the exact copy we publish, with bounded line memory.
try {
  await copyFile(source, temporary);
  let count = 0;
  for await (const line of createInterface({ input: createReadStream(temporary), crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.seq !== ++count || ![1, 2].includes(event.schema_version)) throw new Error(`Invalid event envelope at line ${count}`);
  }
  if (!count) throw new Error('Empty event stream');
  await rename(temporary, new URL('../public/events.ndjson', import.meta.url));
  console.log(`Baked ${count} events from ../events.ndjson`);
} finally { await rm(temporary, { force: true }); }
