/**
 * Scene 17 — Close. Lower-third text over the shot-12 capture (first 180f):
 * v5 "Close" line, text skeleton not verbatim (DIRECTING.md Phase 3 — text
 * is the skeleton, voice is the flesh). Hairline rule draws in.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CLAMP, enter} from '../../motion/timing';
import {color, font} from '../../brand/tokens';

export const CloseLowerThird: React.FC = () => {
  const frame = useCurrentFrame();
  const kicker = enter(frame, 30, 10, 'rise');
  const title = enter(frame, 30, 22, 'rise');
  const ruleW = interpolate(frame, [10, 26], [0, 1], CLAMP);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 110,
          width: 900,
          fontFamily: font.family,
        }}
      >
        <div
          style={{
            width: 64,
            height: 2,
            background: color.money,
            transform: `scaleX(${ruleW})`,
            transformOrigin: 'left',
            marginBottom: 20,
          }}
        />
        <div
          style={{
            fontSize: 15,
            letterSpacing: 2.2,
            color: color.muted,
            marginBottom: 12,
            opacity: kicker.opacity,
            transform: kicker.transform,
          }}
        >
          DATED DOLLARS ON ARC
        </div>
        <div
          style={{
            fontSize: 46,
            fontWeight: 450,
            letterSpacing: -1.5,
            color: color.fg,
            opacity: title.opacity,
            transform: title.transform,
            lineHeight: 1.2,
          }}
        >
          Money that pays bills before it becomes cash — settled.
        </div>
      </div>
    </AbsoluteFill>
  );
};
