#!/usr/bin/env node
/**
 * capture-durations.mjs — ffprobe every per-scene recapture in
 * public/captures/ and write its real wall-clock length to
 * src/generated/capture-durations.json as {"<sceneNum>": seconds}.
 *
 * Why this exists (boundary-bleed fix, 2026-09-13): the capture harness
 * (cascade-3d/capture/record-take-v6.mjs) cuts each scene at the APP's own
 * authored shot length (a word-count estimate), while the film sizes each
 * scene from the real narration clip. When the narration is longer than the
 * shot, CascadeFilm used to keep sampling the capture past its last authored
 * frame — and because the recorder's cut carries a couple of tenths of the
 * NEXT shot, what showed on screen was the next scene's opening card sitting
 * under the current scene's narration (verified in frames at the 6->7, 7->8
 * and 9->10 boundaries). Feeding the film the capture's measured length lets
 * CascadeFilm.tsx stretch the capture over the scene instead (see
 * `captureFor`), so a scene never shows its successor's picture.
 *
 * CAPTURE_TAIL_TRIM_SECONDS (CascadeFilm.tsx) is what discards the
 * recorder's own overshoot; this script reports the raw file length only.
 *
 * Usage: node scripts/capture-durations.mjs   (run by render-scenes.sh)
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILM_DIR = path.join(__dirname, '..');
const CAPTURES = path.join(FILM_DIR, 'public', 'captures');
const OUT = path.join(FILM_DIR, 'src', 'generated', 'capture-durations.json');
const FFPROBE = process.env.FFPROBE ?? 'ffprobe';

const probe = (file) =>
  Number(
    execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
      encoding: 'utf8',
    }).trim(),
  );

const durations = {};
for (let num = 1; num <= 12; num++) {
  const file = path.join(CAPTURES, `scene-${String(num).padStart(2, '0')}.mp4`);
  if (!existsSync(file)) continue;
  const seconds = probe(file);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`unreadable capture duration: ${file}`);
  durations[String(num)] = Number(seconds.toFixed(3));
}

mkdirSync(path.dirname(OUT), {recursive: true});
writeFileSync(OUT, `${JSON.stringify(durations, null, 2)}\n`);
console.error(`capture-durations: ${Object.keys(durations).length} capture(s) measured -> ${OUT}`);
