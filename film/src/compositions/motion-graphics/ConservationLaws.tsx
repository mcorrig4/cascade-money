/**
 * Scene 13 — The rules survive. Script-v6-liam.md: "And the accounting
 * rules still hold. Every dollar of income has exactly one owner. No two
 * yield claims overlap on the same principal. Ten thousand operations.
 * Zero violations." Composited over the shot-08-conservation-laws capture.
 *
 * Figures (docs/verified-figures-v6.md): sim.scenarios.stress(ops=10000,
 * seed=1) -> 10,000 ops, 0 hard-invariant violations. Beats sized as
 * fractions of the scene's own duration.
 *
 * Fix (verified issue #1): the two laws used to enter on a stagger with no
 * exit, so by the second law's entrance both were on screen at once (the
 * "dim duplicate behind" — law 1 still fully opaque under law 2). Each law
 * now owns an exclusive time slot: it enters, holds, then fades out and
 * rises away before the next one enters — never two at once. The
 * 10,000-ops/0-violations figure is no longer a big competing beat; it is
 * a small persistent line pinned to the bottom of the frame for the whole
 * scene, so the eye always has the headline number without it fighting the
 * law that's currently on screen.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {enter, CLAMP} from '../../motion/timing';
import {color, font, type, scrim} from '../../brand/tokens';

const LAWS = [
  {
    eyebrow: 'OWNERSHIP',
    body: 'every dollar of income has exactly one owner',
    accent: color.money,
  },
  {
    eyebrow: 'YIELD',
    body: 'no two yield claims overlap on the same principal',
    accent: color.money,
  },
];

const ENTER_DUR = 20;
const EXIT_DUR = 16;

/** Fade + rise-away exit — the mirror of `enter(..., 'rise')`. */
const exitUp = (frame: number, at: number, dur: number) => {
  const p = interpolate(frame, [at, at + dur], [0, 1], CLAMP);
  return {opacity: 1 - p, transform: `translateY(${-28 * p}px)`};
};

export const ConservationLaws: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const n = LAWS.length;
  // Pace the laws evenly across the whole scene: one exclusive slot each.
  const slot = Math.floor(dur / n);

  const footerLine = enter(frame, 30, 24, 'fade');

  return (
    <AbsoluteFill style={{background: scrim, fontFamily: font.family, color: color.fg}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{width: 970, height: 260, position: 'relative'}}>
          {LAWS.map((law, i) => {
            const start = i * slot;
            const isLast = i === n - 1;
            const exitAt = start + slot - EXIT_DUR;
            const e = enter(frame, 30, start, 'rise');
            let opacity = e.opacity;
            let transform = e.transform;
            if (!isLast && frame >= exitAt) {
              const x = exitUp(frame, exitAt, EXIT_DUR);
              opacity = x.opacity;
              transform = x.transform;
            }
            return (
              <div
                key={law.eyebrow}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderTop: `1px solid ${color.hairline}`,
                  padding: '20px 0',
                  opacity,
                  transform,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    color: law.accent,
                    fontSize: type.lawEyebrow,
                    letterSpacing: 2,
                    marginBottom: 10,
                    fontWeight: 600,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}/{law.eyebrow}
                </span>
                <p style={{fontSize: type.lawBody, margin: '8px 0 0', lineHeight: 1.4, color: color.fg}}>
                  {law.body}
                </p>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{display: 'grid', placeItems: 'end center', paddingBottom: 56}}>
        <div
          style={{
            fontSize: 20,
            color: color.fgDim,
            letterSpacing: 0.3,
            opacity: footerLine.opacity,
          }}
        >
          10,000 operations · <span style={{color: color.money}}>0 violations</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
