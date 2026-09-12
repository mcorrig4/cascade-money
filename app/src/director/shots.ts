import { eventPosition, PlaybackEngine } from '../playback/engine.ts';
import type { Event, EventIndex } from '../data/types.ts';
export const SHOTS = [
  { id: 1, title: 'Apple Park', detail: 'Cupertino · September 9, 2025', seconds: 3 },
  { id: 2, title: 'The network', detail: 'Pull back · $56 billion', seconds: 8 },
  { id: 3, title: 'The proof', detail: 'Cupertino → Asan', seconds: 12 },
  { id: 4, title: 'The cascade', detail: 'Follow the dollars', seconds: 12 },
  { id: 5, title: 'One year', detail: '365 days in fifteen seconds', seconds: 15 },
  { id: 6, title: 'A dollar with a date', detail: 'Extend · earn the added interval', seconds: 53 },
  { id: 7, title: 'The yield curve', detail: 'Discount-window trades', seconds: 27 },
  { id: 8, title: 'Conservation laws', detail: 'Principal · yield · loss', seconds: 20 },
  { id: 9, title: 'The vault', detail: 'Balance sheet through maturity', seconds: 15 },
  { id: 10, title: 'The reframe', detail: 'Fifth Avenue → the world', seconds: 15 },
  { id: 11, title: 'Architecture', detail: 'Dated dollars on Arc', seconds: 5 },
  { id: 12, title: 'Cascade', detail: 'App · repository · contract', seconds: 20 },
].map(s => ({ ...s, duration: `${s.seconds}s` }));
const APPLE = { lat: 37.3349, lng: -122.009, altitude: 0.00022 };
export function position(engine: PlaybackEngine, event: Event, after = false) {
  const events = engine.index.days[event.day].events;
  return event.day + eventPosition(events.indexOf(event), events.length) + (after ? 0.000001 : -0.000001);
}
export function proofPayments(index: EventIndex, story = 'apple') {
  const name = (id?: string) => `${id} ${index.firms.get(id ?? '')?.name ?? ''}`.toLowerCase();
  const first = index.payments.find(e => e.type === 'issue' && (story === 'tesla'
    ? name(e.from).includes('tesla') && name(e.to).includes('panasonic')
    : (index.schema === 1 || ![...index.firms.values()].some(f => f.name.toLowerCase().includes('samsung'))) ? (e.invoiceId ?? '').startsWith('apple:') : name(e.from).includes('apple') && name(e.to).includes('samsung')));
  if (!first) return [];
  const chain = [first];
  while (chain.length < 4) {
    const prev = chain.at(-1)!;
    const next = index.payments.find(e => e.seq > prev.seq && e.type === 'pay' && e.from === prev.to && e.amount === first.amount && !chain.some(p => p.invoiceId === e.invoiceId));
    if (!next) break; chain.push(next);
  }
  return chain;
}
export function shotAvailable(engine: PlaybackEngine, id: number) {
  return id !== 3 && id !== 4 || proofPayments(engine.index, engine.state.story).length >= (id === 3 ? 2 : 3);
}
export function playShot(engine: PlaybackEngine, id: number) {
  const shot = SHOTS.find(s => s.id === id); if (!shot || !shotAvailable(engine, id)) return;
  engine.beginShot(id, shot.seconds);
  const hold = () => engine.after(shot.seconds, () => engine.update({ shotRunning: false }));
  if (id === 1 || id === 2) {
    engine.setPosition(0, true); engine.fly(APPLE.lat, APPLE.lng, APPLE.altitude, 0);
    if (id === 1) hold();
    else {
      engine.after(0.3, () => engine.fly(APPLE.lat, APPLE.lng, 2.15, 3000));
      engine.after(1.2, () => engine.update({ showDebt: true }));
      engine.after(2.5, () => engine.playRange(0, 4.999, 5.5));
    }
  } else if (id === 3 || id === 4) {
    const all = proofPayments(engine.index, engine.state.story), events = id === 3 ? all.slice(0, 2) : all.slice(2);
    engine.update({ focusInvoices: all.map(e => e.invoiceId!) });
    engine.fly(APPLE.lat, APPLE.lng, 0.8, 0);
    engine.playRange(position(engine, events[0]), position(engine, events.at(-1)!, true), 12);
    if (id === 3) {
      const destination = engine.index.firms.get(all[0].to!);
      const target = destination?.name.toLowerCase().includes('samsung') || engine.state.story === 'tesla' ? destination : undefined;
      engine.after(0.4, () => engine.fly(target?.lat ?? 36.803, target?.lng ?? 127.057, 0.8, 2800));
    } else events.forEach((e, i) => {
      const f = engine.index.firms.get(e.to!); if (f?.lat != null && f.lng != null) engine.after(0.4 + i * 5, () => engine.fly(f.lat!, f.lng!, 1.25, 2400));
    });
  } else if (id === 5) {
    engine.fly(28, -145, 2.35, 0); engine.update({ speed: 'year', caption: true }); engine.playRange(0, 365, 15);
  } else if (id === 6) {
    engine.fly(37, -122, 1.65, 1200);
    const chain = proofPayments(engine.index, 'tesla');
    if (chain.length) {
      engine.playRange(position(engine, chain[0]), position(engine, chain.at(-1)!, true), shot.seconds);
      chain.forEach((e, i) => { const f = engine.index.firms.get(e.to!); if (f?.lat != null && f.lng != null) engine.after(8 + i * 12, () => engine.fly(f.lat!, f.lng!, 1.6, 2800)); });
    } else hold();
  } else if (id === 7) {
    engine.fly(30, -145, 2.3); const trade = engine.index.trades[0];
    if (trade) engine.playRange(trade.day, trade.day + 0.999999, shot.seconds); else hold();
  } else if (id === 9) {
    engine.fly(25, -145, 2.3); const maturity = engine.index.checkpoints.find(e => Number(e.data.matured_cents) > 0);
    if (maturity) engine.playRange(Math.max(0, maturity.day - 1), Math.min(365, maturity.day + 1.999), shot.seconds); else hold();
  } else if (id === 10) {
    engine.update({ stage: 'cube' }); engine.fly(40.7637, -73.9723, 0.05, 0);
    engine.after(0.3, () => engine.fly(40.7637, -73.9723, 0.000012, 3500));
    engine.after(7.5, () => { engine.update({ stage: 'wide' }); engine.fly(30, -65, 2.6, 6000); }); hold();
  } else { engine.fly(30, -145, 2.3); hold(); }
}
