/**
 * Scene 5 — "The catch, rotation begins". Two real figures from v5's spoken
 * line (script-v5-listening.md "The catch"): $56B committed-not-yet-paid,
 * and ~115 days average payment terms. No live capture exists for this beat
 * (shooting-script-v2 §Scene 5 APP NOTE: still needs a shots.ts split) — a
 * motion-graphic data card per the PO's brief. Rendered inside the browser
 * frame (protocol-talk beat). Duration 360f / 12s.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {enter, stagger, pulse} from '../../motion/timing';
import {bgGradient, color, font, type} from '../../brand/tokens';

export const TheCatch: React.FC = () => {
  const frame = useCurrentFrame();
  const kicker = enter(frame, 30, 0, 'fade');
  const days = enter(frame, 30, 20, 'settle');
  const daysSub = enter(frame, 30, stagger(1, 6, 20), 'fade');
  const amount = enter(frame, 30, 150, 'settle');
  const amountSub = enter(frame, 30, stagger(1, 6, 150), 'fade');
  const line = enter(frame, 30, 280, 'rise');
  const daysPulse = pulse(frame, 20 + 10, 0.05, 8);
  const amountPulse = pulse(frame, 150 + 10, 0.05, 8);

  return (
    <AbsoluteFill style={{background: bgGradient, fontFamily: font.family, color: color.fg}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{width: 1100}}>
          <span
            style={{
              display: 'block',
              color: color.muted,
              fontSize: type.kicker,
              letterSpacing: 2.2,
              marginBottom: 30,
              opacity: kicker.opacity,
            }}
          >
            THE CATCH
          </span>

          <div style={{display: 'flex', gap: 90, alignItems: 'baseline'}}>
            <div style={{opacity: days.opacity, transform: `${days.transform} scale(${daysPulse})`}}>
              <div
                style={{
                  fontSize: 130,
                  fontWeight: 450,
                  letterSpacing: -5,
                  color: color.amber,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                115 days
              </div>
              <div style={{fontSize: 22, color: color.fgDim, marginTop: 10, opacity: daysSub.opacity}}>
                average payment terms
              </div>
            </div>
          </div>

          <div style={{marginTop: 60, opacity: amount.opacity, transform: `${amount.transform} scale(${amountPulse})`}}>
            <div
              style={{
                fontSize: 130,
                fontWeight: 450,
                letterSpacing: -5,
                color: color.money,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              $56,000,000,000
            </div>
            <div style={{fontSize: 22, color: color.fgDim, marginTop: 10, opacity: amountSub.opacity}}>
              committed to suppliers, not yet paid
            </div>
          </div>

          <div
            style={{
              marginTop: 60,
              fontSize: 26,
              color: color.fgFaint,
              borderTop: `1px solid ${color.hairline}`,
              paddingTop: 26,
              opacity: line.opacity,
              transform: line.transform,
            }}
          >
            Nothing settled until it ships.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export const THE_CATCH_DURATION = 360;
