import test from 'node:test';
import assert from 'node:assert/strict';
import { projectEvent, projectLine } from '../scripts/lib/project-events.mjs';

const envelope = {
  accounts: ['A', 'B'], actor: 'A', amount_cents: 100,
  balance_sheet: { backing_asset_units: '1/1', backing_value_cents: 1, claimable_cents: 2, dated_cents: 3, deficit_cents: 4, principal_cents: 5, reserve_cents: 6, spot_cents: 7, unclaimed_accrued_cents: 8 },
  checks: { breaches: { liquidity_standard: false, solvency: false }, hard: { cursor_monotonicity: true, date_rule: null } },
  dates: [1, 2], day: 3, index: { day: 3, value: '123456789012345678901234567890/1' }, iso_date: '2025-09-12',
  request_id: 'req:1', schema_version: 2, seq: 42,
};

test('non-checkpoint event drops actor, request_id, dates and the exact-rational index snapshot', () => {
  const out = projectEvent({ ...envelope, type: 'claim', data: { entitlement_id: 'e:1', residual_cents: '0/1', value_cents: '0/1' } });
  assert.equal('actor' in out, false);
  assert.equal('request_id' in out, false);
  assert.equal('dates' in out, false);
  assert.equal('index' in out, false);
  assert.deepEqual(out.data, {}, 'claim carries no loader-consumed data fields');
  assert.equal(out.schema_version, 2); assert.equal(out.seq, 42); assert.equal(out.day, 3);
  assert.equal(out.iso_date, '2025-09-12'); assert.equal(out.amount_cents, 100);
  assert.deepEqual(out.accounts, ['A', 'B']);
});

test('checkpoint keeps the exact-rational index snapshot; other types never do', () => {
  const cp = projectEvent({ ...envelope, type: 'checkpoint', data: { matured_cents: 500, gross_backing_value_cents: 999 } });
  assert.deepEqual(cp.index, { day: 3, value: '123456789012345678901234567890/1' });
  assert.deepEqual(cp.data, { matured_cents: 500 }, 'unused checkpoint fields are dropped');
  const pay = projectEvent({ ...envelope, type: 'pay', data: { debtor: 'A', creditor: 'B', invoice_id: 'i:1', legs: [{ amount_cents: 100, date: 90 }] } });
  assert.equal('index' in pay, false);
});

test('balance_sheet keeps only the seven overlay-consumed totals', () => {
  const out = projectEvent({ ...envelope, type: 'withdraw', data: { asset_units: '999999999999999/452148619' } });
  assert.deepEqual(out.balance_sheet, { backing_value_cents: 1, claimable_cents: 2, dated_cents: 3, deficit_cents: 4, reserve_cents: 6, spot_cents: 7, unclaimed_accrued_cents: 8 });
  assert.equal('principal_cents' in out.balance_sheet, false);
  assert.equal('backing_asset_units' in out.balance_sheet, false);
  assert.deepEqual(out.data, {}, 'withdraw asset_units is unused by the loader');
});

test('checks.hard and checks.breaches pass through in full, including null entries', () => {
  const out = projectEvent({ ...envelope, type: 'claim', data: {} });
  assert.deepEqual(out.checks, { hard: { cursor_monotonicity: true, date_rule: null }, breaches: { liquidity_standard: false, solvency: false } });
});

test('invoice_registered keeps only the invoice fields adaptInvoice reads', () => {
  const invoice = { invoice_id: 'apple:1', creditor: 'Samsung Display', debtor: 'Apple', amount_cents: 10_000, due_day: 90, maturity_bound: 90, signed_day: 0, outstanding_cents: 10_000, issued_cents: 0, paid_cents: 0, item: 'panels', quantity: 5, unit: 'panels', deliver_to: 'foxconn-zhengzhou' };
  const out = projectEvent({ ...envelope, type: 'invoice_registered', data: { invoice } });
  assert.deepEqual(out.data, { invoice: { invoice_id: 'apple:1', creditor: 'Samsung Display', debtor: 'Apple', amount_cents: 10_000, item: 'panels', quantity: 5, unit: 'panels', deliver_to: 'foxconn-zhengzhou' } });
});

test('run_started keeps only firm/site fields adaptFirm reads, dropping policy/tier/category', () => {
  const node = { id: 'Apple', name: 'Apple', role: 'anchor', lat: 37.3, lon: -122, city: 'Cupertino', country: 'United States', region: 'North America', tier: 1, category: 'components', policy: 'naive', cash_need_bps: 1000, sites: [{ site_id: 'apple-park', lat: 37.3, lon: -122, city: 'Cupertino', country: 'United States', region: 'North America' }] };
  const out = projectEvent({ ...envelope, type: 'run_started', data: { nodes: [node], policy: {}, phase: 'A', world: 'apple', seed: 1, requested_days: 365 } });
  assert.deepEqual(out.data, { nodes: [{ id: 'Apple', name: 'Apple', role: 'anchor', lat: 37.3, lon: -122, city: 'Cupertino', country: 'United States', region: 'North America', sites: [{ site_id: 'apple-park', lat: 37.3, lon: -122, city: 'Cupertino', country: 'United States' }] }] });
});

test('run_completed keeps only the two metrics fields index.ts cross-checks', () => {
  const out = projectEvent({ ...envelope, type: 'run_completed', data: { world: 'apple', requested_days: 365, daily_checkpoints_executed: 365, metrics: { gross_invoice_settled_cents: 1, principal_deposited_cents: 2, reuse_multiple: '9/2', circulation_efficiency_status: 'x' }, invoice_count: 999, balance_sheets: [1, 2, 3], story_totals: {}, suppliers: [], days: [] } });
  assert.deepEqual(out.data, { metrics: { gross_invoice_settled_cents: 1, principal_deposited_cents: 2 } });
});

test('an unrecognized future event type keeps its envelope but drops all data fields', () => {
  const out = projectEvent({ ...envelope, type: 'some_future_type', data: { anything: 'goes here', nested: { a: 1 } } });
  assert.deepEqual(out.data, {});
  assert.equal(out.type, 'some_future_type');
});

test('projectLine round-trips a raw NDJSON line to its projected JSON line', () => {
  const line = JSON.stringify({ ...envelope, type: 'sell', data: { seller: 'A', buyer: 'B', date: 11, spot_cents: 998_800, discount_bps: 12, clearing_discount: '3/2500' } });
  const projected = JSON.parse(projectLine(line));
  assert.deepEqual(projected.data, { seller: 'A', buyer: 'B', date: 11, spot_cents: 998_800 });
});
