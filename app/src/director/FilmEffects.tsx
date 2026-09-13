import { START, displayDate } from '../data/types.ts';
import { cueMs } from './cues.ts';
import { SHOTS } from './shots.ts';
import type {PlaybackState} from '../playback/engine.ts';
import {clamp} from '../camera/primitives.ts';
import {narrationTime} from './shots.ts';
/** Exposure and typography share the narration clock, including manual capture. */
export function FilmEffects({state}:{state:PlaybackState}) {
 const t=narrationTime(state),closing=state.shot===12;
 const black=state.shot===1?1-clamp(t/.8):0;
 const scene=SHOTS.find(s=>s.id===state.shot);
 const closeAt=scene?cueMs(state,'wordmark',2.5,scene.baseSeconds)/1000:2.5;
 const rewind=state.timelapse?.direction===-1&&state.timelapse.elapsed<2000;
 const rewindUtc=new Date(START+state.position*86400000);
 const lineAt=scene?cueMs(state,'close-line',.5,scene.baseSeconds)/1000:.5;
 const lineOpacity=closing?Math.min(clamp((state.shotElapsed-lineAt)/.3),clamp((closeAt-state.shotElapsed)/.3)):0;
 return <>
  {rewind&&<section className="rewind-readout" aria-label="Rewinding the year">
    <svg viewBox="0 0 70 36" aria-hidden="true"><path d="M32 4 8 18l24 14V4m30 0L38 18l24 14V4" fill="currentColor"/></svg>
    <span>REWIND</span><time dateTime={rewindUtc.toISOString()}>{displayDate(state.position)}<b>{rewindUtc.toISOString().slice(11,19)} UTC</b></time>
  </section>}
  <div className="film-exposure" style={{opacity:state.exposure}} aria-hidden="true"/>
  {closing&&state.shotElapsed<closeAt&&<div className="ending-line" style={{opacity:lineOpacity}}><p>global supply chains.<br/>settled.</p></div>}
  {black>0&&<div className="film-black" style={{opacity:black}} aria-hidden="true"/>}
 </>;
}
