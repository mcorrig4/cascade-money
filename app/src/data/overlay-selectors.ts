import { money, record } from './adapters.ts';
import { dollars } from './format.ts';
import type { Event, EventIndex } from './types.ts';

export function rational(value: unknown): { n: bigint; d: bigint } | null {
  if (typeof value === 'bigint') return { n: value, d: 1n };
  if (typeof value === 'number' && Number.isSafeInteger(value)) return { n: BigInt(value), d: 1n };
  if (typeof value !== 'string' || !/^-?\d+(\/\d+)?$/.test(value)) return null;
  const [n, d = '1'] = value.split('/');
  return BigInt(d) > 0n ? { n: BigInt(n), d: BigInt(d) } : null;
}
export function rationalDollars(value: unknown): string {
  const r = rational(value); return r ? dollars(r.n / r.d, true) : '—';
}
export function latestEvent(index: EventIndex, day: number, cursor: number): Event | undefined {
  return index.days[day].events[cursor - 1] ?? (day > 0 ? index.days[day - 1].lastState : undefined);
}
export const TENORS = [7, 30, 60, 90, 180];
export function curveQuotes(index: EventIndex, seq: number) {
  return TENORS.map(tenor => {
    let face = 0n, spot = 0n, trades = 0;
    for (const e of index.trades) {
      if (e.seq > seq) break;
      if (Number(e.data.date) - e.day !== tenor || e.amount <= 0n) continue;
      face += e.amount; spot += money(e.data.spot_cents); trades++;
    }
    return { tenor, trades, price: face ? Number(spot * 1_000_000n / face) / 1_000_000 : null };
  });
}
export function extensionAccrual(index: EventIndex, extension: Event | undefined, seq: number) {
  if (!extension) return null;
  const entitlement = record(extension.data.entitlement);
  const start = Number(entitlement.start_day), end = Number(entitlement.end_day);
  const through = index.checkpoints.findLast(e => e.seq <= seq);
  if (!through || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (through.cutoff.day < start) return 0n;
  const initial = index.checkpoints.findLast(e => e.seq <= seq && e.cutoff.day <= start - 1);
  const final = index.checkpoints.findLast(e => e.seq <= seq && e.cutoff.day <= end);
  const a = rational(initial?.cutoff.value), b = rational(final?.cutoff.value);
  if (!a || !b) return null;
  return extension.amount * (b.n * a.d - a.n * b.d) / (a.d * b.d);
}
export function activeChecks(event: Event | undefined) {
  return {
    hard: Object.entries(event?.checks.hard ?? {}).map(([name, pass]) => ({ name, pass: pass === true })),
    breaches: Object.entries(event?.checks.breaches ?? {}).map(([name, active]) => ({ name, active: active === true })),
  };
}
