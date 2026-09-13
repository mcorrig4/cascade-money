#!/usr/bin/env node
// check-cues.mjs — self-QA gate: refuses a render if any scene's installed
// narration wav (public/narration/scene-NN.wav) no longer matches the md5
// cues-from-words.mjs used to build src/generated/cues.json / cues.lock.json.
// Added 2026-09-13 after a lane rendered scene 2 with cues resolved against
// a narration cut that had since changed — the timestamps looked plausible
// but were stale, and nothing caught it before the render shipped.
//
// Usage: node scripts/check-cues.mjs
// Exit 0: every scene in the lock file's wav still matches. Exit 1: prints
// the stale scene(s) and refuses (caller should run cues-from-words.mjs and
// re-check before rendering). Exit 1 also if the lock file doesn't exist —
// cues have never been generated for this checkout.
import {readFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const FILM_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_PATH = join(FILM_DIR, 'src/generated/cues.lock.json');
const NARRATION_DIR = join(FILM_DIR, 'public/narration');

const wavFileFor = (sceneNum) => join(NARRATION_DIR, `scene-${String(sceneNum).padStart(2, '0')}.wav`);
const md5File = (path) => (existsSync(path) ? createHash('md5').update(readFileSync(path)).digest('hex') : null);

if (!existsSync(LOCK_PATH)) {
  console.error(`check-cues: no lock file at ${LOCK_PATH} — run scripts/cues-from-words.mjs first.`);
  process.exit(1);
}

const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
// W4 empty-lock incident: an empty lock verified nothing while allowing a render.
if (Object.keys(lock).length === 0) {
  console.error(`check-cues: empty narration lock at ${LOCK_PATH} — refusing render.`);
  process.exit(1);
}
const stale = [];
const missing = [];

for (const [sceneNumStr, expectedMd5] of Object.entries(lock)) {
  const sceneNum = Number(sceneNumStr);
  const wavPath = wavFileFor(sceneNum);
  const actualMd5 = md5File(wavPath);
  if (actualMd5 === null) {
    missing.push(`scene ${sceneNum}: ${wavPath} not found`);
  } else if (actualMd5 !== expectedMd5) {
    stale.push(`scene ${sceneNum}: cues built from md5 ${expectedMd5}, installed wav is now ${actualMd5}`);
  }
}

if (stale.length > 0 || missing.length > 0) {
  console.error('check-cues: STALE — cues do not match the installed narration. Re-run scripts/cues-from-words.mjs before rendering.');
  for (const line of stale) console.error(`  - ${line}`);
  for (const line of missing) console.error(`  - ${line}`);
  process.exit(1);
}

console.log(`check-cues: OK — ${Object.keys(lock).length} scene(s) match the cues that were generated for them.`);
