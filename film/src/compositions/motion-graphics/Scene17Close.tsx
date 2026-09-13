/**
 * Scene 17 — Close. The spoken close dropped "Dated dollars on Arc." (now
 * silent) but the product owner wants it on screen. The close card carries
 * four beats now: white -> "global supply chains. settled." -> the Cascade
 * Money wordmark -> "Dated dollars on Arc." (same font family, medium size,
 * subtle) -> "money with a date." Any older tagline text (v5's separate
 * two-scene ending) is retired; this is the one close card now. Beats sized
 * as fractions of the scene's own duration.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, enter} from '../../motion/timing';
import {color, font} from '../../brand/tokens';
import {Wordmark} from '../../components/Wordmark';

// No narration cues here on purpose (see cues.ts's file header): these four
// beats are a deliberate held dramatic sequence timed off the scene's own
// duration, not the ~5-word VO ("Cascade. Money with a date.") — anchoring
// the wordmark to the word "Cascade" (spoken in the first fraction of a
// second) would collapse the sequence instead of pacing it.
export const Scene17Close: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const toWhite = interpolate(frame, [0, dur * 0.22], [0, 1], CLAMP);
  const taglineIn = interpolate(frame, [dur * 0.1, dur * 0.22], [0, 1], CLAMP);
  const taglineOut = interpolate(frame, [dur * 0.42, dur * 0.5], [1, 0], CLAMP);
  const taglineOpacity = Math.min(taglineIn, taglineOut);

  const wordmarkAt = dur * 0.5;
  const mark = enter(frame, fps, wordmarkAt, 'settle');
  const arcAt = wordmarkAt + Math.round(dur * 0.16);
  const arc = enter(frame, fps, arcAt, 'fade');
  const tag = enter(frame, fps, arcAt + Math.round(dur * 0.16), 'fade');

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
                marginTop: 26,
                fontSize: 34,
                fontWeight: 450,
                letterSpacing: 0.2,
                color: color.bgInner,
                opacity: arc.opacity * 0.6,
              }}
            >
              Dated dollars on Arc.
            </div>
            <div
              style={{
                fontFamily: font.family,
                marginTop: 16,
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
