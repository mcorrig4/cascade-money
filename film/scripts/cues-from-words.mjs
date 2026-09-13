#!/usr/bin/env node
// cues-from-words.mjs — resolves src/cues.ts's {cue, phrase} pairs against
// per-scene whisper word-timestamp JSON, writing src/generated/cues.json as
// `{[scene]: {[cue]: seconds}}` for CascadeFilm's motion-graphics components
// to read via cueFrame() (src/cues.ts). Run this BEFORE every render (wired
// into render-scenes.sh) so a re-narration's new word timings flow through
// without any code change.
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
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CUE_PHRASES} from '../src/cues.ts';

const FILM_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORDS_DIR = join(
  process.env.HOME ?? '',
  'claudes-world/tmp/cascade-film/narration/out-v7/words',
);
const wordsDir = process.argv[2] ?? process.env.CASCADE_WORDS_DIR ?? DEFAULT_WORDS_DIR;
const OUT_PATH = join(FILM_DIR, 'src/generated/cues.json');
const REVEAL_LEAD_SECONDS = 0.15; // reveals fire 150ms before the word starts

// Strip everything but letters/digits/$ so "million." / "$100" / "10,000"
// tokens compare cleanly against a hand-typed phrase.
const normalize = (w) => w.toLowerCase().replace(/[^a-z0-9$]/g, '');

const wordsFileFor = (sceneNum) => join(wordsDir, `scene-${String(sceneNum).padStart(2, '0')}.json`);

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

mkdirSync(dirname(OUT_PATH), {recursive: true});
writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n');

const resolvedCount = Object.values(result).reduce((a, s) => a + Object.keys(s).length, 0);
console.log(`cues-from-words: resolved ${resolvedCount} cue(s) -> ${OUT_PATH}`);
if (unresolved.length > 0) {
  console.log(`cues-from-words: ${unresolved.length} cue(s) left to fall back:`);
  for (const line of unresolved) console.log(`  - ${line}`);
}
