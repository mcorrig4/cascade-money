/**
 * CascadeFilm — the root composition. Assembles all 20 scenes of
 * shooting-script-v2.md (v2.1) in order via <Series> (hard cuts between
 * scenes — the script's own camera-continuity doctrine means each capture
 * is already one continuous take; a crossfade between them would fight
 * that, not support it). 1920x1080 @ 30fps, 7080f / 3:56 total.
 *
 * BrowserFrame framing doctrine (PO brief, item 1): the film opens tilted
 * into a browser window (scene 1), settles to full bleed for the cinematic
 * globe beats, and pulls back OUT into the framed browser window for every
 * protocol-talk / data beat. `framingRamp()` below computes the 0-1
 * progress for each scene's BrowserFrame from its neighbors in SCENES so
 * the frame breathes in and out rather than hard-cutting chrome on/off.
 */
import React from 'react';
import {AbsoluteFill, Sequence, Series, useCurrentFrame} from 'remotion';
import {ensureFontsLoaded} from '../brand/fonts';
import {color} from '../brand/tokens';
import {CaptureScene} from '../components/CaptureScene';
import {BrowserFrame, FrameMode} from '../components/BrowserFrame';
import {NARRATION_MARKERS, SCENE18_CAPTURE_START, SCENES, sceneStart, TOTAL_DURATION} from './schedule';

import {RewindFlash} from './motion-graphics/RewindFlash';
import {TitleCard} from './motion-graphics/TitleCard';
import {TheCatch} from './motion-graphics/TheCatch';
import {TheQuestion} from './motion-graphics/TheQuestion';
import {TreasuryDecision} from './motion-graphics/TreasuryDecision';
import {YieldCurve} from './motion-graphics/YieldCurve';
import {ConservationLaws} from './motion-graphics/ConservationLaws';
import {ReframeOverlay} from './motion-graphics/ReframeOverlay';
import {ComposableOverlay} from './motion-graphics/ComposableOverlay';
import {CloseLowerThird} from './motion-graphics/CloseLowerThird';
import {EndingLine} from './motion-graphics/EndingLine';
import {WordmarkCard} from './motion-graphics/WordmarkCard';

ensureFontsLoaded();

export const CASCADE_FILM_DURATION = TOTAL_DURATION;

const RAMP = 24; // frames — the pull-back-out / settle-to-bleed transition length

const isFramed = (id: string | undefined) => {
  if (!id) return false;
  const sc = SCENES.find((s) => s.id === id);
  return sc?.frame === 'framed';
};

const neighborOf = (id: string, dir: -1 | 1): string | undefined => {
  const i = SCENES.findIndex((s) => s.id === id);
  return SCENES[i + dir]?.id;
};

/**
 * Local-frame progress (0=bleed, 1=framed) for a scene's own BrowserFrame,
 * given its own mode, duration, and whether its neighbors are framed too
 * (in which case there's no need to ramp — the browser stays put across
 * the cut, the more natural read for adjacent data beats).
 */
const framingRamp = (id: string, localFrame: number): number => {
  const sc = SCENES.find((s) => s.id === id)!;
  const target = sc.frame === 'framed' ? 1 : 0;
  const enterFrom = isFramed(neighborOf(id, -1)) ? 1 : 0;
  const exitTo = isFramed(neighborOf(id, 1)) ? 1 : 0;

  if (localFrame < RAMP && enterFrom !== target) {
    return enterFrom + (target - enterFrom) * (localFrame / RAMP);
  }
  if (localFrame > sc.durationInFrames - RAMP && exitTo !== target) {
    const t = (localFrame - (sc.durationInFrames - RAMP)) / RAMP;
    return target + (exitTo - target) * Math.max(0, Math.min(1, t));
  }
  return target;
};

/** Renders the capture for a schedule scene id, framed per `framingRamp`, with optional overlay children. */
const FramedCaptureScene: React.FC<{id: string; children?: React.ReactNode}> = ({id, children}) => {
  const frame = useCurrentFrame();
  const sc = SCENES.find((s) => s.id === id)!;
  const progress = framingRamp(id, frame);
  return (
    <CaptureScene
      src={sc.capture!}
      captureDurationInFrames={sc.captureDurationInFrames!}
      mode={sc.frame as FrameMode}
      progress={progress}
    >
      {children}
    </CaptureScene>
  );
};

/** Renders a pure motion-graphic scene framed per `framingRamp` (no capture underneath). */
const FramedGraphic: React.FC<{id: string; children: React.ReactNode}> = ({id, children}) => {
  const frame = useCurrentFrame();
  const sc = SCENES.find((s) => s.id === id)!;
  const progress = framingRamp(id, frame);
  return (
    <BrowserFrame mode={sc.frame as FrameMode} progress={progress}>
      {children}
    </BrowserFrame>
  );
};

