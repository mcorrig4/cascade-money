/**
 * Scene 16 — The composable diagram. Frames the app's own
 * public/architecture.svg (copied verbatim to public/cascade/architecture.svg)
 * and reveals it as a composable system: one caption line per spoken clause
 * of v5's "The reframe" tail ("...becomes a composition of dated dollars"),
 * driven by an explicit `REVEAL_TIMES` array — per the brief's requirement
 * ("the composable reveal driven by an array of reveal times").
 * Composited over the shot-11 capture. Duration budget: 240f / 8s scene,
 * this overlay itself runs the reveal across its first ~150f then holds.
 */
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {enter} from '../../motion/timing';
import {color, font, scrim} from '../../brand/tokens';

const ITEMS = ['Units', '+ Spot', '+ Accrued yield', '= One dated dollar'];
/** Frame each item lands, relative to this scene's own local frame 0. */
export const REVEAL_TIMES = [10, 45, 80, 120];

export const ComposableOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const diagram = enter(frame, 30, 0, 'fade');

  return (
    <AbsoluteFill style={{background: scrim}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{width: 1200, fontFamily: font.family}}>
          <div
            style={{
              border: `1px solid ${color.hairline}`,
              borderRadius: 12,
              padding: 20,
              background: 'rgba(9,21,31,0.6)',
              opacity: diagram.opacity,
            }}
          >
            <Img src={staticFile('cascade/architecture.svg')} style={{width: '100%', display: 'block'}} />
          </div>
          <div style={{display: 'flex', gap: 28, marginTop: 26, justifyContent: 'center'}}>
            {ITEMS.map((item, i) => {
              const e = enter(frame, 30, REVEAL_TIMES[i], 'rise');
              return (
                <div
                  key={item}
                  style={{
                    fontSize: 24,
                    color: i === ITEMS.length - 1 ? color.money : color.fgDim,
                    opacity: e.opacity,
                    transform: e.transform,
                    fontWeight: i === ITEMS.length - 1 ? 550 : 400,
                  }}
                >
                  {item}
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export const COMPOSABLE_OVERLAY_ITEMS = ITEMS;
