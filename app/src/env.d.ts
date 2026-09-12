import type { GlobeInstance } from 'globe.gl';
import type { PlaybackEngine } from './playback/engine.ts';
import type { ArcPool } from './globe/arc-pool.ts';
declare global {
  const __SITE_MODEL_VERSIONS__: Record<string, string>;
  interface Window {
    Telegram?: { WebApp?: import('./platform/telegram.ts').TelegramApp };
    __cascade?: {
      shots: typeof import('./director/shots.ts').SHOTS;playScene:(id:number)=>void;playFilm:()=>void;
      engine: PlaybackEngine; globe: GlobeInstance; pool: ArcPool;
      cameraFlightActive: () => boolean;
      tiles: () => { site: 'apple-park' | 'fifth-avenue' | null; ready: boolean; failed: boolean; progress: number; visibleTiles: number; opacity: number; ground: number | null; modelSize: [number, number, number] | null; tileBounds: [number, number, number, number, number, number] | null };
      siteView: (site: 'apple-park' | 'fifth-avenue', orbit?: number) => void;
      siteNadir: (site: 'apple-park' | 'fifth-avenue', altitude?: number) => void;
      models: () => { id: string; pending: boolean; missing: boolean; loaded: boolean; fade: number }[];
      geography: () => { name: string; lat: number; lng: number; expected: { u: number; v: number }; uv: { u: number; v: number } | null }[];
      ageArcs: (milliseconds: number) => void;
      geometry: () => { seq: number; geometry?: string; alpha: number | null; clipStart: number; clipEnd: number; groundKm: number; depthTest?: boolean }[];
    };
  }
}
