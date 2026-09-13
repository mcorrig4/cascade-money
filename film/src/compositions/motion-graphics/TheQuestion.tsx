/**
 * Scene 4 — The question. v9 narration: "Cascade gives that value a form
 * that can move. A dated dollar. Not as cash, as a dollar with a date."
 * No capture exists; held inside the browser frame. Three beats — the card
 * itself, the headline, then the secondary line — each keyed to its own
 * spoken word via cues.ts so they land on "form" / "dated" / "cash"
 * respectively instead of a single fixed reveal. Exit timing is sized as a
 * fraction of the scene's own duration so the hold/exit tracks whatever
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
  const cardAt = cueFrame(cues, 'question-card', fps, cueFrame(cues, 'question-card-fallback', fps, at30(4, fps)));
  const headlineAt = cueFrame(cues, 'dated-dollar', fps, cueFrame(cues, 'dated-dollar-fallback', fps, cardAt + at30(20, fps)));
  const secondaryAt = cueFrame(cues, 'not-cash', fps, headlineAt + at30(28, fps));
  const card = enter(frame, fps, cardAt, 'settle');
  const headline = enter(frame, fps, headlineAt, 'settle');
  const secondary = enter(frame, fps, secondaryAt, 'settle');
  const exitAt = Math.max(dur - at30(22, fps), at30(10, fps));
  const x = exit(frame, exitAt, at30(16, fps), 'fade');

  return (
    <AbsoluteFill style={{background: bgGradient, fontFamily: font.family}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div
          style={{
            width: 1100,
            textAlign: 'center',
            opacity: Math.min(card.opacity, x.opacity),
            transform: card.transform,
          }}
        >
          <div
            style={{
              fontSize: 76,
              fontWeight: 450,
              letterSpacing: -2,
              lineHeight: 1.15,
              color: color.money,
              opacity: headline.opacity,
              transform: headline.transform,
            }}
          >
            A dated dollar.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 42,
              fontWeight: 450,
              letterSpacing: -1,
              lineHeight: 1.35,
              color: color.fg,
              opacity: secondary.opacity,
              transform: secondary.transform,
            }}
          >
            Not as cash. As a dollar with a date.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
