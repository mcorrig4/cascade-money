import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleRewindEvents, rewindLedgerRows, REWIND_DURATION_MS, REWIND_EVENT_CAP } from '../src/globe/rewind-events.ts';
import { eventPosition } from '../src/playback/engine.ts';
import type { Event, EventIndex } from '../src/data/types.ts';

function fixture(entries: { day: number; count: number; type?: string; amount?: bigint }[]) {
  let seq = 0;
  const days = Array.from({ length: 365 }, () => ({ events: [] as Event[] }));
  for (const entry of entries) for (let i = 0; i < entry.count; i++) days[entry.day].events.push({
    seq: ++seq, day: entry.day, type: entry.type ?? 'pay', amount: entry.amount ?? 100n,
    from: 'payer', to: 'payee',
  } as Event);
  return { days } as Pick<EventIndex, 'days'>;
}

test('rewind samples are independent of traversal history and use the scene clock', () => {
  const index = fixture([{ day: 100, count: 3 }, { day: 102, count: 2 }, { day: 115, count: 1 }]);
  const direct = sampleRewindEvents(index, 100.1, 1200);
  for (let p = 105; p > 100.1; p -= .17) sampleRewindEvents(index, p, 1200 - (p - 100.1) * 2000 / 365);
  assert.deepEqual(sampleRewindEvents(index, 100.1, 1200), direct);
  assert.equal(direct.length, 5);
  assert.ok(direct.every((entry, i) => !i || entry.position < direct[i - 1].position));
  for (const entry of direct) {
    assert.ok(Math.abs(entry.age - (entry.position - 100.1) * 2000 / 365) < 1e-9);
    assert.equal(entry.born, 1200 - entry.age);
    assert.equal(entry.life, 10 * 2000 / 365);
    assert.ok(entry.age >= 0 && entry.age < entry.life);
  }
});

test('rewind crosses the same fractional event boundaries as playback and removes posted rows', () => {
  const index = fixture([{ day: 12, count: 3 }]);
  const boundary = 12 + eventPosition(1, 3);
  const before = rewindLedgerRows(index, boundary + .000001);
  const after = rewindLedgerRows(index, boundary - .000001);
  assert.deepEqual(before.map(e => e.seq), [2, 1]);
  assert.deepEqual(after.map(e => e.seq), [1]);
  const crossed = sampleRewindEvents(index, boundary - .000001, 1000);
  assert.ok(crossed.some(entry => entry.event.seq === 2));
  assert.ok(!crossed.some(entry => entry.event.seq === 1));
});

test('rewind caps output to 80 nearby positive payments and stops at exactly two seconds', () => {
  const index = fixture([{ day: 80, count: 120 }, { day: 81, count: 2, type: 'checkpoint' }, { day: 82, count: 2, amount: 0n }, { day: 100, count: 2 }]);
  const samples = sampleRewindEvents(index, 80, 1000, { maxEvents: 1000 });
  assert.equal(samples.length, REWIND_EVENT_CAP);
  assert.deepEqual(samples.map(s => s.event.seq), Array.from({ length: 80 }, (_, i) => 80 - i));
  assert.equal(sampleRewindEvents(index, 80, 1000, { maxEvents: 3 }).length, 3);
  assert.equal(sampleRewindEvents(index, 80.999, 1000).length, 0);
  assert.deepEqual(sampleRewindEvents(index, 80, REWIND_DURATION_MS), []);
  assert.deepEqual(sampleRewindEvents(index, 80, -1), []);
  assert.throws(() => sampleRewindEvents(index, NaN, 1000), RangeError);
  assert.throws(() => sampleRewindEvents(index, 80, 1000, { windowDays: 0 }), RangeError);
});

test('rewind never creates events before the start clock and supports bounded longer streaks', () => {
  const index = fixture([{ day: 350, count: 1 }, { day: 360, count: 1 }]);
  assert.deepEqual(sampleRewindEvents(index, 350, 0), []);
  const sample = sampleRewindEvents(index, 350, 500, { windowDays: 50 });
  assert.equal(sample.length, 2);
  assert.equal(sample[0].life, 50 * 2000 / 365);
  assert.ok(sample.every(entry => entry.born >= 0));
});

test('ledger rows bridge midnight without resurrecting future payments or scanning the whole year', () => {
  const index = fixture([{ day: 1, count: 1 }, { day: 18, count: 2 }, { day: 19, count: 1 }, { day: 20, count: 1 }]);
  assert.deepEqual(rewindLedgerRows(index, 19.1).map(e => e.day), [18, 18]);
  assert.deepEqual(rewindLedgerRows(index, 20.8, 2).map(e => e.day), [20, 19]);
  assert.deepEqual(rewindLedgerRows(index, 0), []);
  assert.throws(() => rewindLedgerRows(index, Infinity), RangeError);
});
