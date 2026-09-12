import type {PlaybackState} from '../playback/engine.ts';
import {clamp} from '../camera/primitives.ts';
/** Exposure and typography share the shot clock, including manual pause. */
export function FilmEffects({state}:{state:PlaybackState}) {
 const t=state.shotElapsed;
 const black=state.shot===1?1-clamp(t/.8):state.shot===12?clamp((t-15)/3):0;
 const lineOpacity=state.shot===20?Math.min(clamp((t-2)/1),clamp((8-t)/2)):0;
 return <>
   <div className="film-exposure" style={{opacity:state.exposure}} aria-hidden="true"/>
   {state.shot===20&&<div className="ending-line" style={{opacity:lineOpacity}}><p>global supply chains.<br/>settled.</p></div>}
   {black>0&&<div className="film-black" style={{opacity:black}} aria-hidden="true"/>}
 </>;
}
