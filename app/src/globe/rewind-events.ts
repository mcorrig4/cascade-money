import { DAYS, isPayment, type Event, type EventIndex } from '../data/types.ts';
import { eventPosition } from '../playback/engine.ts';

export const REWIND_DURATION_MS = 2000;
export const REWIND_EVENT_CAP = 80;
export const REWIND_WINDOW_DAYS = 10;
export interface RewindEvent {
  event: Event;
  /** Absolute event position on the same day/fraction clock as PlaybackEngine. */
  position: number;
  /** Birth and lifetime use the scene's rewind elapsed clock, never wall time. */
  born: number;
  life: number;
  age: number;
}
export interface RewindOptions { windowDays?: number; maxEvents?: number }
const drawable = (event: Event) => isPayment(event) && event.amount > 0n;
const millisecondsPerDay = REWIND_DURATION_MS / DAYS;

/**
 * Payments just crossed by a backwards playhead. Rebuild the pool from this
 * result each frame: seeking straight to a timestamp and stepping to it produce
 * identical samples. Scan only nearby day buckets; output is always capped.
 */
export function sampleRewindEvents(index: Pick<EventIndex, 'days'>, position: number, elapsedMs: number, options: RewindOptions = {}): RewindEvent[] {
  if (!Number.isFinite(position) || !Number.isFinite(elapsedMs)) throw new RangeError('Rewind position and elapsed time must be finite');
  if (position < 0 || position >= DAYS || elapsedMs < 0 || elapsedMs >= REWIND_DURATION_MS) return [];
  const windowDays = options.windowDays ?? REWIND_WINDOW_DAYS;
  const maxEvents = options.maxEvents ?? REWIND_EVENT_CAP;
  if (!Number.isFinite(windowDays) || windowDays <= 0 || !Number.isInteger(maxEvents) || maxEvents < 1) throw new RangeError('Rewind window and event cap must be positive');
  const window = Math.min(windowDays, DAYS), cap = Math.min(maxEvents, REWIND_EVENT_CAP);
  const life = window * millisecondsPerDay;
  const result: RewindEvent[] = [];
  for (let day = Math.floor(position); day <= Math.min(index.days.length - 1, Math.floor(position + window)); day++) {
    const events = index.days[day]?.events ?? [];
    for (let offset = 0; offset < events.length; offset++) {
      const event = events[offset];
      if (!drawable(event)) continue;
      const at = day + eventPosition(offset, events.length);
      // Newer events have just un-posted. Older events have not been crossed yet.
      if (at < position || at >= position + window) continue;
      const age = (at - position) * millisecondsPerDay;
      if (age > elapsedMs) continue;
      result.push({ event, position: at, born: elapsedMs - age, life, age });
      // Prefer the most recently crossed payments when the visual budget fills.
      if (result.length >= cap) return result.reverse();
    }
  }
  return result.reverse();
}

/** Still-posted rows immediately before the playhead; backwards crossings remove rows. */
export function rewindLedgerRows(index: Pick<EventIndex, 'days'>, position: number, limit = 6): Event[] {
  if (!Number.isFinite(position) || !Number.isInteger(limit) || limit < 1) throw new RangeError('Ledger position must be finite and row limit positive');
  if (position < 0 || !index.days.length) return [];
  const lastDay = Math.min(index.days.length - 1, Math.floor(position));
  const result: Event[] = [], cap = Math.min(limit, REWIND_EVENT_CAP);
  for (let day = lastDay; day >= Math.max(0, lastDay - REWIND_WINDOW_DAYS); day--) {
    const events = index.days[day]?.events ?? [];
    for (let offset = events.length - 1; offset >= 0; offset--) {
      if (day + eventPosition(offset, events.length) > position || !drawable(events[offset])) continue;
      result.push(events[offset]);
      if (result.length >= cap) return result;
    }
  }
  return result;
}
