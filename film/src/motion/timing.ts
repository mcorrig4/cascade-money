/**
 * The claude.do motion language — timing presets for every enter/exit in the system.
 *
 * PRINCIPLES (the taste, encoded):
 *  1. One idea per beat. A scene is 2–4 beats, never a firehose.
 *  2. Enter fast, settle soft. Text never bounces; objects may overshoot ~4%.
 *  3. Exits are quieter than enters: ~60% of the duration, less travel, ease-in.
 *  4. Stagger is rhythm: 3–5 frame steps, reading left→right / top→bottom.
 *  5. Land with a pulse: numbers/titles get a 3–6% scale bump over ~10 frames.
 *  6. The frame breathes: safe margins always; at most ONE glow per scene.
 *  7. Hold the money frame: hooks ≥45f, outros ≥60f of stillness before exit.
 */
import {spring, interpolate, Easing} from 'remotion';

export const FPS = 30;
/** One beat = 24 frames (0.8s). Scenes are 6–12 beats. */
export const BEAT = 24;

/* ---------------------------------------------------------------- springs */
/** Text settle — NO overshoot. The workhorse for words and titles. */
export const SPRING_SETTLE = {damping: 200} as const;
/** Card/object pop — slight overshoot (~4%), lively but adult. */
export const SPRING_POP = {damping: 16, mass: 0.9, stiffness: 130} as const;
/** Rise — soft vertical entrance for panels/rows. */
export const SPRING_RISE = {damping: 32, stiffness: 90} as const;

/* ----------------------------------------------------------------- enters */
export type EnterStyle = 'settle' | 'pop' | 'rise' | 'fade';

/** Returns {opacity, transform} for an element entering at `delay` frames. */
export const enter = (
  frame: number, fps: number, delay: number, style: EnterStyle = 'settle',
) => {
  const f = Math.max(0, frame - delay);
  switch (style) {
    case 'pop': {
      const s = spring({frame: f, fps, config: SPRING_POP, durationInFrames: 24});
      return {opacity: interpolate(f, [0, 8], [0, 1], CLAMP), transform: `scale(${0.92 + 0.08 * s})`};
    }
    case 'rise': {
      const s = spring({frame: f, fps, config: SPRING_RISE, durationInFrames: 28});
      return {opacity: interpolate(f, [0, 10], [0, 1], CLAMP), transform: `translateY(${40 * (1 - s)}px)`};
    }
    case 'fade':
      return {opacity: interpolate(f, [0, 14], [0, 1], CLAMP), transform: 'none'};
    default: { // settle — text
      const s = spring({frame: f, fps, config: SPRING_SETTLE, durationInFrames: 20});
      return {opacity: interpolate(f, [0, 8], [0, 1], CLAMP), transform: `translateY(${24 * (1 - s)}px)`};
    }
  }
};

/* ------------------------------------------------------------------ exits */
/** Exits ease IN (accelerate away) and travel less than enters. `at` = first frame of exit. */
export const exit = (
  frame: number, at: number, dur = 12, style: 'drop' | 'fade' | 'scaleAway' = 'fade',
) => {
  const p = interpolate(frame, [at, at + dur], [0, 1], {...CLAMP, easing: Easing.in(Easing.cubic)});
  if (style === 'drop') return {opacity: 1 - p, transform: `translateY(${16 * p}px)`};
  if (style === 'scaleAway') return {opacity: 1 - p, transform: `scale(${1 - 0.04 * p})`};
  return {opacity: 1 - p, transform: 'none'};
};

/* ---------------------------------------------------------------- helpers */
export const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Rhythmic stagger: index → frame delay. Default step = 4f. */
export const stagger = (i: number, step = 4, base = 0) => base + i * step;

/** One-shot emphasis pulse (scale multiplier), centered at frame `at`. */
export const pulse = (frame: number, at: number, amount = 0.05, half = 6) => {
  const d = Math.abs(frame - at);
  return d >= half ? 1 : 1 + amount * Math.cos((d / half) * (Math.PI / 2));
};

/** Count-up value: eased toward `target` between f0 and f1 (quint-out feel). */
export const countUp = (frame: number, f0: number, f1: number, target: number) => {
  const p = interpolate(frame, [f0, f1], [0, 1], {...CLAMP, easing: Easing.out(Easing.quad)});
  const q = 1 - Math.pow(1 - p, 5);
  return Math.round(target * q);
};

/* ------------------------------------------------------------ transitions */
/** Standard scene-to-scene durations (frames) for @remotion/transitions. */
export const TRANSITION = {
  cut: 0,
  fade: 14,        // default — crossfade between scenes
  fadeBlack: 12,   // hard beat-change: dip to black
  slide: 18,       // dark panel wipe, for chapter changes only
} as const;

/** Word/letter cascade: budget `total` frames across n items, min `step`. */
export const cascade = (n: number, total: number, minStep = 3) =>
  Math.max(minStep, Math.floor(total / Math.max(1, n)));
