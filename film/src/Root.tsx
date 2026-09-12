import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {CascadeFilm, CascadeFilmProps} from './compositions/CascadeFilm';
import {applyDurationFloors, ESTIMATED_TOTAL_DURATION, SCENES} from './compositions/schedule';
import {loadCaptureOverrides, loadNarration} from './compositions/narration';

const FPS = 30;

const calculateMetadata: CalculateMetadataFunction<CascadeFilmProps> = async () => {
  const [narration, captureOverrides] = await Promise.all([
    loadNarration(FPS),
    loadCaptureOverrides(SCENES.map((sc) => sc.num)),
  ]);
  const durationInFrames = SCENES.reduce(
    (acc, sc) => acc + applyDurationFloors(sc, narration[sc.num]?.durationInFrames ?? sc.estimateFrames),
    0,
  );
  return {durationInFrames, props: {narration, captureOverrides}};
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
      defaultProps={{narration: {}, captureOverrides: {}}}
      calculateMetadata={calculateMetadata}
    />
  );
};
