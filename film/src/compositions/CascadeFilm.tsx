/**
 * CascadeFilm — the root composition, rebuilt for the product owner's final
 * v6 narration (docs/script-v6-liam.md, Stage 12 remap; reordered/renumbered
 * to 13 scenes 2026-09-13). 13 scenes via
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
import React, {Suspense} from 'react';
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
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
import {color, font} from '../brand/tokens';
import {CaptureScene} from '../components/CaptureScene';
import {BrowserFrame, FrameMode} from '../components/BrowserFrame';
import {resolveSceneDurations, SCENES, SceneDef, sceneByNum} from './schedule';
import {captureFileFor, NarrationMap} from './narration';
import {DEFAULT_NARRATION_CONTROLS, NarrationControls} from './narrationControlsSchema';
import {at30, CLAMP} from '../motion/timing';
import {cameraAt, cameraStyle, FULL_FRAME, RostrumMove} from '../motion/rostrumCamera';
import {cueFrame} from '../cues';
import cueTimesData from '../generated/cues.json';

import {TheQuestion} from './motion-graphics/TheQuestion';
import {Scene08Counters} from './motion-graphics/Scene08Counters';
import {Scene14ZoomOut} from './motion-graphics/Scene14ZoomOut';
import {Scene11Receipt} from './motion-graphics/Scene11Receipt';
import {Scene12Close} from './motion-graphics/Scene12Close';
import {Hook} from './motion-graphics/Hook';
import type {AppFrameProps} from '../live/AppFrame';

ensureFontsLoaded();

/**
 * The live app (`@cascade-app/*`, aliased to app/src — see film/tsconfig.json)
 * is only ever needed on the `source==='live'` path; `--source captures`
 * renders (draft parts, most of render-scenes.sh) never touch it. A STATIC
 * `import {AppFrame} from '../live/AppFrame'` used to pull the whole app
 * module graph into every bundle regardless of source, which breaks a
 * captures-only render on any checkout where app/ is stale or missing (a
 * dev-mac render dir has hit "Can't resolve '@cascade-app/styles.css'" this
 * way — RENDER DIR UPDATE note, scene-owner-brief-template.md). `React.lazy`
 * defers the import() to first use (i.e. only when source==='live' actually
 * renders <LiveAppFrame>), so a captures-only bundle never resolves it.
 *
 * Suspense alone doesn't make Remotion's headless-Chrome render WAIT for the
 * lazy chunk before capturing a frame — that needs its own delayRender/
 * continueRender handle (same pattern as brand/fonts.ts's FontFace loading).
 * The handle is tied to the SAME import() promise React.lazy resolves
 * (dynamic import() is cached per specifier, so calling it again here is a
 * cache hit, not a second fetch) so "the module has loaded" means the same
 * thing to both Remotion and React.
 */
const importAppFrame = () => import('../live/AppFrame');
const LazyAppFrame = React.lazy(() =>
  importAppFrame().then((m) => ({default: m.AppFrame})),
);

