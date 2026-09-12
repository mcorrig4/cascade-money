import { Vector3 } from 'three';
import type { PlaybackState } from '../playback/engine.ts';
import { nearSite, SITES } from './site-math.ts';
import type { SiteId } from './site-math.ts';

export interface TilePlan { site: SiteId | null; prefetch: boolean; blend: number }

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

export function canUseTiles(enabled: boolean, key: string | undefined, failed = false) {
  return enabled && !!key?.trim() && !failed;
}

export function shouldHoldForTiles(state: Pick<PlaybackState, 'shot' | 'shotElapsed' | 'shotRunning'>, ready: boolean, failed: boolean, configured: boolean) {
  if (!configured || failed || ready || !state.shotRunning) return false;
  return state.shot === 1 && state.shotElapsed >= .25 && state.shotElapsed < 8 ||
    state.shot === 10 && state.shotElapsed >= 3.5 && state.shotElapsed < 8.3;
}

export function tilePlan(state: Pick<PlaybackState, 'shot' | 'shotElapsed'>, lat: number, lng: number, altitude: number): TilePlan {
  if (state.shot === 1 && state.shotElapsed <= 9.4) {
    return { site: 'apple-park', prefetch: true, blend: 1 - smoothstep(8, 8.7, state.shotElapsed) };
  }
  if (state.shot === 10 && state.shotElapsed <= 9.4) {
    const enter = smoothstep(5.5, 6.2, state.shotElapsed);
    const leave = 1 - smoothstep(8.3, 9, state.shotElapsed);
    return { site: 'fifth-avenue', prefetch: true, blend: enter * leave };
  }
  const nearby = (Object.keys(SITES) as SiteId[]).find(id => nearSite(id, lat, lng, Math.min(altitude, 0.001)));
  if (!nearby || altitude >= 0.008) return { site: null, prefetch: false, blend: 0 };
  return { site: nearby, prefetch: true, blend: 1 - smoothstep(0.0012, 0.0035, altitude) };
}

export function enoughTiles(progress: number, visible: number, failed: number) {
  // Parent tiles provide a complete frame while finer LODs continue streaming.
  return failed === 0 && visible >= 8 && progress >= 0.12;
}

export function medianGroundHeight(points: Vector3[]) {
  if (!points.length) return null;
  const heights = points.map(point => point.y).sort((a, b) => a - b);
  const middle = Math.floor(heights.length / 2);
  return heights.length % 2 ? heights[middle] : (heights[middle - 1] + heights[middle]) / 2;
}
