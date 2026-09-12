import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readStream } from '../src/data/ndjson.ts';
import { adaptFirm, parseLine } from '../src/data/adapters.ts';
import { appendEvent, createIndex, finishIndex } from '../src/data/index.ts';
import { dollars } from '../src/data/format.ts';
import { dateForDay } from '../src/data/types.ts';
const sample = await readFile(new URL('../../events.ndjson', import.meta.url), 'utf8');
function chunks(text: string, size: number) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
    controller.close();
  } });
}
test('sample preserves accounting, order, calendar, and empty-day carry forward', async () => {
  const index = await readStream(chunks(sample, 127));
  assert.equal(index.eventCount, 10);
  assert.equal(index.firms.size, 5);
  assert.deepEqual(index.days[0].end, { settled: 40_000_000_000n, committed: 10_000_000_000n });
  assert.deepEqual(index.days[364].end, index.days[0].end);
  assert.deepEqual(index.days[0].prefix[6], { settled: 20_000_000_000n, committed: 10_000_000_000n });
  assert.equal(index.days[1].purchases, 0n);
  assert.equal(dateForDay(0), '2025-09-09'); assert.equal(dateForDay(364), '2026-09-08');
});
test('split multibyte UTF-8 and a final line without newline parse correctly', async () => {
  const index = await readStream(chunks(sample.replaceAll('Clearview Glass', 'Québec Glass').trimEnd(), 1));
  assert.ok(index.firms.has('Québec Glass'));
});
test('unsafe integers remain exact before formatting', () => {
  const parsed = parseLine('{"amount_cents":900719925474099312345}');
  assert.equal(parsed.amount_cents, 900719925474099312345n);
  assert.equal(dollars(parsed.amount_cents as bigint), '$9,007,199,254,740,993,123.45');
});
test('v2 geography takes precedence over the v1 presentation lookup', () => {
  assert.equal(adaptFirm({ id: 'Apple', lat: 10, lon: 20, city: 'City' }, 2).lng, 20);
  assert.equal(adaptFirm({ id: 'Apple' }, 1).city, 'Cupertino');
  assert.equal(adaptFirm({ id: 'missing' }, 1).lat, undefined);
  assert.equal(adaptFirm({ id: 'bad', lat: 110, lon: 20 }, 2).lat, undefined);
});
test('reject malformed JSON, unsupported schemas, discontinuous sequences, and date mismatches', async () => {
  await assert.rejects(readStream(chunks('{broken}', 3)), /Line 1/);
  await assert.rejects(readStream(chunks(sample.replace('"schema_version":1', '"schema_version":3'), 500)), /Unsupported schema/);
  await assert.rejects(readStream(chunks(sample.replace('"seq":2', '"seq":3'), 500)), /Expected sequence/);
  await assert.rejects(readStream(chunks(sample.replace('"day":0', '"date":"2025-09-10","day":0'), 500)), /Date\/day mismatch/);
});
test('transfer and rejection cannot inflate invoice settlement', () => {
  const index = createIndex();
  const records = sample.trim().split('\n').map(parseLine);
  records.slice(0, -1).forEach(e => appendEvent(index, e));
  const base = records[5];
  appendEvent(index, { ...base, type: 'transfer', seq: 10, amount_cents: 12345, data: { sender: 'Apple', recipient: 'TSMC' } });
  appendEvent(index, { ...base, type: 'operation_rejected', seq: 11, amount_cents: 0, data: {} });
  finishIndex(index);
  assert.equal(index.days[0].end.settled, 40_000_000_000n);
});
test('v2 summaries reconcile, invoice detail and story markers survive', () => {
  const index = createIndex();
  const records = sample.trim().split('\n').map(parseLine).map(v => ({ ...v, schema_version: 2 }));
  const invoice = (records[1] as Record<string, unknown>).data as Record<string, unknown>;
  invoice.invoice = { ...(invoice.invoice as object), annotation: 'Wafers delivered to Hsinchu', item: 'wafers', quantity: 12, unit: 'lots', deliver_to: 'Hsinchu' };
  records.forEach(e => appendEvent(index, e));
  appendEvent(index, { ...records[0], type: 'story', seq: 11, data: { story_id: 'apple', beat: 'proof', caption: 'caption' } });
  appendEvent(index, { ...records[0], type: 'day_summary', seq: 12, data: { new_invoice_cents: 40_000_000_000, settled_invoice_cents: 40_000_000_000, principal_committed_cents: 10_000_000_000, gross_settled_cents: 40_000_000_000 } });
  finishIndex(index);
  assert.equal(index.invoices.get('apple:1')?.annotation, 'Wafers delivered to Hsinchu');
  assert.equal(index.stories[0].beat, 'proof');
  assert.equal(index.days[0].summary?.purchases, 40_000_000_000n);
  const bad = createIndex(); records.forEach(e => appendEvent(bad, e));
  appendEvent(bad, { ...records[0], type: 'day_summary', seq: 11, data: { new_invoice_cents: 1, settled_invoice_cents: 2 } });
  assert.throws(() => finishIndex(bad), /summary disagrees/);
});
