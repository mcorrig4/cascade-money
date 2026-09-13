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
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {ensureFontsLoaded} from '../brand/fonts';
import {color} from '../brand/tokens';
import {CaptureScene} from '../components/CaptureScene';
import {BrowserFrame, FrameMode} from '../components/BrowserFrame';
import {PhoneHero} from '../components/PhoneHero';
import {resolveSceneDurations, SCENES, SceneDef, sceneByNum} from './schedule';
import {captureFileFor, NarrationMap} from './narration';
import {DEFAULT_NARRATION_CONTROLS, NarrationControls} from './narrationControlsSchema';
import {at30, CLAMP} from '../motion/timing';
import {cameraAt, cameraStyle, FULL_FRAME, RostrumMove} from '../motion/rostrumCamera';
import {cueFrame} from '../cues';
import cueTimesData from '../generated/cues.json';

import {RewindSequence} from './motion-graphics/RewindSequence';
import {TheQuestion} from './motion-graphics/TheQuestion';
import {ContradictionOverlay} from './motion-graphics/ContradictionOverlay';
import {Scene08Counters} from './motion-graphics/Scene08Counters';
import {Scene12Stress} from './motion-graphics/Scene12Stress';
import {ConservationLaws} from './motion-graphics/ConservationLaws';
import {Scene14ZoomOut} from './motion-graphics/Scene14ZoomOut';
import {Scene17Close} from './motion-graphics/Scene17Close';
import {Hook} from './motion-graphics/Hook';

ensureFontsLoaded();

export interface CascadeFilmProps extends Record<string, unknown> {
  narration: NarrationMap;
  captureOverrides: Record<number, boolean>;
  /**
   * Per-scene VO offset/trim/gain — see narrationControlsSchema.ts. Editable
   * in Remotion Studio's props sidebar (Root.tsx wires the zod schema onto
   * this Composition). All-zero defaults are a no-op.
   */
  narrationControls: NarrationControls;
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
  /**
   * Draft (15) or final (30) fps — narrationControlsSchema.ts. Baked into
   * the composition's actual fps by Root.tsx's calculateMetadata; the
   * component itself always reads the real value via useVideoConfig(),
   * never this field directly.
   */
  fps?: 15 | 30;
}

/** Every named slide-reveal/card timestamp resolved from narration word timings — see cues.ts and scripts/cues-from-words.mjs. */
const CUE_TIMES = cueTimesData as Record<number, Record<string, number>>;

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

const RAMP_AT_30 = 24;

const isFramed = (num: number | undefined) =>
  num !== undefined && sceneByNum(num).frame === 'framed';

/** Local-frame progress (0=bleed/tilt-out, 1=framed) for a scene's own BrowserFrame. */
const framingRamp = (sc: SceneDef, localFrame: number, durationInFrames: number, fps: number): number => {
  const ramp = at30(RAMP_AT_30, fps);
  const target = sc.frame === 'framed' ? 1 : 0;
  const enterFrom = isFramed(sc.num - 1) ? 1 : 0;
  const exitTo = isFramed(sc.num + 1) ? 1 : 0;

  if (localFrame < ramp && enterFrom !== target) {
    return enterFrom + (target - enterFrom) * (localFrame / ramp);
  }
  if (localFrame > durationInFrames - ramp && exitTo !== target) {
    const t = (localFrame - (durationInFrames - ramp)) / ramp;
    return target + (exitTo - target) * Math.max(0, Math.min(1, t));
  }
  return target;
};

