/**
 * Scene 19 — The line. WHITE FLASH + FADE primitive (§0.2 item 7): ramps to
 * white over the first 3s, holds white ~3s while the line is legible, text
 * fades over the last 2s. Locked line per Decisions (script-v5-listening.md):
 * "global supply chains. settled." (lowercase, exactly as Liam locked it).
 * Duration 240f / 8s — matches the script's own 3+3+2s breakdown exactly.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CLAMP} from '../../motion/timing';
import {color, font} from '../../brand/tokens';

export const EndingLine: React.FC = () => {
  const frame = useCurrentFrame();
  const toWhite = interpolate(frame, [0, 90], [0, 1], CLAMP);
  const textIn = interpolate(frame, [40, 70], [0, 1], CLAMP);
  const textOut = interpolate(frame, [180, 240], [1, 0], CLAMP);
  const textOpacity = Math.min(textIn, textOut);

  return (
    <AbsoluteFill style={{background: color.bgOuter}}>
      <AbsoluteFill style={{background: '#ffffff', opacity: toWhite}} />
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div
          style={{
            fontFamily: font.family,
            fontSize: 62,
            fontWeight: 450,
            letterSpacing: -1.5,
            color: color.bgOuter,
            opacity: textOpacity,
          }}
        >
          global supply chains. settled.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export const ENDING_LINE_DURATION = 240;
