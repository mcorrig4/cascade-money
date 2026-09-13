import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {CascadeFilm, CascadeFilmProps} from './compositions/CascadeFilm';
import {applyDurationFloors, ESTIMATED_TOTAL_DURATION, SCENES} from './compositions/schedule';
import {loadCaptureOverrides, loadNarration} from './compositions/narration';
import {cascadeFilmSchema, DEFAULT_NARRATION_CONTROLS} from './compositions/narrationControlsSchema';

const FPS = 30;

const calculateMetadata: CalculateMetadataFunction<CascadeFilmProps> = async ({props}) => {
  const [narration, captureOverrides] = await Promise.all([
    loadNarration(FPS),
    loadCaptureOverrides(SCENES.map((sc) => sc.num)),
  ]);
  const durationInFrames = SCENES.reduce(
    (acc, sc) => acc + applyDurationFloors(sc, narration[sc.num]?.durationInFrames ?? sc.estimateFrames),
    0,
  );
  // Spread the incoming props (defaultProps merged with any --props override,
  // e.g. reviewLabels from the CLI) so calculateMetadata only ever ADDS the
  // live-computed narration/captureOverrides — it never drops a prop the
  // caller passed in.
  return {durationInFrames, props: {...props, narration, captureOverrides}};
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CascadeFilm"
      component={CascadeFilm}
      durationInFrames={ESTIMATED_TOTAL_DURATION}
      fps={FPS}
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
      schema={cascadeFilmSchema}
      defaultProps={{
        narration: {},
        captureOverrides: {},
        reviewLabels: false,
        narrationControls: DEFAULT_NARRATION_CONTROLS,
      }}
      calculateMetadata={calculateMetadata}
    />
  );
};
