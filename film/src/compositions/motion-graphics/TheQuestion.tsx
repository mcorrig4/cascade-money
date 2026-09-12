/**
 * Scene 6 — "The question", the shortest beat (v5: "So what if that future
 * payment could move today, as a dated dollar?"). No capture exists; a
 * single-line motion graphic, 90f / 3s, held inside the browser frame.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {enter, exit} from '../../motion/timing';
import {bgGradient, color, font} from '../../brand/tokens';

export const TheQuestion: React.FC = () => {
  const frame = useCurrentFrame();
  const e = enter(frame, 30, 4, 'settle');
  const x = exit(frame, 68, 16, 'fade');
  const opacity = Math.min(e.opacity, x.opacity);

  return (
    <AbsoluteFill style={{background: bgGradient, fontFamily: font.family}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div
          style={{
            width: 1100,
            fontSize: 58,
            fontWeight: 450,
            letterSpacing: -2,
            lineHeight: 1.25,
            color: color.fg,
            opacity,
            transform: e.transform,
          }}
        >
          What if that future payment could move today — as a{' '}
          <span style={{color: color.money}}>dated dollar</span>?
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export const THE_QUESTION_DURATION = 90;
