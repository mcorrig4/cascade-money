import React from 'react';
import {Composition} from 'remotion';
import {CascadeFilm, CASCADE_FILM_DURATION} from './compositions/CascadeFilm';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CascadeFilm"
      component={CascadeFilm}
      durationInFrames={CASCADE_FILM_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
