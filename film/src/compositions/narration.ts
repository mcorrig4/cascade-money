/**
 * narration.ts — optional real-narration overlay for the v6 schedule.
 *
 * When film/public/narration/narration.json exists, it is a JSON array of
 * {scene, file, duration} objects (scene = 1..12 matching SCENES[].num,
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
  /**
   * Scene 1 only (round 4, Liam 2026-09-13): once Liam records his own take
   * for scene 1's first two lines, `file`/`duration` above become HIS clip,
   * and this pair name the Kokoro-generated tail ("iPhone Duo, launching
   * Monday.") that plays after it — `tailDuration` is that tail clip's own
   * ffprobe'd length in seconds, authored in narration.json exactly like
   * `duration` is for `file`. Both fields are added to narration.json
   * TOGETHER, only once both audio files actually exist — until then this
   * scene (like every other) is a single `file` read straight through, so
   * an in-progress re-record never breaks the render (see loadNarration).
   */
  tailFile?: string;
  tailDuration?: number; // seconds
  /**
   * Optional per-scene override of the silence between `file` and
   * `tailFile` (seconds). Defaults to SCENE1_NARRATION_GAP_SECONDS when a
   * tail is present and this is omitted — added so scenes other than 1 can
   * carry their own breath length before their Kokoro tail (e.g. a longer
   * pause for the "echo of a thought" effect) without changing the shared
   * default.
   */
  tailGapSec?: number;
}

export type NarrationMap = Record<
  number,
  {
    file: string;
    durationInFrames: number; // scene's resolved Sequence duration: raw clip + settle pad (+ tail, if any)
    rawDurationInFrames: number; // file (+gap+tail, if any) length, no settle pad — what narrationControls trims against / schedule.ts's scene-1 tail math reads
    /** Scene 1 two-part narration (see NarrationEntry.tailFile above). */
    tailFile?: string;
    tailOffsetInFrames?: number; // frames from the START of `file`'s own Sequence at which the tail begins (file's raw length + the gap)
    tailRawDurationInFrames?: number; // the tail clip's own length, no settle pad
  }
>;

export const NARRATION_SETTLE_SECONDS = 0.4;
/** Default silence between a scene's `file` and its `tailFile` when the
 * entry does not specify its own `tailGapSec` (originally scene-1-only, now
 * the fallback for every two-part scene). */
export const SCENE1_NARRATION_GAP_SECONDS = 0.25;

export const loadNarration = async (fps: number): Promise<NarrationMap> => {
  try {
    const res = await fetch(staticFile('narration/narration.json'));
    if (!res.ok) return {};
    const data: NarrationEntry[] = await res.json();
    const map: NarrationMap = {};
    for (const e of data) {
      if (e.tailFile !== undefined && e.tailDuration !== undefined) {
        // Two-part scene (scene 1, round 4): total raw length is `file` +
        // the gap (per-scene tailGapSec, defaulting to
        // SCENE1_NARRATION_GAP_SECONDS) + `tailFile`, both fed through the
        // same fps-rounding path as the single-file case below.
        const gapSeconds = e.tailGapSec ?? SCENE1_NARRATION_GAP_SECONDS;
        const rawTotalSeconds = e.duration + gapSeconds + e.tailDuration;
        map[e.scene] = {
          file: e.file,
          durationInFrames: Math.round((rawTotalSeconds + NARRATION_SETTLE_SECONDS) * fps),
          rawDurationInFrames: Math.round(rawTotalSeconds * fps),
          tailFile: e.tailFile,
          tailOffsetInFrames: Math.round((e.duration + gapSeconds) * fps),
          tailRawDurationInFrames: Math.round(e.tailDuration * fps),
        };
        continue;
      }
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
