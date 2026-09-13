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
 *
 * The title card and the four stat lines are keyed to when the narration
 * actually SAYS each one (cues.ts / scripts/cues-from-words.mjs), not a
 * fixed offset into the scene — see `cues` below. A stat whose cue hasn't
 * resolved (no words file, or this VO cut doesn't say it) falls back to
 * the original evenly-spaced slot.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, at30, enter} from '../../motion/timing';
import {cueFrame, SceneCues} from '../../cues';
import {bgGradient, color, font} from '../../brand/tokens';

const STATS = ['Nearly 200 suppliers', 'Thousands of factories', '50+ countries', '~$200B in product costs'];
const STAT_CUES = ['stat-suppliers', 'stat-factories', 'stat-countries', 'stat-cost'];
const BANDS = 7;

export const RewindSequence: React.FC<{durationInFrames: number; cues?: SceneCues}> = ({
  durationInFrames: dur,
  cues,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // Normalize the background scroll's frame-driven speed to a 30fps-equivalent
  // counter so its on-screen rate doesn't change with the composition's fps.
  const frame30 = frame * (30 / fps);

  const blurEnd = dur * 0.3;
  const flashEnd = dur * 0.38;
  const titleEnd = dur * 0.55;

  const speed = interpolate(frame30, [0, blurEnd * (30 / fps)], [2, 34], CLAMP);
  const flashOpacity = interpolate(frame, [blurEnd, flashEnd], [0, 1], CLAMP);
  const fromWhite = interpolate(frame, [flashEnd, flashEnd + at30(20, fps)], [1, 0], CLAMP);

  const titleInAt = cueFrame(cues, 'date-card', fps, flashEnd + at30(8, fps));
  const titleIn = interpolate(frame, [titleInAt, titleInAt + at30(16, fps)], [0, 1], CLAMP);
  const titleOut = interpolate(frame, [titleEnd - at30(20, fps), titleEnd], [1, 0], CLAMP);
  const titleOpacity = Math.min(titleIn, titleOut);

  const statSpanFallback = (dur - titleEnd) / STATS.length;
  const statAt = STAT_CUES.map((cue, i) =>
    cueFrame(cues, cue, fps, titleEnd + i * statSpanFallback),
  );
  const statsPhase = frame >= statAt[0];

  return (
    <AbsoluteFill style={{background: color.bgOuter, overflow: 'hidden'}}>
      {frame < flashEnd &&
        Array.from({length: BANDS}).map((_, i) => {
          const y = (1080 / BANDS) * i;
          const h = 1080 / BANDS;
          const dir = i % 2 === 0 ? -1 : 1;
          const x = ((frame30 * speed * dir) % 2400) - 1200;
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
                const at = statAt[i];
                const end = i + 1 < STATS.length ? statAt[i + 1] : dur;
                const e = enter(frame, fps, at + at30(4, fps), 'rise');
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
                        frame >= at && frame < end
                          ? Math.min(
                              e.opacity,
                              interpolate(frame, [end - at30(14, fps), end], [1, 0], CLAMP),
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
