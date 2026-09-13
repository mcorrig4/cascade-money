#!/usr/bin/env node
// cues-from-words.mjs — resolves src/cues.ts's {cue, phrase} pairs against
// per-scene whisper word-timestamp JSON, writing src/generated/cues.json as
// `{[scene]: {[cue]: seconds}}` for CascadeFilm's motion-graphics components
// to read via cueFrame() (src/cues.ts). Run this BEFORE every render (wired
// into render-scenes.sh, guarded at render/splice by check-cues.mjs) so a
// re-narration's new word timings flow through without any code change.
//
// Usage:
//   node scripts/cues-from-words.mjs [wordsDir]
// wordsDir defaults to $CASCADE_WORDS_DIR, else public/narration/words in
// this film checkout. Missing scene/tail transcripts warn and allow partial
// cues; a missing directory, zero phrase matches, or empty WAV lock fails.
//
// Word JSON shape (one file per scene): {scene, words: [{word, start, end}]}
// — start/end in seconds from the scene's own clip start (matches how
// CascadeFilm's Series.Sequence already frames scene-local time).
//
// Also writes src/generated/cues.lock.json — the md5 of every
// public/narration/scene-NN.wav this run's cues were built from (Director,
// 2026-09-13: self-QA gate after Liam caught scene 2's cues resolving early
// against a narration cut that had since changed). check-cues.mjs
// recomputes those md5s at render time and fails the render if any scene's
// installed wav no longer matches what generated the cues it's about to
// burn in.
import {readFileSync, writeFileSync, existsSync, mkdirSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CUE_PHRASES} from '../src/cues.ts';

const FILM_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
// W4 broken-cut incident: host-local transcripts silently disabled narration reveals.
const DEFAULT_WORDS_DIR = join(FILM_DIR, 'public/narration/words');
const wordsDir = process.argv[2] ?? process.env.CASCADE_WORDS_DIR ?? DEFAULT_WORDS_DIR;
const NARRATION_DIR = join(FILM_DIR, 'public/narration');
const OUT_PATH = join(FILM_DIR, 'src/generated/cues.json');
const LOCK_PATH = join(FILM_DIR, 'src/generated/cues.lock.json');
// W2 preserves approved locked-scene timing while rebuilt scenes have zero lead.
const LOCKED_SCENES = new Set([1, 11, 12]);

const fail = (message) => {
  console.error(`cues-from-words: ${message} (words directory: ${wordsDir})`);
  process.exit(1);
};
if (!existsSync(wordsDir) || !statSync(wordsDir).isDirectory()) fail('words directory does not exist or is not a directory');
const narrationPath = join(NARRATION_DIR, 'narration.json');
const narration = existsSync(narrationPath) ? JSON.parse(readFileSync(narrationPath, 'utf8')) : [];

// Strip everything but letters/digits/$ so "million." / "$100" / "10,000"
// tokens compare cleanly against a hand-typed phrase.
const normalize = (w) => w.toLowerCase().replace(/[^a-z0-9$]/g, '');

const wordsFileFor = (sceneNum) => join(wordsDir, `scene-${String(sceneNum).padStart(2, '0')}.json`);
const wavFileFor = (sceneNum) => join(NARRATION_DIR, `scene-${String(sceneNum).padStart(2, '0')}.wav`);

const md5File = (path) => (existsSync(path) ? createHash('md5').update(readFileSync(path)).digest('hex') : null);

