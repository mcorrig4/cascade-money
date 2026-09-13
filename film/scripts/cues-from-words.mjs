#!/usr/bin/env node
// cues-from-words.mjs — resolves src/cues.ts's {cue, phrase} pairs against
// per-scene whisper word-timestamp JSON, writing src/generated/cues.json as
// `{[scene]: {[cue]: seconds}}` for CascadeFilm's motion-graphics components
// to read via cueFrame() (src/cues.ts). Run this BEFORE every render (wired
// into render-scenes.sh / splice-draft.sh, guarded by check-cues.mjs) so a
// re-narration's new word timings flow through without any code change.
//
// Usage:
//   node scripts/cues-from-words.mjs [wordsDir]
// wordsDir defaults to $CASCADE_WORDS_DIR, else the current whisper output
// location. A scene missing its words-NN.json (not transcribed yet, or the
// dir moved) just leaves that scene's cues unresolved — every consumer
// falls back to its historical fixed offset, so this never breaks a build.
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
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CUE_PHRASES} from '../src/cues.ts';

const FILM_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORDS_DIR = join(
  process.env.HOME ?? '',
  'claudes-world/tmp/cascade-film/narration/out-v7/words',
);
const wordsDir = process.argv[2] ?? process.env.CASCADE_WORDS_DIR ?? DEFAULT_WORDS_DIR;
const NARRATION_DIR = join(FILM_DIR, 'public/narration');
const OUT_PATH = join(FILM_DIR, 'src/generated/cues.json');
const LOCK_PATH = join(FILM_DIR, 'src/generated/cues.lock.json');
const REVEAL_LEAD_SECONDS = 0.15; // reveals fire 150ms before the word starts

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
    if (matched) return {start: words[i].start, endIndex: i + phraseTokens.length};
  }
  return null;
};

// Scene 2's fact reveals (Liam 2026-09-13 07:13 EDT round 6: "not until the
// T/F/TH sound is coming out of my mouth, measured on the waveform, not
// whisper's word boundary"). Whisper's boundary is measurably off here —
// e.g. the second "200" (of "200 suppliers") is stamped at 5.20s by
// whisper; the real /t/ burst measured on the 8ms-window/2ms-hop RMS
// envelope (12dB rise from the local silence minimum) is 5.416s, 216ms
// later. These four values are that measurement, applied with NO lead/delay
// (frame = round(seconds * fps), same as every other cue). Pinned to the
// installed scene-02.wav's md5 so a re-narration doesn't silently ship a
// stale onset — see cues.lock.json / check-cues.mjs. If the md5 no longer
// matches, this override is skipped and 'hook-open'/'stat-suppliers'/
// 'stat-factories'/'stat-countries' fall back to their normal phrase
// resolution (word boundary, no worse than before this pass).
const MANUAL_ONSET_OVERRIDES = {
  2: {
    wavMd5: '256ef116708471945739705b1b3ad733',
    cues: {
      'hook-open': 2.036, // /t/ of "two" in "two hundred billion"
      'stat-suppliers': 5.416, // /t/ of "two" in "two hundred suppliers"
      'stat-factories': 7.202, // /th/ of "thousands"
      'stat-countries': 9.148, // /f/ of "fifty"
    },
  },
};

const result = {};
const unresolved = [];

for (const [sceneNumStr, cues] of Object.entries(CUE_PHRASES)) {
  const sceneNum = Number(sceneNumStr);
  const path = wordsFileFor(sceneNum);
  if (!existsSync(path)) {
    for (const {cue} of cues) unresolved.push(`scene ${sceneNum} "${cue}" — no words file at ${path}`);
    continue;
  }
  const {words} = JSON.parse(readFileSync(path, 'utf8'));
  let cursor = 0;
  const sceneResult = {};
  for (const {cue, phrase} of cues) {
    const phraseTokens = phrase.split(/\s+/).map(normalize).filter(Boolean);
    const match = findPhrase(words, phraseTokens, cursor);
    if (!match) {
      unresolved.push(`scene ${sceneNum} "${cue}" — phrase "${phrase}" not found in ${path}`);
      continue;
    }
    sceneResult[cue] = Math.max(0, Number((match.start - REVEAL_LEAD_SECONDS).toFixed(3)));
    cursor = match.endIndex;
  }
  if (Object.keys(sceneResult).length > 0) result[sceneNum] = sceneResult;
}

// Apply the measured-onset overrides, guarded by the installed wav's md5.
for (const [sceneNumStr, override] of Object.entries(MANUAL_ONSET_OVERRIDES)) {
  const sceneNum = Number(sceneNumStr);
  const actualMd5 = md5File(wavFileFor(sceneNum));
  if (actualMd5 === override.wavMd5) {
    result[sceneNum] = {...(result[sceneNum] ?? {}), ...override.cues};
  } else {
    console.log(
      `cues-from-words: scene ${sceneNum} narration wav md5 changed (expected ${override.wavMd5}, got ${actualMd5}) — skipping manual onset override, using phrase resolution instead. Re-run onset measurement.`,
    );
  }
}

mkdirSync(dirname(OUT_PATH), {recursive: true});
writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n');

// Lock file: md5 of every narration wav these cues were built from, so
// check-cues.mjs can catch a stale render (installed wav changed, cues
// weren't regenerated).
const lock = {};
for (const sceneNumStr of Object.keys(CUE_PHRASES)) {
  const sceneNum = Number(sceneNumStr);
  const md5 = md5File(wavFileFor(sceneNum));
  if (md5) lock[sceneNum] = md5;
}
writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');

const resolvedCount = Object.values(result).reduce((a, s) => a + Object.keys(s).length, 0);
console.log(`cues-from-words: resolved ${resolvedCount} cue(s) -> ${OUT_PATH}`);
console.log(`cues-from-words: wrote ${Object.keys(lock).length} narration md5(s) -> ${LOCK_PATH}`);
if (unresolved.length > 0) {
  console.log(`cues-from-words: ${unresolved.length} cue(s) left to fall back:`);
  for (const line of unresolved) console.log(`  - ${line}`);
}
