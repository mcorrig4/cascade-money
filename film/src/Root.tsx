import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {CascadeFilm, CascadeFilmProps, CascadeLiveScene, CascadeLiveSceneProps} from './compositions/CascadeFilm';
import {ESTIMATED_TOTAL_DURATION, FPS_BASE, filmDurationAtFps, resolveSceneDurations, SCENES} from './compositions/schedule';
import {loadCaptureOverrides, loadNarration} from './compositions/narration';
import {cascadeFilmSchema, DEFAULT_FPS, DEFAULT_NARRATION_CONTROLS} from './compositions/narrationControlsSchema';
import {W0LayoutProbe, w0ProbeSchema} from './compositions/W0LayoutProbe';
import {W0_PROBE_SHOTS, W0_PROBE_SHOT_FRAMES} from './compositions/w0ProbeSchedule';
import {AppFrame} from './live/AppFrame';

const calculateMetadata: CalculateMetadataFunction<CascadeFilmProps> = async ({props}) => {
  // `fps` is a Studio/CLI-editable input prop (15 for the draft profile, 30
  // for final — narrationControlsSchema.ts). It drives BOTH the actual
  // composition fps AND the frame count schedule.ts scales to, so the
  // film's wall-clock length never changes when fps does.
  const fps = props.fps ?? DEFAULT_FPS;
  const [narration, captureOverrides] = await Promise.all([
    loadNarration(fps),
    loadCaptureOverrides(SCENES.map((sc) => sc.num)),
  ]);
  const durationInFrames = filmDurationAtFps(narration, fps);
  // Spread the incoming props (defaultProps merged with any --props override,
  // e.g. reviewLabels from the CLI) so calculateMetadata only ever ADDS the
  // live-computed narration/captureOverrides — it never drops a prop the
  // caller passed in.
  return {durationInFrames, fps, props: {...props, narration, captureOverrides}};
};

const calculateSceneMetadata: CalculateMetadataFunction<CascadeLiveSceneProps> = async ({props}) => {
  const fps=props.fps??DEFAULT_FPS,sceneIndex=Math.max(1,Math.min(12,Math.round(props.sceneIndex??1)));
  const [narration,captureOverrides]=await Promise.all([loadNarration(fps),loadCaptureOverrides([sceneIndex])]);
  return {fps,durationInFrames:resolveSceneDurations(narration,fps)[sceneIndex-1],props:{...props,sceneIndex,fps,narration,captureOverrides}};
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition id="W0LayoutProbe" component={W0LayoutProbe} width={1920} height={1080} fps={30}
      durationInFrames={W0_PROBE_SHOTS.length * W0_PROBE_SHOT_FRAMES}
      schema={w0ProbeSchema} defaultProps={{debugOutlines:true}}/>
    <Composition
      id="CascadeFilm"
      component={CascadeFilm}
      durationInFrames={ESTIMATED_TOTAL_DURATION}
      fps={FPS_BASE}
      width={1920}
      height={1080}
      // reviewLabels: true renders a review-only top-left scene-number chip
      // (see CascadeFilm.tsx / ReviewLabelOverlay). Pick it up with:
      //   npx remotion render CascadeFilm --props='{"reviewLabels":true}'
      //
      // narrationControls: per-scene VO offset/trim/gain, editable in
      // Remotion Studio's props sidebar (schema below) — see
      // narrationControlsSchema.ts. Every entry starts at the all-zero
      // no-op default, so this does not change any scene's timing.
      //
      // fps: 15 (draft) or 30 (final) — see narrationControlsSchema.ts and
      // schedule.ts's scaleFrames/resolveSceneDurations/filmDurationAtFps.
      schema={cascadeFilmSchema}
      defaultProps={{
        narration: {},
        captureOverrides: {},
        reviewLabels: false,
        narrationControls: DEFAULT_NARRATION_CONTROLS,
        fps: DEFAULT_FPS,
        source: 'captures',
      }}
      calculateMetadata={calculateMetadata}
    />
    <Composition id="CascadeLiveScene" component={CascadeLiveScene} durationInFrames={163} fps={30} width={1920} height={1080}
      defaultProps={{sceneIndex:1,fps:30,source:'live',narration:{},captureOverrides:{},narrationControls:DEFAULT_NARRATION_CONTROLS}}
      calculateMetadata={calculateSceneMetadata}/>
    <Composition id="CascadeLive" component={AppFrame} durationInFrames={301} fps={30} width={1920} height={1080}/>
    <Composition id="CascadeLiveSite" component={AppFrame} durationInFrames={30} fps={30} width={1920} height={1080} defaultProps={{scene:2}}/>
    <Composition id="CascadeSeekProbe" component={AppFrame} durationInFrames={3} fps={30} width={1920} height={1080} defaultProps={{scene:4,timesMs:[4000,10000,4000]}}/>
    </>
  );
};