const LiveAppFrame: React.FC<AppFrameProps> = (props) => {
  const [handle] = React.useState(() => delayRender('Loading live AppFrame module'));
  React.useEffect(() => {
    importAppFrame()
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
  return (
    <Suspense fallback={null}>
      <LazyAppFrame {...props} />
    </Suspense>
  );
};

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
  source?: 'live' | 'captures';
}

export type FilmSource = 'live' | 'captures';

/** Every named slide-reveal/card timestamp resolved from narration word timings — see cues.ts and scripts/cues-from-words.mjs. */
const CUE_TIMES = cueTimesData as Record<number, Record<string, number>>;

/**
 * A scene's resolved Sequence duration, looked up by scene NUM rather than
 * array position. SCENES is both non-contiguous in num (old scenes 3, 5, 12,
 * 13 are cut entirely — see schedule.ts) AND reordered from the original
 * v6 script order (old scene 9 "Run the year" now plays after old 10/11,
 * not before — reorder-to-13 pass, 2026-09-13), so neither `sceneIndex-1`
 * nor the scene's own historical position is a valid array index.
 * `resolveSceneDurations` returns an array parallel
 * to SCENES itself (same order, same length), so this always resolves the
 * right entry regardless of which scenes exist.
 */
const durationFor = (durations: number[], num: number): number => {
  const idx = SCENES.findIndex((s) => s.num === num);
  if (idx === -1) throw new Error(`unknown scene num ${num}`);
  return durations[idx];
};

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

/** Is the scene at this SCENES[] array position 'framed'? Out-of-range (before the first/after the last scene) reads as not-framed — there is no neighbor to ramp from/to. */
const isFramedAtIndex = (idx: number): boolean =>
  idx >= 0 && idx < SCENES.length && SCENES[idx].frame === 'framed';

/**
 * Local-frame progress (0=bleed/tilt-out, 1=framed) for a scene's own
 * BrowserFrame. Enter/exit ramps to whatever scene is actually ADJACENT in
 * SCENES[] (previous/next array position) — not sc.num-1/sc.num+1, which
 * would misfire the moment SCENES is reordered or has a gap (scene 2's real
 * neighbor is now scene 3, not scene 4).
 */
const framingRamp = (sc: SceneDef, localFrame: number, durationInFrames: number, fps: number): number => {
  const ramp = at30(RAMP_AT_30, fps);
  const target = sc.frame === 'framed' ? 1 : 0;
  const idx = SCENES.findIndex((s) => s.num === sc.num);
  const enterFrom = isFramedAtIndex(idx - 1) ? 1 : 0;
  const exitTo = isFramedAtIndex(idx + 1) ? 1 : 0;

  if (localFrame < ramp && enterFrom !== target) {
    return enterFrom + (target - enterFrom) * (localFrame / ramp);
  }
  if (localFrame > durationInFrames - ramp && exitTo !== target) {
    const t = (localFrame - (durationInFrames - ramp)) / ramp;
    return target + (exitTo - target) * Math.max(0, Math.min(1, t));
  }
  return target;
};

// Scenes 4/10 retain their authored framing; 9 retains its rostrum camera.
// Scene 12 is intentionally excluded: it authors a closing card, not an app capture.
const WINDOWED_SCENES = new Set([2, 3, 5, 6, 7, 8, 11]);
const WINDOW_TARGET_SCALE = 0.62;
// At progress=1: left=19%, width=62%, right=19% (364.8px each at 1920px).
const WINDOW_CENTER_ANCHOR_FRAC = (1 - WINDOW_TARGET_SCALE) / 2;
const WINDOW_SKEW_DEG = 0;
const WINDOW_PERSPECTIVE_PX = 1800;
type SceneCapture = {src: string; captureDurationInFrames: number; startFrom: number};

/** App content is windowed; film overlays retain full-frame coordinates and timing. */
const WindowedBeat: React.FC<{
  cap?: SceneCapture | null;
  app?: React.ReactNode;
  children?: React.ReactNode;
}> = ({cap, app, children}) => (
  <>
    <BrowserFrame
      mode="framed"
      progress={1}
      chrome="browser"
      targetScale={WINDOW_TARGET_SCALE}
      anchorLeftFrac={WINDOW_CENTER_ANCHOR_FRAC}
      skewYDeg={WINDOW_SKEW_DEG}
      perspectivePx={WINDOW_PERSPECTIVE_PX}
    >
      {app ?? (cap ? <CaptureScene {...cap} mode="bleed" /> : <AbsoluteFill style={{background: color.bgOuter}} />)}
    </BrowserFrame>
    {children}
  </>
);

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
  if (WINDOWED_SCENES.has(sc.num)) {
    return <WindowedBeat cap={cap}>{children}</WindowedBeat>;
  }
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
  if (WINDOWED_SCENES.has(sc.num)) {
    return <WindowedBeat>{children}</WindowedBeat>;
  }
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
    <>
      <Sequence from={offsetFrames} durationInFrames={Infinity} layout="none">
        <Audio
          src={staticFile(`narration/${entry.file}`)}
          trimBefore={trimBefore}
          trimAfter={trimAfter}
          volume={volume}
        />
      </Sequence>
      {/* Scene 1 two-part narration (round 4): the Kokoro tail plays after
          `entry.file` + the fixed gap — see narration.ts's tailOffsetInFrames.
          Absent for every other scene (and for scene 1 until both parts
          exist), so this is a no-op everywhere else. */}
      {entry.tailFile && entry.tailOffsetInFrames !== undefined ? (
        <Sequence from={offsetFrames + entry.tailOffsetInFrames} durationInFrames={Infinity} layout="none">
          <Audio src={staticFile(`narration/${entry.tailFile}`)} volume={volume} />
        </Sequence>
      ) : null}
    </>
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

/**
 * Scene 4's opening date/location corner label (Director's addition,
 * product owner decision 2026-09-13 02:13 ET, reply 21837): with scene 3
 * (Rewind's date card) cut, scene 4 now opens with no on-screen date at
 * all, so a small static corner label carries it instead — in the app's
 * own location-corner-label convention (app/src/director/SceneLabels.tsx's
 * `.scene-location`: top-left, small type, dark text-shadow for legibility
 * over any capture), but as a FILM overlay: top-left, one line, static (no
 * enter animation) for the first ~4s of the scene, then fades out over
 * 400ms. Never re-appears after that.
 */
const SCENE4_LABEL_TEXT = 'September 9, 2025 · Cupertino';
const SCENE4_LABEL_HOLD_SECONDS = 4;
const SCENE4_LABEL_FADE_MS = 400;

const Scene4DateCornerLabel: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const holdFrames = Math.round(SCENE4_LABEL_HOLD_SECONDS * fps);
  const fadeFrames = Math.round((SCENE4_LABEL_FADE_MS / 1000) * fps);
  const opacity = interpolate(frame, [holdFrames, holdFrames + fadeFrames], [1, 0], CLAMP);
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          top: 28,
          left: 28,
          opacity,
          color: color.fg,
          fontFamily: font.family,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: 0.1,
          textShadow: '0 2px 10px #000, 0 0 20px #000',
        }}
      >
        {SCENE4_LABEL_TEXT}
      </div>
    </AbsoluteFill>
  );
};

