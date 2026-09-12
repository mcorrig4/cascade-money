/**
 * Scene 11 — The treasury decision (v2.1 restored section). Per-clause coin
 * states per shooting-script-v2 §Scene 11: a 30-day dollar appears, a 90-day
 * bill appears beside it with a visible gap, then the gap highlights on
 * "so who gets those sixty days of yield". No capture exists yet (script:
 * "New shot id needed, working id 6b-treasury") — motion graphic, 180f/6s.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {enter, pulse} from '../../motion/timing';
import {bgGradient, color, font, type} from '../../brand/tokens';

const Chip: React.FC<{label: string; day: string; e: {opacity: number; transform: string}}> = ({
  label,
  day,
  e,
}) => (
  <div
    style={{
      opacity: e.opacity,
      transform: e.transform,
      border: `1px solid ${color.hairline}`,
      borderRadius: 12,
      padding: '28px 40px',
      background: 'rgba(9,21,31,0.6)',
      textAlign: 'center',
      minWidth: 220,
    }}
  >
    <div style={{fontSize: 44, fontWeight: 450, color: color.money, letterSpacing: -1}}>{day}</div>
    <div style={{fontSize: 15, color: color.fgDim, marginTop: 8, letterSpacing: 0.5}}>{label}</div>
  </div>
);

export const TreasuryDecision: React.FC = () => {
  const frame = useCurrentFrame();
  const kicker = enter(frame, 30, 0, 'fade');
  const day30 = enter(frame, 30, 10, 'pop');
  const day90 = enter(frame, 30, 55, 'pop');
  const gapLabel = enter(frame, 30, 110, 'rise');
  const gapPulse = pulse(frame, 120, 0.06, 10);

  return (
    <AbsoluteFill style={{background: bgGradient, fontFamily: font.family, color: color.fg}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <span
            style={{
              display: 'block',
              color: color.muted,
              fontSize: type.kicker,
              letterSpacing: 2.2,
              marginBottom: 40,
              opacity: kicker.opacity,
            }}
          >
            YOU'RE THE TREASURER
          </span>
          <div style={{display: 'flex', gap: 64, alignItems: 'center', justifyContent: 'center'}}>
            <Chip label="money arrives" day="Day 30" e={day30} />
            <div
              style={{
                width: 120,
                height: 2,
                background: color.amber,
                opacity: gapLabel.opacity * gapPulse,
              }}
            />
            <Chip label="supplier accepts" day="Day 90" e={day90} />
          </div>
          <div
            style={{
              marginTop: 44,
              fontSize: 28,
              color: color.amber,
              letterSpacing: -0.3,
              opacity: gapLabel.opacity,
              transform: gapLabel.transform,
            }}
          >
            Who gets those sixty days of yield?
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export const TREASURY_DECISION_DURATION = 180;
