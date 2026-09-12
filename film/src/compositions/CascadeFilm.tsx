/**
 * CascadeFilm — the root composition, rebuilt for the product owner's final
 * v6 narration (docs/script-v6-liam.md, Stage 12 remap). 17 scenes via
 * <Series> (hard cuts — each capture is already one continuous take; see
 * schedule.ts for the per-scene duration/capture doctrine).
 *
 * Two live data sources are threaded through as props (computed once by
 * Root.tsx's calculateMetadata, so the numbers used to SIZE the
 * composition and the numbers used to RENDER it never drift apart):
 *   - `narration`: real VO clip length + file per scene, when
 *     public/narration/narration.json exists for it (else the scene falls
 *     back to schedule.ts's word-count estimate).
 *   - `captureOverrides`: whether public/captures/scene-NN.mp4 exists yet
 *     for that scene (else the scene falls back to schedule.ts's named old
 *     shot file, or a pure motion graphic if none matches the new beat).
 */
import React from 'react';
import {AbsoluteFill, Audio, Sequence, Series, staticFile, useCurrentFrame} from 'remotion';
import {ensureFontsLoaded} from '../brand/fonts';
import {color} from '../brand/tokens';
import {CaptureScene} from '../components/CaptureScene';
import {BrowserFrame, FrameMode} from '../components/BrowserFrame';
import {PhoneHero} from '../components/PhoneHero';
import {applyDurationFloors, SCENES, SceneDef, sceneByNum} from './schedule';
import {captureFileFor, NarrationMap} from './narration';

import {RewindSequence} from './motion-graphics/RewindSequence';
import {TheQuestion} from './motion-graphics/TheQuestion';
import {ContradictionOverlay} from './motion-graphics/ContradictionOverlay';
import {Scene08Counters} from './motion-graphics/Scene08Counters';
import {Scene12Stress} from './motion-graphics/Scene12Stress';
import {ConservationLaws} from './motion-graphics/ConservationLaws';
import {Scene14ZoomOut} from './motion-graphics/Scene14ZoomOut';
import {ChainOfPromises} from './motion-graphics/ChainOfPromises';
import {Scene17Close} from './motion-graphics/Scene17Close';

ensureFontsLoaded();

export interface CascadeFilmProps extends Record<string, unknown> {
  narration: NarrationMap;
  captureOverrides: Record<number, boolean>;
}

/** The resolved duration for a scene: real VO length+0.4s, else the word-count estimate. */
const durationFor = (sc: SceneDef, narration: NarrationMap): number =>
  applyDurationFloors(sc, narration[sc.num]?.durationInFrames ?? sc.estimateFrames);

export const filmDuration = (narration: NarrationMap): number =>
  SCENES.reduce((acc, sc) => acc + durationFor(sc, narration), 0);

/** The resolved capture for a scene: the scene-NN.mp4 recapture if it exists, else the fallback. */
const captureFor = (
  sc: SceneDef,
  overrides: Record<number, boolean>,
  resolvedDuration: number,
): {src: string; captureDurationInFrames: number; startFrom: number} | null => {
  if (overrides[sc.num]) {
    // A fresh recapture is assumed cut to the scene's own length.
    return {src: captureFileFor(sc.num), captureDurationInFrames: resolvedDuration, startFrom: 0};
  }
  if (!sc.fallbackCapture) return null;
  return {
    src: sc.fallbackCapture,
    captureDurationInFrames: sc.fallbackCaptureDurationInFrames ?? resolvedDuration,
    startFrom: sc.fallbackCaptureStartFrom ?? 0,
  };
};

const RAMP = 24;

const isFramed = (num: number | undefined) =>
  num !== undefined && sceneByNum(num).frame === 'framed';

/** Local-frame progress (0=bleed/tilt-out, 1=framed) for a scene's own BrowserFrame. */
const framingRamp = (sc: SceneDef, localFrame: number, durationInFrames: number): number => {
  const target = sc.frame === 'framed' ? 1 : 0;
  const enterFrom = isFramed(sc.num - 1) ? 1 : 0;
  const exitTo = isFramed(sc.num + 1) ? 1 : 0;

  if (localFrame < RAMP && enterFrom !== target) {
    return enterFrom + (target - enterFrom) * (localFrame / RAMP);
  }
  if (localFrame > durationInFrames - RAMP && exitTo !== target) {
    const t = (localFrame - (durationInFrames - RAMP)) / RAMP;
    return target + (exitTo - target) * Math.max(0, Math.min(1, t));
  }
  return target;
};

