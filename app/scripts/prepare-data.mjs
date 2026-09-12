import { readFile, mkdir, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('../../events.ndjson', import.meta.url), 'utf8');
const lines = source.trim().split(/\r?\n/);
for (const [i, line] of lines.entries()) {
  const event = JSON.parse(line);
  if (event.seq !== i + 1 || ![1, 2].includes(event.schema_version)) {
    throw new Error(`Invalid event envelope at line ${i + 1}`);
  }
}
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/events.ndjson', import.meta.url), source);
console.log(`Baked ${lines.length} events from ../events.ndjson`);
