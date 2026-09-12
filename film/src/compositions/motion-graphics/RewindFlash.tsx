/**
 * Scene 3 — Rewind. No live capture exists for this beat (shooting-script-v2
 * §Scene 3: "needs the TIME-LAPSE BLUR and WHITE FLASH + FADE primitives",
 * neither built in the app yet). Built here as a Remotion motion graphic:
 * fast horizontal terminator-style light bands reversing direction, ending
 * in a full white flash (the film's one sanctioned camera-moot exception
 * per §0.1, exactly as the ending's white cards already use).
 * Duration: 120f / 4s (script timecode 0:13-0:17).
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CLAMP} from '../../motion/timing';
import {color} from '../../brand/tokens';

const BANDS = 7;

export const RewindFlash: React.FC = () => {
  const frame = useCurrentFrame();
  // Blur/streak phase: 0-90f, accelerating speed (feels like rewinding time).
  const speed = interpolate(frame, [0, 90], [2, 34], CLAMP);
  const flashOpacity = interpolate(frame, [90, 120], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{background: color.bgOuter, overflow: 'hidden'}}>
      {Array.from({length: BANDS}).map((_, i) => {
        const y = (1080 / BANDS) * i;
        const h = 1080 / BANDS;
        const dir = i % 2 === 0 ? -1 : 1;
        const x = ((frame * speed * dir) % 2400) - 1200;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: y,
              left: 0,
              width: 2400,
              height: h,
              transform: `translateX(${x}px)`,
              background: `linear-gradient(90deg, transparent 0%, ${color.money}22 45%, ${color.money}55 50%, ${color.money}22 55%, transparent 100%)`,
              opacity: 0.6,
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(105,230,192,0.08), transparent 70%)',
        }}
      />
      <AbsoluteFill style={{background: '#ffffff', opacity: flashOpacity}} />
    </AbsoluteFill>
  );
};
export const REWIND_FLASH_DURATION = 120;
