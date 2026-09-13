/**
 * Scene 5 — The contradiction. Script-v6-liam.md: "Samsung can have a
 * hundred million dollars coming from Apple... while Corning is waiting to
 * be paid by Samsung. Everybody has value coming. Everybody has bills to
 * pay. But the dates don't line up." Composited over the continuing
 * shot-02-network capture (stage12-directive: "globe keeps drifting").
 * Two timelines, misaligned dots, per the brief.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {at30, enter} from '../../motion/timing';
import {cueFrame, SceneCues} from '../../cues';
import {color, font, scrim} from '../../brand/tokens';

const ROWS = [
  {label: 'Samsung — receivable from Apple', at: 0.62, color: color.money},
  {label: 'Corning — waiting on Samsung', at: 0.3, color: color.amber},
];

export const ContradictionOverlay: React.FC<{durationInFrames: number; cues?: SceneCues}> = ({
  durationInFrames: dur,
  cues,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rowsIn = enter(frame, fps, cueFrame(cues, 'rows-in', fps, at30(10, fps)), 'fade');
  const line = enter(frame, fps, cueFrame(cues, 'dates-line', fps, Math.round(dur * 0.55)), 'fade');

  return (
    <AbsoluteFill style={{background: scrim}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{width: 1100, fontFamily: font.family, opacity: rowsIn.opacity}}>
          {ROWS.map((row) => (
            <div key={row.label} style={{marginBottom: 44}}>
              <div style={{color: color.fgDim, fontSize: 18, marginBottom: 12}}>{row.label}</div>
              <div
                style={{
                  position: 'relative',
                  height: 4,
                  background: color.hairline,
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${row.at * 100}%`,
                    top: -10,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    background: row.color,
                    transform: 'translateX(-50%)',
                    boxShadow: `0 0 24px ${row.color}`,
                  }}
                />
              </div>
            </div>
          ))}
          <div
            style={{
              marginTop: 20,
              fontSize: 30,
              color: color.fg,
              fontWeight: 450,
              opacity: line.opacity,
              transform: line.transform,
            }}
          >
            The dates don't line up.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