/** A scene that plays a capture (real or fallback), framed per framingRamp, with optional overlay. */
const CaptureBeat: React.FC<{
  sc: SceneDef;
  duration: number;
  cap: {src: string; captureDurationInFrames: number; startFrom: number};
  children?: React.ReactNode;
}> = ({sc, duration, cap, children}) => {
  const frame = useCurrentFrame();
  const progress = framingRamp(sc, frame, duration);
  return (
    <CaptureScene
      src={cap.src}
      captureDurationInFrames={cap.captureDurationInFrames}
      startFrom={cap.startFrom}
      mode={sc.frame as FrameMode}
      progress={progress}
    >
      {children}
    </CaptureScene>
  );
};

/** A pure motion-graphic scene, framed per framingRamp (no capture underneath). */
const GraphicBeat: React.FC<{sc: SceneDef; duration: number; children: React.ReactNode}> = ({
  sc,
  duration,
  children,
}) => {
  const frame = useCurrentFrame();
  const progress = framingRamp(sc, frame, duration);
  return (
    <BrowserFrame mode={sc.frame as FrameMode} progress={progress}>
      {children}
    </BrowserFrame>
  );
};

const SceneVO: React.FC<{num: number; narration: NarrationMap}> = ({num, narration}) => {
  const entry = narration[num];
  if (!entry) return null;
  return <Audio src={staticFile(`narration/${entry.file}`)} />;
};

