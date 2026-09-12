import type { GlobeInstance } from 'globe.gl';
import type { PlaybackEngine } from './playback/engine.ts';
import type { ArcPool } from './globe/arc-pool.ts';
declare global {
  interface Window {
    __cascade?: {
      engine: PlaybackEngine; globe: GlobeInstance; pool: ArcPool;
      ageArcs: (milliseconds: number) => void;
      geometry: () => { seq: number; geometry?: string; alpha: number | null }[];
    };
  }
}
