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
import {AbsoluteFill, Audio, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
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
  /**
   * REVIEW-ONLY. When true, overlays a fixed top-left chip on every frame
   * showing the scene number/title and scene-local timecode (e.g.
   * "S07 · The cascade · 00:12"), so the product owner can refer to beats
   * by number while drafting. Defaults to false (see Root.tsx's
   * defaultProps) and must never render for a real deliverable. Pick it up
   * with:
   *   npx remotion render CascadeFilm --props='{"reviewLabels":true}'
   */
  reviewLabels?: boolean;
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

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * REVIEW-ONLY overlay (CascadeFilmProps.reviewLabels). Sits as a sibling of
 * <Series>, so useCurrentFrame() here is the ABSOLUTE composition frame
 * (Series's own children are the ones offset per-scene, not this). Walks
 * `durations` — same array, same order as SCENES — to find which scene the
 * current absolute frame falls in and how far into that scene it is, then
 * renders "S<NN> · <title> · mm:ss" (scene-local timecode) as a fixed
 * top-left pill. Never rendered unless reviewLabels is explicitly true.
 */
const ReviewLabelOverlay: React.FC<{durations: number[]}> = ({durations}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  let sceneStart = 0;
  let sceneIndex = durations.length - 1;
  for (let i = 0; i < durations.length; i++) {
    if (frame < sceneStart + durations[i]) {
      sceneIndex = i;
      break;
    }
    sceneStart += durations[i];
  }

  const sc = SCENES[sceneIndex];
  const localFrame = Math.max(0, frame - sceneStart);
  const totalSeconds = Math.floor(localFrame / fps);
  const mm = pad2(Math.floor(totalSeconds / 60));
  const ss = pad2(totalSeconds % 60);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          padding: '10px 20px',
          borderRadius: 999,
          background: 'rgba(0,0,0,0.75)',
          color: color.white,
          fontFamily: "'SF Mono', 'Menlo', 'Consolas', monospace",
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}
      >
        {`S${pad2(sc.num)} · ${sc.title} · ${mm}:${ss}`}
      </div>
    </AbsoluteFill>
  );
};

export const CascadeFilm: React.FC<CascadeFilmProps> = ({narration, captureOverrides, reviewLabels = false}) => {
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
            // The scene-05 recapture is the app's own recording, which
            // already burns in the "dates don't line up" contradiction
            // card (app/src/director/ShotOverlays.tsx, overlay 'contradiction').
            // Drawing ContradictionOverlay on top of it doubles that card —
            // one owner per element, capture wins (ac02b78). Only the
            // fallback (pre-overlay) shot-02-network capture needs this
            // component to draw the card itself.
            const overlay = captureOverrides[5] ? null : <ContradictionOverlay durationInFrames={durations[4]} />;
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[4]} cap={cap}>
                {overlay}
              </CaptureBeat>
            ) : (
              <GraphicBeat sc={sc} duration={durations[4]}>
                {overlay}
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
            // The scene-08 recapture is the app's own recording, which
            // already burns in the $100M/$400M/4-companies counters
            // (app/src/director/ShotOverlays.tsx, overlay 'totals', stage
            // 12 "Let it land"). Rendering Scene08Counters on top of it
            // doubled the counters (ghosted duplicate behind the sharp
            // numerals, draft v5 ~t=128s). One owner per element, capture
            // wins (ac02b78) — only render the Remotion counters in the
            // fallback path, when no scene-08 capture exists yet.
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[7]} cap={cap}>
                {!captureOverrides[8] && <Scene08Counters durationInFrames={durations[7]} />}
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
            // scene-12 recapture already burns in the vault balance sheet
            // ("Extensions. Transfers. Redemptions. Sales." + invariants —
            // app's 'vault' overlay). Scene12Stress duplicates that
            // headline; render it only in the fallback path.
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[11]} cap={cap}>
                {!captureOverrides[12] && <Scene12Stress durationInFrames={durations[11]} />}
              </CaptureBeat>
            ) : null;
          })()}
          <SceneVO num={12} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 13 — The rules survive" durationInFrames={durations[12]}>
          {(() => {
            const sc = sceneByNum(13);
            const cap = captureFor(sc, captureOverrides, durations[12]);
            // scene-13 recapture already burns in "Nothing counted twice."
            // plus the ownership/yield/operations laws (app's 'laws'
            // overlay). ConservationLaws duplicates that; render it only
            // in the fallback path.
            const overlay = captureOverrides[13] ? null : <ConservationLaws durationInFrames={durations[12]} />;
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[12]} cap={cap}>
                {overlay}
              </CaptureBeat>
            ) : (
              <GraphicBeat sc={sc} duration={durations[12]}>
                {overlay}
              </GraphicBeat>
            );
          })()}
          <SceneVO num={13} narration={narration} />
        </Series.Sequence>

        <Series.Sequence name="Scene 14 — Zoom out" durationInFrames={durations[13]}>
          {(() => {
            const sc = sceneByNum(14);
            const cap = captureFor(sc, captureOverrides, durations[13]);
            // scene-14 recapture already burns in "Composable." plus the
            // Loans/Forwards/Bonds/Derivatives + "Money plus time" beats
            // (app's 'composable' overlay). Scene14ZoomOut duplicates that;
            // render it only in the fallback path.
            const overlay14 = captureOverrides[14] ? null : <Scene14ZoomOut durationInFrames={durations[13]} />;
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[13]} cap={cap}>
                {overlay14}
              </CaptureBeat>
            ) : (
              <GraphicBeat sc={sc} duration={durations[13]}>
                {overlay14}
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
      {reviewLabels ? <ReviewLabelOverlay durations={durations} /> : null}
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
