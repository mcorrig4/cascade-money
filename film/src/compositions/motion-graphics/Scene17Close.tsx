/**
 * Scene 17 — Close. Script-v6-liam.md spoken line: "Cascade. Dated dollars
 * on Arc. Money with a date." The close card itself carries the retained
 * locked tagline text (Stage-12 brief item 3): white -> "global supply
 * chains. settled." -> the Cascade Money wordmark -> "money with a date."
 * Any older tagline text (v5's separate two-scene ending) is retired; this
 * is the one close card now. Beats sized as fractions of the scene's own
 * duration.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CLAMP, enter} from '../../motion/timing';
import {color, font} from '../../brand/tokens';
import {Wordmark} from '../../components/Wordmark';

export const Scene17Close: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const toWhite = interpolate(frame, [0, dur * 0.22], [0, 1], CLAMP);
  const taglineIn = interpolate(frame, [dur * 0.1, dur * 0.22], [0, 1], CLAMP);
  const taglineOut = interpolate(frame, [dur * 0.42, dur * 0.5], [1, 0], CLAMP);
  const taglineOpacity = Math.min(taglineIn, taglineOut);

  const wordmarkAt = dur * 0.5;
  const mark = enter(frame, 30, wordmarkAt, 'settle');
  const tag = enter(frame, 30, wordmarkAt + Math.round(dur * 0.22), 'fade');

  return (
    <AbsoluteFill style={{background: color.bgOuter}}>
      <AbsoluteFill style={{background: '#ffffff', opacity: toWhite}} />

      {frame < wordmarkAt && (
        <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
          <div
            style={{
              fontFamily: font.family,
              fontSize: 58,
              fontWeight: 450,
              letterSpacing: -1.5,
              color: color.bgOuter,
              opacity: taglineOpacity,
              textAlign: 'center',
            }}
          >
            global supply chains. settled.
          </div>
        </AbsoluteFill>
      )}

      {frame >= wordmarkAt && (
        <AbsoluteFill style={{background: '#ffffff', display: 'grid', placeItems: 'center'}}>
          <div style={{textAlign: 'center'}}>
            <div
              style={{
                opacity: mark.opacity,
                transform: mark.transform,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Wordmark size={90} full dark />
            </div>
            <div
              style={{
                fontFamily: font.family,
                marginTop: 30,
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
      )}
    </AbsoluteFill>
  );
};
