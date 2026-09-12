/**
 * Scene 13 — The rules survive. Script-v6-liam.md: "And the accounting
 * rules still hold. Every dollar of income has exactly one owner. No two
 * yield claims overlap on the same principal. Ten thousand operations.
 * Zero violations." Composited over the shot-08-conservation-laws capture.
 *
 * Figures (docs/verified-figures-v6.md): sim.scenarios.stress(ops=10000,
 * seed=1) -> 10,000 ops, 0 hard-invariant violations. Beats sized as
 * fractions of the scene's own duration.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {countUp, enter} from '../../motion/timing';
import {color, font, scrim} from '../../brand/tokens';

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

export const ConservationLaws: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const lawStep = Math.max(20, Math.floor(dur * 0.28));
  const statAt = Math.round(dur * 0.62);
  const ops = countUp(frame, statAt, statAt + 40, 10_000);
  const statEnter = enter(frame, 30, statAt, 'settle');

  return (
    <AbsoluteFill style={{background: scrim, fontFamily: font.family, color: color.fg}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{width: 970, display: 'flex', flexDirection: 'column'}}>
          {LAWS.map((law, i) => {
            const e = enter(frame, 30, i * lawStep, 'rise');
            return (
              <div
                key={law.eyebrow}
                style={{
                  borderTop: `1px solid ${color.hairline}`,
                  padding: '20px 0',
                  opacity: e.opacity,
                  transform: e.transform,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    color: law.accent,
                    fontSize: 13,
                    letterSpacing: 2,
                    marginBottom: 10,
                    fontWeight: 600,
                  }}
                >
                  {law.eyebrow}
                </span>
                <p style={{fontSize: 22, margin: '8px 0 0', lineHeight: 1.4, color: color.fg}}>
                  {law.body}
                </p>
              </div>
            );
          })}
          <div
            style={{
              borderTop: `1px solid ${color.hairline}`,
              padding: '26px 0 0',
              marginTop: 6,
              opacity: statEnter.opacity,
              transform: statEnter.transform,
              display: 'flex',
              gap: 60,
            }}
          >
            <div>
              <div style={{fontSize: 64, fontWeight: 450, letterSpacing: -2, color: color.fg}}>
                {ops.toLocaleString()}
              </div>
              <div style={{fontSize: 18, color: color.fgDim, marginTop: 6}}>operations</div>
            </div>
            <div>
              <div style={{fontSize: 64, fontWeight: 450, letterSpacing: -2, color: color.money}}>0</div>
              <div style={{fontSize: 18, color: color.fgDim, marginTop: 6}}>violations</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
