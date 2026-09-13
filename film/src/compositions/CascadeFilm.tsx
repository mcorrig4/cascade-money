/** W2 Stage 2: one persistent application window carries scenes 2–10;
 * native app sources and crisp presentation share cue-driven scene clocks.
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
import {WindowLayout, useWindowGeometry, WINDOW_PRESETS} from '../components/WindowLayout';
import {transitionProgress, type WindowGeometry} from '../components/windowGeometry';
import {resolveSceneDurations, SCENES, SceneDef, sceneByNum} from './schedule';
import {captureFileFor, NarrationMap} from './narration';
import {DEFAULT_NARRATION_CONTROLS, NarrationControls} from './narrationControlsSchema';
import {at30, CLAMP} from '../motion/timing';
import {cameraAt, cameraStyle, FULL_FRAME, RostrumMove} from '../motion/rostrumCamera';
import {cueFrame, type SceneCues} from '../cues';
import cueTimesData from '../generated/cues.json';
import captureDurations from '../generated/capture-durations.json';

import {Scene11Receipt} from './motion-graphics/Scene11Receipt';
import {Scene12Close} from './motion-graphics/Scene12Close';
import {ScenePresentation} from '../components/presentation/ScenePresentation';
import {sceneWindowSpec, sourceFit, requiredCueFrame, narrationAdjustedCues} from './windowChoreography';
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

/**
 * How much of the tail of a per-scene recapture is the RECORDER's overshoot
 * rather than the scene's own picture (boundary-bleed fix, 2026-09-13).
 * record-take-v6.mjs cuts each clip at the app's authored shot boundary, and
 * its measured per-scene deltas run up to +0.27s past that boundary — i.e.
 * the last few tenths of every clip are already the NEXT shot's opening
 * card. Measured directly off the out-v6 clips (frames sampled every 0.6s
 * through the last 3s of scenes 5, 6, 7 and 10, 2026-09-13): every one of
 * them cuts to the next shot's card exactly 1.2s before the file ends, so
 * 1.25s is the trim that reliably lands on this scene's own last picture.
 */
const CAPTURE_TAIL_TRIM_SECONDS = 1.25;

/**
 * Slowest the capture layer is allowed to run. A mild stretch is invisible on
 * these slow globe moves; past this it reads as slow motion, so a capture
 * that far short of its scene holds on its last real frame instead (still
 * never the next shot's picture — that is the whole point). Scene 1's
 * cold-load capture is deliberately on the freeze side of this line: it is a
 * loading screen the scene-1 lane already signed off holding. Any scene that
 * lands here wants a recapture at the narration's own length, not a film-side
 * fix — see shot 5's authored `seconds` in app/src/director/shots.ts.
 */
const MIN_CAPTURE_PLAYBACK_RATE = 0.75;

/** The resolved capture for a scene: the scene-NN.mp4 recapture if it exists, else the fallback. */
const captureFor = (
  sc: SceneDef,
  overrides: Record<number, boolean>,
  resolvedDuration: number,
  fps: number,
): {src: string; captureDurationInFrames: number; startFrom: number; playbackRate: number} | null => {
  if (overrides[sc.num]) {
    // A recapture is cut to the APP's authored shot length, which is a
    // word-count estimate — not this scene's narration length. Measure it
    // (generated/capture-durations.json) and stretch the real footage across
    // the scene rather than sampling past its end into the next shot.
    const measured = (captureDurations as Record<string, number>)[String(sc.num)];
    const src = captureFileFor(sc.num);
    if (measured === undefined) {
      return {src, captureDurationInFrames: resolvedDuration, startFrom: 0, playbackRate: 1};
    }
    const usableFrames = Math.max(1, Math.floor((measured - CAPTURE_TAIL_TRIM_SECONDS) * fps));
    const fit = usableFrames / resolvedDuration;
    const playbackRate = fit >= 1 || fit < MIN_CAPTURE_PLAYBACK_RATE ? 1 : fit;
    return {
      src,
      captureDurationInFrames: Math.min(resolvedDuration, Math.floor(usableFrames / playbackRate)),
      startFrom: 0,
      playbackRate,
    };
  }
  if (!sc.fallbackCapture) return null;
  return {
    src: sc.fallbackCapture,
    captureDurationInFrames: sc.fallbackCaptureDurationInFrames ?? resolvedDuration,
    startFrom: sc.fallbackCaptureStartFrom ?? 0,
    playbackRate: 1,
  };
};

