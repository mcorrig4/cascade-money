import { DAYS } from '../data/types.ts';
import type { Event, EventIndex, Totals } from '../data/types.ts';

export type Speed = 1 | 10 | 50 | 'year';
export interface PlaybackState {
  position: number; day: number; cursor: number; playing: boolean; speed: Speed;
  revision: number; shot: number | null; shotRunning: boolean; story: string;
  recording: boolean; camera: { lat: number; lng: number; altitude: number; duration: number; id: number; site?: 'apple-park' | 'fifth-avenue' };
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
  storyEvents: Event[] | null = null;
  private storyQueue: Event[] = [];
  reveal(event: Event) { this.storyEvents?.push(event); this.storyQueue.push(event); }
  drainStoryEvents() { return this.storyQueue.splice(0); }
  private range?: { start: number; end: number; seconds: number; elapsed: number; complete?: () => void };
  constructor(index: EventIndex) {
    this.index = index;
    this.state = { position: 0.999, day: 0, cursor: index.days[0].events.length, playing: false, speed: 1,
      revision: 0, shot: null, shotRunning: false, story: 'all', recording: false, showDebt: false, caption: false,
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
    this.update({ shot: null, shotRunning: false, stage: 'main', focusInvoices: null, showDebt: false, caption: false, playing: false });
  }
  beginShot(shot: number, duration = 0) {
    this.stopShot(); this.shotClock = 0;
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
  fly(lat: number, lng: number, altitude: number, duration = 1800, site?: 'apple-park' | 'fifth-avenue') {
    this.update({ camera: { lat, lng, altitude, duration, site, id: this.state.camera.id + 1 } });
  }
  tick(seconds: number) {
    if (this.state.shotRunning) {
      this.shotClock += seconds; this.update({ shotElapsed: this.shotClock });
      while (this.scheduled.length && this.scheduled[0].time <= this.shotClock) this.scheduled.shift()!.run();
    }
    if (!this.state.playing) return;
    if (this.range) {
      const range = this.range;
      range.elapsed += seconds;
      const fraction = Math.min(1, range.elapsed / range.seconds);
      this.setPosition(range.start + (range.end - range.start) * fraction);
      if (fraction === 1) { this.range = undefined; this.update({ playing: false, shotRunning: false }); range.complete?.(); }
      return;
    }
    const position = this.state.position + seconds * speedRate(this.state.speed);
    this.setPosition(position);
    if (position >= DAYS) this.update({ playing: false, shotRunning: false });
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
