/**
 * Scene 6 — The question. Script-v6-liam.md: "So what if that future
 * payment could move today? Not as cash. As a dollar with a date." No
 * capture exists; held inside the browser frame. Beats sized as fractions
 * of the scene's own duration so the hold/exit timing tracks whatever
 * length narration.json ultimately assigns this scene.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {enter, exit} from '../../motion/timing';
import {bgGradient, color, font} from '../../brand/tokens';

export const TheQuestion: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const e = enter(frame, 30, 4, 'settle');
  const exitAt = Math.max(dur - 22, 10);
  const x = exit(frame, exitAt, 16, 'fade');
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
            lineHeight: 1.3,
            color: color.fg,
            opacity,
            transform: e.transform,
            textAlign: 'center',
          }}
        >
          So what if that future payment could move today?
          <br />
          Not as cash. As a{' '}
          <span style={{color: color.money}}>dollar with a date</span>.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
