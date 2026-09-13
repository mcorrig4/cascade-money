import { OVERLAY_OWNERS, type OverlayKind } from './shots.ts';
import type { PlaybackEngine, PlaybackState } from '../playback/engine.ts';

/** Cover UI and external recording-mode entry without coupling capture bookkeeping
 * to Three.js. The renderer consumes this revision before its next frame. */
export function recordingOrientationPatch(state:PlaybackState,patch:Partial<PlaybackState>) {
 return patch.recording===true&&!state.recording
  ? {orientationRevision:state.orientationRevision+1}:{};
}
/** Every entry path, including external recorder updates, must retain the product HUD.
 * Normalize after caller fields so hud:false cannot silently strip a running take. */
export function recordingStatePatch(state:PlaybackState,patch:Partial<PlaybackState>) {
 return {...recordingOrientationPatch(state,patch),...patch,...((patch.recording??state.recording)?{hud:true}:{})};
}
export function setRecordingMode(engine:PlaybackEngine,recording:boolean) {
 engine.update({recording});
}

export function recordingVisibility(recording:boolean) {
 return {hud:true,director:!recording,story:!recording,network:!recording};
}

/** One ownership boundary for cards, copy and scrims; product visibility keeps its HUD rules. */
export function recordingElementVisible(recording:boolean,kind:OverlayKind) {
 return !recording||OVERLAY_OWNERS[kind]==='product';
}

/** Shared overlay/recorder boundary: shot identity plus its nonnegative film clock. */
export function shotOverlayVisible(
 state:{shot:number|null;shotElapsed:number;tMs:number;recording?:boolean}, shot:{id:number;startTime:number}, kind?:OverlayKind,
) {
 // Capture bookkeeping omits kind: a hidden slide must still publish its scene transition.
 return (kind===undefined||recordingElementVisible(state.recording??false,kind)) && state.shot===shot.id && state.shotElapsed>=0 && state.tMs>=shot.startTime*1000-1e-6;
}
export type SceneTransition={sceneIndex:number;sceneId:number;tMs:number;filmTMs?:number};
/** Recorder timestamps use the capture's performance-clock origin, never authored durations. */
export function sceneCaptureRanges(transitions:SceneTransition[],captureStartMs:number,captureEndMs:number) {
 return transitions.map((transition,i)=>({sceneIndex:transition.sceneIndex,sceneId:transition.sceneId,
  startMs:transition.tMs-captureStartMs,endMs:(transitions[i+1]?.tMs??captureEndMs)-captureStartMs}));
}

export type RecordedTake = {
 captureStartMs:number;captureEndMs:number;sceneTransitions:SceneTransition[];
 ranges:ReturnType<typeof sceneCaptureRanges>;
};
/** Recording mode consumes the actual published scene events, including pauses/stalls. */
export class SceneRecording {
 private startMs:number|null=null;
 private endMs:number|null=null;
 private transitions:SceneTransition[]=[];
 begin(tMs:number,initial?:SceneTransition) {
  this.startMs=tMs;this.endMs=null;this.transitions=[];
  if(initial)this.consume({...initial,tMs});
 }
 consume(transition:SceneTransition) {
  if(this.startMs===null||this.endMs!==null)return;
  if(this.transitions.at(-1)?.sceneId===transition.sceneId)return;
  this.transitions.push({...transition});
 }
 end(tMs:number) {if(this.startMs!==null)this.endMs=tMs;return this.snapshot(tMs);}
 snapshot(tMs:number):RecordedTake|null {
  if(this.startMs===null)return null;
  const captureEndMs=this.endMs??tMs;
  const sceneTransitions=this.transitions.map(t=>({...t}));
  return {captureStartMs:this.startMs,captureEndMs,sceneTransitions,
   ranges:sceneCaptureRanges(sceneTransitions,this.startMs,captureEndMs)};
 }
}
