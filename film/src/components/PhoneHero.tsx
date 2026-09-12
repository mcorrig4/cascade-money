/**
 * PhoneHero — the iPhone Duo product photo (public/assets/iphone-duo.jpg),
 * shared by two beats of script-v6-liam.md:
 *   Scene 1 "The object of desire" — the photo with a slow push, the
 *     browser frame tilting in over it (the film's opening gesture).
 *   Scene 15 "New York" — the photo again, held as "a finished phone" for
 *     a beat before the film cuts to the descent capture.
 * `tilt` (0-1) drives BrowserFrame's tilt-in; pass 1 for the scene 15 use
 * (settled, no tilt gesture) and an eased 0->1 ramp for scene 1's open.
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
          src={staticFile('assets/iphone-duo.jpg')}
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