/**
 * The example's two globe labels (reorder-to-13 pass, 2026-09-13): "The
 * hidden supply chain" scene names Apple's payment terms with Samsung and
 * Samsung's own payment terms with Corning; these two chips make the
 * mismatch legible on the globe itself, at the scene's own last line (cue
 * phrase "obligation", falling back to "waits" if a re-narration drops that
 * word — see cues.ts). A FILM overlay, not an app-drawn one: neither the
 * live globe nor the capture already burns these in, so this always
 * renders regardless of which visual layer is under it. Fixed screen
 * position (not projected onto the 3D marker) matching Scene4DateCornerLabel's
 * own convention for this scene.
 */
const EXAMPLE_LABEL_FADE_MS = 400;

const ExampleGlobeLabels: React.FC<{durationInFrames: number; cues?: Record<string, number>}> = ({cues}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const revealFrame = cueFrame(cues, 'example-labels', fps, cueFrame(cues, 'example-labels-fallback', fps, 0));
  const fadeFrames = Math.round((EXAMPLE_LABEL_FADE_MS / 1000) * fps);
  const opacity = interpolate(frame, [revealFrame, revealFrame + fadeFrames], [0, 1], CLAMP);
  if (opacity <= 0) return null;
  const chip = (): React.CSSProperties => ({
    position: 'absolute',
    opacity,
    padding: '8px 16px',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.75)',
    color: color.white,
    fontFamily: font.family,
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: 0.6,
    whiteSpace: 'nowrap',
  });
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{...chip(), top: '38%', left: '58%'}}>FROM APPLE · LATER</div>
      <div style={{...chip(), top: '58%', left: '68%'}}>PAYMENT NEEDED · TODAY</div>
    </AbsoluteFill>
  );
};

/**
 * Scene 9's closing beat (reorder-to-13 pass, 2026-09-13, product owner +
 * Director/wingman 03:33 ET): old scenes 12 (Stress test) and 13 (The rules
 * survive) are CUT as standalone scenes, but their verified headline figure
 * ("10,000 operations, 0 hard-invariant violations" — docs/verified-figures-v6.md)
 * survives as a ~2.5s flash card at the tail of scene 9 (Run the year), as
 * the year view recedes. Not narration-keyed (no VO recorded for this line
 * yet): it simply fills schedule.ts's SCENE9_CLOSE_FLASH_SECONDS window at
 * the end of the scene's own resolved duration.
 */
