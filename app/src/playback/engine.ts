import { sampleCamera, type CameraCommand, type Pose, type Center, type Ease, type Route, type Keyframe, orbitAt } from '../camera/primitives.ts';
import { DAYS } from '../data/types.ts';
import type { Event, EventIndex, Totals } from '../data/types.ts';

export type Speed = 1 | 10 | 50 | 'year';
export interface PlaybackState {
  position: number; day: number; cursor: number; playing: boolean; speed: Speed;
  revision: number; shot: number | null; shotRunning: boolean; story: string;
  recording: boolean; camera: CameraCommand; cameraElapsed:number; film:boolean; exposure:number; flash: {from:number;to:number;elapsed:number;duration:number}|null; timelapse:{days:number;direction:number;duration:number;elapsed:number}|null;
  showDebt: boolean; caption: boolean; shotElapsed: number; shotDuration: number; stage: 'main' | 'cube' | 'wide'; focusInvoices: string[] | null;
}
export const eventPosition = (index: number, count: number) => 0.08 + (index + 1) / (count + 1) * 0.84;
export const speedRate = (speed: Speed) => speed === 'year' ? DAYS / 15 : speed;

export class PlaybackEngine {
  index: EventIndex;
  state: PlaybackState;
  listeners = new Set<() => void>();
  private scheduled: { time: number; run: () => void }[] = [];
  private shotClock = 0;
  private clockMode: 'realtime' | 'manual' = 'realtime';
  /** Captures own the timeline; RAF ticks must not add unaccounted wall time. */
  setClockMode(mode: 'realtime' | 'manual') { this.clockMode = mode; }
  private observedCamera?:{id:number;pose:Pose};
  observeCamera(pose:Pose){this.observedCamera={id:this.state.camera.id,pose};}
  storyEvents: Event[] | null = null;
  /** Future interior renderer may accept the descent; absent means above-ground fallback. */
  subsurfaceInteriorCameraHook?: (durationMs:number)=>boolean;
  private storyQueue: Event[] = [];
  reveal(event: Event) { this.storyEvents?.push(event); this.storyQueue.push(event); }
  drainStoryEvents() { return this.storyQueue.splice(0); }
  private range?: { start: number; end: number; seconds: number; elapsed: number; complete?: () => void };
  constructor(index: EventIndex) {
    this.index = index;
    this.state = { position: 0.999, day: 0, cursor: index.days[0].events.length, playing: false, speed: 1,
      cameraElapsed:0, film:false, exposure:0, flash:null, timelapse:null, revision: 0, shot: null, shotRunning: false, story: 'all', recording: false, showDebt: false, caption: false,
      shotElapsed: 0, shotDuration: 0, stage: 'main', focusInvoices: null,
      camera: { lat: 36, lng: -145, altitude: 2.15, duration: 0, id: 0 } };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  update(patch: Partial<PlaybackState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  setPosition(position: number, revision = false) {
    position = Math.max(0, Math.min(DAYS - 0.000001, position));
    const day = Math.floor(position), fraction = position - day, events = this.index.days[day].events;
    let cursor = 0, high = events.length;
    while (cursor < high) { const mid = (cursor + high) >>> 1; if (eventPosition(mid, events.length) <= fraction) cursor = mid + 1; else high = mid; }
    this.update({ position, day, cursor, revision: this.state.revision + Number(revision) });
  }
  seek(day: number) { this.stopShot(); this.update({ playing: false }); this.setPosition(Math.floor(day) + 0.999, true); }
  replayDay() { this.stopShot(); this.setPosition(this.state.day, true); this.update({ playing: true }); }
  toggle() {
    if (this.state.shot !== null && !this.state.shotRunning && !this.range && !this.scheduled.length) this.stopShot();
    if (!this.state.playing && !this.state.shotRunning && this.state.position % 1 > 0.99) this.setPosition(this.state.day, true);
    if (this.state.shot !== null) this.update({ shotRunning: !this.state.shotRunning, playing: !this.state.shotRunning && !!this.range });
    else this.update({ playing: !this.state.playing });
  }
  setSpeed(speed: Speed) {
    this.stopShot(); this.update({ speed });
    if (speed === 'year') { this.setPosition(0, true); this.update({ playing: true }); }
  }
  stopShot() {
    this.scheduled = []; this.range = undefined; this.storyEvents = null; this.storyQueue = [];
    this.update({ exposure:0,flash:null,timelapse:null,film:false, shot: null, shotRunning: false, stage: 'main', focusInvoices: null, showDebt: false, caption: false, playing: false });
  }
  beginShot(shot: number, duration = 0) {
    const {exposure,flash,timelapse}=this.state;
    this.stopShot(); this.update({exposure,flash,timelapse}); this.shotClock = 0;
    this.update({ shot, shotElapsed: 0, shotDuration: duration, shotRunning: true, revision: this.state.revision + 1 });
  }
  after(seconds: number, run: () => void) {
    this.scheduled.push({ time: seconds, run }); this.scheduled.sort((a, b) => a.time - b.time);
  }
  playRange(start: number, end: number, seconds: number, complete?: () => void) {
    this.setPosition(start, true);
    this.range = { start, end, seconds, elapsed: 0, complete };
    this.update({ playing: true });
  }
  currentCamera():Pose { return this.observedCamera?.id===this.state.camera.id && this.state.cameraElapsed>=this.state.camera.duration ? this.observedCamera.pose : sampleCamera(this.state.camera,this.state.cameraElapsed); }
  fly(lat:number,lng:number,altitude:number,duration=1800,siteOrOptions?:CameraCommand['site']|{ease?:Ease;route?:Route;site?:CameraCommand['site']}) {
    const options=typeof siteOrOptions==='string'?{site:siteOrOptions}:siteOrOptions??{};
    this.update({camera:{lat,lng,altitude,duration,id:this.state.camera.id+1,from:this.currentCamera(),primitive:{kind:'fly'},ease:{kind:'cubic'},...options},cameraElapsed:0});
  }
  orbit(center:Center,radius:number,altitude:number,angularSpeed:number,duration:number,bearing=0) {
    const end=orbitAt(center,radius,altitude,bearing+angularSpeed*duration/1000);
    this.update({camera:{...end,id:this.state.camera.id+1,duration,from:this.currentCamera(),site:'apple-park',primitive:{kind:'orbit',center,radius,angularSpeed,bearing}},cameraElapsed:0});
  }
  splinePath(keyframes:Keyframe[],duration:number,landmarkPath?:CameraCommand['landmarkPath']) {
    if(keyframes.length<3 || keyframes.some((k,i)=>i>0&&k.t<=keyframes[i-1].t))throw new Error('Spline requires three ordered keyframes');
    this.update({camera:{...keyframes.at(-1)!,id:this.state.camera.id+1,duration,from:this.currentCamera(),primitive:{kind:'spline',keyframes},landmarkPath},cameraElapsed:0});
  }
  snapAndPullOut(center:Center,snapAltitude:number,pullOutAltitude:number,duration:number) {
    // The spline lands here first. Re-centering is a short continuous settle
    // when invoked elsewhere, never a zero-duration teleport.
    const now=this.currentCamera();
    if(Math.abs(now.lat-center.lat)+Math.abs(now.lng-center.lng)+Math.abs(now.altitude-snapAltitude)>.000001){
      this.fly(center.lat,center.lng,snapAltitude,300);
      this.after(this.state.shotElapsed+.3,()=>this.fly(center.lat,center.lng,pullOutAltitude,duration));
    }else this.fly(center.lat,center.lng,pullOutAltitude,duration);
  }
  timelapse(center:Center|'global',days:number,direction:'forward'|'reverse',duration:number) {
    if(center!=='global')this.fly(center.lat,center.lng,this.currentCamera().altitude,Math.min(600,duration));
    this.update({timelapse:{days,direction:direction==='reverse'?-1:1,duration,elapsed:0}});
  }
  flashToWhite(duration:number) { this.update({flash:{from:this.state.exposure,to:1,elapsed:0,duration}}); }
  fadeFromWhite(duration:number) { this.update({flash:{from:this.state.exposure,to:0,elapsed:0,duration}}); }
  tick(seconds:number, source: 'realtime' | 'manual' = 'realtime') {
    if (source !== this.clockMode) return;
    let remaining=Math.max(0,seconds),guard=0;
    do {
      // Consume exact cue boundaries, including when a capture advances many
      // seconds at once. No range from scene N leaks into N+1.
      const next=this.state.shotRunning?this.scheduled[0]?.time:undefined;
      const dt=next===undefined?remaining:Math.min(remaining,Math.max(0,next-this.shotClock));
      if(this.state.shotRunning){this.shotClock+=dt;this.update({shotElapsed:this.shotClock});}
      if(this.state.shotRunning||this.state.shot===null){
        const flash=this.state.flash,tl=this.state.timelapse;
        this.update({cameraElapsed:this.state.cameraElapsed+dt*1000,
          ...(flash?{flash:{...flash,elapsed:flash.elapsed+dt*1000},exposure:flash.from+(flash.to-flash.from)*Math.min(1,(flash.elapsed+dt*1000)/Math.max(1,flash.duration))}:{}),
          ...(tl?{timelapse:{...tl,elapsed:Math.min(tl.duration,tl.elapsed+dt*1000)}}:{})});
      }
      if(this.state.playing){
        if(this.range){const range=this.range;range.elapsed+=dt;const fraction=Math.min(1,range.elapsed/range.seconds);
          this.setPosition(range.start+(range.end-range.start)*fraction);
          if(fraction===1){this.range=undefined;this.update({playing:false});range.complete?.();}
        }else{const position=this.state.position+dt*speedRate(this.state.speed);this.setPosition(position);if(position>=DAYS)this.update({playing:false});}
      }
      remaining-=dt;
      while(this.state.shotRunning&&this.scheduled.length&&this.scheduled[0].time<=this.shotClock+1e-9)this.scheduled.shift()!.run();
      if(++guard>1000)throw new Error('Director cue loop');
    }while(remaining>1e-9);
  }
  totals(): Totals {
    const bucket = this.index.days[this.state.day];
    if (this.state.focusInvoices) {
      const seq = bucket.events[this.state.cursor - 1]?.seq ?? (bucket.events[0]?.seq ?? Infinity) - 1;
      const result = { settled: 0n, committed: 0n };
      for (const e of this.storyEvents ?? this.index.payments) if ((this.storyEvents !== null || e.seq <= seq) && this.state.focusInvoices.includes(e.invoiceId ?? '')) {
        if (e.type === 'issue' || e.type === 'pay') result.settled += e.amount;
        if (e.type === 'issue') result.committed += e.amount;
      }
      return result;
    }
    return bucket.prefix[this.state.cursor - 1] ?? bucket.start;
  }
  visibleEvents(): Event[] { return this.index.days[this.state.day].events.slice(0, this.state.cursor); }
}
