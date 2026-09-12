/**
 * Scene 20 — Cascade Money / the tag. Per Decisions (script-v5-listening.md):
 * wordmark "Cascade Money" (icon + type), then "money with a date." beneath.
 * 540f / 18s: 6s wordmark hold, 6s tag joins+holds, 6s held-then-fade-black.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CLAMP, enter} from '../../motion/timing';
import {color} from '../../brand/tokens';
import {Wordmark} from '../../components/Wordmark';

export const WordmarkCard: React.FC = () => {
  const frame = useCurrentFrame();
  const mark = enter(frame, 30, 10, 'settle');
  const tag = enter(frame, 30, 190, 'fade');
  const fadeBlack = interpolate(frame, [480, 540], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{background: '#ffffff'}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <div style={{opacity: mark.opacity, transform: mark.transform, display: 'flex', justifyContent: 'center'}}>
            <Wordmark size={96} full dark />
          </div>
          <div
            style={{
              marginTop: 34,
              fontSize: 28,
              letterSpacing: 0.4,
              color: color.bgInner,
              opacity: tag.opacity,
            }}
          >
            money with a date.
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000000', opacity: fadeBlack}} />
    </AbsoluteFill>
  );
};
export const WORDMARK_CARD_DURATION = 540;
