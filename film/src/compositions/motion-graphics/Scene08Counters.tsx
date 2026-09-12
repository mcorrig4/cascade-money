/**
 * Scene 8 — Let it land. Script-v6-liam.md: "One hundred million dollars
 * committed. Four hundred million dollars of obligations settled... Nobody
 * borrowed another dollar... That's the cascade." Composited over the
 * continuing shot-04-the-cascade capture.
 *
 * Two verified figure sets exist for the same sim run
 * (docs/verified-figures-v6.md): the straight line of hops reaches
 * $400M / 4 payees — this is what the product owner recorded for scenes
 * 7/8, so it is the default; the full branch-out reaches $450M / 8
 * companies and stays available as the alternate. `USE_EXTENDED_FIGURES`
 * is the switch between them — flip it to true only if the recorded
 * narration is re-cut to speak the extended line.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {countUp, enter} from '../../motion/timing';
import {color, font, scrim, type} from '../../brand/tokens';

/** Flip to true to show the extended figures ($450M / 8 companies). */
export const USE_EXTENDED_FIGURES = false;

const COMMITTED = 100_000_000;
const SETTLED = USE_EXTENDED_FIGURES ? 450_000_000 : 400_000_000;
const COMPANIES = USE_EXTENDED_FIGURES ? 8 : 4;

export const Scene08Counters: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const committed = countUp(frame, 10, 60, COMMITTED / 1_000_000);
  const settled = countUp(frame, 70, 140, SETTLED / 1_000_000);
  const companies = countUp(frame, 150, 190, COMPANIES);
  const line = enter(frame, 30, Math.max(dur - 60, 200), 'rise');

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
