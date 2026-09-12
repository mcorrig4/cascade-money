import { createReadStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createWriteStream, statSync } from 'node:fs';
import { projectEvent } from './lib/project-events.mjs';
import { collectCameraAccounts, keepEvent, capPerDay, INTERNAL_FOUR, PER_DAY_CAP } from './lib/filter-events.mjs';

const source = new URL('../../events.ndjson', import.meta.url);
const temporary = new URL('../public/events.ndjson.tmp', import.meta.url);
const destination = new URL('../public/events.ndjson', import.meta.url);
const TARGET_BYTES = 25 * 1000 * 1000;
await mkdir(new URL('../public/', import.meta.url), { recursive: true });

// Bake pipeline (product decision, coordinator 2026-09-12):
//   1. Project every event to exactly the fields the app loader reads
//      (scripts/lib/project-events.mjs) — always lossless w.r.t. app behavior.
//   2. Drop story-irrelevant claim/extend/withdraw/funding_shortfall events
//      (scripts/lib/filter-events.mjs) — every other type is always kept.
//   3. If still over the ~25 MB phone-usable target, additionally cap the
//      same four types to the 200 largest-amount events per day.
// The repo-root events.ndjson stays untouched; only public/events.ndjson
// (the served/dist artifact) is derived, with seq renumbered consecutively
// over whatever survives.
try {
  const cameraAccounts = await collectCameraAccounts(source);
  const kept = [];
  let rawCount = 0, keptCount = 0;
  const keptByType = new Map(), rawByType = new Map();
  for await (const line of createInterface({ input: createReadStream(source), crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.seq !== ++rawCount || ![1, 2].includes(event.schema_version)) throw new Error(`Invalid event envelope at line ${rawCount}`);
    rawByType.set(event.type, (rawByType.get(event.type) ?? 0) + 1);
    if (!keepEvent(event, cameraAccounts)) continue;
    keptCount++;
    keptByType.set(event.type, (keptByType.get(event.type) ?? 0) + 1);
    kept.push({ day: event.day, projected: projectEvent(event) });
  }
  if (!rawCount) throw new Error('Empty event stream');

  const writeOut = async entries => {
    const output = createWriteStream(temporary);
    let seq = 0;
    for (const entry of entries) {
      entry.projected.seq = ++seq;
      const ok = output.write(JSON.stringify(entry.projected) + '\n');
      if (!ok) await new Promise(resolve => output.once('drain', resolve));
    }
    await new Promise((resolve, reject) => output.end(error => (error ? reject(error) : resolve())));
    return seq;
  };

  let entries = kept.map(k => ({ projected: k.projected }));
  let finalCount = await writeOut(entries);
  let stageBytes = statSync(temporary).size;
  let cappedApplied = false;
  console.log(`Story-relevance filter kept ${keptCount}/${rawCount} raw events -> ${finalCount} baked events, ${stageBytes} bytes.`);

  if (stageBytes > TARGET_BYTES) {
    entries = capPerDay(entries, PER_DAY_CAP);
    finalCount = await writeOut(entries);
    stageBytes = statSync(temporary).size;
    cappedApplied = true;
    console.log(`Still over ${TARGET_BYTES} bytes; applied a ${PER_DAY_CAP}-per-day cap on ${[...INTERNAL_FOUR].join('/')} -> ${finalCount} baked events, ${stageBytes} bytes.`);
  }

  await rename(temporary, destination);
  console.log(`Baked ${finalCount} events from ../events.ndjson (projected + story-relevance filtered${cappedApplied ? ' + per-day capped' : ''}).`);
  console.log('Kept by type:', Object.fromEntries(keptByType));
} finally { await rm(temporary, { force: true }); }
