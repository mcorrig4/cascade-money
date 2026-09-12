import type { GlobeInstance } from 'globe.gl';
import type { PlaybackEngine } from './playback/engine.ts';
import type { ArcPool } from './globe/arc-pool.ts';
declare global {
  interface Window {
    Telegram?: { WebApp?: import('./platform/telegram.ts').TelegramApp };
    __cascade?: {
      engine: PlaybackEngine; globe: GlobeInstance; pool: ArcPool;
      geography: () => { name: string; lat: number; lng: number; expected: { u: number; v: number }; uv: { u: number; v: number } | null }[];
      ageArcs: (milliseconds: number) => void;
      geometry: () => { seq: number; geometry?: string; alpha: number | null; clipStart: number; clipEnd: number; groundKm: number; depthTest?: boolean }[];
    };
  }
}
