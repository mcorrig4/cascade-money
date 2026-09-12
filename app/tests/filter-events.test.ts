import test from 'node:test';
import assert from 'node:assert/strict';
import { keepEvent, keepInternalEvent, capPerDay, ALWAYS_KEEP, INTERNAL_FOUR } from '../scripts/lib/filter-events.mjs';

const cameraAccounts = new Set(['Apple', 'Samsung Display']);

test('always-keep types survive regardless of accounts or day', () => {
  for (const type of ALWAYS_KEEP) {
    assert.equal(keepEvent({ type, accounts: ['Some Unrelated Supplier'], day: 300 }, cameraAccounts), true, type);
  }
});

test('an internal-four event touching a story camera account is kept on any day', () => {
  for (const type of INTERNAL_FOUR) {
    assert.equal(keepInternalEvent({ type, accounts: ['Samsung Display'], day: 300 }, cameraAccounts), true, type);
  }
});

test('an internal-four event is kept within the first week even off-story', () => {
  assert.equal(keepInternalEvent({ type: 'claim', accounts: ['Some Unrelated Supplier'], day: 7 }, cameraAccounts), true);
  assert.equal(keepInternalEvent({ type: 'claim', accounts: ['Some Unrelated Supplier'], day: 0 }, cameraAccounts), true);
});

test('an internal-four event off-story and past the first week is dropped', () => {
  assert.equal(keepInternalEvent({ type: 'claim', accounts: ['Some Unrelated Supplier'], day: 8 }, cameraAccounts), false);
  assert.equal(keepEvent({ type: 'withdraw', accounts: ['Some Unrelated Supplier'], day: 300 }, cameraAccounts), false);
});

test('capPerDay keeps only the N largest-amount internal-four events per day, leaving other kept types untouched', () => {
  const day0Internal = [10, 5, 30, 1, 20].map((amount, i) => ({ projected: { type: 'claim', day: 0, amount_cents: amount, seq: i } }));
  const day1Internal = [50, 60].map((amount, i) => ({ projected: { type: 'withdraw', day: 1, amount_cents: amount, seq: 100 + i } }));
  const nonInternal = [{ projected: { type: 'pay', day: 0, amount_cents: 999999, seq: 200 } }];
  const kept = capPerDay([...day0Internal, ...day1Internal, ...nonInternal], 2);
  const day0Kept = kept.filter(e => e.projected.type === 'claim').map(e => e.projected.amount_cents).sort((a, b) => a - b);
  assert.deepEqual(day0Kept, [20, 30], 'only the two largest day-0 claims survive');
  assert.equal(kept.filter(e => e.projected.type === 'withdraw').length, 2, 'day 1 had only 2, under the cap, so both survive');
  assert.equal(kept.some(e => e.projected.type === 'pay'), true, 'non-internal types are never capped');
});