/** A scene that plays a capture (real or fallback), framed per framingRamp, with optional overlay. */
const CaptureBeat: React.FC<{
  sc: SceneDef;
  duration: number;
  cap: {src: string; captureDurationInFrames: number; startFrom: number};
  /** Rostrum-camera transform for the video layer only — see CaptureScene's videoStyle. Undefined for every caller but Scene 9. */
  videoStyle?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({sc, duration, cap, videoStyle, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = framingRamp(sc, frame, duration, fps);
  return (
    <CaptureScene
      src={cap.src}
      captureDurationInFrames={cap.captureDurationInFrames}
      startFrom={cap.startFrom}
      mode={sc.frame as FrameMode}
      progress={progress}
      videoStyle={videoStyle}
    >
      {children}
    </CaptureScene>
  );
};

/**
 * Scene 9 — Run the year: rostrum-camera pan/zoom on the capture layer only
 * (Liam round 2, msg 21778 — "Can we use Remotion to do that? Smooth zoom
 * in on a UI piece and then zoom out and move over to a different UI
 * piece"). Three moves, cue-timed off the real narration: push in on the
 * bottom-left year scrubber ("simulation"), pan to the right-side
 * transactions ledger ("invoices" / fallback "Thousands"), pull back to the
 * full frame ("countries" / fallback "across") and stay wide through the
 * cross-border close. See motion/rostrumCamera.ts for the transform math —
 * the browser frame (this scene is 'bleed' mode, so there is none) and any
 * overlay children never move, only the video.
 */
const Scene9Capture: React.FC<{
  sc: SceneDef;
  duration: number;
  cap: {src: string; captureDurationInFrames: number; startFrom: number};
}> = ({sc, duration, cap}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = framingRamp(sc, frame, duration, fps);
  const cues = CUE_TIMES[9];

  // Fixed-second fallbacks are the real v7 VO timestamps for these words
  // (measured directly off the narration transcript), used only if a
  // future re-narration drops both the primary and fallback phrase.
  const scrubberStart = cueFrame(cues, 'push-in-scrubber', fps, Math.round(3.23 * fps));
  const ledgerStart = cueFrame(
    cues,
    'pan-to-ledger',
    fps,
    cueFrame(cues, 'pan-to-ledger-fallback', fps, Math.round(6.35 * fps)),
  );
  const pullBackStart = cueFrame(
    cues,
    'pull-back-full',
    fps,
    cueFrame(cues, 'pull-back-full-fallback', fps, Math.round(9.63 * fps)),
  );

  // A 1080p-final render (fps===30, per render-scenes.sh's profile coupling)
  // caps the scrubber push-in at 2.0x to stay sharp; the 360p draft
  // (fps===15) can push further to 2.2x (Liam round 2 brief). The ledger
  // pan is capped at 2.0x at every profile.
  const scrubberScale = fps === 30 ? 2.0 : 2.2;

  const moves: RostrumMove[] = [
    {
      startFrame: scrubberStart,
      durationInFrames: Math.round(0.9 * fps),
      target: {xFrac: 0.19, yFrac: 0.87, scale: scrubberScale}, // day counter + scrubber start/playhead, bottom-left
    },
    {
      startFrame: ledgerStart,
      durationInFrames: Math.round(1.1 * fps),
      target: {xFrac: 0.87, yFrac: 0.4, scale: 2.0}, // transactions/payment-flow column, right side
    },
    {
      startFrame: pullBackStart,
      durationInFrames: Math.round(1.0 * fps),
      target: FULL_FRAME,
    },
  ];

  const camera = cameraAt(frame, moves);

  return (
    <CaptureScene
      src={cap.src}
      captureDurationInFrames={cap.captureDurationInFrames}
      startFrom={cap.startFrom}
      mode={sc.frame as FrameMode}
      progress={progress}
      videoStyle={cameraStyle(camera)}
    />
  );
};

/** A pure motion-graphic scene, framed per framingRamp (no capture underneath). */
const GraphicBeat: React.FC<{sc: SceneDef; duration: number; children: React.ReactNode}> = ({
  sc,
  duration,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = framingRamp(sc, frame, duration, fps);
  return (
    <BrowserFrame mode={sc.frame as FrameMode} progress={progress}>
      {children}
    </BrowserFrame>
  );
};

/** dB -> linear gain; 0dB (the default) is unity, matching Audio's own un-set volume. */
const dbToVolume = (gainDb: number): number => 10 ** (gainDb / 20);

const SceneVO: React.FC<{num: number; narration: NarrationMap; narrationControls: NarrationControls}> = ({
  num,
  narration,
  narrationControls,
}) => {
  const entry = narration[num];
  if (!entry) return null;
  const {fps} = useVideoConfig();
  const controls = narrationControls[num - 1] ?? DEFAULT_NARRATION_CONTROLS[num - 1];

  const offsetFrames = Math.round(controls.offsetSec * fps);
  const trimBefore = Math.round(controls.trimStartSec * fps);
  // trimAfter is an ABSOLUTE frame position into the raw clip (see
  // calculate-media-duration.js), not a duration trimmed off the end —
  // so "cut trimEndSec off the end" is rawDurationInFrames minus that,
  // never below trimBefore.
  const trimAfter = Math.max(
    trimBefore,
    entry.rawDurationInFrames - Math.round(controls.trimEndSec * fps),
  );
  const volume = dbToVolume(controls.gainDb);

  return (
    // from can be negative: a negative offsetSec means the clip is already
    // partway through by the time the scene starts, not that it plays
    // before the scene's own Series.Sequence exists.
    <Sequence from={offsetFrames} durationInFrames={Infinity} layout="none">
      <Audio
        src={staticFile(`narration/${entry.file}`)}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        volume={volume}
      />
    </Sequence>
  );
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

export const CascadeFilm: React.FC<CascadeFilmProps> = ({
  narration,
  captureOverrides,
  narrationControls,
  reviewLabels = false,
}) => {
  const {fps} = useVideoConfig();
  const durations = resolveSceneDurations(narration, fps);

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
          {(() => {
            const sc1 = sceneByNum(1);
            const cap1 = captureFor(sc1, captureOverrides, durations[0]);
            const revealFrame1 = cueFrame(
              CUE_TIMES[1],
              'phone-reveal',
              fps,
              cueFrame(CUE_TIMES[1], 'phone-reveal-fallback', fps, scene1PhoneRevealFrame(durations[0])),
            );
            // The strobe pre-roll (SCENE1_STROBE_TOTAL_MS, cues.ts's
            // 'phone-reveal' cue minus this) has to run BEFORE the cue
            // lands, so the overlay's own Sequence starts earlier than the
            // landing frame — PhoneRevealOverlay receives how many local
            // frames until landing via cueFrame1 (clamped at the top of the
            // scene if the cue resolves very early).
            const strobeLeadFrames = Math.round((SCENE1_STROBE_TOTAL_MS / 1000) * fps);
            const overlayStart1 = Math.max(0, revealFrame1 - strobeLeadFrames);
            return (
              <>
                <Scene1AppWindow cap={cap1} />
                <Sequence from={overlayStart1} durationInFrames={durations[0] - overlayStart1} layout="none">
                  <PhoneRevealOverlay cueFrame={revealFrame1 - overlayStart1} />
                </Sequence>
              </>
            );
          })()}
          <SceneVO num={1} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 2 — The hook" durationInFrames={durations[1]}>
          {(() => {
            const sc = sceneByNum(2);
            const cap = captureFor(sc, captureOverrides, durations[1]);
            // Capture (Apple Park orbit -> arch swoop -> pull-out to Earth
            // with the HUD) is unchanged — product owner's round-2 brief
            // (2026-09-13) only replaces the OLD narration overlay (there
            // wasn't one) with the Hook beats/citation chips on top of it.
            const hook = (
              <Hook durationInFrames={durations[1]} cues={CUE_TIMES[2]} sceneStartFrame={durations[0]} />
            );
            return cap ? (
              <CaptureBeat sc={sc} duration={durations[1]} cap={cap}>
                {hook}
              </CaptureBeat>
            ) : (
              <GraphicBeat sc={sc} duration={durations[1]}>
                {hook}
              </GraphicBeat>
            );
          })()}
          <SceneVO num={2} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 3 — Rewind" durationInFrames={durations[2]}>
          <RewindSequence durationInFrames={durations[2]} cues={CUE_TIMES[3]} />
          <SceneVO num={3} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 4 — The hidden supply chain" durationInFrames={durations[3]}>
          {(() => {
            const sc = sceneByNum(4);
            const cap = captureFor(sc, captureOverrides, durations[3]);
            return cap ? <CaptureBeat sc={sc} duration={durations[3]} cap={cap} /> : null;
          })()}
          <SceneVO num={4} narration={narration} narrationControls={narrationControls} />
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
            const overlay = captureOverrides[5] ? null : <ContradictionOverlay durationInFrames={durations[4]} cues={CUE_TIMES[5]} />;
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
          <SceneVO num={5} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 6 — The question" durationInFrames={durations[5]}>
          <GraphicBeat sc={sceneByNum(6)} duration={durations[5]}>
            <TheQuestion durationInFrames={durations[5]} cues={CUE_TIMES[6]} />
          </GraphicBeat>
          <SceneVO num={6} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 7 — The cascade" durationInFrames={durations[6]}>
          {(() => {
            const sc = sceneByNum(7);
            const cap = captureFor(sc, captureOverrides, durations[6]);
            return cap ? <CaptureBeat sc={sc} duration={durations[6]} cap={cap} /> : null;
          })()}
          <SceneVO num={7} narration={narration} narrationControls={narrationControls} />
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
                {!captureOverrides[8] && <Scene08Counters durationInFrames={durations[7]} cues={CUE_TIMES[8]} />}
              </CaptureBeat>
            ) : null;
          })()}
          <SceneVO num={8} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 9 — Run the year" durationInFrames={durations[8]}>
          {(() => {
            const sc = sceneByNum(9);
            const cap = captureFor(sc, captureOverrides, durations[8]);
            return cap ? <Scene9Capture sc={sc} duration={durations[8]} cap={cap} /> : null;
          })()}
          <SceneVO num={9} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 10 — A dollar with a date" durationInFrames={durations[9]}>
          {(() => {
            const sc = sceneByNum(10);
            const cap = captureFor(sc, captureOverrides, durations[9]);
            return cap ? <CaptureBeat sc={sc} duration={durations[9]} cap={cap} /> : null;
          })()}
          <SceneVO num={10} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 11 — Underneath it" durationInFrames={durations[10]}>
          {(() => {
            const sc = sceneByNum(11);
            const cap = captureFor(sc, captureOverrides, durations[10]);
            return cap ? <CaptureBeat sc={sc} duration={durations[10]} cap={cap} /> : null;
          })()}
          <SceneVO num={11} narration={narration} narrationControls={narrationControls} />
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
                {!captureOverrides[12] && <Scene12Stress durationInFrames={durations[11]} cues={CUE_TIMES[12]} />}
              </CaptureBeat>
            ) : null;
          })()}
          <SceneVO num={12} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 13 — The rules survive" durationInFrames={durations[12]}>
          {(() => {
            const sc = sceneByNum(13);
            const cap = captureFor(sc, captureOverrides, durations[12]);
            // scene-13 recapture already burns in "Nothing counted twice."
            // plus the ownership/yield/operations laws (app's 'laws'
            // overlay). ConservationLaws duplicates that; render it only
            // in the fallback path.
            const overlay = captureOverrides[13] ? null : <ConservationLaws durationInFrames={durations[12]} cues={CUE_TIMES[13]} />;
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
          <SceneVO num={13} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 14 — Zoom out" durationInFrames={durations[13]}>
          {(() => {
            const sc = sceneByNum(14);
            const cap = captureFor(sc, captureOverrides, durations[13]);
            // scene-14 recapture already burns in "Composable." plus the
            // Loans/Forwards/Bonds/Derivatives + "Money plus time" beats
            // (app's 'composable' overlay). Scene14ZoomOut duplicates that;
            // render it only in the fallback path.
            const overlay14 = captureOverrides[14] ? null : <Scene14ZoomOut durationInFrames={durations[13]} cues={CUE_TIMES[14]} />;
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
          <SceneVO num={14} narration={narration} narrationControls={narrationControls} />
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
          <SceneVO num={15} narration={narration} narrationControls={narrationControls} />
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
          />
          <SceneVO num={16} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 17 — Close" durationInFrames={durations[16]}>
          <Scene17Close durationInFrames={durations[16]} />
          <SceneVO num={17} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>
      </Series>
      {reviewLabels ? <ReviewLabelOverlay durations={durations} /> : null}
    </AbsoluteFill>
  );
};

/**
 * Scene 1's narration (script-v6-liam.md, Scene 1 — "The object of desire")
 * is two lines:
 *   "After years of rumors, leaked documents, and patent filings…" (9 words)
 *   "the iPhone Duo launches Monday." (5 words)
 * The phone photo is the film's first mention of the product by name, so it
 * must not be on screen for the lead-in line — it reveals exactly when the
 * narration reaches "the iPhone Duo launches Monday," not at the scene's
 * (and film's) frame 0. This word-count split is now only the FALLBACK for
 * cueFrame() (cues.ts's 'phone-reveal' cue, scene 1) — used only when
 * generated/cues.json has no resolved timestamp for this scene (missing
 * words file, or a re-narration that no longer says "iPhone" at all).
 */
const SCENE1_PRE_MENTION_WORDS = 9;
const SCENE1_MENTION_WORDS = 5;
const scene1PhoneRevealFrame = (scene1DurationInFrames: number): number =>
  Math.round(
    (scene1DurationInFrames * SCENE1_PRE_MENTION_WORDS) /
      (SCENE1_PRE_MENTION_WORDS + SCENE1_MENTION_WORDS),
  );

/** Scene 15's held-photo beat — settled, no tilt gesture (scene 1 no longer uses PhoneHero; see PhoneRevealOverlay below). */
const PhoneHeroScene: React.FC<{durationInFrames: number; finished?: boolean}> = ({durationInFrames}) => {
  const frame = useCurrentFrame();
  return <PhoneHero frame={frame} durationInFrames={durationInFrames} tilt={1} />;
};

/**
 * Scene 1's opening beat — full-bleed app capture (which itself now opens on
 * a near-black loading frame and resolves into the live dashboard, verified
 * on the current public/captures/scene-01.mp4, 2026-09-13) that pulls back
 * over the first ~1.2s into a LEFT-anchored window, per the product owner's
 * round-3 brief (2026-09-13 v2): "fake browser UI that floats towards left
 * side of screen, right edge slightly skewed back giving perspective view."
 * BrowserFrame's 'framed'/chrome="browser" pull-back scale is overridden via
 * its optional targetScale/anchorLeftFrac/skewYDeg/perspectivePx props (all
 * default to the old centred/flat 5%-padding look, so every other caller —
 * there are none on chrome="browser" today, but the props stay opt-in on
 * principle — is unaffected) to settle at ~62% frame width, ~4% left
 * margin, rotateY -8° (right edge recedes into perspective 1800px).
 */
const SCENE1_PULLBACK_FRAMES_AT_30 = 36; // ~1.2s ease into the framed window
const SCENE1_WINDOW_TARGET_SCALE = 0.62; // ~62% of frame width
const SCENE1_WINDOW_LEFT_MARGIN_FRAC = 0.04; // ~4% left margin
const SCENE1_WINDOW_SKEW_DEG = -8; // rotateY at settle — right edge recedes
const SCENE1_WINDOW_PERSPECTIVE_PX = 1800;

const Scene1AppWindow: React.FC<{
  cap: {src: string; captureDurationInFrames: number; startFrom: number} | null;
}> = ({cap}) => {
  const {fps} = useVideoConfig();
  const pullbackFrames = at30(SCENE1_PULLBACK_FRAMES_AT_30, fps);
  const progress = interpolate(useCurrentFrame(), [0, pullbackFrames], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });

  const video = cap ? (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(`captures/${cap.src}`)} startFrom={cap.startFrom} />
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{background: color.bgOuter}} />
  );

  return (
    <BrowserFrame
      mode="framed"
      progress={progress}
      chrome="browser"
      targetScale={SCENE1_WINDOW_TARGET_SCALE}
      anchorLeftFrac={SCENE1_WINDOW_LEFT_MARGIN_FRAC}
      skewYDeg={SCENE1_WINDOW_SKEW_DEG}
      perspectivePx={SCENE1_WINDOW_PERSPECTIVE_PX}
    >
      {video}
    </BrowserFrame>
  );
};

/**
 * Scene 1's product reveal (round 3, product owner's brief 2026-09-13 v2):
 * "On right side of screen, slight overlap in front of the window flashes
 * in, faster and faster like horror build up the picture of new iPhone,
 * before fully appearing and remaining once narration says 'foldable
 * iPhone'." Rendered as a sibling AFTER Scene1AppWindow (not nested in its
 * BrowserFrame), so it sits unclipped and in front of the whole window.
 *
 * The phone sits at ~80% frame height on the right, positioned so its own
 * left ~12% overlaps IN FRONT of the (now left-anchored, ~62%-wide)
 * window's right edge — see Scene1AppWindow's SCENE1_WINDOW_* constants,
 * which this reads to place that overlap correctly.
 *
 * `cueFrame` (prop) is the LOCAL frame — inside this component's own
 * Sequence — at which the reveal lands (i.e. the narration cue point); the
 * Sequence itself starts SCENE1_STROBE_TOTAL_MS earlier so the whole strobe
 * pre-roll finishes exactly on that frame. Before it: a hard on/off strobe
 * whose gaps shrink geometrically (SCENE1_STROBE_GAPS_MS), each flash a
 * plain opacity snap to 1 (no fade) tinted with a faint white overlay — no
 * other color shift, no shake, no unfold/skew on the image itself. On and
 * after the cue: full opacity with a quick 120ms scale settle (1.03->1.0),
 * then held.
 */
const SCENE1_PHONE_HEIGHT_FRAC = 0.8; // of the 1080-tall frame
const SCENE1_PHONE_ASPECT = 1429 / 1101; // public/assets/iphone-duo-hands.png
// Gaps (ms) between successive strobe flashes, shrinking geometrically; the
// final entry is the gap from the last flash to the landing cue itself.
const SCENE1_STROBE_GAPS_MS = [700, 480, 330, 230, 160, 110, 80];
const SCENE1_STROBE_FLASH_STARTS_MS: number[] = [0];
for (let i = 1; i < SCENE1_STROBE_GAPS_MS.length; i++) {
  SCENE1_STROBE_FLASH_STARTS_MS.push(SCENE1_STROBE_FLASH_STARTS_MS[i - 1] + SCENE1_STROBE_GAPS_MS[i - 1]);
}
const SCENE1_STROBE_TOTAL_MS =
  SCENE1_STROBE_FLASH_STARTS_MS[SCENE1_STROBE_FLASH_STARTS_MS.length - 1] +
  SCENE1_STROBE_GAPS_MS[SCENE1_STROBE_GAPS_MS.length - 1];
const SCENE1_STROBE_FLASH_ON_MS = 60; // each hard-flash's own on-duration
const SCENE1_LAND_SETTLE_MS = 120; // scale 1.03 -> 1.0 once landed

const PhoneRevealOverlay: React.FC<{cueFrame: number}> = ({cueFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const cueMs = (cueFrame / fps) * 1000;

  let opacity = 0;
  let flashTint = 0;
  let scale = 1;

  if (ms < cueMs) {
    // Pre-cue: hard on/off strobe, accelerating toward the cue.
    for (const startMs of SCENE1_STROBE_FLASH_STARTS_MS) {
      if (ms >= startMs && ms < startMs + SCENE1_STROBE_FLASH_ON_MS) {
        opacity = 1;
        flashTint = 1;
        break;
      }
    }
  } else {
    // Landed: full opacity, brief scale settle, then held.
    opacity = 1;
    const settleP = interpolate(ms - cueMs, [0, SCENE1_LAND_SETTLE_MS], [0, 1], {
      ...CLAMP,
      easing: Easing.out(Easing.cubic),
    });
    scale = 1.03 - 0.03 * settleP;
  }

  const height = 1080 * SCENE1_PHONE_HEIGHT_FRAC;
  const width = height * SCENE1_PHONE_ASPECT;
  // Window's settled right edge (Scene1AppWindow's SCENE1_WINDOW_* consts):
  // left margin + width, in the same 1920-wide frame. The phone's left
  // edge sits 12% of its own width inside that (overlapping IN FRONT of
  // the window), the rest extending right.
  const windowRightEdgePx = 1920 * (SCENE1_WINDOW_LEFT_MARGIN_FRAC + SCENE1_WINDOW_TARGET_SCALE);
  const overlapFrac = 0.12;
  const leftPx = windowRightEdgePx - overlapFrac * width;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: leftPx,
          width,
          height,
          opacity,
          transform: `translateY(-50%) scale(${scale})`,
        }}
      >
        <Img
          src={staticFile('assets/iphone-duo-hands.png')}
          style={{width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.5))'}}
        />
        {flashTint > 0 ? (
          <AbsoluteFill style={{background: `rgba(255,255,255,${0.35 * flashTint})`, mixBlendMode: 'screen'}} />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
