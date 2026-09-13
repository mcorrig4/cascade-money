import { Vector3 } from 'three';
import type { PlaybackState } from '../playback/engine.ts';
import { shotSite } from '../director/shots.ts';
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

const OPTIONAL_IMAGERY_MESSAGE='Optional imagery unavailable';
let consoleGated=false;
/**
 * 3d-tiles-renderer's per-tile load path already special-cases AbortError and
 * stays silent (TilesRendererBase#requestTileContents), but its ROOT tileset
 * load path (TilesRendererBase#update) does not: it unconditionally
 * console.error()s whatever rejects loadRootTileset(), regardless of error
 * name. A root request can fail this way on every cold load whenever the
 * optional imagery is unreachable (revoked/misconfigured key, offline,
 * quota) — expected and already handled by `onFailure` above, not a bug to
 * surface. Filter only this one, exact, already-handled message; every
 * other console.error call passes through untouched.
 */
function gateOptionalImageryConsoleError() {
  if (consoleGated || typeof console === 'undefined') return;
  consoleGated = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const isOptionalImageryAbort = args.some(arg =>
      (arg instanceof DOMException && arg.name === 'AbortError' && arg.message === OPTIONAL_IMAGERY_MESSAGE) ||
      (typeof arg === 'string' && arg.includes(OPTIONAL_IMAGERY_MESSAGE)));
    if (isOptionalImageryAbort) return;
    original(...args);
  };
}

/** Fail closed without exposing signed tile URLs, and preserve ordinary LOD aborts. */
export async function fetchOptionalTile(fetchTile:(url:string,options:RequestInit)=>Promise<Response>,url:string,options:RequestInit={},onFailure:()=>void) {
  gateOptionalImageryConsoleError();
  try {
    const timeout=AbortSignal.timeout(12000);
    const response=await fetchTile(url,{...options,cache:'no-store',signal:options.signal?AbortSignal.any([options.signal,timeout]):timeout});
    if(!response.ok)throw new Error(OPTIONAL_IMAGERY_MESSAGE);
    return response;
  } catch {
    if(!options.signal?.aborted)onFailure();
    throw new DOMException(OPTIONAL_IMAGERY_MESSAGE,'AbortError');
  }
}

/** Optional photorealistic imagery never gates the film or Earth readiness. */
export function shouldHoldForTiles(_state: Pick<PlaybackState, 'shot' | 'shotElapsed' | 'shotRunning'>, _ready: boolean, _failed: boolean, _configured: boolean) {
  return false;
}

/** Readiness may change the available layer; opacity has no accumulated animation phase. */
export function tileOpacity(plan: TilePlan, ready: boolean, failed: boolean, forcedFallback: boolean, ground: number | null) {
  return ready && !failed && !forcedFallback && ground !== null ? plan.blend : 0;
}

export function tilePlan(state: Pick<PlaybackState, 'shot' | 'shotElapsed'> & Partial<Pick<PlaybackState, 'camera'>>, lat: number, lng: number, altitude: number): TilePlan {
  const authoredSite=shotSite(state.shot);
  // HUD jumps name their destination before the camera reaches its proximity radius.
  const jumpSite=state.shot===null?state.camera?.site:null;
  if(jumpSite && jumpSite in SITES)return {site:jumpSite,prefetch:true,blend:1-smoothstep(0.0012,0.0035,altitude)};
  if(state.shot===1)return {site:'apple-park',prefetch:true,blend:1-smoothstep(14,14.8,state.shotElapsed)};
  // Shot 10 ("New York", the store flight + stair descent) is cut
  // (scene-11-delete pass, 2026-09-13) — its enter/leave fade special-case
  // is retired with it; shot 19 (Beneath it) now opens the fifth-avenue
  // site itself and falls through to the generic authoredSite blend below,
  // same as it (and shot 12/Close) already did.
  if (authoredSite) return {site:authoredSite,prefetch:true,blend:1};
  const nearby = (Object.keys(SITES) as SiteId[]).find(id => nearSite(id, lat, lng, Math.min(altitude, 0.001)));
  if (!nearby || altitude >= 0.008) return { site: null, prefetch: false, blend: 0 };
  return { site: nearby, prefetch: true, blend: 1 - smoothstep(0.0012, 0.0035, altitude) };
}

export function enoughTiles(progress: number, visible: number, failed: number) {
  // Do not release a close-up on planet-scale parents. Regional detail is
  // present only once a substantial visible working set has refined.
  // loadProgress is not monotone: it can drop sharply when a moving camera
  // exposes fresh descendants. Forty visible models is the stable signal that
  // the regional hierarchy has arrived; a small non-zero progress floor avoids
  // accepting only the root while allowing authored wide starts to resolve.
  return failed === 0 && visible >= 40 && (progress >= 0.1 || visible >= 80);
}

export function medianGroundHeight(points: Vector3[]) {
  if (!points.length) return null;
  const heights = points.map(point => point.y).sort((a, b) => a - b);
  const middle = Math.floor(heights.length / 2);
  return heights.length % 2 ? heights[middle] : (heights[middle - 1] + heights[middle]) / 2;
}
