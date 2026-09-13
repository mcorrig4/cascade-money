import {Easing, interpolate} from 'remotion';

export type WindowState = Readonly<{
  targetScale: number;
  anchorLeftFrac: number;
  skewYDeg: number;
  perspectivePx: number;
  originXFrac: number;
  chromeProgress: number;
}>;

const smallScale = 0.62;
const leftMargin = 0.04;
const browser = {perspectivePx: 1800, originXFrac: 0, chromeProgress: 1};

/** W0: preset geometry belongs here; scenes own only choreography and cue times. */
export const WINDOW_PRESETS = Object.freeze({
  skewLeft: {...browser, targetScale: smallScale, anchorLeftFrac: leftMargin, skewYDeg: 8},
  skewRight: {...browser, targetScale: smallScale, anchorLeftFrac: 1 - leftMargin - smallScale, skewYDeg: -8, originXFrac: 1},
  centerSmall: {...browser, targetScale: smallScale, anchorLeftFrac: (1 - smallScale) / 2, skewYDeg: 0},
  centerLarge: {...browser, targetScale: 0.95, anchorLeftFrac: 0.025, skewYDeg: 0},
  fullscreen: {...browser, targetScale: 1, anchorLeftFrac: 0, skewYDeg: 0, chromeProgress: 0},
} as const satisfies Record<string, WindowState>);
Object.values(WINDOW_PRESETS).forEach(Object.freeze);

export type WindowPreset = keyof typeof WINDOW_PRESETS;
export type WindowEndpoint = WindowPreset | WindowState;
export type WindowLayoutSpec =
  | {preset: WindowPreset; from?: never; to?: never; startFrame?: never; durationInFrames?: never; easing?: never}
  | {preset?: never; from: WindowEndpoint; to: WindowEndpoint; startFrame: number; durationInFrames: number; easing?: (t: number) => number};
export type Point = {x: number; y: number};
export type WindowRect = {left: number; right: number; top: number; bottom: number; width: number; height: number};
export type WindowGeometry = WindowState & {
  scale: number;
  leftPct: number;
  rotateY: number;
  perspective: number;
  width: number;
  height: number;
  corners: readonly Point[];
  rect: WindowRect;
};

const finite = (value: number, name: string) => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
};
const validateState = (state: WindowState): WindowState => {
  if (!state) throw new Error('Unknown window preset');
  for (const key of Object.keys(browser).concat(['targetScale', 'anchorLeftFrac', 'skewYDeg']) as (keyof WindowState)[]) finite(state[key], key);
  if (state.targetScale <= 0 || state.perspectivePx <= 0) throw new Error('Window scale and perspective must be positive');
  for (const key of ['originXFrac', 'chromeProgress'] as const) {
    if (state[key] < 0 || state[key] > 1) throw new Error(`${key} must be in [0, 1]`);
  }
  // Off-screen anchors and large windows are valid choreography; projection
  // separately rejects any corner crossing the perspective camera plane.
  return state;
};
const endpoint = (value: WindowEndpoint): WindowState => validateState(typeof value === 'string' ? WINDOW_PRESETS[value] : value);

export const transitionProgress = (frame: number, startFrame: number, durationInFrames: number,
  easing: (t: number) => number = Easing.inOut(Easing.cubic)): number => {
  finite(frame, 'frame'); finite(startFrame, 'startFrame');
  if (!Number.isFinite(durationInFrames) || durationInFrames <= 0) throw new Error('Window transition duration must be positive');
  return interpolate(frame, [startFrame, startFrame + durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing,
  });
};

/** Resolved endpoints preserve scene 1's overlapping pull-back/swing without double easing. */
export const interpolateWindowState = (from: WindowEndpoint, to: WindowEndpoint, progress: number): WindowState => {
  finite(progress, 'progress');
  const a = endpoint(from), b = endpoint(to);
  const p = Math.max(0, Math.min(1, progress));
  // Exact endpoints avoid a residual fraction (e.g. .025000000000000022)
  // after a transition has finished and the caller switches to a static preset.
  if (p === 0) return a;
  if (p === 1) return b;
  const mix = (key: keyof WindowState) => a[key] + (b[key] - a[key]) * p;
  return {
    targetScale: mix('targetScale'), anchorLeftFrac: mix('anchorLeftFrac'), skewYDeg: mix('skewYDeg'),
    perspectivePx: mix('perspectivePx'), originXFrac: mix('originXFrac'), chromeProgress: mix('chromeProgress'),
  };
};