const STRESS_FLASH_SECONDS = 2.5;
const STRESS_FLASH_FADE_MS = 350;

const StressResultFlash: React.FC<{durationInFrames: number; cues?: Record<string, number>}> = ({
  durationInFrames,
  cues,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const flashFrames = Math.round(STRESS_FLASH_SECONDS * fps);
  const fadeFrames = Math.round((STRESS_FLASH_FADE_MS / 1000) * fps);
  // Keys to the recorded "Separately, we tested..." line (cues.ts's
  // `stress-flash` on "Separately", fallback `stress-flash-fallback` on
  // "tested") — falls back to the scene's own fixed tail-length offset
  // when neither resolves (missing words file, or a re-narration that
  // drops both words).
  const flashStart = cueFrame(
    cues,
    'stress-flash',
    fps,
    cueFrame(cues, 'stress-flash-fallback', fps, durationInFrames - flashFrames),
  );
  const opacity = interpolate(
    frame,
    [flashStart, flashStart + fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    CLAMP,
  );
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{display: 'grid', placeItems: 'center', background: 'rgba(6,17,27,0.55)', opacity}}>
      <div style={{textAlign: 'center', maxWidth: 900, padding: '0 40px'}}>
        <p style={{fontFamily: font.family, fontSize: 30, fontWeight: 500, color: color.fg, lineHeight: 1.35, margin: 0}}>
          Separately, we tested ten thousand operations with zero accounting invariant violations.
        </p>
        <div style={{marginTop: 18, fontFamily: font.family, fontSize: 16, letterSpacing: 2, fontWeight: 600, color: color.money}}>
          10,000 OPERATIONS · 0 VIOLATIONS
        </div>
      </div>
    </AbsoluteFill>
  );
};

export interface CascadeLiveSceneProps extends Record<string, unknown> {
  sceneIndex: number;
  fps?: 15 | 30;
  source?: FilmSource;
  narration?: NarrationMap;
  captureOverrides?: Record<number, boolean>;
  narrationControls?: NarrationControls;
  includeAudio?: boolean;
}

