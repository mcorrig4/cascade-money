/**
 * Scene 15 — The reframe. Ported concept from video-lab's
 * CascadeDerivativesFigureScene. Figure: $846,000,000,000,000 — BIS "OTC
 * derivatives statistics at end-June 2025", $846T global OTC notional
 * outstanding (cited in market-anchors.md). Peaks on "eight hundred
 * forty-six trillion" — timed here to land mid-scene (frame ~180 of 450,
 * i.e. ~6s into the 15s beat, matching the spoken clause's position in
 * v5's "The reframe" line). Composited over the shot-10 capture, dimmed.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {enter, stagger} from '../../motion/timing';
import {color, font, scrim} from '../../brand/tokens';

const FIGURE_AT = 180;

export const ReframeOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const e = enter(frame, 30, FIGURE_AT, 'settle');
  const sub = enter(frame, 30, stagger(1, 6, FIGURE_AT), 'fade');
  const reveal = enter(frame, 30, FIGURE_AT + 60, 'fade');

  return (
    <AbsoluteFill style={{background: scrim}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{textAlign: 'center', fontFamily: font.family, color: color.fg}}>
          <h2
            style={{
              fontSize: 92,
              fontWeight: 450,
              letterSpacing: -4,
              margin: 0,
              color: color.money,
              opacity: e.opacity,
              transform: e.transform,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            $846,000,000,000,000
          </h2>
          <div style={{fontSize: 28, letterSpacing: -0.5, color: color.fgDim, marginTop: 16, opacity: sub.opacity}}>
            the global derivatives market
          </div>
          <div
            style={{
              fontSize: 22,
              color: color.amber,
              marginTop: 30,
              opacity: reveal.opacity,
              letterSpacing: -0.2,
            }}
          >
            A second dimension for money.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export const REFRAME_OVERLAY_APPEAR_AT = FIGURE_AT;
