import {cueFrame, type SceneCues} from '../cues';
import {WINDOW_PRESETS, type WindowLayoutSpec} from '../components/windowGeometry';

export const FLAT_RIGHT = {...WINDOW_PRESETS.skewRight, skewYDeg: 0};
export const requiredCueFrame = (cues: SceneCues, name: string, fps: number): number => {
  if (!Number.isFinite(cues?.[name])) throw new Error(`Missing required film cue: ${name}`);
  return cueFrame(cues, name, fps, 0);
};

/** W2 Stage 2: window continuity follows spoken clauses, independently of source cuts. */
export const sceneWindowSpec = (scene: number, frame: number, fps: number, cues: SceneCues): WindowLayoutSpec => {
  const move = (from: 'centerLarge' | 'centerSmall' | 'skewRight' | typeof FLAT_RIGHT,
    to: 'centerLarge' | 'centerSmall' | 'skewRight' | typeof FLAT_RIGHT, cue: string, seconds = 0.9): WindowLayoutSpec =>
    ({from, to, startFrame: requiredCueFrame(cues, cue, fps), durationInFrames: Math.round(seconds * fps)});
  if (scene === 2) return {preset: 'centerSmall'};
  if (scene === 3 || scene === 4) return {preset: 'centerLarge'};
  if (scene === 5) return frame < requiredCueFrame(cues, 'window-mirror', fps)
    ? move('centerLarge', 'centerSmall', 'cascade-open')
    : move('centerSmall', 'skewRight', 'window-mirror');
  if (scene === 6 || scene === 7) return {preset: 'skewRight'};
  if (scene === 8) return move('skewRight', FLAT_RIGHT, 'window-flatten', 0.45);
  if (scene === 9) return move(FLAT_RIGHT, 'centerLarge', 'window-center');
  if (scene === 10) return move('centerLarge', 'skewRight', 'zoom-out-again');
  throw new Error(`No middle-film layout for scene ${scene}`);
};

export const sourceFit = (width = 1920, height = 1080, chromeHeight = 65) => {
  const scale = (height - chromeHeight) / height;
  return {scale, left: (width - width * scale) / 2};
};

/** W2 keeps film cues on SceneVO's rounded offset/trim clock; tails are separate untrimmed Audio. */
export const narrationAdjustedCues = (cues: SceneCues, fps: number,
  controls: {offsetSec: number; trimStartSec: number}, tailOffsetInFrames?: number): SceneCues => {
  if (!cues || (controls.offsetSec === 0 && controls.trimStartSec === 0)) return cues;
  const offset = Math.round(controls.offsetSec * fps);
  const trim = Math.round(controls.trimStartSec * fps);
  return Object.fromEntries(Object.entries(cues).map(([name, seconds]) => {
    const frame = Math.round(seconds * fps);
    const isTail = tailOffsetInFrames !== undefined && frame >= tailOffsetInFrames;
    return [name, Math.max(0, frame + offset - (isTail ? 0 : trim)) / fps];
  }));
};
