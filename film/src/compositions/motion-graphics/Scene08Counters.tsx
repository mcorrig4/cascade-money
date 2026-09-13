/**
 * Scene 8 — Let it land. Script-v6-liam.md: "One hundred million dollars
 * committed. Four hundred million dollars of obligations settled... Nobody
 * borrowed another dollar... That's the cascade." Composited over the
 * continuing shot-04-the-cascade capture.
 *
 * The full Corning branch is now the default: $450M / 8 companies.
 * USE_EXTENDED_FIGURES mirrors the app switch; false retains the optional
 * straight-line $400M / 4 presentation. Narration will be re-recorded separately.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {at30, countUp, enter} from '../../motion/timing';
import {cueFrame, SceneCues} from '../../cues';
import {color, font, scrim, type} from '../../brand/tokens';

/** Flip to true to show the extended figures ($450M / 8 companies). */
export const USE_EXTENDED_FIGURES = true;

const COMMITTED = 100_000_000;
const SETTLED = USE_EXTENDED_FIGURES ? 450_000_000 : 400_000_000;
const COMPANIES = USE_EXTENDED_FIGURES ? 8 : 4;

export const Scene08Counters: React.FC<{durationInFrames: number; cues?: SceneCues}> = ({
  durationInFrames: dur,
  cues,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const committedStart = cueFrame(cues, 'committed-counter', fps, at30(10, fps));
  const settledStart = cueFrame(cues, 'settled-counter', fps, at30(70, fps));
  const companiesStart = cueFrame(cues, 'companies-counter', fps, at30(150, fps));
  const committed = countUp(frame, committedStart, committedStart + at30(50, fps), COMMITTED / 1_000_000);
  const settled = countUp(frame, settledStart, settledStart + at30(70, fps), SETTLED / 1_000_000);
  const companies = countUp(frame, companiesStart, companiesStart + at30(40, fps), COMPANIES);
  const lineAt = cueFrame(cues, 'tagline', fps, Math.max(dur - at30(60, fps), at30(200, fps)));
  const line = enter(frame, fps, lineAt, 'rise');

  return (
    <AbsoluteFill style={{background: scrim, fontFamily: font.family, color: color.fg}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{display: 'flex', gap: 90, alignItems: 'flex-end'}}>
          <Stat value={`$${committed}M`} label="committed" accent={color.fg} />
          <Stat value={`$${settled}M`} label="settled" accent={color.money} />
          <Stat value={`${companies}`} label={COMPANIES === companies ? 'companies paid' : 'companies'} accent={color.amber} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{display: 'grid', placeItems: 'end center', paddingBottom: 110}}>
        <div
          style={{
            fontSize: 40,
            fontWeight: 450,
            opacity: line.opacity,
            transform: line.transform,
          }}
        >
          That's the cascade.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{value: string; label: string; accent: string}> = ({value, label, accent}) => (
  <div style={{textAlign: 'center'}}>
    <div style={{fontSize: type.statNumber * 0.7, fontWeight: 450, letterSpacing: -3, color: accent}}>
      {value}
    </div>
    <div style={{fontSize: type.statCaption, color: color.fgDim, marginTop: 8}}>{label}</div>
  </div>
);
