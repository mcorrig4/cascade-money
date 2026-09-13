import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {color} from '../../brand/tokens';

/** Phone-over-campus composite: the top half of scene 11 ("Beneath it"). */
export const PhoneCampusHero: React.FC = () => (
  <AbsoluteFill style={{background: color.bgOuter, overflow: 'hidden'}}>
    {/* Crop the captured dashboard to the campus; keep dates/counters offscreen. */}
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <Img src={staticFile('assets/apple-park-dusk.png')} style={{position: 'absolute', width: 3600, height: 2025, left: -650, top: -620}} />
    </div>
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${color.bgOuter} 0%, rgba(7,16,25,0.92) 25%, rgba(7,16,25,0.35) 60%, ${color.bgOuter} 88%)`}} />
    {/* Longer, eased wrist fade preserves the hands before blending into the campus. */}
    <div style={{position: 'absolute', width: 1120, height: 680, left: 400, top: 0, overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 58%, rgba(0,0,0,0.95) 67%, rgba(0,0,0,0.7) 77%, rgba(0,0,0,0.25) 90%, transparent 100%)'}}>
      <Img src={staticFile('assets/iphone-duo-hands.png')} style={{width: 1120, height: 'auto', maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'}} />
    </div>
  </AbsoluteFill>
);
