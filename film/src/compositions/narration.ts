/**
 * narration.ts — optional real-narration overlay for the v6 schedule.
 *
 * When film/public/narration/narration.json exists, it is a JSON array of
 * {scene, file, duration} objects (scene = 1..17 matching SCENES[].num,
 * file = filename inside public/narration/, duration = seconds of the
 * rendered VO clip). Each such scene's Sequence duration becomes
 * `duration + 0.4s` (a small settle pad after the line finishes) instead of
 * the word-count estimate, and its audio plays from that file.
 *
 * Both `calculateMetadata` (Root.tsx) and CascadeFilm read this through the
 * same two functions so the numbers used to size the composition and the
 * numbers used to render it can never drift apart.
 *
 * Capture existence (public/captures/scene-NN.mp4) is resolved the same
 * way — a HEAD request works identically in the browser (Studio preview)
 * and in Node (headless-Chrome render, which still serves `public/` over
 * HTTP), so one code path covers both without any Node-only APIs like `fs`.
 */
import {staticFile} from 'remotion';

export interface NarrationEntry {
  scene: number;
  file: string;
  duration: number; // seconds
}

export type NarrationMap = Record<
  number,
  {
    file: string;
    durationInFrames: number; // scene's resolved Sequence duration: raw clip + settle pad
    rawDurationInFrames: number; // the clip's own length, no settle pad — what narrationControls trims against
  }
>;

export const NARRATION_SETTLE_SECONDS = 0.4;

export const loadNarration = async (fps: number): Promise<NarrationMap> => {
  try {
    const res = await fetch(staticFile('narration/narration.json'));
    if (!res.ok) return {};
    const data: NarrationEntry[] = await res.json();
    const map: NarrationMap = {};
    for (const e of data) {
      map[e.scene] = {
        file: e.file,
        durationInFrames: Math.round((e.duration + NARRATION_SETTLE_SECONDS) * fps),
        rawDurationInFrames: Math.round(e.duration * fps),
      };
    }
    return map;
  } catch {
    return {};
  }
};

export const captureFileFor = (sceneNum: number): string =>
  `scene-${String(sceneNum).padStart(2, '0')}.mp4`;

/** Which scenes already have a public/captures/scene-NN.mp4 recapture. */
export const loadCaptureOverrides = async (
  sceneNums: number[],
): Promise<Record<number, boolean>> => {
  const entries = await Promise.all(
    sceneNums.map(async (num): Promise<[number, boolean]> => {
      try {
        const res = await fetch(staticFile(`captures/${captureFileFor(num)}`), {method: 'HEAD'});
        return [num, res.ok];
      } catch {
        return [num, false];
      }
    }),
  );
  return Object.fromEntries(entries);
};
