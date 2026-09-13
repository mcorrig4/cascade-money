/**
 * Scene 17 — Close. The narration is now just "This is Cascade Money." The
 * close card carries three beats: white -> "global supply chains. settled."
 * -> the Cascade Money wordmark -> "Dated dollars on Arc." (same font
 * family, medium size, subtle). The second subtitle ("money with a date.")
 * was removed 2026-09-11 — it disappeared too fast and read as two
 * competing layers under the wordmark. Beats sized as fractions of the
 * scene's own duration.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, enter} from '../../motion/timing';
import {color, font} from '../../brand/tokens';
import {Wordmark} from '../../components/Wordmark';

// No narration cues here on purpose (see cues.ts's file header): these three
// beats are a deliberate held dramatic sequence timed off the scene's own
// duration, not the ~4-word VO ("This is Cascade Money.") — anchoring
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
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
