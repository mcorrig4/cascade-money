import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { appendEvent, createIndex, finishIndex } from '../src/data/index.ts';
import { parseLine } from '../src/data/adapters.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { playShot } from '../src/director/shots.ts';
import { ArcPool } from '../src/globe/arc-pool.ts';
const index = createIndex();
(await readFile(new URL('./fixtures/events-v1.ndjson', import.meta.url), 'utf8')).trim().split('\n').forEach(line => appendEvent(index, parseLine(line)));
finishIndex(index);
test('backward seek restores exact totals without replay or duplication', () => {
  const engine = new PlaybackEngine(index);
  engine.seek(364); engine.seek(0); engine.replayDay();
  assert.equal(engine.totals().settled, 0n);
  engine.tick(1);
  assert.equal(engine.totals().settled, 40_000_000_000n);
  engine.seek(0); assert.equal(engine.totals().settled, 40_000_000_000n);
});
test('one-year preset completes at precisely fifteen seconds, at differing frame rates', () => {
  for (const fps of [20, 30, 60, 144]) {
    const engine = new PlaybackEngine(index); engine.setSpeed('year');
    for (let i = 0; i < fps * 15 - 1; i++) engine.tick(1 / fps);
    assert.equal(engine.state.playing, true);
    engine.tick(1 / fps + 1e-9);
    assert.equal(engine.state.day, 364); assert.equal(engine.state.playing, false);
    assert.equal(engine.totals().settled, 40_000_000_000n);
  }
});
test('shots restore their own starting state and cancellation discards queued camera moves', () => {
  const engine = new PlaybackEngine(index);
  playShot(engine, 3); engine.tick(12);
  assert.equal(engine.totals().settled, 20_000_000_000n);
  playShot(engine, 4); engine.tick(12);
  assert.equal(engine.totals().settled, 40_000_000_000n);
  playShot(engine, 2); engine.stopShot(); const camera = engine.state.camera.id;
  engine.tick(20); assert.equal(engine.state.camera.id, camera);
  playShot(engine, 1); assert.equal(engine.state.day, 0); assert.equal(engine.totals().settled, 0n);
});
test('arc pool never exceeds 200 including retiring arcs and fades before expiry', () => {
  const pool = new ArcPool(), event = index.days[0].events.find(e => e.type === 'issue')!;
  for (let i = 0; i < 450; i++) { pool.add({ ...event, seq: i + 1 }, index, 0); assert.ok(pool.arcs.length <= 200); }
  assert.equal(pool.arcs.length, 200);
  pool.clear(); pool.add(event, index, 0); pool.tick(200);
  assert.equal(pool.arcs[0].alpha, 1);
  pool.tick(1600); assert.ok(pool.arcs[0].alpha < 0.5);
  pool.tick(1800); assert.equal(pool.arcs.length, 0);
});
