/**
 * PhoneHero — the iPhone Duo product photo (public/assets/iphone-duo-hands.png,
 * dark-navy two-hands folding shot), the "finished phone" beat of
 * script-v6-liam.md:
 *   Scene 15 "New York" — the photo held as "a finished phone" for a beat
 *     before the film cuts to the descent capture. Called with `tilt=1`
 *     (settled, no tilt gesture) via PhoneHeroScene's `finished` prop.
 * Scene 1's own phone reveal ("The object of desire") no longer uses this
 * component — it composites the same image directly over the app window
 * with an unfolding wipe (see CascadeFilm.tsx's PhoneRevealOverlay), rather
 * than replacing the whole frame with its own tilted browser window.
 */
import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {BrowserFrame} from './BrowserFrame';
import {color} from '../brand/tokens';

export const PhoneHero: React.FC<{
  frame: number;
  durationInFrames: number;
  tilt?: number; // 0-1, BrowserFrame tilt progress; 1 = flat/settled
}> = ({frame, durationInFrames, tilt = 1}) => {
  // Slow push over the whole beat — 100% -> ~108% scale, never a hard zoom.
  const push = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <BrowserFrame mode="tilt" progress={tilt}>
      <AbsoluteFill style={{background: color.bgOuter, display: 'grid', placeItems: 'center'}}>
        <Img
          src={staticFile('assets/iphone-duo-hands.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${push})`,
          }}
        />
      </AbsoluteFill>
    </BrowserFrame>
  );
};
