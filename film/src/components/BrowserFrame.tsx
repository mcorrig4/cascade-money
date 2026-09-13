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
 * `chrome` (default 'simple') selects the chrome look: 'simple' is the
 * original traffic-lights + URL-pill bar every existing caller keeps getting
 * unless it opts in. 'browser' is the fuller desktop-browser chrome (title
 * bar with window controls, a one-tab tab strip, and a separate address bar
 * with a lock glyph) that Scene 1's opening beat uses per the product
 * owner's brief (2026-09-13, round 2): "add some window chrome... I want it
 * to look like a web browser is actually running it." Scoped to 'framed'
 * mode only — never touch other callers' look.
 *
 * Implementation note: the whole window (chrome + content) is one native
 * 1920x1080 element that gets ONE CSS transform (scale, and rotateX/Y for
 * the tilt) — no nested/double scaling, so children (OffthreadVideo, scene
 * components) always render at native resolution.
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {color, font} from '../brand/tokens';
import {windowFrameStyle, type WindowGeometry} from './windowGeometry';

export type FrameMode = 'tilt' | 'bleed' | 'framed';
export type ChromeStyle = 'simple' | 'browser';

const URL_LABEL = 'cascade.vellum.network';
const FULL_URL_LABEL = 'https://cascade.vellum.network';
const TAB_LABEL = 'Cascade — dated dollars on Arc';
const CHROME_H = 64;
// ~6% of the 1080-tall frame, per the product owner's brief.
const CHROME_H_BROWSER = Math.round(1080 * 0.06);
const TAB_STRIP_H = Math.round(CHROME_H_BROWSER * 0.52);
const ADDRESS_BAR_H = CHROME_H_BROWSER - TAB_STRIP_H;

const LockGlyph: React.FC<{size?: number; color: string}> = ({size = 11, color: c}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{flexShrink: 0}}>
    <rect x={5} y={11} width={14} height={10} rx={2} stroke={c} strokeWidth={2} />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={c} strokeWidth={2} fill="none" />
  </svg>
);

export const BrowserFrame: React.FC<{
  mode: FrameMode;
  /** 0 = fully the OTHER state, 1 = fully this state. Ignored for 'bleed'. */
  progress?: number;
  /** 'simple' (default) preserves the original chrome for every existing caller. */
  chrome?: ChromeStyle;
  /**
   * 'framed' + chrome="browser" only. Overrides the settle scale (default
   * undefined = the original centred `1 - 0.086*p` ~5%-padding pull-back),
   * left-anchors the window at this fraction of frame width once settled
   * (default undefined = stays centred), adds an extra rotateY at settle
   * (default 0 = no skew), and the perspective distance for that skew
   * (default 2400, matching the existing centred/tilt look). Every other
   * caller omits these and gets the unchanged behavior.
   */
  targetScale?: number;
  anchorLeftFrac?: number;
  skewYDeg?: number;
  perspectivePx?: number;
  /** WindowLayout supplies resolved geometry; omitted preserves legacy callers. */
  geometry?: WindowGeometry;
  legacyFrameAppearance?: boolean;
  children: React.ReactNode;
}> = ({
  mode,
  progress = 1,
  chrome = 'simple',
  targetScale,
  anchorLeftFrac,
  skewYDeg = 0,
  perspectivePx = 2400,
  geometry,
  legacyFrameAppearance = false,
  children,
}) => {
  if (mode === 'bleed') {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  const isTilt = mode === 'tilt';
  const isBrowserChrome = mode === 'framed' && chrome === 'browser';
  const p = Math.max(0, Math.min(1, progress));

  // Tilt: starts small/rotated (p=0) and eases to flat/full (p=1).
  // Framed: starts full-bleed (p=0) and eases IN to a chrome-visible inset
  // window (p=1) — this is the "pull back out" gesture.
  const scale = isTilt ? 0.62 + 0.38 * p : 1 - (1 - (targetScale ?? 0.914)) * p;
  const rotateX = isTilt ? 22 * (1 - p) : 0;
  const rotateY = isTilt ? -14 * (1 - p) : 0;
  const chromeOpacity = p;
  const radius = isTilt ? 22 - 10 * p : 8 + 14 * p;
  const chromeH = isBrowserChrome ? CHROME_H_BROWSER : CHROME_H;

  if (isBrowserChrome) {
    // Left-anchored settle (Scene 1 round 3): transform-origin stays the
    // window's own left edge the whole time, so at p=0 (leftPct=0,
    // scale=1, skew=0) it's identical to the old full-bleed start, and it
    // eases continuously toward the left-margin / scale / skew target as p
    // goes to 1 — never a discontinuous origin swap.
    const leftPct = (anchorLeftFrac ?? 0) * p * 100;
    const rotateYSettle = skewYDeg * p;
    return (
      <AbsoluteFill
        style={{
          perspective: geometry?.perspective ?? perspectivePx,
          background: color.bgOuter,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${leftPct}%`,
            width: 1920,
            height: 1080,
            transform: `translateY(-50%) scale(${scale}) rotateY(${rotateYSettle}deg)`,
            transformOrigin: 'left center',
            borderRadius: radius,
            overflow: 'hidden',
            boxShadow: `0 ${60 * p}px ${140 * p}px rgba(0,0,0,${0.55 * p})`,
            border: `1px solid rgba(170,199,204,${0.22 * chromeOpacity})`,
            background: color.bgOuter,
            ...(geometry ? windowFrameStyle(geometry, legacyFrameAppearance) : {}),
          }}
        >
          {/* title bar: window controls + one-tab tab strip */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: TAB_STRIP_H,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 18px',
              background: '#0a1520',
              opacity: chromeOpacity,
              zIndex: 2,
            }}
          >
            {['#f19178', '#e8b768', '#69e6c0'].map((c) => (
              <span key={c} style={{width: 11, height: 11, borderRadius: 6, background: c, opacity: 0.9}} />
            ))}
            <div
              style={{
                marginLeft: 8,
                height: TAB_STRIP_H - 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 14px',
                borderRadius: '8px 8px 0 0',
                background: color.bgInner,
                color: color.fg,
                fontFamily: font.family,
                fontSize: 12,
                letterSpacing: 0.1,
                maxWidth: 340,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{width: 7, height: 7, borderRadius: 4, background: color.money, flexShrink: 0}} />
              <span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{TAB_LABEL}</span>
            </div>
          </div>

          {/* address bar */}
          <div
            style={{
              position: 'absolute',
              top: TAB_STRIP_H,
              left: 0,
              right: 0,
              height: ADDRESS_BAR_H,
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              background: '#0e1e2a',
              borderBottom: `1px solid ${color.hairline}`,
              boxShadow: `0 4px 10px rgba(0,0,0,${0.32 * chromeOpacity})`,
              opacity: chromeOpacity,
              zIndex: 2,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: ADDRESS_BAR_H - 10,
                borderRadius: (ADDRESS_BAR_H - 10) / 2,
                background: '#0a1520',
                border: `1px solid ${color.hairline}`,
                padding: '0 14px',
                color: color.muted,
                fontFamily: font.family,
                fontSize: 12,
                letterSpacing: 0.1,
              }}
            >
              <LockGlyph size={11} color={color.fgFaint} />
              <span>{FULL_URL_LABEL}</span>
            </div>
          </div>

          {/* content, inset below the full chrome */}
          <div
            style={{
              position: 'absolute',
              top: chromeH * chromeOpacity,
              left: 0,
              width: geometry?.width ?? 1920,
              height: geometry?.height ?? 1080,
              overflow: 'hidden',
            }}
          >
            {children}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

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
