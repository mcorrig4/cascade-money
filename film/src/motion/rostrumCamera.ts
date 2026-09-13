/**
 * rostrumCamera — pan/zoom transform for a CaptureScene's video layer only
 * (never the browser chrome, never overlay children). Used by Scene 9 ("Run
 * the year", Liam round 2, msg 21778): push in on the bottom-left year
 * scrubber, pan over to the right-side transactions ledger, then pull back
 * to the full frame.
 *
 * A move eases FROM the previous held target TO its own target over
 * `durationInFrames`, cubic ease-in-out, no overshoot, then holds until the
 * next move's startFrame. Before the first move it holds FULL_FRAME.
 *
 * The zoom is centered on the target point via transform-origin math: with
 * transform-origin set to the target's own fractional position, a pure
 * scale() leaves that point fixed on screen, so an additional translate of
 * (frame-center minus target point) recenters it — the standard "zoom into
 * a region and center it" combination, not a scale-in-place that leaves the
 * region pinned to a corner.
 */
import type {CSSProperties} from 'react';

export interface CameraTarget {
  /** Fraction (0-1) of the capture's 1920x1080 frame. */
  xFrac: number;
  yFrac: number;
  scale: number;
}

export interface RostrumMove {
  /** Scene-local frame this move begins easing (cue-resolved, via cueFrame). */
  startFrame: number;
  /** Ease duration in frames (derive from the brief's ms via the composition's fps). */
  durationInFrames: number;
  target: CameraTarget;
}

export const FULL_FRAME: CameraTarget = {xFrac: 0.5, yFrac: 0.5, scale: 1};

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/** Cubic ease-in-out — symmetric accelerate/decelerate, no overshoot. */
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Resolves the held/interpolating camera target at `frame`, walking an
 * ordered list of moves. Each move eases from the PRECEDING move's target
 * (or FULL_FRAME before the first move), so the moves chain: push in, hold,
 * pan, hold, pull back, hold.
 */
export const cameraAt = (frame: number, moves: RostrumMove[]): CameraTarget => {
  let from = FULL_FRAME;
  let current: CameraTarget = FULL_FRAME;
  for (const move of moves) {
    if (frame <= move.startFrame) return current;
    const t = easeInOutCubic(clamp01((frame - move.startFrame) / Math.max(1, move.durationInFrames)));
    current = {
      xFrac: from.xFrac + (move.target.xFrac - from.xFrac) * t,
      yFrac: from.yFrac + (move.target.yFrac - from.yFrac) * t,
      scale: from.scale + (move.target.scale - from.scale) * t,
    };
    from = move.target;
  }
  return current;
};

/**
 * CSS for the capture layer at a resolved camera target: scale about the
 * target point via transform-origin, then translate that point to frame
 * center. Identity transform at FULL_FRAME (scale 1, centered).
 */
export const cameraStyle = (target: CameraTarget, frameW = 1920, frameH = 1080): CSSProperties => {
  const px = target.xFrac * frameW;
  const py = target.yFrac * frameH;
  const tx = frameW / 2 - px;
  const ty = frameH / 2 - py;
  return {
    transformOrigin: `${target.xFrac * 100}% ${target.yFrac * 100}%`,
    transform: `translate(${tx}px, ${ty}px) scale(${target.scale})`,
  };
};