export const CascadeFilm: React.FC<CascadeFilmProps> = ({narration, captureOverrides}) => {
  const durations = SCENES.map((sc) => durationFor(sc, narration));

  const sc15 = sceneByNum(15);
  const sc16 = sceneByNum(16);
  const dur15 = durations[14];
  const dur16 = durations[15];
  const cap15 = captureFor(sc15, captureOverrides, dur15);
  const cap16 = captureFor(sc16, captureOverrides, dur16);
  // Scene 15 opens on the finished-phone photo, then cuts to the descent
  // capture; scene 16 continues that SAME capture from where 15 left off
  // (one continuous take across the two scenes, per the shooting doctrine)
  // — unless a scene-15/16.mp4 recapture exists, in which case each plays
  // its own file in full.
  const photoFrames15 = captureOverrides[15] ? 0 : Math.min(100, Math.round(dur15 * 0.33));
  const descentStart15 = cap15?.startFrom ?? 0;
  const descentFrames15 = dur15 - photoFrames15;
  const descentStart16 = captureOverrides[16] ? cap16?.startFrom ?? 0 : descentStart15 + descentFrames15;

  return (
    <AbsoluteFill style={{background: color.bgOuter}}>
      <Series>
        <Series.Sequence name="Scene 1 — The object of desire" durationInFrames={durations[0]}>
          <PhoneHeroScene durationInFrames={durations[0]} />
          <SceneVO num={1} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 2 — Apple Park" durationInFrames={durations[1]}>
          {(() => {
            const sc = sceneByNum(2);
            const cap = captureFor(sc, captureOverrides, durations[1]);
            return cap ? <CaptureBeat sc={sc} duration={durations[1]} cap={cap} /> : null;
          })()}
          <SceneVO num={2} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 3 — Rewind" durationInFrames={durations[2]}>
          <RewindSequence durationInFrames={durations[2]} />
          <SceneVO num={3} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 4 — The hidden supply chain" durationInFrames={durations[3]}>
          {(() => {
            const sc = sceneByNum(4);
            const cap = captureFor(sc, captureOverrides, durations[3]);
            return cap ? <CaptureBeat sc={sc} duration={durations[3]} cap={cap} /> : null;
          })()}
          <SceneVO num={4} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 5 — The contradiction" durationInFrames={durations[4]}>
          {(() => {
            const sc = sceneByNum(5);
            const cap = captureFor(sc, captureOverrides, durations[4]);
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[4]} cap={cap}>
                <ContradictionOverlay durationInFrames={durations[4]} />
              </CaptureBeat>
            ) : (
              <GraphicBeat sc={sc} duration={durations[4]}>
                <ContradictionOverlay durationInFrames={durations[4]} />
              </GraphicBeat>
            );
          })()}
          <SceneVO num={5} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 6 — The question" durationInFrames={durations[5]}>
          <GraphicBeat sc={sceneByNum(6)} duration={durations[5]}>
            <TheQuestion durationInFrames={durations[5]} />
          </GraphicBeat>
          <SceneVO num={6} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 7 — The cascade" durationInFrames={durations[6]}>
          {(() => {
            const sc = sceneByNum(7);
            const cap = captureFor(sc, captureOverrides, durations[6]);
            return cap ? <CaptureBeat sc={sc} duration={durations[6]} cap={cap} /> : null;
          })()}
          <SceneVO num={7} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 8 — Let it land" durationInFrames={durations[7]}>
          {(() => {
            const sc = sceneByNum(8);
            const cap = captureFor(sc, captureOverrides, durations[7]);
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[7]} cap={cap}>
                <Scene08Counters durationInFrames={durations[7]} />
              </CaptureBeat>
            ) : null;
          })()}
          <SceneVO num={8} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 9 — Run the year" durationInFrames={durations[8]}>
          {(() => {
            const sc = sceneByNum(9);
            const cap = captureFor(sc, captureOverrides, durations[8]);
            return cap ? <CaptureBeat sc={sc} duration={durations[8]} cap={cap} /> : null;
          })()}
          <SceneVO num={9} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 10 — A dollar with a date" durationInFrames={durations[9]}>
          {(() => {
            const sc = sceneByNum(10);
            const cap = captureFor(sc, captureOverrides, durations[9]);
            return cap ? <CaptureBeat sc={sc} duration={durations[9]} cap={cap} /> : null;
          })()}
          <SceneVO num={10} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 11 — Underneath it" durationInFrames={durations[10]}>
          {(() => {
            const sc = sceneByNum(11);
            const cap = captureFor(sc, captureOverrides, durations[10]);
            return cap ? <CaptureBeat sc={sc} duration={durations[10]} cap={cap} /> : null;
          })()}
          <SceneVO num={11} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 12 — Stress test" durationInFrames={durations[11]}>
          {(() => {
            const sc = sceneByNum(12);
            const cap = captureFor(sc, captureOverrides, durations[11]);
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[11]} cap={cap}>
                <Scene12Stress durationInFrames={durations[11]} />
              </CaptureBeat>
            ) : null;
          })()}
          <SceneVO num={12} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 13 — The rules survive" durationInFrames={durations[12]}>
          {(() => {
            const sc = sceneByNum(13);
            const cap = captureFor(sc, captureOverrides, durations[12]);
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[12]} cap={cap}>
                <ConservationLaws durationInFrames={durations[12]} />
              </CaptureBeat>
            ) : (
              <GraphicBeat sc={sc} duration={durations[12]}>
                <ConservationLaws durationInFrames={durations[12]} />
              </GraphicBeat>
            );
          })()}
          <SceneVO num={13} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 14 — Zoom out" durationInFrames={durations[13]}>
          {(() => {
            const sc = sceneByNum(14);
            const cap = captureFor(sc, captureOverrides, durations[13]);
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[13]} cap={cap}>
                <Scene14ZoomOut durationInFrames={durations[13]} />
              </CaptureBeat>
            ) : (
              <GraphicBeat sc={sc} duration={durations[13]}>
                <Scene14ZoomOut durationInFrames={durations[13]} />
              </GraphicBeat>
            );
          })()}
          <SceneVO num={14} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 15 — New York" durationInFrames={dur15}>
          {captureOverrides[15] && cap15 ? (
            <CaptureBeat sc={sc15} duration={dur15} cap={cap15} />
          ) : (
            <>
              <Sequence from={0} durationInFrames={photoFrames15} layout="none">
                <PhoneHeroScene durationInFrames={photoFrames15} finished />
              </Sequence>
              <Sequence from={photoFrames15} durationInFrames={descentFrames15} layout="none">
                <CaptureBeat
                  sc={sc15}
                  duration={descentFrames15}
                  cap={{
                    src: sc15.fallbackCapture!,
                    captureDurationInFrames: sc15.fallbackCaptureDurationInFrames!,
                    startFrom: descentStart15,
                  }}
                />
              </Sequence>
            </>
          )}
          <SceneVO num={15} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 16 — Beneath it" durationInFrames={dur16}>
          <CaptureBeat
            sc={sc16}
            duration={dur16}
            cap={
              captureOverrides[16] && cap16
                ? cap16
                : {
                    src: sc16.fallbackCapture!,
                    captureDurationInFrames: sc16.fallbackCaptureDurationInFrames!,
                    startFrom: descentStart16,
                  }
            }
          >
            <ChainOfPromises durationInFrames={dur16} />
          </CaptureBeat>
          <SceneVO num={16} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 17 — Close" durationInFrames={durations[16]}>
          <Scene17Close durationInFrames={durations[16]} />
          <SceneVO num={17} narration={narration} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

/** Scene 1's entrance / scene 15's held-photo beat — the tilt eases 0->1 on scene 1 only. */
const PhoneHeroScene: React.FC<{durationInFrames: number; finished?: boolean}> = ({
  durationInFrames,
  finished = false,
}) => {
  const frame = useCurrentFrame();
  const tilt = finished ? 1 : Math.max(0, Math.min(1, frame / 70));
  return <PhoneHero frame={frame} durationInFrames={durationInFrames} tilt={tilt} />;
};