export const CascadeFilm: React.FC = () => {
  return (
    <AbsoluteFill style={{background: color.bgOuter}}>
      <Series>
        <Series.Sequence name="Scene 1 — Apple Park orbit" durationInFrames={SCENES[0].durationInFrames}>
          <TiltInScene id="scene01" />
        </Series.Sequence>

        <Series.Sequence name="Scene 2 — network reveal" durationInFrames={SCENES[1].durationInFrames}>
          <FramedCaptureScene id="scene02" />
        </Series.Sequence>

        <Series.Sequence name="Scene 3 — Rewind" durationInFrames={SCENES[2].durationInFrames}>
          <RewindFlash />
        </Series.Sequence>

        <Series.Sequence name="Scene 4 — September 9, 2025" durationInFrames={SCENES[3].durationInFrames}>
          <TitleCard />
        </Series.Sequence>

        <Series.Sequence name="Scene 5 — The catch" durationInFrames={SCENES[4].durationInFrames}>
          <FramedGraphic id="scene05">
            <TheCatch />
          </FramedGraphic>
        </Series.Sequence>

        <Series.Sequence name="Scene 6 — The question" durationInFrames={SCENES[5].durationInFrames}>
          <FramedGraphic id="scene06">
            <TheQuestion />
          </FramedGraphic>
        </Series.Sequence>

        <Series.Sequence name="Scene 7 — The proof" durationInFrames={SCENES[6].durationInFrames}>
          <FramedCaptureScene id="scene07" />
        </Series.Sequence>

        <Series.Sequence name="Scene 8 — The cascade" durationInFrames={SCENES[7].durationInFrames}>
          <FramedCaptureScene id="scene08" />
        </Series.Sequence>

        <Series.Sequence name="Scene 9 — The year" durationInFrames={SCENES[8].durationInFrames}>
          <FramedCaptureScene id="scene09" />
        </Series.Sequence>

        <Series.Sequence name="Scene 10 — A dollar with a date" durationInFrames={SCENES[9].durationInFrames}>
          <FramedCaptureScene id="scene10" />
        </Series.Sequence>

        <Series.Sequence name="Scene 11 — The treasury decision" durationInFrames={SCENES[10].durationInFrames}>
          <FramedGraphic id="scene11">
            <TreasuryDecision />
          </FramedGraphic>
        </Series.Sequence>

        <Series.Sequence name="Scene 12 — Extend it." durationInFrames={SCENES[11].durationInFrames}>
          <FramedGraphic id="scene12">
            <YieldCurve />
          </FramedGraphic>
        </Series.Sequence>

        <Series.Sequence name="Scene 13 — Under pressure" durationInFrames={SCENES[12].durationInFrames}>
          <FramedCaptureScene id="scene13" />
        </Series.Sequence>

        <Series.Sequence name="Scene 14 — The rules" durationInFrames={SCENES[13].durationInFrames}>
          <FramedCaptureScene id="scene14">
            <ConservationLaws />
          </FramedCaptureScene>
        </Series.Sequence>

        <Series.Sequence name="Scene 15 — The reframe" durationInFrames={SCENES[14].durationInFrames}>
          <FramedCaptureScene id="scene15">
            <ReframeOverlay />
          </FramedCaptureScene>
        </Series.Sequence>

        <Series.Sequence name="Scene 16 — The composable diagram" durationInFrames={SCENES[15].durationInFrames}>
          <FramedCaptureScene id="scene16">
            <ComposableOverlay />
          </FramedCaptureScene>
        </Series.Sequence>

        <Series.Sequence name="Scene 17 — Close" durationInFrames={SCENES[16].durationInFrames}>
          <FramedCaptureScene id="scene17">
            <CloseLowerThird />
          </FramedCaptureScene>
        </Series.Sequence>

        <Series.Sequence name="Scene 18 — The descent" durationInFrames={SCENES[17].durationInFrames}>
          <CaptureScene
            src="shot-12-cascade.mp4"
            startFrom={SCENE18_CAPTURE_START}
            captureDurationInFrames={SCENES[17].captureDurationInFrames!}
            mode="bleed"
            vignette
          />
        </Series.Sequence>

        <Series.Sequence name="Scene 19 — The line" durationInFrames={SCENES[18].durationInFrames}>
          <EndingLine />
        </Series.Sequence>

        <Series.Sequence name="Scene 20 — Cascade Money" durationInFrames={SCENES[19].durationInFrames}>
          <WordmarkCard />
        </Series.Sequence>
      </Series>

      {/* Scratch narration markers — silent placeholder, one zero-footprint
          named Sequence per spoken line, visible in Studio's timeline. */}
      {NARRATION_MARKERS.map((m) => (
        <Sequence
          key={m.sceneId}
          name={`VO — ${m.label}`}
          from={sceneStart(m.sceneId)}
          durationInFrames={1}
          layout="none"
        />
      ))}
    </AbsoluteFill>
  );
};

/** Scene 1 only: tilt-in entrance, easing progress 0->1 over its first ~70f, then holding flat. */
const TiltInScene: React.FC<{id: string}> = ({id}) => {
  const frame = useCurrentFrame();
  const sc = SCENES.find((s) => s.id === id)!;
  const progress = Math.max(0, Math.min(1, frame / 70));
  return (
    <CaptureScene
      src={sc.capture!}
      captureDurationInFrames={sc.captureDurationInFrames!}
      mode="tilt"
      progress={progress}
    />
  );
};
