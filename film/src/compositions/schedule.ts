/**
 * CascadeFilm schedule — the 17 scenes of docs/script-v6-liam.md, one entry
 * per scene, in order. This is the "product owner's final narration" cut
 * (Stage 12): every scene id/title below is copied verbatim from that
 * script's own "Scene N — Title" headers.
 *
 * `estimateFrames` is a FALLBACK duration, used only when
 * public/narration/narration.json has no entry for that scene yet (see
 * narration.ts). It is derived from the scene's own spoken word count at
 * 155 words/minute, i.e. `words/155*60` seconds, rounded to the frame at
 * 30fps. One extra second (30 frames) is added once, to scene 17 (Close),
 * because it is a held outro card whose visual beats (white card -> wordmark
 * -> tag) need a floor of hold time independent of how few words it speaks
 * — not because every scene gets +1s (17 scenes x 1s would blow the 4:00
 * upload ceiling on 603 words: 4:10 vs the 3:54 target). Word counts:
 * verified-figures-v6.md ("v6 spoken words: 603").
 *
 *   totalWords/155*60 + 1s(close pad) = 233.43s + 1s = 234.43s = 3:54,
 *   5.6s under the 4:00 hard cap that rejects uploads.
 *
 * These numbers are a PRE-NARRATION placeholder. Once real VO lands in
 * public/narration/narration.json, each scene's actual Sequence duration
 * becomes that clip's own length + 0.4s (see narration.ts) and this
 * estimate stops being used for that scene.
 *
 * `fallbackCapture` names the file in public/captures/ used for that scene
 * UNTIL a matching public/captures/scene-NN.mp4 recapture exists (checked
 * live via narration.ts's loadCaptureOverrides — no code change needed to
 * adopt a recapture). Scenes with `fallbackCapture: null` have no old shot
 * that matches the new beat and are built as pure motion graphics instead —
 * never a black frame either way.
 */
export type SceneFrameMode = 'tilt' | 'bleed' | 'framed';

export interface SceneDef {
  num: number; // 1-17, matches the script's own scene numbers
  id: string; // 'scene01'..'scene17'
  title: string; // verbatim from script-v6-liam.md's "Scene N — Title"
  estimateFrames: number;
  fallbackCapture: string | null;
  fallbackCaptureDurationInFrames?: number; // real ffprobe'd length of the fallback file
  fallbackCaptureStartFrom?: number; // offset into the fallback file, for shared/continued takes
  frame: SceneFrameMode;
  motionGraphic: boolean;
}

