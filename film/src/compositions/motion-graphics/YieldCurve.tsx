/**
 * Scene 12 — "Extend it." (the yield curve). Re-activates the app's dormant
 * yield-curve shot (shots.ts id 7) on the two-word v5 cue, per
 * shooting-script-v2 §Scene 12: five tenor points (7/30/60/90/180 days),
 * axes appear then the curve sketches in over ~4s after the line.
 * Legibility rule (shooting-script §0.5): stroke ≥2-3px effective at 240p —
 * drawn at 4px here, well over the floor. Duration 150f / 5s.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CLAMP, enter} from '../../motion/timing';
import {bgGradient, color, font, type} from '../../brand/tokens';

// [tenor days, illustrative annualized yield %] — five points, per storyboard-v2 §1 shot 7 spec.
const POINTS: [number, number][] = [
  [7, 4.1],
  [30, 4.3],
  [60, 4.5],
  [90, 4.7],
  [180, 5.0],
];

const W = 900;
const H = 420;
const PAD = 60;

const xFor = (days: number) => PAD + (days / 180) * (W - PAD * 2);
const yFor = (yield_: number) => H - PAD - ((yield_ - 3.5) / 2) * (H - PAD * 2);

export const YieldCurve: React.FC = () => {
  const frame = useCurrentFrame();
  const title = enter(frame, 30, 0, 'fade');
  const axes = enter(frame, 30, 6, 'fade');
  const drawP = interpolate(frame, [20, 110], [0, 1], CLAMP);

  const path = POINTS.map(([d, y], i) => `${i === 0 ? 'M' : 'L'} ${xFor(d)} ${yFor(y)}`).join(' ');

  return (
    <AbsoluteFill style={{background: bgGradient, fontFamily: font.family, color: color.fg}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div>
          <div
            style={{
              fontSize: type.kicker,
              letterSpacing: 2.2,
              color: color.amber,
              marginBottom: 18,
              opacity: title.opacity,
              textAlign: 'center',
            }}
          >
            EXTEND IT.
          </div>
          <svg width={W} height={H} style={{overflow: 'visible', opacity: axes.opacity}}>
            {/* axes */}
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={color.hairline} strokeWidth={2} />
            <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={color.hairline} strokeWidth={2} />
            {/* curve, drawn on */}
            <path
              d={path}
              fill="none"
              stroke={color.amber}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - drawP}
            />
            {POINTS.map(([d, y], i) => {
              const pointReveal = interpolate(drawP, [i / POINTS.length, (i + 0.4) / POINTS.length], [0, 1], CLAMP);
              return (
                <g key={d} opacity={pointReveal}>
                  <circle cx={xFor(d)} cy={yFor(y)} r={6} fill={color.amber} />
                  <text
                    x={xFor(d)}
                    y={H - PAD + 28}
                    fill={color.fgDim}
                    fontSize={16}
                    textAnchor="middle"
                    fontFamily={font.family}
                  >
                    {d}d
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export const YIELD_CURVE_DURATION = 150;
