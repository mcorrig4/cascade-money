import React from 'react';
import {AbsoluteFill} from 'remotion';
import {bgGradient, font, color} from '../brand/tokens';

export const Ground: React.FC<{children: React.ReactNode; dim?: boolean}> = ({children, dim}) => (
  <AbsoluteFill style={{background: bgGradient, fontFamily: font.family, color: color.fg}}>
    {dim && <AbsoluteFill style={{background: 'rgba(3,10,15,0.72)'}} />}
    <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>{children}</AbsoluteFill>
  </AbsoluteFill>
);
