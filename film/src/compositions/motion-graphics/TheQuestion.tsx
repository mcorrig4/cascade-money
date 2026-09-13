/**
 * Scene 6 — The question. Script-v6-liam.md: "So what if that future
 * payment could move today? Not as cash. As a dollar with a date." No
 * capture exists; held inside the browser frame. Beats sized as fractions
 * of the scene's own duration so the hold/exit timing tracks whatever
 * length narration.json ultimately assigns this scene.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {at30, enter, exit} from '../../motion/timing';
import {cueFrame, SceneCues} from '../../cues';
import {bgGradient, color, font} from '../../brand/tokens';

export const TheQuestion: React.FC<{durationInFrames: number; cues?: SceneCues}> = ({
  durationInFrames: dur,
  cues,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e = enter(frame, fps, cueFrame(cues, 'question-card', fps, at30(4, fps)), 'settle');
  const exitAt = Math.max(dur - at30(22, fps), at30(10, fps));
  const x = exit(frame, exitAt, at30(16, fps), 'fade');
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