type SceneCapture = {src: string; captureDurationInFrames: number; startFrom: number; playbackRate: number};

/** W2 keeps the accepted rostrum targets and durations inside the app window. */
const useScene9Camera = (cues: SceneCues) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const moves: RostrumMove[] = [
    {startFrame: requiredCueFrame(cues, 'push-in-scrubber', fps), durationInFrames: Math.round(0.9 * fps), target: {xFrac: 0.19, yFrac: 0.87, scale: fps === 30 ? 2.0 : 2.2}},
    {startFrame: requiredCueFrame(cues, 'pan-to-ledger', fps), durationInFrames: Math.round(1.1 * fps), target: {xFrac: 0.87, yFrac: 0.4, scale: 2.0}},
    {startFrame: requiredCueFrame(cues, 'pull-back-full', fps), durationInFrames: Math.round(1.0 * fps), target: FULL_FRAME},
  ];
  return cameraStyle(cameraAt(frame, moves));
};

const MiddleSource: React.FC<{scene: number; source: FilmSource; cap: SceneCapture | null; cues: SceneCues}> = ({scene, source, cap, cues}) => {
  const rostrum = useScene9Camera(scene === 9 ? cues : CUE_TIMES[9]);
  const videoStyle = scene === 9 ? rostrum : undefined;
  return source === 'live'
    ? <AbsoluteFill style={{overflow: 'hidden'}}><AbsoluteFill style={videoStyle}><LiveAppFrame scene={scene} absoluteTimeline /></AbsoluteFill></AbsoluteFill>
    : cap ? <CaptureScene {...cap} mode="bleed" videoStyle={videoStyle} /> : <AbsoluteFill style={{background: color.bgOuter}} />;
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

export interface CascadeLiveSceneProps extends Record<string, unknown> {
  sceneIndex: number;
  fps?: 15 | 30;
  source?: FilmSource;
  narration?: NarrationMap;
  captureOverrides?: Record<number, boolean>;
  narrationControls?: NarrationControls;
  includeAudio?: boolean;
}

/** W2 uses one window host for scenes 2–10, including the uninterrupted 3→4 frame. */
const MiddleFilm: React.FC<{
  scenes: number[]; durations: number[]; source: FilmSource; captureOverrides: Record<number, boolean>;
  narration: NarrationMap; narrationControls: NarrationControls; includeAudio?: boolean;
}> = ({scenes, durations, source, captureOverrides, narration, narrationControls, includeAudio = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  let start = 0;
  let scene = scenes[scenes.length - 1];
  for (const candidate of scenes) {
    scene = candidate;
    const duration = durationFor(durations, candidate);
    if (frame < start + duration) break;
    start += duration;
  }
  const localFrame = frame - start;
  const duration = durationFor(durations, scene);
  const cues = narrationAdjustedCues(CUE_TIMES[scene], fps,
    narrationControls[scene - 1] ?? DEFAULT_NARRATION_CONTROLS[scene - 1], narration[scene]?.tailOffsetInFrames);
  const localSpec = sceneWindowSpec(scene, localFrame, fps, cues);
  const spec = localSpec.preset !== undefined ? localSpec : {...localSpec, startFrame: localSpec.startFrame + start};
  const geometry = useWindowGeometry(spec);
  const cap = captureFor(sceneByNum(scene), captureOverrides, duration, fps);
  const fit = sourceFit();
  return <>
    <WindowLayout {...spec}>
      {/* W2 preserves a native 1920×1080 source and its footer below the 65px chrome. */}
      <div style={{position: 'absolute', width: 1920, height: 1080, left: fit.left, top: 0, transform: `scale(${fit.scale})`, transformOrigin: 'top left'}}>
        <Sequence from={start} durationInFrames={duration} layout="none">
          <MiddleSource scene={scene} source={source} cap={cap} cues={cues} />
        </Sequence>
      </div>
    </WindowLayout>
    <Sequence from={start} durationInFrames={duration} layout="none">
      <ScenePresentation scene={scene} geometry={geometry} cues={cues} />
      {includeAudio ? <SceneVO num={scene} narration={narration} narrationControls={narrationControls} /> : null}
    </Sequence>
  </>;
};

/** Individual scene targets share the full film's presentation and source clocks. */
export const CascadeLiveScene: React.FC<CascadeLiveSceneProps> = ({
  sceneIndex, source = 'live', narration = {}, captureOverrides = {},
  narrationControls = DEFAULT_NARRATION_CONTROLS, includeAudio = true,
}) => {
  const {fps} = useVideoConfig();
  const durations = resolveSceneDurations(narration, fps);
  const duration = durationFor(durations, sceneIndex);
  if (sceneIndex >= 2 && sceneIndex <= 10) return <AbsoluteFill style={{background: color.bgOuter}}>
    <MiddleFilm scenes={[sceneIndex]} durations={durations} source={source} captureOverrides={captureOverrides} narration={narration} narrationControls={narrationControls} includeAudio={includeAudio} />
  </AbsoluteFill>;
  const visual = sceneIndex === 11 ? <Scene11Receipt durationInFrames={duration} cues={CUE_TIMES[11]} />
    : sceneIndex === 12 ? <Scene12Close durationInFrames={duration} />
    : source === 'live' ? <Scene1Beat duration={duration} app={<LiveAppFrame scene={sceneIndex} loadingFrames={fps} absoluteTimeline />} phoneEarliestFrame={fps} />
    : <Scene1Beat duration={duration} cap={captureFor(sceneByNum(sceneIndex), captureOverrides, duration, fps)} />;
  return <AbsoluteFill style={{background: color.bgOuter}}>{visual}{includeAudio ? <SceneVO num={sceneIndex} narration={narration} narrationControls={narrationControls} /> : null}</AbsoluteFill>;
};

export const CascadeFilm: React.FC<CascadeFilmProps> = ({narration, captureOverrides, narrationControls, reviewLabels = false, source = 'live'}) => {
  const {fps} = useVideoConfig();
  const durations = resolveSceneDurations(narration, fps);
  const middleScenes = SCENES.filter(sc => sc.num >= 2 && sc.num <= 10).map(sc => sc.num);
  return <AbsoluteFill style={{background: color.bgOuter}}>
    <Series>
      <Series.Sequence name="Scene 1 — The object of desire" durationInFrames={durationFor(durations, 1)}>
        <CascadeLiveScene sceneIndex={1} source={source} narration={narration} captureOverrides={captureOverrides} narrationControls={narrationControls} />
      </Series.Sequence>
      <Series.Sequence name="Scenes 2–10 — The application and presentation" durationInFrames={middleScenes.reduce((sum, scene) => sum + durationFor(durations, scene), 0)}>
        <MiddleFilm scenes={middleScenes} durations={durations} source={source} captureOverrides={captureOverrides} narration={narration} narrationControls={narrationControls} />
      </Series.Sequence>
      <Series.Sequence name="Scene 11 — New York" durationInFrames={durationFor(durations, 11)}>
        <Scene11Receipt durationInFrames={durationFor(durations, 11)} cues={CUE_TIMES[11]} />
        <SceneVO num={11} narration={narration} narrationControls={narrationControls} />
      </Series.Sequence>
      <Series.Sequence name="Scene 12 — Beneath it" durationInFrames={durationFor(durations, 12)}>
        <Scene12Close durationInFrames={durationFor(durations, 12)} />
        <SceneVO num={12} narration={narration} narrationControls={narrationControls} />
      </Series.Sequence>
    </Series>
    {reviewLabels ? <ReviewLabelOverlay durations={durations} /> : null}
  </AbsoluteFill>;
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
  const swingStart = endFrame - at30(SCENE1_SWING_FRAMES_AT_30, fps);
  const swingDuration = at30(SCENE1_SWING_FRAMES_AT_30, fps);
  const swingProgress = transitionProgress(frame, swingStart, swingDuration);
  const swingGeometry = useWindowGeometry({
    from: 'skewLeft', to: 'centerSmall', startFrame: swingStart, durationInFrames: swingDuration,
  });
  const reveal = cueFrame(
    CUE_TIMES[1], 'phone-reveal', fps,
    cueFrame(CUE_TIMES[1], 'phone-reveal-fallback', fps, scene1PhoneRevealFrame(duration)),
  );
  // Preserve entrance pre-roll: the phone's local cue still lands on reveal.
  const lead = Math.round((SCENE1_PHONE_FADE_MS / 1000) * fps);
  const start = Math.max(phoneEarliestFrame, reveal - lead);
  return (
    <>
      <Scene1AppWindow cap={cap} app={app} swingGeometry={swingGeometry} />
      <Sequence from={start} durationInFrames={duration - start} layout="none">
        <PhoneRevealOverlay cueFrame={reveal - start} swingProgress={swingProgress} />
      </Sequence>
    </>
  );
};

const Scene1AppWindow: React.FC<{
  cap: SceneCapture | null;
  app?: React.ReactNode;
  swingGeometry: WindowGeometry;
}> = ({cap, app, swingGeometry}) => {
  const {fps} = useVideoConfig();
  const pullbackFrames = at30(SCENE1_PULLBACK_FRAMES_AT_30, fps);

  const video = cap ? (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(`captures/${cap.src}`)} startFrom={cap.startFrom} playbackRate={cap.playbackRate} />
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{background: color.bgOuter}} />
  );

  return (
    <WindowLayout
      from="fullscreen" to={swingGeometry}
      startFrame={0} durationInFrames={pullbackFrames}
      easing={Easing.out(Easing.cubic)} legacyFrameAppearance
    >
      {app ?? video}
    </WindowLayout>
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
 * window's right edge — see WindowLayout's skewLeft preset,
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
/**
 * Liam, 2026-09-13 14:12 (v5 scene-1 draft): "Scene 1 image entrance is ugly.
 * Blur-mask the left edge so it isn't a hard line, and it seems to grow and
 * shrink or move a little when appearing."
 *
 * Two causes, both removed here. The wobble was a 1.03 -> 1.0 scale settle
 * played over the same 120ms the opacity was still ramping, so the phone
 * appeared to breathe as it arrived; the entrance is now a single opacity ramp
 * with one easing and no transform of its own. The hard line was the image's
 * own left edge cutting straight across the app window it overlaps; the wrapper
 * now carries a horizontal alpha mask that feathers that edge (and the
 * drop-shadow with it, since the mask applies after the filter).
 */
const SCENE1_PHONE_EDGE_FEATHER_PX = 110; // at 1080p, ~10% of the phone's own width

const PhoneRevealOverlay: React.FC<{cueFrame: number; swingProgress: number}> = ({cueFrame, swingProgress}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const cueMs = (cueFrame / fps) * 1000;

  const opacity = interpolate(ms, [cueMs - SCENE1_PHONE_FADE_MS, cueMs], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  }) * (1 - swingProgress);

  const height = 1080 * SCENE1_PHONE_HEIGHT_FRAC;
  const width = height * SCENE1_PHONE_ASPECT;
  // Window's settled, unrotated right edge (the original phone anchor):
  // left margin + width, in the same 1920-wide frame. The phone's left
  // edge sits 12% of its own width inside that (overlapping IN FRONT of
  // the window), the rest extending right.
  const windowRightEdgePx = 1920 * (WINDOW_PRESETS.skewLeft.anchorLeftFrac + WINDOW_PRESETS.skewLeft.targetScale);
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
          transform: 'translateY(-50%)',
          maskImage: `linear-gradient(to right, rgba(0,0,0,0) 0px, rgba(0,0,0,1) ${SCENE1_PHONE_EDGE_FEATHER_PX}px)`,
          WebkitMaskImage: `linear-gradient(to right, rgba(0,0,0,0) 0px, rgba(0,0,0,1) ${SCENE1_PHONE_EDGE_FEATHER_PX}px)`,
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