export const windowStateAt = (spec: WindowLayoutSpec, frame: number): WindowState => {
  finite(frame, 'frame');
  return spec.preset !== undefined ? endpoint(spec.preset)
    : interpolateWindowState(spec.from, spec.to, transitionProgress(frame, spec.startFrame, spec.durationInFrames, spec.easing));
};

export const projectWindow = (state: WindowState, width: number, height: number): WindowGeometry => {
  validateState(state); finite(width, 'width'); finite(height, 'height');
  if (width <= 0 || height <= 0) throw new Error('Composition dimensions must be positive');
  const {targetScale: scale, anchorLeftFrac, skewYDeg: rotateY, perspectivePx: perspective, originXFrac} = state;
  // CSS left describes the untransformed element. Compensate for the origin so
  // anchorLeftFrac still names the unrotated visible rectangle for either edge.
  const leftPct = originXFrac === 0 ? anchorLeftFrac * 100
    : (anchorLeftFrac - (1 - scale) * originXFrac) * 100;
  const originX = originXFrac * width;
  const theta = rotateY * Math.PI / 180;
  const corners = [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => {
    const dx = x - originX;
    const worldX = leftPct / 100 * width + originX + scale * Math.cos(theta) * dx;
    const worldY = height / 2 + scale * (y - height / 2);
    // BrowserFrame uses scale(s), NOT scale3d(s,s,s): the rotated Z stays
    // unscaled. Perspective belongs to the parent, whose origin is frame centre.
    const z = -Math.sin(theta) * dx;
    if (perspective <= z) throw new Error('Window crosses the perspective camera plane');
    const factor = perspective / (perspective - z);
    return {x: width / 2 + (worldX - width / 2) * factor, y: height / 2 + (worldY - height / 2) * factor};
  });
  const left = Math.min(...corners.map(p => p.x)), right = Math.max(...corners.map(p => p.x));
  const top = Math.min(...corners.map(p => p.y)), bottom = Math.max(...corners.map(p => p.y));
  return {...state, scale, leftPct, rotateY, perspective, width, height, corners,
    rect: {left, right, top, bottom, width: right - left, height: bottom - top}};
};

export const windowGeometryAt = (spec: WindowLayoutSpec, frame: number, width = 1920, height = 1080): WindowGeometry =>
  projectWindow(windowStateAt(spec, frame), width, height);

/** These expressions deliberately retain BrowserFrame's original operation order. */
export const windowFrameStyle = (g: WindowGeometry, legacyFrameAppearance = false) => {
  const p = g.chromeProgress;
  return {
    position: 'absolute' as const,
    top: '50%', left: `${g.leftPct}%`, width: g.width, height: g.height,
    transform: `translateY(-50%) scale(${g.scale}) rotateY(${g.rotateY}deg)`,
    transformOrigin: g.originXFrac === 0 ? 'left center' : g.originXFrac === 1 ? 'right center' : `${g.originXFrac * 100}% center`,
    // Scene 1 historically clips even its p=0 frame (8px radius, 1px border).
    // W0 parity takes precedence; ordinary fullscreen has neither edge.
    borderRadius: legacyFrameAppearance ? 8 + 14 * p : 22 * p,
    overflow: 'hidden' as const,
    boxShadow: `0 ${60 * p}px ${140 * p}px rgba(0,0,0,${0.55 * p})`,
    border: `${legacyFrameAppearance ? 1 : p}px solid rgba(170,199,204,${0.22 * p})`,
  };
};

export const presentationRect = (g: WindowGeometry, side: 'left' | 'right', padding = 32): WindowRect => {
  const pad = Math.max(0, padding);
  const left = Math.min(g.width, side === 'left' ? pad : Math.max(pad, g.rect.right + pad));
  const right = Math.max(left, Math.min(g.width - pad, side === 'left' ? g.rect.left - pad : g.width - pad));
  const top = Math.min(pad, g.height), bottom = Math.max(top, g.height - pad);
  return {left, right, top, bottom, width: right - left, height: bottom - top};
};
