/**
 * Scene 4 — "September 9, 2025" title card. Fades in from the white flash
 * scene 3 leaves (per the continuity table: "4 opens on white, fades back
 * to 37.3349,-122.009" — no capture built for this yet, so the fade-from-
 * white + title text is a motion graphic). Silent, 90f / 3s.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CLAMP} from '../../motion/timing';
import {bgGradient, color, font} from '../../brand/tokens';

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const fromWhite = interpolate(frame, [0, 20], [1, 0], CLAMP);
  const textIn = interpolate(frame, [10, 26], [0, 1], CLAMP);
  const textOut = interpolate(frame, [70, 90], [1, 0], CLAMP);
  const opacity = Math.min(textIn, textOut);

  return (
    <AbsoluteFill style={{background: bgGradient}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div
          style={{
            fontFamily: font.family,
            color: color.fg,
            fontSize: 54,
            fontWeight: 450,
            letterSpacing: -1.5,
            opacity,
          }}
        >
          September 9, 2025
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#ffffff', opacity: fromWhite}} />
    </AbsoluteFill>
  );
};
export const TITLE_CARD_DURATION = 90;
