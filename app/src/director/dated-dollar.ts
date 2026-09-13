import { dateForDay } from '../data/types.ts';

/** Both arguments are simulation UTC days, never host-local dates. */
export function datedUnit(maturityDay: number, simulationDay: number) {
  return { days: Math.max(0, maturityDay - simulationDay), isoDate: dateForDay(maturityDay) };
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Tick d represents the newly owned interval [d, d+1); the old interval stays empty. */
export function extensionAt(tMs: number, startMs: number, endMs: number, oldDay = 30, newDay = 90) {
  const progress = clamp((tMs - startMs) / Math.max(1, endMs - startMs));
  const maturityDay = oldDay + Math.round((newDay - oldDay) * progress);
  return { maturityDay, addedDays: maturityDay - oldDay,
    ticks: Array.from({ length: newDay }, (_, day) => ({ day, filled: day >= oldDay && day < maturityDay })) };
}
/** A complete orbit exchanges the coins and returns them to their own positions. */
export function sameDateSwapAt(tMs: number, startMs: number, endMs: number) {
  const angle = clamp((tMs - startMs) / Math.max(1, endMs - startMs)) * Math.PI * 2;
  return [0, 1].map(i => ({ x: (i ? 1 : -1) * Math.cos(angle), y: (i ? 1 : -1) * Math.sin(angle) }));
}
