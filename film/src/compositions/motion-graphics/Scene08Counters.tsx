/**
 * Scene 6 — Let it land. v9 narration: "One hundred million dollars
 * deposited. Four hundred fifty million dollars transacted. Nine invoices
 * settled. The payments add up. The backing does not multiply. That's the
 * cascade." Composited over the continuing shot-04-the-cascade capture —
 * but ONLY in the fallback path, when no scene-06 capture exists yet: the
 * scene-06 recapture is the app's own recording, which already burns in
 * these same figures (app/src/director/ShotOverlays.tsx, overlay 'totals',
 * stage 12/17 "Let it land"). One owner per element, capture wins — see
 * CascadeFilm.tsx's Scene 6 Series.Sequence.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {at30, countUp, enter} from '../../motion/timing';
import {cueFrame, SceneCues} from '../../cues';
import {color, font, scrim, type} from '../../brand/tokens';

const DEPOSITED = 100_000_000;
const TRANSACTED = 450_000_000;
const INVOICES = 9;

export const Scene08Counters: React.FC<{durationInFrames: number; cues?: SceneCues}> = ({
  durationInFrames: dur,
  cues,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const depositedStart = cueFrame(cues, 'committed-counter', fps, cueFrame(cues, 'committed-counter-fallback', fps, at30(10, fps)));
  const transactedStart = cueFrame(cues, 'settled-counter', fps, cueFrame(cues, 'settled-counter-fallback', fps, at30(70, fps)));
  const invoicesStart = cueFrame(cues, 'companies-counter', fps, cueFrame(cues, 'companies-counter-fallback', fps, at30(150, fps)));
  const deposited = countUp(frame, depositedStart, depositedStart + at30(50, fps), DEPOSITED / 1_000_000);
  const transacted = countUp(frame, transactedStart, transactedStart + at30(70, fps), TRANSACTED / 1_000_000);
  const invoices = countUp(frame, invoicesStart, invoicesStart + at30(40, fps), INVOICES);
  const lineAt = cueFrame(cues, 'tagline', fps, cueFrame(cues, 'tagline-fallback', fps, Math.max(dur - at30(60, fps), at30(200, fps))));
  const line = enter(frame, fps, lineAt, 'rise');

  return (
    <AbsoluteFill style={{background: scrim, fontFamily: font.family, color: color.fg}}>
      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        <div style={{display: 'flex', gap: 90, alignItems: 'flex-end'}}>
          <Stat value={`$${deposited}M`} label="deposited" accent={color.fg} />
          <Stat value={`$${transacted}M`} label="transacted" accent={color.money} />
          <Stat value={`${invoices}`} label={INVOICES === invoices ? 'invoices settled' : 'invoices'} accent={color.amber} />
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