export const SCENES: SceneDef[] = [
  {num: 1, id: 'scene01', title: 'The object of desire', estimateFrames: 163, fallbackCapture: null, frame: 'tilt', motionGraphic: true},
  {num: 2, id: 'scene02', title: 'Apple Park', estimateFrames: 441, fallbackCapture: 'shot-01-apple-park.mp4', fallbackCaptureDurationInFrames: 89, frame: 'bleed', motionGraphic: false},
  {num: 3, id: 'scene03', title: 'Rewind', estimateFrames: 546, fallbackCapture: null, frame: 'bleed', motionGraphic: true},
  {num: 4, id: 'scene04', title: 'The hidden supply chain', estimateFrames: 557, fallbackCapture: 'shot-02-network.mp4', fallbackCaptureDurationInFrames: 239, frame: 'bleed', motionGraphic: false},
  {num: 5, id: 'scene05', title: 'The contradiction', estimateFrames: 453, fallbackCapture: 'shot-02-network.mp4', fallbackCaptureDurationInFrames: 239, frame: 'bleed', motionGraphic: false},
  {num: 6, id: 'scene06', title: 'The question', estimateFrames: 209, fallbackCapture: null, frame: 'framed', motionGraphic: true},
  {num: 7, id: 'scene07', title: 'The cascade', estimateFrames: 639, fallbackCapture: 'shot-04-the-cascade.mp4', fallbackCaptureDurationInFrames: 359, frame: 'bleed', motionGraphic: false},
  {num: 8, id: 'scene08', title: 'Let it land', estimateFrames: 348, fallbackCapture: 'shot-04-the-cascade.mp4', fallbackCaptureDurationInFrames: 359, frame: 'bleed', motionGraphic: false},
  {num: 9, id: 'scene09', title: 'Run the year', estimateFrames: 499, fallbackCapture: 'shot-05-one-year.mp4', fallbackCaptureDurationInFrames: 450, frame: 'bleed', motionGraphic: false},
  {num: 10, id: 'scene10', title: 'A dollar with a date', estimateFrames: 778, fallbackCapture: 'shot-06-dollar-with-a-date.mp4', fallbackCaptureDurationInFrames: 1590, frame: 'bleed', motionGraphic: false},
  {num: 11, id: 'scene11', title: 'Underneath it', estimateFrames: 569, fallbackCapture: 'shot-09-the-vault.mp4', fallbackCaptureDurationInFrames: 449, frame: 'bleed', motionGraphic: false},
  {num: 12, id: 'scene12', title: 'Stress test', estimateFrames: 314, fallbackCapture: 'shot-09-the-vault.mp4', fallbackCaptureDurationInFrames: 449, frame: 'bleed', motionGraphic: false},
  {num: 13, id: 'scene13', title: 'The rules survive', estimateFrames: 325, fallbackCapture: 'shot-08-conservation-laws.mp4', fallbackCaptureDurationInFrames: 600, frame: 'framed', motionGraphic: true},
  {num: 14, id: 'scene14', title: 'Zoom out', estimateFrames: 488, fallbackCapture: 'shot-11-architecture.mp4', fallbackCaptureDurationInFrames: 150, frame: 'framed', motionGraphic: true},
  {num: 15, id: 'scene15', title: 'New York', estimateFrames: 302, fallbackCapture: 'shot-12-cascade.mp4', fallbackCaptureDurationInFrames: 420, fallbackCaptureStartFrom: 180, frame: 'bleed', motionGraphic: true},
  {num: 16, id: 'scene16', title: 'Beneath it', estimateFrames: 267, fallbackCapture: 'shot-12-cascade.mp4', fallbackCaptureDurationInFrames: 420, fallbackCaptureStartFrom: 180, frame: 'bleed', motionGraphic: true},
  {num: 17, id: 'scene17', title: 'Close', estimateFrames: 135, fallbackCapture: null, frame: 'bleed', motionGraphic: true},
];

/**
 * All the numbers on SCENES[] above (estimateFrames) and the floor just
 * below (SCENE17_CLOSE_FLOOR_FRAMES) were authored assuming 30fps — that is
 * this file's `FPS_BASE`. The composition itself can run at a different fps
 * (the draft profile renders at 15fps — see CascadeFilmProps.fps in
 * narrationControlsSchema.ts), so every consumer of these numbers goes
 * through `resolveSceneDurations`/`filmDurationAtFps` below, which convert
 * to the ACTUAL fps once, centrally — never re-derive frame math from these
 * raw fields directly.
 */
export const FPS_BASE = 30;

/** Convert a frame count authored at FPS_BASE to the equivalent at `fps`, preserving wall-clock duration. Rounds — for a SINGLE constant, not a whole scene list (see resolveSceneDurations for why the film's total needs cumulative rounding instead). */
export const scaleFrames = (framesAtBase: number, fps: number): number =>
  Math.round((framesAtBase * fps) / FPS_BASE);

/**
 * Scene 17 (Close) is a held outro card: white -> tag -> wordmark beats need
 * a floor of screen time independent of how few words the VO speaks for it.
 * Applied everywhere a scene's resolved duration is computed
 * (resolveSceneDurations below, used by both Root.tsx's calculateMetadata
 * and CascadeFilm.tsx) so the sizing and rendering numbers never drift
 * apart. Narration shorter than the floor just ends early and the card
 * holds silently for the remainder; narration longer than the floor is
 * unaffected (the floor is a minimum, not a cap).
 *
 * An 8s (240-frame) floor was the first pass, but with the rest of the
 * schedule at its current word-count estimates that pushes the film's total
 * from 3:54 to 3:57.9 — over the 3:54 target. Reduced to 5s (150 frames),
 * the largest floor that still lands the total at 3:54 (234.93s, verified
 * via `npx remotion compositions`).
 */
