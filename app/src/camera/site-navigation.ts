import type { PlaybackEngine } from '../playback/engine.ts';
import { EARTH_METERS } from './primitives.ts';

export function jumpToSite(engine:PlaybackEngine,site:'apple-park'|'fifth-avenue'|'globe') {
  engine.stopShot();
  if(site==='globe')engine.fly(36,-145,2.15,3000);
  else if(site==='apple-park')engine.fly(37.3349,-122.009,600/EARTH_METERS,3000,site);
  else engine.fly(40.7638,-73.973,12/EARTH_METERS,3000,site);
}

