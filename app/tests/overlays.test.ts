import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adaptEvent, adaptSummary, parseLine } from '../src/data/adapters.ts';
import { appendEvent, createIndex, finishIndex } from '../src/data/index.ts';
import { activeChecks, curveQuotes, extensionAccrual, latestEvent, rational } from '../src/data/overlay-selectors.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { playShot, proofPayments, SHOTS } from '../src/director/shots.ts';
const records = (await readFile(new URL('./fixtures/events-v1.ndjson', import.meta.url), 'utf8')).trim().split('\n').map(parseLine);
const makeIndex = () => { const i = createIndex(); records.forEach(r => appendEvent(i, r)); return finishIndex(i); };
const event = (seq: number, type: string, data: object = {}, day = 0) => adaptEvent({ schema_version: 2, seq, type, day, amount_cents: 10000, data });

test('published v2 summaries distinguish daily and cumulative commitments', () => {
  const summary = adaptSummary(event(1, 'day_summary', { new_invoices: { count: 2, cents: 800 }, invoices_settled: { count: 3, cents: 900 }, principal_committed_cents: 300, principal_committed_to_date_cents: 1300, gross_settled_to_date_cents: 2900 }));
  assert.equal(summary?.purchases, 800n); assert.equal(summary?.dailyCommitted, 300n);
  assert.equal(summary?.committed, 1300n); assert.equal(summary?.grossSettled, 2900n);
});
test('curve uses executed, face-weighted prices through the current sequence only', () => {
  const index = createIndex();
  index.trades = [event(1, 'sell', { date: 30, spot_cents: 9900 }), event(3, 'sell', { date: 30, spot_cents: 9700 }), event(4, 'sell', { date: 60, spot_cents: 9600 })];
  assert.equal(curveQuotes(index, 0).every(q => q.price === null), true);
  assert.equal(curveQuotes(index, 1)[1].price, 0.99);
  assert.equal(curveQuotes(index, 3)[1].price, 0.98);
  assert.equal(curveQuotes(index, 3)[2].price, null);
});
test('inclusive extension interval uses cutoff differences and excludes future checkpoints', () => {
  const index = createIndex(), extension = event(1, 'extend', { entitlement: { start_day: 31, end_day: 90 } });
  const checkpoint = (seq: number, day: number, value: string) => ({ ...event(seq, 'checkpoint', {}, day), cutoff: { day, value } });
  index.checkpoints = [checkpoint(2, 30, '100/100'), checkpoint(3, 60, '103/100'), checkpoint(4, 90, '106/100')];
  assert.equal(extensionAccrual(index, extension, 1), null);
  assert.equal(extensionAccrual(index, extension, 2), 0n);
  assert.equal(extensionAccrual(index, extension, 3), 300n);
  assert.equal(extensionAccrual(index, extension, 4), 600n);
  assert.equal(rational('1/0'), null);
});
test('invariant and breach booleans have opposite meanings; missing state stays missing', () => {
  const e = event(1, 'checkpoint'); e.checks = { hard: { principal: true, yield: false }, breaches: { solvency: false, liquidity: true } };
  assert.deepEqual(activeChecks(e).hard.map(c => c.pass), [true, false]);
  assert.deepEqual(activeChecks(e).breaches.map(c => c.active), [false, true]);
  assert.equal(latestEvent(createIndex(), 0, 0), undefined);
});
test('new display chain drives proof counters and Asan camera without unrelated payments', () => {
  const index = makeIndex(); index.schema = 2;
  const ids = ['Apple', 'Samsung Display', 'Corning', 'Silica', 'Freight'];
  const lat = [37.3349, 36.803, 37.772, 41.2, 33.77], lng = [-122.009, 127.057, -84.837, -89, -118.2];
  ids.forEach((id, i) => index.firms.set(id, { id, name: id, role: 'supplier', named: true, lat: lat[i], lng: lng[i] }));
  index.payments.forEach((p, i) => { p.from = ids[i]; p.to = ids[i + 1]; });
  assert.deepEqual(proofPayments(index).map(e => e.to), ids.slice(1));
  const engine = new PlaybackEngine(index); playShot(engine, 3); engine.tick(0.5);
  assert.equal(engine.state.camera.lng, 127.057);
  engine.tick(11.5); assert.equal(engine.totals().settled, 20000000000n);
});
test('all overlay shots start independently, pause and cancel scheduled flights', () => {
  const engine = new PlaybackEngine(makeIndex()); assert.equal(SHOTS.length, 12);
  for (let shot = 6; shot <= 12; shot++) {
    playShot(engine, shot); assert.equal(engine.state.shot, shot);
    engine.tick(0.1); engine.toggle(); const elapsed = engine.state.shotElapsed;
    engine.tick(5); assert.equal(engine.state.shotElapsed, elapsed);
    engine.stopShot(); const camera = engine.state.camera.id;
    engine.tick(60); assert.equal(engine.state.camera.id, camera);
  }
  playShot(engine, 10); engine.tick(4); assert.equal(engine.state.stage, 'cube');
  assert.equal(engine.state.camera.altitude, 8 / 6_371_000);
  assert.equal(engine.state.camera.site, 'fifth-avenue');
  engine.tick(5); assert.equal(engine.state.stage, 'cube');
  engine.tick(.21); assert.equal(engine.state.stage, 'wide');
});
test('legacy v1 without geographic enrichment still gets its five presentation positions', () => {
  const index = createIndex();
  records.forEach((r, i) => {
    const raw = { ...r, schema_version: 1 }; delete raw.iso_date;
    if (i === 0) raw.data = { ...(r.data as object), nodes: ((r.data as { nodes: { id: string }[] }).nodes).map(n => ({ id: n.id })) };
    appendEvent(index, raw);
  });
  finishIndex(index); assert.equal(index.firms.size, 5); assert.equal([...index.firms.values()].every(f => f.lat !== undefined), true);
  assert.equal(proofPayments(index).length, 4);
});
