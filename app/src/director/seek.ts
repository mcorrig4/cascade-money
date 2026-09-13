import {SHOTS, playShot} from './shots.ts';

const LIVE_SCENE = 4;

/** Deterministically reconstruct scene 4 at an absolute timeline position. */
export function seekTo(tMs: number) {
  const engine = window.__cascade?.engine;
  if (!engine) throw new Error('Cascade is not ready to seek');
  const shot = SHOTS.find(candidate => candidate.scene === LIVE_SCENE);
  if (!shot) throw new Error(`Cascade scene ${LIVE_SCENE} is missing`);
  const elapsedMs = Math.max(0, Math.min(tMs, shot.seconds * 1000));

  engine.setClockMode('manual');
  engine.stopShot();
  engine.update({
    speed: 1,
    story: 'apple',
    recording: false,
    camera: {
      ...shot.start,
      from: shot.start,
      duration: 0,
      id: engine.state.camera.id + 1,
      primitive: {kind: 'fly'},
    },
    cameraElapsed: 0,
  });
  engine.setPosition(0, true);
  playShot(engine, shot.id);
  // Process authored cues at exactly t=0 before advancing to the requested time.
  engine.tick(0, 'manual');
  engine.tick(elapsedMs / 1000, 'manual');
  return engine.state;
}
