import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readStream } from '../src/data/ndjson.ts';
import { handoff, receiver } from '../src/data/handoff.ts';
import { PlaybackEngine, eventPosition } from '../src/playback/engine.ts';
import { cascadeBeats, playShot, proofPayments } from '../src/director/shots.ts';
const fixture = await readFile(new URL('./fixtures/events-v1.ndjson', import.meta.url));
async function load() { return readStream(new ReadableStream({ start(c) { c.enqueue(fixture); c.close(); } })); }
test('acknowledged handoff preserves totals and shared event identities, releases worker days', async () => {
  const original = await load();
  const expected = original.days[364].end;
  let target: ReturnType<typeof receiver>;
  await handoff(original, h => { target = receiver(structuredClone(h)); }, async (n, bucket) => {
    target.day(n, structuredClone(bucket));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(original.days[n], undefined);
  });
  const result = target!.finish();
  assert.deepEqual(result.days[364].end, expected);
  assert.ok(result.payments.every(p => result.days[p.day].events.includes(p)));
  assert.equal(result.days[364].lastState, result.days[0].events.at(-1));
});
test('branch proof reveals one, two, four real payments with constant principal', async () => {
  const index = await load(), base = index.payments[0];
  const pairs = [['Apple','Samsung'],['Samsung','Corning'],['Corning','Silica'],['Corning','Chemicals'],['Silica','Freight'],['Silica','Mine'],['Chemicals','Gas'],['Chemicals','Salt']];
  const payments = pairs.map(([from,to], i) => ({ ...base, seq: i + 1, from, to, invoiceId: `apple:${i}`, type: i ? 'pay' : 'issue', amount: i < 2 ? 100n : i < 4 ? 50n : 25n }));
  index.payments = payments; index.days[0].events = payments;
  index.stories = payments.map((payment,i) => ({ storyId:'apple-display', beat:String(i), branch:i, event:payment, payment, cameraAccounts:[payment.from,payment.to] }));
  assert.equal(proofPayments(index).length, 8);
  assert.deepEqual(cascadeBeats(payments.slice(2)).map(b => b.length), [2,4]);
  const engine = new PlaybackEngine(index); playShot(engine,4);
  assert.deepEqual(engine.totals(), { settled:200n, committed:100n });
  engine.tick(.4); assert.equal(engine.drainStoryEvents().length,1);
  engine.tick(.22); assert.equal(engine.drainStoryEvents().length,1);
  engine.tick(11.38);
  assert.deepEqual(engine.totals(), { settled:400n, committed:100n });
  assert.equal(engine.drainStoryEvents().length,4);
  engine.stopShot(); assert.equal(engine.storyEvents,null);
});
test('dense-day binary seek agrees with event boundaries', async () => {
  const index = await load();
  index.days[0].events = Array.from({ length:250000 }, (_,i) => ({ ...index.payments[0], seq:i+1 }));
  const engine = new PlaybackEngine(index);
  const start = performance.now();
  for (let i=0; i<250000; i+=97) {
    engine.setPosition(eventPosition(i,250000)); assert.equal(engine.state.cursor,i+1);
  }
  console.log(`250k-event day: 2,578 seeks in ${(performance.now()-start).toFixed(1)} ms`);
});
test('250k streamed events index in order without a source-object array', async () => {
  const envelope = JSON.parse(fixture.toString().split('\n')[0]);
  let seq = 0;
  const started = performance.now();
  const index = await readStream(new ReadableStream({ pull(controller) {
    if (seq === 250000) { controller.close(); return; }
    let chunk = '';
    for (let n = 0; n < 128 && seq < 250000; n++) {
      ++seq;
      chunk += JSON.stringify({ ...envelope, seq, type:'checkpoint', data:{} }) + '\n';
    }
    controller.enqueue(new TextEncoder().encode(chunk));
  } }));
  assert.equal(index.eventCount,250000);
  assert.equal(index.days[0].events.at(-1)!.seq,250000);
  assert.equal(index.days[0].prefix[0],index.days[0].prefix.at(-1));
  console.log(`250k streamed events indexed in ${(performance.now()-started).toFixed(0)} ms`);
});
