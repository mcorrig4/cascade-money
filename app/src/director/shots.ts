import { eventPosition, PlaybackEngine } from '../playback/engine.ts';
import type { Event, EventIndex } from '../data/types.ts';
export const SHOTS = [
  { id: 1, title: 'Apple Park', detail: 'Cupertino · September 9, 2025', seconds: 20 },
  { id: 2, title: 'The network', detail: 'Pull back · $56 billion', seconds: 8 },
  { id: 3, title: 'The proof', detail: 'Cupertino → Asan', seconds: 12 },
  { id: 4, title: 'The cascade', detail: 'Follow the dollars', seconds: 12 },
  { id: 5, title: 'One year', detail: '365 days in fifteen seconds', seconds: 15 },
  { id: 6, title: 'A dollar with a date', detail: 'Extend · earn the added interval', seconds: 53 },
  { id: 7, title: 'The yield curve', detail: 'Discount-window trades', seconds: 27 },
  { id: 8, title: 'Conservation laws', detail: 'Principal · yield · loss', seconds: 20 },
  { id: 9, title: 'The vault', detail: 'Balance sheet through maturity', seconds: 15 },
  { id: 10, title: 'The reframe', detail: 'Fifth Avenue → the world', seconds: 17 },
  { id: 11, title: 'Composable', detail: 'Architecture · dated dollars on Arc', seconds: 5 },
  { id: 12, title: 'Cascade', detail: 'App · repository · contract', seconds: 20 },
].map(s => ({ ...s, duration: `${s.seconds}s` }));
// Seconds from each shot's start; editable narration cue sheet.
export const SCENE_LOCATIONS = [
  { shot: 1, name: 'Apple Park', place: 'Cupertino, California' },
  { shot: 10, name: 'Apple Store NYC', place: 'Fifth Avenue, New York City' },
];
// Narration text lives at scene center, separately from the location captions.
// Timings use the shot clock so pause, seek and offline captures agree.
export const SCENE_TEXT_BEATS = [
  { shot: 1, id: 'flashback', at: 0.2, until: 2.9, text: 'September 9, 2025' },
  { shot: 10, id: 'money-time', at: 3.8, until: 5.8, text: 'Money. And time.' },
  { shot: 10, id: 'derivatives', at: 6.2, until: 10.2, text: '$846 trillion' },
  { shot: 10, id: 'reframe', at: 10.5, until: 14.9, text: 'Time becomes a property of money.' },
];
export function sceneTextAt(shot: number | null, elapsed: number) {
  const cue = SCENE_TEXT_BEATS.find(c => c.shot === shot && elapsed >= c.at && elapsed < c.until);
  if (!cue) return null;
  const opacity = Math.min(1, (elapsed - cue.at) / 0.35, (cue.until - elapsed) / 0.35);
  return { ...cue, opacity, offset: (1 - opacity) * 12 };
}
export const COMPOSABLE_BEATS = [
  {at:0, title:'USDC → vault', detail:'Commit principal on Arc.'},
  {at:1, title:'Issue → pay', detail:'Settle invoices with dated dollars.'},
  {at:2, title:'Extend → earn', detail:'Move the date forward; own the added yield.'},
  {at:3, title:'Claim → withdraw', detail:'Redeem yield and matured principal.'},
  {at:4, title:'Compose', detail:'Trade dates for spot in a separate market.'},
];
export const COIN_BEATS = [
  {at:0, key:'coin', title:'Money with a date.', text:'One dollar, held in a vault on Arc.'},
  {at:6, key:'date', title:'A calendar date.', text:'Redeemable for one dollar on its date.'},
  {at:13, key:'claim', title:'Earlier pays later.', text:'Pay a later bill at face value.'},
  {at:25, key:'extend', title:'Extend. Earn the interval.', text:'Move the date forward. Earn yield for the added days.'},
  {at:44, key:'fungibility', title:'Same date. Same dollar.', text:'Every dollar with the same date is identical.'},
];
export const beatIndex = (times:readonly {at:number}[], elapsed:number) => Math.max(0,times.findLastIndex(b=>elapsed>=b.at));
const APPLE = { lat: 37.3349, lng: -122.009, altitude: 608 / 6_371_000 };
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
  const marker = index.stories.find(s => s.payment?.seq === first.seq);
  if (marker) {
    const marked = index.stories.filter(s => s.storyId === marker.storyId && s.payment).map(s => s.payment!);
    const unique = [...new Map(marked.map(e => [e.seq, e])).values()].sort((a, b) => a.seq - b.seq);
    if (unique.length > 1) return unique;
  }
  const chain = [first];
  while (chain.length < 4) {
    const prev = chain.at(-1)!;
    const next = index.payments.find(e => e.seq > prev.seq && e.type === 'pay' && e.from === prev.to && e.amount === first.amount && !chain.some(p => p.invoiceId === e.invoiceId));
    if (!next) break; chain.push(next);
  }
  return chain;
}
// A generation shares a beat; sibling payments from one payer remain consecutive.
export function cascadeBeats(events: Event[]) {
  const levels = new Map<string, number>(), beats: Event[][] = [];
  for (const event of events) {
    const level = levels.get(event.from!) ?? 0;
    (beats[level] ??= []).push(event);
    levels.set(event.to!, level + 1);
  }
  return beats.filter(Boolean);
}
export function shotAvailable(engine: PlaybackEngine, id: number) {
  return id !== 3 && id !== 4 || proofPayments(engine.index, engine.state.story).length >= (id === 3 ? 2 : 3);
}
export function playShot(engine: PlaybackEngine, id: number) {
  const shot = SHOTS.find(s => s.id === id); if (!shot || !shotAvailable(engine, id)) return;
  engine.beginShot(id, shot.seconds);
  const hold = () => engine.after(shot.seconds, () => engine.update({ shotRunning: false }));
  if (id === 1 || id === 2) {
    engine.setPosition(0, true); engine.fly(APPLE.lat, APPLE.lng, APPLE.altitude, 0, 'apple-park');
    if (id === 1) { engine.after(14, () => engine.fly(31, -133, 2.15, 5000)); hold(); }
    else {
      engine.after(0.3, () => engine.fly(APPLE.lat, APPLE.lng, 2.15, 3000));
      engine.after(1.2, () => engine.update({ showDebt: true }));
      engine.after(2.5, () => engine.playRange(0, 4.999, 5.5));
    }
  } else if (id === 3 || id === 4) {
    const all = proofPayments(engine.index, engine.state.story), events = id === 3 ? all.slice(0, 2) : all.slice(2);
    engine.update({ focusInvoices: all.map(e => e.invoiceId!) });
    engine.fly(APPLE.lat, APPLE.lng, 0.8, 0);
    if (id === 3) {
      engine.playRange(position(engine, events[0]), position(engine, events.at(-1)!, true), 12);
      const destination = engine.index.firms.get(all[0].to!);
      const target = destination?.name.toLowerCase().includes('samsung') || engine.state.story === 'tesla' ? destination : undefined;
      engine.after(0.4, () => engine.fly(target?.lat ?? 36.803, target?.lng ?? 127.057, 0.8, 2800));
    } else {
      engine.setPosition(position(engine, events[0]), true);
      engine.storyEvents = all.slice(0, 2);
      const beats = cascadeBeats(events);
      beats.forEach((beat, i) => {
        const time = 0.4 + i * (9 / Math.max(1, beats.length));
        engine.after(time, () => {
          const firms = [...new Set(beat.flatMap(e => [e.from, e.to]))].map(id => engine.index.firms.get(id!)).filter(f => f?.lat != null && f.lng != null);
          if (firms.length) {
            const lat = firms.reduce((sum, f) => sum + f!.lat!, 0) / firms.length;
            const x = firms.reduce((sum, f) => sum + Math.cos(f!.lng! * Math.PI / 180), 0);
            const y = firms.reduce((sum, f) => sum + Math.sin(f!.lng! * Math.PI / 180), 0);
            const lng = Math.atan2(y, x) * 180 / Math.PI;
            const span = Math.max(...firms.map(f => Math.max(Math.abs(f!.lat! - lat), Math.abs(((f!.lng! - lng + 540) % 360) - 180))));
            engine.fly(lat, lng, Math.min(2.6, Math.max(1.25 + i * 0.15, span / 45)), 1400);
          }
        });
        beat.forEach((event, j) => engine.after(time + j * 0.22, () => {
          engine.reveal(event);
          engine.setPosition(position(engine, event, true));
        }));
      });
      hold();
    }
  } else if (id === 5) {
    engine.fly(28, -145, 2.35, 0); engine.update({ speed: 'year', caption: true }); engine.playRange(0, 365, 15);
  } else if (id === 6) {
    engine.fly(37, -122, 1.65, 1200);
    // Real operations provide continuous background activity; never manufacture payments.
    const payments=engine.index.payments;
    if (payments.length) engine.playRange(position(engine,payments[0]), position(engine,payments.at(-1)!,true), shot.seconds);
    else hold();
  } else if (id === 7) {
    engine.fly(30, -145, 2.3); const trade = engine.index.trades[0];
    if (trade) engine.playRange(trade.day, trade.day + 0.999999, shot.seconds); else hold();
  } else if (id === 9) {
    engine.fly(25, -145, 2.3); const maturity = engine.index.checkpoints.find(e => Number(e.data.matured_cents) > 0);
    if (maturity) engine.playRange(Math.max(0, maturity.day - 1), Math.min(365, maturity.day + 1.999), shot.seconds); else hold();
  } else if (id === 10) {
    engine.update({ stage: 'cube' }); engine.fly(40.7638, -73.9730, 0.035, 0);
    engine.after(0.15, () => engine.fly(40.7638, -73.9730, 8 / 6_371_000, 1600, 'fifth-avenue'));
    engine.after(8.3, () => engine.fly(28, -66, 2.6, 6200));
    engine.after(9.1, () => engine.update({ stage: 'wide' })); hold();
  } else { engine.fly(30, -145, 2.3); hold(); }
}
