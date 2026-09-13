#!/usr/bin/env node
/**
 * scene-frames.mjs — print the per-scene frame ranges of CascadeFilm as it
 * would actually render RIGHT NOW, using the exact same duration logic the
 * composition itself uses (Root.tsx's calculateMetadata).
 *
 * It imports the real functions from src/compositions/schedule.ts and
 * src/compositions/narration.ts rather than re-deriving the math, so this
 * script can never drift out of sync with what `npx remotion render`
 * produces. The only glue code here is a tiny local static file server: in
 * the browser/render context `narration.ts`'s fetch(staticFile(...)) calls
 * resolve against the page's own origin; in plain Node there is no origin,
 * so this script stands up a throwaway server for `public/` and teaches
 * `fetch` to resolve those root-relative paths against it. That is transport
 * plumbing, not scene-duration logic.
 *
 * Usage: node scripts/scene-frames.mjs [fps]   (or: pnpm --dir film scene-frames -- 15)
 * `fps` defaults to 30 (final profile); pass 15 for the draft profile so the
 * printed frame ranges match what `--props='{"fps":15}'` will actually
 * render (see render-scenes.sh).
 * Output: JSON array of {scene, title, from, to, frames, seconds} plus a
 * trailing {total: {frames, seconds}} entry, at the requested fps.
 */
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createReadStream, existsSync, statSync} from 'node:fs';

import {SCENES, resolveSceneDurations} from '../src/compositions/schedule.ts';
import {loadNarration} from '../src/compositions/narration.ts';

const FPS = Number(process.argv[2] ?? 30);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const CONTENT_TYPES = {'.json': 'application/json', '.mp4': 'video/mp4'};

const startStaticServer = () =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(PUBLIC_DIR, decodeURIComponent((req.url ?? '/').split('?')[0]));
      if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404).end();
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, {'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream'});
      createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });

const main = async () => {
  const server = await startStaticServer();
  const {port} = server.address();
  const origin = `http://127.0.0.1:${port}`;

  // narration.ts calls fetch(staticFile(...)), which yields a root-relative
  // path like "/narration/narration.json" (there is no browser origin to
  // resolve it against in plain Node). Teach fetch to resolve those against
  // the throwaway static server started above; anything already absolute
  // passes straight through.
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/')) return nativeFetch(origin + url, init);
    return nativeFetch(input, init);
  };

  let narration;
  try {
    narration = await loadNarration(FPS);
  } finally {
    globalThis.fetch = nativeFetch;
    server.close();
  }

  const sceneFrames = resolveSceneDurations(narration, FPS);
  let cursor = 0;
  const rows = SCENES.map((sc, i) => {
    const frames = sceneFrames[i];
    const from = cursor;
    const to = cursor + frames - 1;
    cursor += frames;
    return {scene: sc.num, title: sc.title, from, to, frames, seconds: Number((frames / FPS).toFixed(2))};
  });

  // Contiguity gate (boundary-bleed fix, 2026-09-13): render-scenes.sh cuts
  // each part straight from these ranges, so a gap would drop frames from the
  // film and an overlap would print the same frames into two parts. Both are
  // silent in the output — the splice still concatenates — so assert here,
  // where the ranges are produced, rather than trusting the arithmetic above.
  rows.forEach((row, i) => {
    if (row.frames <= 0) throw new Error(`scene ${row.scene} has ${row.frames} frames`);
    if (row.to !== row.from + row.frames - 1)
      throw new Error(`scene ${row.scene} range ${row.from}-${row.to} does not match ${row.frames} frames`);
    if (i === 0) {
      if (row.from !== 0) throw new Error(`first scene starts at frame ${row.from}, not 0`);
      return;
    }
    const prev = rows[i - 1];
    if (row.from !== prev.to + 1)
      throw new Error(
        `scenes ${prev.scene} and ${row.scene} are not contiguous: ${prev.from}-${prev.to} then ${row.from}-${row.to}`,
      );
  });

  console.log(
    JSON.stringify(
      [...rows, {total: {frames: cursor, seconds: Number((cursor / FPS).toFixed(2))}}],
      null,
      2,
    ),
  );
};

main();
