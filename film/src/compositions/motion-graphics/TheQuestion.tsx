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

/**
 * Scrim used when the capture plays underneath: dark enough at the centre
 * for the headline to hold contrast, clear at the edges so the app's own
 * question card (left) and the growing coin (right) stay readable.
 */
const QUESTION_SCRIM =
  'radial-gradient(ellipse at 50% 50%, rgba(1,6,9,0.62) 0%, rgba(1,6,9,0.42) 45%, rgba(1,6,9,0.18) 100%)';

export const TheQuestion: React.FC<{
  durationInFrames: number;
  cues?: SceneCues;
  /**
   * True when the app capture (scene-04.mp4 — the Apple obligation centring
   * and becoming the dated-dollar coin) is playing underneath. The card then
   * sits on a scrim instead of the opaque brand gradient, which is what hid
   * the coin entirely in the v7 draft.
   */
  overCapture?: boolean;
}> = ({durationInFrames: dur, cues, overCapture = false}) => {
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
    <AbsoluteFill
      style={{
        background: overCapture ? QUESTION_SCRIM : bgGradient,
        fontFamily: font.family,
      }}
    >
      {/*
        Over the capture the app draws its own centred question and the coin
        that grows out of it, so the film card drops to the lower third (clear
        of the app's headline above and its ledger strip below) and loses a
        little type size. On the pure motion-graphic path it stays centred at
        full size, exactly as authored.
      */}
      <AbsoluteFill
        style={{
          display: 'grid',
          placeItems: overCapture ? 'end center' : 'center',
          paddingBottom: overCapture ? 190 : 0,
        }}
      >
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
              fontSize: overCapture ? 60 : 76,
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
              marginTop: overCapture ? 20 : 28,
              fontSize: overCapture ? 34 : 42,
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