export const SCENE17_CLOSE_FLOOR_FRAMES = 150; // 5s @ FPS_BASE (30fps)

/**
 * Scene 1's Kokoro take (round 3, audio agent 2026-09-13) needs more room
 * after "Monday" than the standard 0.4s settle pad (NARRATION_SETTLE_SECONDS
 * in narration.ts) — a 1.0s tail — so this scene alone uses the take's own
 * RAW length (rawDurationInFrames, no settle pad baked in) + this tail,
 * instead of narration.ts's padded `durationInFrames`. Capped at the
 * cold-load capture's own length (verified via ffprobe, 2026-09-13:
 * scene-01.mp4 is 26.53s) so the window is never asked to play past its
 * source video's end.
 */
const SCENE1_TAIL_SECONDS = 1.0;
const SCENE1_CAPTURE_DURATION_SECONDS = 26.53;

type NarrationDurations = Record<number, {durationInFrames: number; rawDurationInFrames?: number}>;

/** A scene's UNROUNDED duration in frames at `fps` — real VO length (already fps-native, integer), else the word-count estimate scaled from FPS_BASE (fractional), with scene 1's tail and scene 17's floor applied to whichever one it is. */
const rawDurationForScene = (sc: SceneDef, narration: NarrationDurations, fps: number): number => {
  if (sc.num === 1 && narration[1]?.rawDurationInFrames !== undefined) {
    const withTail = narration[1].rawDurationInFrames! + SCENE1_TAIL_SECONDS * fps;
    return Math.min(withTail, SCENE1_CAPTURE_DURATION_SECONDS * fps);
  }
  const raw = narration[sc.num]?.durationInFrames ?? (sc.estimateFrames * fps) / FPS_BASE;
  return sc.num === 17 ? Math.max(raw, (SCENE17_CLOSE_FLOOR_FRAMES * fps) / FPS_BASE) : raw;
};

/**
 * The 17 scenes' resolved Sequence durations (integer frames) at `fps`.
 * Rounding each scene independently (e.g. `Math.round(rawDurationForScene(...))`)
 * would let up to 17 individual +/-0.5 frame roundings accumulate into a
 * multi-frame drift on the film's total — at fps=15 that showed up as 3529
 * frames instead of the exact half of 7048 (3524). Cumulative rounding
 * (round the RUNNING TOTAL, take each scene's frames as the delta from the
 * previous running total) guarantees the sum of these always equals
 * `filmDurationAtFps`'s own rounding of the true total, at any fps.
 */
export const resolveSceneDurations = (narration: NarrationDurations, fps: number = FPS_BASE): number[] => {
  let cumulative = 0;
  let prevRounded = 0;
  return SCENES.map((sc) => {
    cumulative += rawDurationForScene(sc, narration, fps);
    const rounded = Math.round(cumulative);
    const frames = rounded - prevRounded;
    prevRounded = rounded;
    return frames;
  });
};

export const filmDurationAtFps = (narration: NarrationDurations, fps: number = FPS_BASE): number =>
  resolveSceneDurations(narration, fps).reduce((a, b) => a + b, 0);

/** The default (30fps, no real narration yet) total — Root.tsx's static Composition durationInFrames fallback before calculateMetadata runs. */
export const ESTIMATED_TOTAL_DURATION = filmDurationAtFps({}, FPS_BASE);

export const sceneByNum = (num: number): SceneDef => {
  const sc = SCENES.find((s) => s.num === num);
  if (!sc) throw new Error(`unknown scene num ${num}`);
  return sc;
};
