/**
 * Scene 12 — Stress test. Script-v6-liam.md: "So we hit maturity day.
 * Thousands of extensions. Transfers. Redemptions. Sales. All competing
 * for the same vault at once." Composited over the continuing
 * shot-09-the-vault capture (stage12-directive: "burst ... in the ledger
 * and on the globe, the vault gauges under load").
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {at30, enter, stagger} from '../../motion/timing';
import {cueFrame, SceneCues} from '../../cues';
import {color, font, scrim} from '../../brand/tokens';

const OPS = ['Extensions', 'Transfers', 'Redemptions', 'Sales'];
const OP_CUES = ['op-extensions', 'op-transfers', 'op-redemptions', 'op-sales'];

export const Scene12Stress: React.FC<{durationInFrames: number; cues?: SceneCues}> = ({
  durationInFrames: dur,
  cues,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const kicker = enter(frame, fps, cueFrame(cues, 'kicker', fps, 0), 'fade');
  const stepFallback = Math.max(at30(10, fps), Math.floor((dur * 0.5) / OPS.length));

  return (
    <AbsoluteFill style={{background: scrim, fontFamily: font.family, color: color.fg}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <div
            style={{
              color: color.amber,
              fontSize: 13,
              letterSpacing: 2,
              fontWeight: 600,
              opacity: kicker.opacity,
              marginBottom: 26,
            }}
          >
            MATURITY DAY
          </div>
          <div style={{display: 'flex', gap: 44}}>
            {OPS.map((op, i) => {
              const at = cueFrame(cues, OP_CUES[i], fps, stagger(i, stepFallback, at30(12, fps)));
              const e = enter(frame, fps, at, 'pop');
              return (
                <div
                  key={op}
                  style={{
                    opacity: e.opacity,
                    transform: e.transform,
                    border: `1px solid ${color.hairline}`,
                    borderRadius: 12,
                    padding: '20px 32px',
                    background: 'rgba(9,21,31,0.6)',
                    fontSize: 30,
                    fontWeight: 450,
                  }}
                >
                  {op}
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
