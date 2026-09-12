import type {PlaybackState} from '../playback/engine.ts';
import {clamp} from '../camera/primitives.ts';
import {narrationTime} from './shots.ts';
/** Exposure and typography share the narration clock, including manual capture. */
export function FilmEffects({state}:{state:PlaybackState}) {
 const t=narrationTime(state),closing=state.shot===12;
 const black=state.shot===1?1-clamp(t/.8):0;
 const lineOpacity=closing?Math.min(clamp((t-.5)/.3),clamp((2.5-t)/.3)):0;
 return <>
  <div className="film-exposure" style={{opacity:state.exposure}} aria-hidden="true"/>
  {closing&&t<2.5&&<div className="ending-line" style={{opacity:lineOpacity}}><p>global supply chains.<br/>settled.</p></div>}
  {black>0&&<div className="film-black" style={{opacity:black}} aria-hidden="true"/>}
 </>;
}
