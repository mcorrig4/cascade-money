/**
 * Scene 3 — Rewind. Script-v6-liam.md: "So let's rewind. September 2025.
 * Nearly two hundred suppliers. Thousands of factories. More than fifty
 * countries. And almost two hundred billion dollars in product costs
 * moving through one enormous global supply chain. We recreated that
 * system... and asked what would happen if its payment layer ran onchain."
 *
 * No live capture matches this beat (stage12-directive: "time-lapse blur
 * backward, white flash, fade back with giant 'September 2025' card, then
 * the three stats as giant center lines in sequence"). Built as one
 * composite motion graphic, its four beats sized as FRACTIONS of the
 * scene's own duration (not fixed frame counts) so it still reads cleanly
 * once narration.json's real VO length replaces the word-count estimate.
 *
 * Figures: ~200 suppliers, thousands of factories, 50+ countries, $194.1B
 * FY2025 product cost of sales ("almost two hundred billion") — all from
 * docs/verified-figures-v6.md.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CLAMP, enter} from '../../motion/timing';
import {bgGradient, color, font} from '../../brand/tokens';

const STATS = ['Nearly 200 suppliers', 'Thousands of factories', '50+ countries', '~$200B in product costs'];
const BANDS = 7;

export const RewindSequence: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const blurEnd = dur * 0.3;
  const flashEnd = dur * 0.38;
  const titleEnd = dur * 0.55;

  const speed = interpolate(frame, [0, blurEnd], [2, 34], CLAMP);
  const flashOpacity = interpolate(frame, [blurEnd, flashEnd], [0, 1], CLAMP);
  const fromWhite = interpolate(frame, [flashEnd, flashEnd + 20], [1, 0], CLAMP);

  const titleIn = interpolate(frame, [flashEnd + 8, flashEnd + 24], [0, 1], CLAMP);
  const titleOut = interpolate(frame, [titleEnd - 20, titleEnd], [1, 0], CLAMP);
  const titleOpacity = Math.min(titleIn, titleOut);

  const statsPhase = frame > titleEnd;
  const statSpan = (dur - titleEnd) / STATS.length;

  return (
    <AbsoluteFill style={{background: color.bgOuter, overflow: 'hidden'}}>
      {frame < flashEnd &&
        Array.from({length: BANDS}).map((_, i) => {
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
                left: x,
                width: 2400,
                height: h,
                background: i % 3 === 0 ? 'rgba(105,230,192,0.08)' : 'rgba(230,236,235,0.04)',
              }}
            />
          );
        })}
      <AbsoluteFill style={{background: '#ffffff', opacity: flashOpacity}} />

      {frame >= flashEnd && frame < titleEnd && (
        <AbsoluteFill style={{background: bgGradient}}>
          <AbsoluteFill style={{background: '#ffffff', opacity: fromWhite}} />
          <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
            <div
              style={{
                fontFamily: font.family,
                color: color.fg,
                fontSize: 64,
                fontWeight: 450,
                letterSpacing: -2,
                opacity: titleOpacity,
              }}
            >
              September 2025
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {statsPhase && (
        <AbsoluteFill style={{background: bgGradient}}>
          <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
            <div style={{width: 1200, fontFamily: font.family}}>
              {STATS.map((stat, i) => {
                const at = titleEnd + i * statSpan;
                const e = enter(frame, 30, at + 4, 'rise');
                return (
                  <div
                    key={stat}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      opacity:
                        frame >= at && frame < at + statSpan
                          ? Math.min(
                              e.opacity,
                              interpolate(frame, [at + statSpan - 14, at + statSpan], [1, 0], CLAMP),
                            )
                          : 0,
                      transform: e.transform,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 56,
                        fontWeight: 450,
                        letterSpacing: -1.5,
                        color: i === 3 ? color.money : color.fg,
                      }}
                    >
                      {stat}
                    </span>
                  </div>
                );
              })}
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
