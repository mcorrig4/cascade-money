import { adaptEvent, adaptFirm, adaptInvoice, adaptSummary, money, record } from './adapters.ts';
import { DAYS, isSettlement } from './types.ts';
import type { EventIndex, JsonRecord, Totals } from './types.ts';

export function createIndex(): EventIndex {
  return { schema: 1, firms: new Map(), invoices: new Map(), stories: [], eventCount: 0, warnings: [], payments: [], extensions: [], trades: [], checkpoints: [],
    days: Array.from({ length: DAYS }, () => ({ events: [], start: { settled: 0n, committed: 0n }, end: { settled: 0n, committed: 0n }, prefix: [], purchases: 0n, settled: 0n })) };
}
export function appendEvent(index: EventIndex, raw: JsonRecord) {
  const e = adaptEvent(raw);
  if (e.seq !== index.eventCount + 1) throw new Error(`Expected sequence ${index.eventCount + 1}, received ${e.seq}`);
  if (index.eventCount && e.schema !== index.schema) throw new Error('Mixed schema versions in one run');
  if (e.day >= DAYS) throw new Error(`Day ${e.day} lies outside the viewing year`);
  index.schema = e.schema;
  index.eventCount++;
  index.days[e.day].events.push(e);
  if (isSettlement(e)) index.payments.push(e);
  if (e.type === 'extend') index.extensions.push(e);
  if (e.type === 'sell') index.trades.push(e);
  if (e.type === 'checkpoint') index.checkpoints.push(e);
  if (e.type === 'run_started') {
    for (const rawFirm of Array.isArray(e.data.nodes) ? e.data.nodes : []) {
      const firm = adaptFirm(rawFirm, e.schema);
      index.firms.set(firm.id, firm);
    }
  }
  if (e.type === 'invoice_registered') {
    const invoice = adaptInvoice(e.data.invoice);
    if (index.invoices.has(invoice.id)) throw new Error(`Duplicate invoice ${invoice.id}`);
    index.invoices.set(invoice.id, invoice);
  }
  if (e.type === 'story') {
    const cameraAccounts = Array.isArray(e.data.camera_accounts) ? e.data.camera_accounts.map(String) : [];
    const payment = index.payments.findLast(p => cameraAccounts.length >= 2 && p.from === cameraAccounts[0] && p.to === cameraAccounts[1] && p.day === e.day);
    index.stories.push({ branch: e.data.branch ?? raw.branch, storyId: String(e.data.story_id ?? raw.story_id ?? ''), beat: String(e.data.beat ?? raw.beat ?? ''), caption: String(e.data.caption ?? raw.caption ?? ''), event: e, cameraAccounts, payment });
  }
  if (e.type === 'day_summary') {
    if (index.days[e.day].events.filter(v => v.type === 'day_summary').length > 1) throw new Error(`Duplicate summary on day ${e.day}`);
    index.days[e.day].summary = adaptSummary(e);
    if (!index.days[e.day].summary) index.warnings.push(`Day ${e.day}: summary mapping needs current v2 wire fields`);
  }
}
export function finishIndex(index: EventIndex): EventIndex {
  let totals: Totals = { committed: 0n, settled: 0n };
  let lastState;
  let previousSeq = 0;
  for (const [day, bucket] of index.days.entries()) {
    bucket.start = { ...totals };
    for (const e of bucket.events) {
      if (e.seq <= previousSeq) throw new Error('Execution days must be nondecreasing');
      previousSeq = e.seq;
      if (isSettlement(e)) { totals.settled += e.amount; bucket.settled += e.amount; }
      if (e.type === 'issue') totals.committed += e.amount;
      if (e.type === 'invoice_registered') bucket.purchases += money(record(e.data.invoice).amount_cents);
      const previous = bucket.prefix.at(-1) ?? bucket.start;
      bucket.prefix.push(previous.settled === totals.settled && previous.committed === totals.committed ? previous : { ...totals });
      lastState = e;
      if (e.type === 'run_completed') {
        const metrics = record(e.data.metrics);
        if (metrics.gross_invoice_settled_cents != null && money(metrics.gross_invoice_settled_cents) !== totals.settled) throw new Error('Completion settlement total disagrees with events');
        if (metrics.principal_deposited_cents != null && money(metrics.principal_deposited_cents) !== totals.committed) throw new Error('Completion committed total disagrees with events');
      }
    }
    const summary = bucket.summary;
    if (summary) {
      if (summary.purchases !== bucket.purchases || summary.settled !== bucket.settled || (summary.committed != null && summary.committed !== totals.committed) || (summary.dailyCommitted != null && summary.dailyCommitted !== totals.committed - bucket.start.committed) || (summary.grossSettled != null && summary.grossSettled !== totals.settled)) {
        throw new Error(`Day ${day}: summary disagrees with operation totals`);
      }
      bucket.purchases = summary.purchases;
      bucket.settled = summary.settled;
    }
    bucket.end = { ...totals };
    bucket.lastState = lastState;
  }
  return index;
}
