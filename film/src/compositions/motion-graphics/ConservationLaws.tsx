/**
 * Scene 14 — The rules (conservation laws). Ported from
 * video-lab/src/compositions/cascade-overlay-cards/CascadeOverlayCards.tsx
 * (already built + frame-burst verified there for the identical v1/v2 beat
 * timecode) — text verbatim from v5's "The rules" line. Sequential reveal
 * timed with the spoken sentence order (Principal -> Yield -> Loss).
 * Composited over the shot-08 capture (dimmed, per the app's own
 * .globe-dimmer convention) inside the browser frame. Duration 600f / 20s.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {enter} from '../../motion/timing';
import {color, font, scrim} from '../../brand/tokens';

const LAWS = [
  {
    eyebrow: 'PRINCIPAL',
    body: 'backing never falls below units plus spot plus accrued yield',
    accent: color.money,
  },
  {
    eyebrow: 'YIELD',
    body:
      'every dollar of vault income has exactly one owner — no two yield intervals on the same principal ever overlap',
    accent: color.money,
  },
  {
    eyebrow: 'LOSS',
    body: 'reserve first, then the day’s income, never principal',
    accent: color.amber,
  },
];
// Beat marks chosen against the shot's own narration timing: Principal ~0f,
// Yield ~180f/6s in, Loss ~380f/12.7s in, inside the 600f/20s shot.
const LAW_ENTER = [0, 180, 380];

export const ConservationLaws: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: scrim, fontFamily: font.family, color: color.fg}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{width: 970, display: 'flex', flexDirection: 'column'}}>
          {LAWS.map((law, i) => {
            const e = enter(frame, 30, LAW_ENTER[i], 'rise');
            return (
              <div
                key={law.eyebrow}
                style={{
                  borderTop: `1px solid ${color.hairline}`,
                  padding: '22px 0',
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
                    marginBottom: 12,
                    fontWeight: 600,
                  }}
                >
                  {law.eyebrow}
                </span>
                <p style={{fontSize: 19, margin: '8px 0 0', lineHeight: 1.4, color: color.fg}}>
                  {law.body}
                </p>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export const CONSERVATION_LAWS_DURATION = 600;
