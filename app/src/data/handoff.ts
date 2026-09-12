import { createIndex } from './index.ts';
import { isSettlement } from './types.ts';
import type { DayBucket, EventIndex, StoryMarker } from './types.ts';
type StoryRef = Omit<StoryMarker, 'event' | 'payment'> & { event: number; payment?: number };
export type Header = Pick<EventIndex, 'schema' | 'firms' | 'invoices' | 'eventCount' | 'warnings'> & { stories: StoryRef[] };
// Only one day may be in flight. Release worker references before awaiting its acknowledgement.
export async function handoff(index: EventIndex, header: (value: Header) => void, day: (n: number, value: DayBucket) => Promise<void>) {
  header({ schema: index.schema, firms: index.firms, invoices: index.invoices, eventCount: index.eventCount, warnings: index.warnings,
    stories: index.stories.map(s => ({ ...s, event: s.event.seq, payment: s.payment?.seq })) });
  index.stories = []; index.payments = []; index.extensions = []; index.trades = []; index.checkpoints = [];
  index.firms.clear(); index.invoices.clear();
  // lastState is reconstructed from the ordered buckets in the receiver.
  for (const bucket of index.days) delete bucket.lastState;
  for (let n = 0; n < index.days.length; n++) {
    let bucket: DayBucket | undefined = index.days[n];
    const sent = day(n, bucket);
    index.days[n] = undefined!; bucket = undefined;
    await sent;
  }
}
export function receiver(header: Header) {
  const index = createIndex();
  const { stories, ...metadata } = header;
  Object.assign(index, metadata);
  const wanted = new Set(stories.flatMap(s => [s.event, s.payment]));
  const references = new Map<number, DayBucket['events'][number]>();
  let lastState: DayBucket['lastState'];
  return { index, day(n: number, bucket: DayBucket) {
    for (const e of bucket.events) {
      if (wanted.has(e.seq)) references.set(e.seq, e);
      if (isSettlement(e)) index.payments.push(e);
      if (e.type === 'extend') index.extensions.push(e);
      if (e.type === 'sell') index.trades.push(e);
      if (e.type === 'checkpoint') index.checkpoints.push(e);
      lastState = e;
    }
    bucket.lastState = lastState; index.days[n] = bucket;
  }, finish() {
    index.stories = stories.map(s => ({ ...s, event: references.get(s.event)!, payment: s.payment == null ? undefined : references.get(s.payment) }));
    return index;
  } };
}
