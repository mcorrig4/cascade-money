import {SHOTS, playShot} from './shots.ts';

const LIVE_SCENE = 4;
export const FRAME_DRIVEN_STATE_SOURCES = [
  'React playback requestAnimationFrame', 'globe.gl render and tween requestAnimationFrame', 'OrbitControls damping',
  'camera flight origin and easing', 'idle camera drift', 'event-stream cursor', 'story reveal queue and cue ages',
  'arc lifetime, dash phase, and GPU object identity', 'ring propagation ticker', 'ledger rows and entrance animation',
  'CSS animations and transitions', 'earth sun clock', 'site-model fade and async readiness', 'scene-transition diagnostics',
] as const;
let loggedSources = false;

/** Deterministically reconstruct a scene at an absolute timeline position. */
export function seekTo(tMs: number, scene = LIVE_SCENE, absoluteTimeline = false, cues:Record<string,number> = {}, recordingHud = false) {
  const engine = window.__cascade?.engine;
  if (!engine) throw new Error('Cascade is not ready to seek');
  const shot = SHOTS.find(candidate => candidate.scene === scene);
  if (!shot) throw new Error(`Cascade scene ${scene} is missing`);
  const requestedElapsedMs = absoluteTimeline ? tMs - shot.startTime * 1000 : tMs;
  const elapsedMs = Math.max(0, Math.min(requestedElapsedMs, shot.seconds * 1000));

  engine.setClockMode('manual');
  if (!loggedSources) {
    loggedSources = true;
    console.info('[Cascade frame-driven] controlled state sources:', FRAME_DRIVEN_STATE_SOURCES.join('; '));
  }
  engine.stopShot();
  engine.update({
    speed: 1,
    story: 'apple',
    // `recordingHud` puts the app in the same presentation the film's own
    // captures were recorded in (brand + ledger + timeline, no director/story/
    // site chrome), so a live-rendered scene matches the captured ones instead
    // of showing the interactive app's controls.
    recording: recordingHud,
    hud: true,
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
  engine.update({cues});
  // Process authored cues at exactly t=0 before advancing to the requested time.
  engine.tick(0, 'manual');
  engine.tick(elapsedMs / 1000, 'manual');
  if(requestedElapsedMs<0)engine.update({tMs:shot.startTime*1000+requestedElapsedMs,shotElapsed:requestedElapsedMs/1000});
  return engine.state;
}
