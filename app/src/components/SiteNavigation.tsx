import type { PlaybackEngine } from '../playback/engine.ts';
import { jumpToSite } from '../camera/site-navigation.ts';

export function SiteNavigation({engine}:{engine:PlaybackEngine}) {
  return <nav className="site-navigation" aria-label="Explore sites">
    <button onClick={()=>jumpToSite(engine,'apple-park')}><svg viewBox="0 0 36 36" aria-hidden="true"><ellipse cx="18" cy="19" rx="15" ry="11"/><ellipse cx="18" cy="19" rx="9" ry="6"/><path d="M3 19v5c6 11 24 11 30 0v-5"/></svg><span>Apple Park</span></button>
    <button onClick={()=>jumpToSite(engine,'fifth-avenue')}><svg viewBox="0 0 36 36" aria-hidden="true"><path d="m4 11 14-7 14 7v17l-14 5-14-5V11Zm0 0 14 6 14-6M18 17v16M11 8v15l7 3 7-3V8"/></svg><span>Fifth Avenue</span></button>
    <button onClick={()=>jumpToSite(engine,'globe')}><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><ellipse cx="18" cy="18" rx="7" ry="15"/><path d="M3 18h30M6 9h24M6 27h24"/></svg><span>Globe</span></button>
  </nav>;
}