/** A scene-local render target. App visuals own app overlays; film-only layers remain above them. */
export const CascadeLiveScene: React.FC<CascadeLiveSceneProps> = ({
  sceneIndex,
  source = 'live',
  narration = {},
  captureOverrides = {},
  narrationControls = DEFAULT_NARRATION_CONTROLS,
  includeAudio = true,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const durations = resolveSceneDurations(narration, fps);
  // Look up by scene NUM, not array position — scene 3 is cut, so SCENES
  // (and the `durations` array parallel to it) has a gap and `sceneIndex-1`
  // would silently read the wrong neighbor's duration for every scene from
  // 4 onward (crashing outright once sceneIndex runs off the end, at 17).
  const duration = durationFor(durations, sceneIndex);
  const sc = sceneByNum(sceneIndex);
  const progress = framingRamp(sc, frame, duration, fps);
  const loadingFrames = sceneIndex === 1 ? fps : 0;
  let filmOverlay: React.ReactNode = null;
  if(sceneIndex===2) filmOverlay=<Hook durationInFrames={duration} cues={CUE_TIMES[2]} sceneStartFrame={durations[0]} />;
  else if(sceneIndex===4) filmOverlay=<TheQuestion durationInFrames={duration} cues={CUE_TIMES[4]} />;
  else if(sceneIndex===9) filmOverlay=<StressResultFlash durationInFrames={duration} cues={CUE_TIMES[9]} />;
  // Scene 3 (renumbered from old scene 4) has NO live-path film overlay:
  // Scene4DateCornerLabel/ExampleGlobeLabels are screen-space overlays that
  // collide with the live app's own top-left HUD text there (e2cb199) —
  // they render only on the captures path (see the Series.Sequence below).

  let visual: React.ReactNode;
  if(sceneIndex===11){
    visual=<Scene11Receipt durationInFrames={duration} cues={CUE_TIMES[11]} />;
  }else if(sceneIndex===12){
    visual=<Scene12Close durationInFrames={duration} />;
  }else if(source==='live'){
    const app=<LiveAppFrame scene={sceneIndex} loadingFrames={loadingFrames} absoluteTimeline />;
    if(sceneIndex===1){
      visual=<Scene1Beat duration={duration} app={app} phoneEarliestFrame={loadingFrames} />;
    }else if(WINDOWED_SCENES.has(sceneIndex)){
      visual=<WindowedBeat app={app}>{filmOverlay}</WindowedBeat>;
    }else visual=<BrowserFrame mode={sc.frame as FrameMode} progress={progress}>{app}{filmOverlay}</BrowserFrame>;
  }else{
    const cap=captureFor(sc,captureOverrides,duration);
    if (sceneIndex === 1) {
      visual = <Scene1Beat duration={duration} cap={cap} />;
    } else {
      visual = cap ? (
        <CaptureBeat sc={sc} duration={duration} cap={cap}>{filmOverlay}</CaptureBeat>
      ) : (
        <GraphicBeat sc={sc} duration={duration}>{filmOverlay ?? <AbsoluteFill />}</GraphicBeat>
      );
    }
  }
  // NOTE: the captures path draws Scene4DateCornerLabel and ExampleGlobeLabels
  // as siblings of the capture (see below); the live path deliberately does
  // NOT — the live app's own top-left HUD text (site legend / network
  // labels) occupies the same screen-space corner at this point in scene 3
  // (renumbered from old scene 4) and visually collides with
  // Scene4DateCornerLabel into an illegible overlap (e2cb199). Kept both
  // overlays together here rather than re-splitting them, since
  // ExampleGlobeLabels' own on-globe markers (Samsung/Corning) also sit in
  // the live HUD's working area — production stays on the captures path
  // for scene 3's screen-space labels until that's chased further.
  return <AbsoluteFill style={{background:color.bgOuter}}>{visual}{includeAudio?<SceneVO num={sceneIndex} narration={narration} narrationControls={narrationControls}/>:null}</AbsoluteFill>;
};

export const CascadeFilm: React.FC<CascadeFilmProps> = ({
  narration,
  captureOverrides,
  narrationControls,
  reviewLabels = false,
  source = 'live',
}) => {
  const {fps} = useVideoConfig();
  const durations = resolveSceneDurations(narration, fps);

  if(source==='live')return <AbsoluteFill style={{background:color.bgOuter}}><Series>{SCENES.map((sc,index)=><Series.Sequence key={sc.id} name={`Scene ${sc.num} — ${sc.title}`} durationInFrames={durations[index]}><CascadeLiveScene sceneIndex={sc.num} source="live" narration={narration} captureOverrides={captureOverrides} narrationControls={narrationControls}/></Series.Sequence>)}</Series>{reviewLabels?<ReviewLabelOverlay durations={durations}/>:null}</AbsoluteFill>;

  const dur11 = durationFor(durations, 11);
  const dur12 = durationFor(durations, 12);

  return (
    <AbsoluteFill style={{background: color.bgOuter}}>
      <Series>
        <Series.Sequence name="Scene 1 — The object of desire" durationInFrames={durationFor(durations, 1)}>
          {(() => {
            const sc1 = sceneByNum(1);
            const dur1 = durationFor(durations, 1);
            const cap1 = captureFor(sc1, captureOverrides, dur1);
            return <Scene1Beat duration={dur1} cap={cap1} />;
          })()}
          <SceneVO num={1} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 2 — The hook" durationInFrames={durationFor(durations, 2)}>
          {(() => {
            const sc = sceneByNum(2);
            const dur2 = durationFor(durations, 2);
            const cap = captureFor(sc, captureOverrides, dur2);
            // Capture (Apple Park orbit -> arch swoop -> pull-out to Earth
            // with the HUD) is unchanged — product owner's round-2 brief
            // (2026-09-13) only replaces the OLD narration overlay (there
            // wasn't one) with the Hook beats/citation chips on top of it.
            const hook = (
              <Hook durationInFrames={dur2} cues={CUE_TIMES[2]} sceneStartFrame={durationFor(durations, 1)} />
            );
            return cap ? (
              <CaptureBeat sc={sc} duration={dur2} cap={cap}>
                {hook}
              </CaptureBeat>
            ) : (
              <GraphicBeat sc={sc} duration={dur2}>
                {hook}
              </GraphicBeat>
            );
          })()}
          <SceneVO num={2} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        {/*
         * Old scenes 3 (Rewind) and 5 (The contradiction) are both CUT —
         * Rewind per product owner decision 2026-09-13 02:13 ET (reply
         * 21837), the contradiction per the reorder-to-13 pass (2026-09-13,
         * Director authorization). The film goes straight from scene 2 into
         * scene 3 below (renumbered from old scene 4); scene 2's own VO
         * carries the figures Rewind used to.
         */}

        <Series.Sequence name="Scene 3 — The hidden supply chain" durationInFrames={durationFor(durations, 3)}>
          {(() => {
            const sc = sceneByNum(3);
            const dur = durationFor(durations, 3);
            const cap = captureFor(sc, captureOverrides, dur);
            return <WindowedBeat cap={cap} />;
          })()}
          <Scene4DateCornerLabel />
          <ExampleGlobeLabels durationInFrames={durationFor(durations, 3)} cues={CUE_TIMES[3]} />
          <SceneVO num={3} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 4 — The question" durationInFrames={durationFor(durations, 4)}>
          <GraphicBeat sc={sceneByNum(4)} duration={durationFor(durations, 4)}>
            <TheQuestion durationInFrames={durationFor(durations, 4)} cues={CUE_TIMES[4]} />
          </GraphicBeat>
          <SceneVO num={4} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 5 — The cascade" durationInFrames={durationFor(durations, 5)}>
          {(() => {
            const sc = sceneByNum(5);
            const dur = durationFor(durations, 5);
            const cap = captureFor(sc, captureOverrides, dur);
            return <WindowedBeat cap={cap} />;
          })()}
          <SceneVO num={5} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 6 — Let it land" durationInFrames={durationFor(durations, 6)}>
          {(() => {
            const sc = sceneByNum(6);
            const dur = durationFor(durations, 6);
            const cap = captureFor(sc, captureOverrides, dur);
            // The scene-06 recapture is the app's own recording, which
            // already burns in the $100M/$400M/4-companies counters
            // (app/src/director/ShotOverlays.tsx, overlay 'totals', stage
            // 12 "Let it land"). Rendering Scene08Counters on top of it
            // doubled the counters (ghosted duplicate behind the sharp
            // numerals, draft v5 ~t=128s). One owner per element, capture
            // wins (ac02b78) — only render the Remotion counters in the
            // fallback path, when no scene-06 capture exists yet.
            return cap ? (
              <CaptureBeat sc={sc} duration={dur} cap={cap}>
                {!captureOverrides[6] && <Scene08Counters durationInFrames={dur} cues={CUE_TIMES[6]} />}
              </CaptureBeat>
            ) : <WindowedBeat />;
          })()}
          <SceneVO num={6} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 7 — A dollar with a date" durationInFrames={durationFor(durations, 7)}>
          {(() => {
            const sc = sceneByNum(7);
            const dur = durationFor(durations, 7);
            const cap = captureFor(sc, captureOverrides, dur);
            return <WindowedBeat cap={cap} />;
          })()}
          <SceneVO num={7} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 8 — Underneath it" durationInFrames={durationFor(durations, 8)}>
          {(() => {
            const sc = sceneByNum(8);
            const dur = durationFor(durations, 8);
            const cap = captureFor(sc, captureOverrides, dur);
            return <WindowedBeat cap={cap} />;
          })()}
          <SceneVO num={8} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 9 — Run the year" durationInFrames={durationFor(durations, 9)}>
          {(() => {
            const sc = sceneByNum(9);
            const dur = durationFor(durations, 9);
            const cap = captureFor(sc, captureOverrides, dur);
            return cap ? <Scene9Capture sc={sc} duration={dur} cap={cap} /> : null;
          })()}
          {/*
           * Closing beat (reorder-to-13 pass, 2026-09-13, product owner +
           * Director/wingman 03:33 ET): "Separately, we tested ten thousand
           * operations with zero accounting invariant violations." flashes
           * over the reused stress-test/conservation-laws result card for
           * ~2.5s as the year view recedes — old scenes 12 (Stress test)
           * and 13 (The rules survive) are CUT as standalone scenes, but
           * their verified headline figure survives here. The scene's own
           * duration is extended by exactly this flash's length in
           * schedule.ts (SCENE9_CLOSE_FLASH_SECONDS), so this never eats
           * into the narrated portion above.
           */}
          <StressResultFlash durationInFrames={durationFor(durations, 9)} cues={CUE_TIMES[9]} />
          <SceneVO num={9} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 10 — Zoom out" durationInFrames={durationFor(durations, 10)}>
          {(() => {
            const sc = sceneByNum(10);
            const dur = durationFor(durations, 10);
            const cap = captureFor(sc, captureOverrides, dur);
            // scene-10 recapture already burns in "Composable." plus the
            // Loans/Forwards/Bonds/Derivatives + "Money plus time" beats
            // (app's 'composable' overlay). Scene14ZoomOut duplicates that;
            // render it only in the fallback path.
            const overlay10 = captureOverrides[10] ? null : <Scene14ZoomOut durationInFrames={dur} cues={CUE_TIMES[10]} />;
            return cap ? (
              <CaptureBeat sc={sc} duration={dur} cap={cap}>
                {overlay10}
              </CaptureBeat>
            ) : (
              <GraphicBeat sc={sc} duration={dur}>
                {overlay10}
              </GraphicBeat>
            );
          })()}
          <SceneVO num={10} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 11 — New York" durationInFrames={dur11}>
          <Scene11Receipt durationInFrames={dur11} cues={CUE_TIMES[11]} />
          <SceneVO num={11} narration={narration} narrationControls={narrationControls} />
        </Series.Sequence>

        <Series.Sequence name="Scene 12 — Beneath it" durationInFrames={dur12}>
          <Scene12Close durationInFrames={dur12} />
          <SceneVO num={12} narration={narration} narrationControls={narrationControls} />
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

/**
 * Scene 1's opening beat — full-bleed app capture (which itself now opens on
 * a near-black loading frame and resolves into the live dashboard, verified
 * on the current public/captures/scene-01.mp4, 2026-09-13) that pulls back
 * over the first ~1.2s into a LEFT-anchored window, per the product owner's
 * round-3 brief (2026-09-13 v2): "fake browser UI that floats towards left
 * side of screen, right edge slightly skewed back giving perspective view."
 * BrowserFrame's 'framed'/chrome="browser" pull-back scale is overridden via
 * its optional targetScale/anchorLeftFrac/skewYDeg/perspectivePx props
 * to settle at ~62% frame width, ~4% left
 * margin, rotateY +8° (round 4, Liam correction 2026-09-13: round 3's -8°
 * read backwards — left edge closer, right edge receding into perspective
 * 1800px, sign flipped from round 3's -8° to +8°). The final 0.9s swings
 * flat and centres at the same scale, sharing progress with the phone fade.
 */
const SCENE1_PULLBACK_FRAMES_AT_30 = 36; // ~1.2s ease into the framed window
const SCENE1_WINDOW_TARGET_SCALE = WINDOW_TARGET_SCALE; // ~62% of frame width
const SCENE1_WINDOW_LEFT_MARGIN_FRAC = 0.04; // ~4% left margin
const SCENE1_WINDOW_SKEW_DEG = 8; // rotateY at settle — left closer, right recedes (round 4: sign flip from round 3's -8°)
const SCENE1_WINDOW_PERSPECTIVE_PX = WINDOW_PERSPECTIVE_PX;

const SCENE1_SWING_FRAMES_AT_30 = 27; // 0.9s between endpoints, finishing on D-1

/** Compute the exit once in scene time, before the phone's offset Sequence. */
const Scene1Beat: React.FC<{
  duration: number;
  cap?: SceneCapture | null;
  app?: React.ReactNode;
  phoneEarliestFrame?: number;
}> = ({duration, cap = null, app, phoneEarliestFrame = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const endFrame = duration - 1;
  const swingProgress = interpolate(
    frame,
    [endFrame - at30(SCENE1_SWING_FRAMES_AT_30, fps), endFrame],
    [0, 1],
    {...CLAMP, easing: Easing.inOut(Easing.cubic)},
  );
  const reveal = cueFrame(
    CUE_TIMES[1], 'phone-reveal', fps,
    cueFrame(CUE_TIMES[1], 'phone-reveal-fallback', fps, scene1PhoneRevealFrame(duration)),
  );
  // Preserve entrance pre-roll: the phone's local cue still lands on reveal.
  const lead = Math.round((SCENE1_PHONE_FADE_MS / 1000) * fps);
  const start = Math.max(phoneEarliestFrame, reveal - lead);
  return (
    <>
      <Scene1AppWindow cap={cap} app={app} swingProgress={swingProgress} />
      <Sequence from={start} durationInFrames={duration - start} layout="none">
        <PhoneRevealOverlay cueFrame={reveal - start} swingProgress={swingProgress} />
      </Sequence>
    </>
  );
};

const Scene1AppWindow: React.FC<{
  cap: SceneCapture | null;
  app?: React.ReactNode;
  swingProgress: number;
}> = ({cap, app, swingProgress}) => {
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
      anchorLeftFrac={SCENE1_WINDOW_LEFT_MARGIN_FRAC + (WINDOW_CENTER_ANCHOR_FRAC - SCENE1_WINDOW_LEFT_MARGIN_FRAC) * swingProgress}
      skewYDeg={SCENE1_WINDOW_SKEW_DEG + (WINDOW_SKEW_DEG - SCENE1_WINDOW_SKEW_DEG) * swingProgress}
      perspectivePx={SCENE1_WINDOW_PERSPECTIVE_PX}
    >
      {app ?? video}
    </BrowserFrame>
  );
};

/**
 * Scene 1's product reveal (round 4, Liam correction 2026-09-13: "ditch the
 * flash on the iPhone image and just fade it in at the right timing").
 * Rendered as a sibling AFTER Scene1AppWindow (not nested in its
 * BrowserFrame), so it sits unclipped and in front of the whole window.
 *
 * The phone sits at ~80% frame height on the right, positioned so its own
 * left ~12% overlaps IN FRONT of the (now left-anchored, ~62%-wide)
 * window's right edge — see Scene1AppWindow's SCENE1_WINDOW_* constants,
 * which this reads to place that overlap correctly.
 *
 * `cueFrame` (prop) is the LOCAL frame — inside this component's own
 * Sequence — at which the reveal lands (the narration cue point, cues.ts's
 * 'phone-reveal' → 'foldable', falling back to 'phone-reveal-fallback' →
 * 'iPhone'); the Sequence itself starts SCENE1_PHONE_FADE_MS earlier so a
 * plain opacity fade-in finishes exactly on that frame — no strobe, no
 * color tint, no shake, no unfold/skew on the image itself. On and after
 * the cue: full opacity with a quick 120ms scale settle (1.03->1.0), then
 * held until the scene-local swingProgress fades it out with the window swing.
 */
const SCENE1_PHONE_HEIGHT_FRAC = 0.8; // of the 1080-tall frame
const SCENE1_PHONE_ASPECT = 1429 / 1101; // public/assets/iphone-duo-hands.png
const SCENE1_PHONE_FADE_MS = 700; // plain opacity fade-in, landing on the cue
const SCENE1_LAND_SETTLE_MS = 120; // scale 1.03 -> 1.0 once landed

const PhoneRevealOverlay: React.FC<{cueFrame: number; swingProgress: number}> = ({cueFrame, swingProgress}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const cueMs = (cueFrame / fps) * 1000;

  const opacity = interpolate(ms, [cueMs - SCENE1_PHONE_FADE_MS, cueMs], [0, 1], CLAMP) * (1 - swingProgress);
  const settleP = interpolate(ms - cueMs, [0, SCENE1_LAND_SETTLE_MS], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const scale = 1.03 - 0.03 * settleP;

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
      </div>
    </AbsoluteFill>
  );
};
