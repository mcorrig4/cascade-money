/**
 * Scene 14 — Zoom out. Script-v6-liam.md: "Loans. Forwards. Bonds.
 * Derivatives. Finance is full of promises to move money at some future
 * date. Cascade makes that date part of the money itself. Money... plus
 * time... as one composable primitive." Composited over the continuing
 * shot-11-architecture capture (stage12-directive: "composable overlay
 * reveals Loans / Forwards / Bonds / Derivatives one per spoken word; then
 * 'Money plus time' as giant text with a held pause; then 'a second
 * dimension to money'"). Beats sized as fractions of the scene's own
 * duration.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {enter, stagger} from '../../motion/timing';
import {color, font, scrim} from '../../brand/tokens';

const WORDS = ['Loans', 'Forwards', 'Bonds', 'Derivatives'];

export const Scene14ZoomOut: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const wordsPhaseEnd = dur * 0.45;
  const moneyTimeAt = dur * 0.52;
  const moneyTimeOut = dur * 0.82;
  const finalAt = dur * 0.86;
  const step = Math.max(8, Math.floor(wordsPhaseEnd / WORDS.length));

  const moneyTime = enter(frame, 30, moneyTimeAt, 'settle');
  const moneyTimeFade =
    frame > moneyTimeOut ? Math.max(0, 1 - (frame - moneyTimeOut) / 16) : 1;
  const finalLine = enter(frame, 30, finalAt, 'fade');

  return (
    <AbsoluteFill style={{background: scrim, fontFamily: font.family, color: color.fg}}>
      {frame < moneyTimeAt && (
        <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
          <div style={{display: 'flex', gap: 50}}>
            {WORDS.map((w, i) => {
              const e = enter(frame, 30, stagger(i, step, 6), 'pop');
              return (
                <div
                  key={w}
                  style={{
                    opacity: e.opacity,
                    transform: e.transform,
                    fontSize: 46,
                    fontWeight: 450,
                    letterSpacing: -1,
                    border: `1px solid ${color.hairline}`,
                    borderRadius: 12,
                    padding: '20px 30px',
                    background: 'rgba(9,21,31,0.6)',
                  }}
                >
                  {w}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {frame >= moneyTimeAt && frame < finalAt && (
        <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 450,
              letterSpacing: -3,
              textAlign: 'center',
              opacity: moneyTime.opacity * moneyTimeFade,
              transform: moneyTime.transform,
            }}
          >
            Money <span style={{color: color.fgDim}}>plus</span>{' '}
            <span style={{color: color.money}}>time</span>
          </div>
        </AbsoluteFill>
      )}

      {frame >= finalAt && (
        <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 450,
              letterSpacing: -1.5,
              opacity: finalLine.opacity,
            }}
          >
            A second dimension to money.
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
