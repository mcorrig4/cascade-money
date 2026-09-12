/**
 * CascadeFilm schedule — frame-accurate mapping of shooting-script-v2.md's
 * 20 scenes (source: ~/.world/team/director/docs/cascade/hackathon/
 * shooting-script-v2.md, v2.1) to durations at 30fps. Every duration below
 * is the script's own timecode span; the sum is exactly 7080f = 236s = 3:56,
 * matching the script's delivered runtime.
 *
 * `capture` names the file in public/captures/ used for that scene (real
 * ffprobe'd durations recorded in the comment beside each — see
 * film-lane-status notes for how these were captured on dev-mac
 * ~/cascade-3d/capture/out/). Scenes with no live capture (the script marks
 * these as needing new shots.ts ids not yet built, or the PO explicitly
 * calls them out as motion-graphic beats) get `capture: null` and are built
 * as pure Remotion motion graphics.
 *
 * `frame` names which BrowserFrame mode plays under the scene, per the PO's
 * "reads as an app in a browser" direction: 'tilt' only at the very open,
 * 'bleed' for cinematic globe beats, 'framed' for protocol-talk/data beats.
 */
export type SceneFrameMode = 'tilt' | 'bleed' | 'framed';

export interface SceneDef {
  id: string;
  title: string;
  durationInFrames: number;
  capture: string | null;
  captureDurationInFrames?: number; // real ffprobe'd length, may be < scene length (hold last frame)
  frame: SceneFrameMode;
  motionGraphic: boolean;
}

const s = (seconds: number) => Math.round(seconds * 30);

export const SCENES: SceneDef[] = [
  {id: 'scene01', title: 'Apple Park orbit', durationInFrames: s(4), capture: 'shot-01-apple-park.mp4', captureDurationInFrames: 89, frame: 'tilt', motionGraphic: false},
  {id: 'scene02', title: 'Rainbow-arch swoop / pull-out to Earth', durationInFrames: s(9), capture: 'shot-02-network.mp4', captureDurationInFrames: 239, frame: 'bleed', motionGraphic: false},
  {id: 'scene03', title: 'Rewind (time-lapse blur + white flash)', durationInFrames: s(4), capture: null, frame: 'bleed', motionGraphic: true},
  {id: 'scene04', title: 'September 9, 2025 (title card)', durationInFrames: s(3), capture: null, frame: 'bleed', motionGraphic: true},
  {id: 'scene05', title: 'The catch, rotation begins', durationInFrames: s(12), capture: null, frame: 'framed', motionGraphic: true},
  {id: 'scene06', title: 'The question', durationInFrames: s(3), capture: null, frame: 'framed', motionGraphic: true},
  {id: 'scene07', title: 'The first payment (the proof)', durationInFrames: s(8), capture: 'shot-03-the-proof.mp4', captureDurationInFrames: 359, frame: 'bleed', motionGraphic: false},
  {id: 'scene08', title: 'The cascade', durationInFrames: s(10), capture: 'shot-04-the-cascade.mp4', captureDurationInFrames: 359, frame: 'bleed', motionGraphic: false},
  {id: 'scene09', title: 'The year (global sweep)', durationInFrames: s(15), capture: 'shot-05-one-year.mp4', captureDurationInFrames: 450, frame: 'bleed', motionGraphic: false},
  {id: 'scene10', title: 'A dollar with a date', durationInFrames: s(53), capture: 'shot-06-dollar-with-a-date.mp4', captureDurationInFrames: 1590, frame: 'bleed', motionGraphic: false},
  {id: 'scene11', title: 'The treasury decision', durationInFrames: s(6), capture: null, frame: 'framed', motionGraphic: true},
  {id: 'scene12', title: 'Extend it. (the yield curve)', durationInFrames: s(5), capture: null, frame: 'framed', motionGraphic: true},
  {id: 'scene13', title: 'The vault under pressure', durationInFrames: s(15), capture: 'shot-09-the-vault.mp4', captureDurationInFrames: 449, frame: 'bleed', motionGraphic: false},
  {id: 'scene14', title: 'The rules (conservation laws)', durationInFrames: s(20), capture: 'shot-08-conservation-laws.mp4', captureDurationInFrames: 600, frame: 'framed', motionGraphic: true},
  {id: 'scene15', title: 'The reframe ($846T derivatives)', durationInFrames: s(15), capture: 'shot-10-the-reframe.mp4', captureDurationInFrames: 449, frame: 'framed', motionGraphic: true},
  {id: 'scene16', title: 'The composable diagram', durationInFrames: s(8), capture: 'shot-11-architecture.mp4', captureDurationInFrames: 150, frame: 'framed', motionGraphic: true},
  {id: 'scene17', title: 'Close', durationInFrames: s(6), capture: 'shot-12-cascade.mp4', captureDurationInFrames: 180, frame: 'bleed', motionGraphic: false},
  {id: 'scene18', title: 'The descent', durationInFrames: s(14), capture: 'shot-12-cascade.mp4', captureDurationInFrames: 420, frame: 'bleed', motionGraphic: false},
  {id: 'scene19', title: 'The line (white flash)', durationInFrames: s(8), capture: null, frame: 'bleed', motionGraphic: true},
  {id: 'scene20', title: 'Cascade Money / the tag', durationInFrames: s(18), capture: null, frame: 'bleed', motionGraphic: true},
];

// scene18 shares shot-12-cascade.mp4 with scene17 — it plays the SECOND half
// (frames 180-600 of the 600f/20s capture). Scene component reads this via
// the export below rather than re-deriving it.
export const SCENE18_CAPTURE_START = 180;

export const TOTAL_DURATION = SCENES.reduce((a, sc) => a + sc.durationInFrames, 0);

/** Cumulative start frame for each scene, in CascadeFilm's own timeline. */
export const sceneStart = (id: string): number => {
  let f = 0;
  for (const sc of SCENES) {
    if (sc.id === id) return f;
    f += sc.durationInFrames;
  }
  throw new Error(`unknown scene id ${id}`);
};

/** Markers per spoken line, for the scratch-narration track (silent placeholder). */
export const NARRATION_MARKERS: {sceneId: string; label: string}[] = [
  {sceneId: 'scene01', label: 'Monday (open)'},
  {sceneId: 'scene02', label: 'Monday (network)'},
  {sceneId: 'scene03', label: 'Rewind'},
  {sceneId: 'scene05', label: 'The catch'},
  {sceneId: 'scene06', label: 'The question'},
  {sceneId: 'scene07', label: 'The first payment'},
  {sceneId: 'scene08', label: 'The cascade'},
  {sceneId: 'scene09', label: 'The year'},
  {sceneId: 'scene10', label: 'A dollar with a date / The vault'},
  {sceneId: 'scene11', label: 'The treasury decision'},
  {sceneId: 'scene12', label: 'Extend it.'},
  {sceneId: 'scene13', label: 'Under pressure'},
  {sceneId: 'scene14', label: 'The rules'},
  {sceneId: 'scene15', label: 'The reframe'},
  {sceneId: 'scene17', label: 'Close'},
  {sceneId: 'scene18', label: 'The descent'},
  {sceneId: 'scene19', label: 'The line'},
  {sceneId: 'scene20', label: 'Cascade Money / The tag'},
];