/** Find `phraseTokens` as a contiguous run in `words` at or after `fromIndex`. Returns the matching word's `start`, or null. */
const findPhrase = (words, phraseTokens, fromIndex) => {
  for (let i = fromIndex; i <= words.length - phraseTokens.length; i++) {
    let matched = true;
    for (let j = 0; j < phraseTokens.length; j++) {
      if (normalize(words[i + j].word) !== phraseTokens[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return {start: words[i].start, startIndex: i, endIndex: i + phraseTokens.length};
  }
  return null;
};

// W2 measurements carry provenance and separate main/tail WAV guards.
const overridesPath = join(FILM_DIR, 'src/generated/onset-overrides.json');
const MANUAL_ONSET_OVERRIDES = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {};

const result = {};
const unresolved = [];
const transcriptWarnings = [];

for (const [sceneNumStr, cues] of Object.entries(CUE_PHRASES)) {
  const sceneNum = Number(sceneNumStr);
  const path = wordsFileFor(sceneNum);
  if (!existsSync(path)) {
    for (const {cue} of cues) unresolved.push(`scene ${sceneNum} "${cue}" — no words file at ${path}`);
    continue;
  }
  let {words} = JSON.parse(readFileSync(path, 'utf8'));
  const entry = narration.find((entry) => entry.scene === sceneNum);
  if (entry?.tailFile) {
    const tailPath = join(wordsDir, entry.tailFile.replace(/\.[^.]+$/, '.json'));
    if (existsSync(tailPath)) {
      // W4 missing-tail incident: narration.ts places tails at raw duration + tailGapSec (default 0.25), before any settle pad.
      const offset = entry.duration + (entry.tailGapSec ?? 0.25);
      if (!Number.isFinite(offset) || offset < 0) fail(`invalid tail offset for scene ${sceneNum}`);
      const tail = JSON.parse(readFileSync(tailPath, 'utf8')).words;
      words = [...words, ...tail.map((word) => ({...word, start: word.start + offset, end: word.end + offset}))];
    } else {
      transcriptWarnings.push(`scene ${sceneNum} — no tail words file at ${tailPath}`);
    }
  }
  let cursor = 0;
  const sceneResult = {};
  for (const {cue, phrase} of cues) {
    const phraseTokens = phrase.split(/\s+/).map(normalize).filter(Boolean);
    const match = findPhrase(words, phraseTokens, cursor);
    if (!match) {
      unresolved.push(`scene ${sceneNum} "${cue}" — phrase "${phrase}" not found in ${path}`);
      continue;
    }
    sceneResult[cue] = Math.max(0, Number((match.start - (LOCKED_SCENES.has(sceneNum) ? 0.15 : 0)).toFixed(3)));
    // W2 shared clauses (money / plus / time) need overlapping phrase matches.
    cursor = LOCKED_SCENES.has(sceneNum) ? match.endIndex : match.startIndex;
  }
  if (Object.keys(sceneResult).length > 0) result[sceneNum] = sceneResult;
}

const phraseCount = Object.values(result).reduce((count, cues) => count + Object.keys(cues).length, 0);
if (phraseCount === 0) fail('zero cues resolved from words; refusing to replace generated cues');

// Apply the measured-onset overrides, guarded by the installed wav's md5.
for (const [sceneNumStr, override] of Object.entries(MANUAL_ONSET_OVERRIDES)) {
  const sceneNum = Number(sceneNumStr);
  const actualMd5 = md5File(wavFileFor(sceneNum));
  const entry = narration.find((entry) => entry.scene === sceneNum);
  const tailMatches = !override.tailMd5 || (entry?.tailFile && md5File(join(NARRATION_DIR, entry.tailFile)) === override.tailMd5);
  if (actualMd5 === override.wavMd5 && tailMatches) {
    if (result[sceneNum]) {
      for (const [cue, onset] of Object.entries(override.cues)) {
        if (result[sceneNum][cue] !== undefined) result[sceneNum][cue] = onset;
      }
    }
  } else {
    if (result[sceneNum]) fail(`scene ${sceneNum} measured-onset WAV guard changed (main expected ${override.wavMd5}, got ${actualMd5}; tail matches: ${tailMatches}); re-run onset measurement`);
  }
}

// Lock file: md5 of every narration wav these cues were built from, so
// check-cues.mjs can catch a stale render (installed wav changed, cues
// weren't regenerated).
const lock = {};
for (const sceneNumStr of Object.keys(CUE_PHRASES)) {
  const sceneNum = Number(sceneNumStr);
  const md5 = md5File(wavFileFor(sceneNum));
  if (md5) lock[sceneNum] = md5;
}
// W2 tail words must be guarded by the actual tail audio as well as the main WAV.
for (const entry of narration) {
  if (entry.tailFile) {
    const md5 = md5File(join(NARRATION_DIR, entry.tailFile));
    if (md5) lock[entry.tailFile] = md5;
  }
}
// W4 empty-lock incident: missing WAVs must not turn the render gate into a zero-scene pass.
if (Object.keys(lock).length === 0) fail('empty narration lock; no narration WAVs found');
mkdirSync(dirname(OUT_PATH), {recursive: true});
writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n');
writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');

const resolvedCount = Object.values(result).reduce((a, s) => a + Object.keys(s).length, 0);
console.log(`cues-from-words: resolved ${resolvedCount} cue(s) -> ${OUT_PATH}`);
console.log(`cues-from-words: wrote ${Object.keys(lock).length} narration md5(s) -> ${LOCK_PATH}`);
if (unresolved.length > 0) {
  console.log(`cues-from-words: ${unresolved.length} cue(s) left to fall back:`);
  for (const line of unresolved) console.log(`  - ${line}`);
}

if (transcriptWarnings.length > 0) {
  console.warn(`cues-from-words: ${transcriptWarnings.length} transcript warning(s):`);
  for (const line of transcriptWarnings) console.warn(`  - ${line}`);
}
