import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {color} from '../../brand/tokens';
import {Wordmark} from '../../components/Wordmark';
import {CLAMP} from '../../motion/timing';
import {ReceiptNetworkPicture} from './Scene11Receipt';

/** Scene 12 — continue the completed payment network, then close on the wordmark. */
export const Scene12Close: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  // With the six-second picture floor: .75s context fade, .5s mark fade-in,
  // 1.75s rise, 1s centered hold, 1s fade-out, and 1s of black.
  const moveEnd = Math.round(dur * 0.5);
  const preferredBoundaries = [
    Math.round(dur / 8),
    Math.round(dur * 5 / 24),
    moveEnd,
    moveEnd + Math.round(fps),
    dur - Math.round(fps),
    dur,
  ];
  // Preserve strict ordering even at draft fps, reserving room for all remaining
  // phases. Fractional spacing also makes durations under six frames safe.
  const minimumGap = Math.min(1, dur / preferredBoundaries.length);
  let previousBoundary = 0;
  const [contextFadeEnd, markFadeInEnd, markMoveEnd, markHoldEnd, blackStart] = preferredBoundaries.map((preferred, index) => {
    const latest = dur - (preferredBoundaries.length - 1 - index) * minimumGap;
    const next = Math.min(latest, Math.max(previousBoundary + minimumGap, preferred));
    previousBoundary = next;
    return next;
  });
  const blackOpacity = interpolate(frame, [0, contextFadeEnd], [0, 1], CLAMP);
  const markOpacity = interpolate(
    frame, [contextFadeEnd, markFadeInEnd, markHoldEnd, blackStart], [0, 1, 1, 0], CLAMP,
  );
  const markY = interpolate(frame, [markFadeInEnd, markMoveEnd], [height * 0.86, height * 0.5], {
    ...CLAMP, easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{background: color.bgOuter, overflow: 'hidden'}}>
      <ReceiptNetworkPicture />
      <AbsoluteFill style={{background: color.black, opacity: blackOpacity}} />
      <div style={{
        position: 'absolute', left: width * 0.5, top: markY,
        width: 'max-content', whiteSpace: 'nowrap', opacity: markOpacity,
        transform: 'translate(-50%, -50%)',
      }}>
        <Wordmark size={150} full />
      </div>
    </AbsoluteFill>
  );
};
