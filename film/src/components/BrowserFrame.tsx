/**
 * BrowserFrame — the "this is an app in a browser" device frame.
 *
 * Three modes, driven by the product owner's direction (brief, item 1):
 *  - 'tilt'   : the entrance gesture — a small tilted browser window eases
 *               flat and grows toward full bleed. Used ONLY at the film's
 *               open (scene 1), t=0..~tiltOutFrames.
 *  - 'bleed'  : chrome invisible, content fills the full 1920x1080 frame.
 *               Used for the cinematic globe beats (capture footage).
 *  - 'framed' : chrome visible (traffic lights + URL pill), content inset
 *               inside a rounded window. Used for the protocol-talk /
 *               data beats (motion-graphic scenes), per the PO: "pulls
 *               back out for the protocol-talk beats."
 *
 * `progress` (0-1) drives the transition INTO or OUT OF 'framed'/'tilt' so a
 * scene can animate the pull-back/settle rather than hard-cutting between
 * modes. Callers own their own frame math and pass `progress` already eased
 * (use motion/timing's `enter`/`exit` or a plain interpolate).
 *
 * Implementation note: the whole window (chrome + content) is one native
 * 1920x1080 element that gets ONE CSS transform (scale, and rotateX/Y for
 * the tilt) — no nested/double scaling, so children (OffthreadVideo, scene
 * components) always render at native resolution.
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {color} from '../brand/tokens';

export type FrameMode = 'tilt' | 'bleed' | 'framed';

const URL_LABEL = 'cascade.vellum.network';
const CHROME_H = 64;

export const BrowserFrame: React.FC<{
  mode: FrameMode;
  /** 0 = fully the OTHER state, 1 = fully this state. Ignored for 'bleed'. */
  progress?: number;
  children: React.ReactNode;
}> = ({mode, progress = 1, children}) => {
  if (mode === 'bleed') {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  const isTilt = mode === 'tilt';
  const p = Math.max(0, Math.min(1, progress));

  // Tilt: starts small/rotated (p=0) and eases to flat/full (p=1).
  // Framed: starts full-bleed (p=0) and eases IN to a chrome-visible inset
  // window (p=1) — this is the "pull back out" gesture.
  const scale = isTilt ? 0.62 + 0.38 * p : 1 - 0.086 * p;
  const rotateX = isTilt ? 22 * (1 - p) : 0;
  const rotateY = isTilt ? -14 * (1 - p) : 0;
  const chromeOpacity = p;
  const radius = isTilt ? 22 - 10 * p : 8 + 14 * p;

  return (
    <AbsoluteFill
      style={{
        perspective: 2400,
        display: 'grid',
        placeItems: 'center',
        background: mode === 'framed' ? color.bgOuter : 'transparent',
      }}
    >
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transformStyle: 'preserve-3d',
          borderRadius: radius,
          overflow: 'hidden',
          boxShadow: `0 ${60 * p}px ${140 * p}px rgba(0,0,0,${0.55 * p})`,
          border: `1px solid rgba(170,199,204,${0.22 * chromeOpacity})`,
          position: 'relative',
          background: color.bgOuter,
        }}
      >
        {/* chrome bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: CHROME_H,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px',
            background: '#0a1520',
            borderBottom: `1px solid ${color.hairline}`,
            opacity: chromeOpacity,
            zIndex: 2,
          }}
        >
          {['#f19178', '#e8b768', '#69e6c0'].map((c) => (
            <span
              key={c}
              style={{width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.9}}
            />
          ))}
          <div
            style={{
              marginLeft: 18,
              flex: 1,
              maxWidth: 420,
              height: 30,
              borderRadius: 15,
              background: '#0e1e2a',
              border: `1px solid ${color.hairline}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color.muted,
              fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
              fontSize: 13,
              letterSpacing: 0.2,
            }}
          >
            {URL_LABEL}
          </div>
        </div>

        {/* content, inset below chrome once chrome is visible */}
        <div
          style={{
            position: 'absolute',
            top: CHROME_H * chromeOpacity,
            left: 0,
            width: 1920,
            height: 1080,
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};
