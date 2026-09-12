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

export const ESTIMATED_TOTAL_DURATION = SCENES.reduce((a, sc) => a + sc.estimateFrames, 0);

export const sceneByNum = (num: number): SceneDef => {
  const sc = SCENES.find((s) => s.num === num);
  if (!sc) throw new Error(`unknown scene num ${num}`);
  return sc;
};
