import { eventPosition, PlaybackEngine } from '../playback/engine.ts';
import { isSettlement } from '../data/types.ts';
import type { Event } from '../data/types.ts';

export const SHOTS = [
  { id: 1, title: 'Apple Park', detail: 'Cupertino · September 9, 2025', duration: '3s' },
  { id: 2, title: 'The network', detail: 'Pull back · $56 billion', duration: '8s' },
  { id: 3, title: 'The proof', detail: 'First commitment · same-day payment', duration: '12s' },
  { id: 4, title: 'The cascade', detail: 'Follow the dollars', duration: '12s' },
  { id: 5, title: 'One year', detail: '365 days · all payments', duration: '15s' },
];
const APPLE = { lat: 37.3349, lng: -122.009, altitude: 0.00022 };
function position(engine: PlaybackEngine, event: Event, after = false) {
  const events = engine.index.days[event.day].events;
  return event.day + eventPosition(events.indexOf(event), events.length) + (after ? 0.001 : -0.001);
}
function settlements(engine: PlaybackEngine) {
  const story = engine.state.story === 'tesla' ? 'tesla' : 'apple';
  const markers = engine.index.stories.filter(v => v.storyId.toLowerCase().includes(story));
  const events = engine.index.days.flatMap(d => d.events).filter(isSettlement);
  if (markers.length) {
    const lo = markers[0].event.seq;
    const nextStory = engine.index.stories.find(v => v.event.seq > markers.at(-1)!.event.seq && !v.storyId.toLowerCase().includes(story));
    return events.filter(e => e.seq >= lo && (!nextStory || e.seq < nextStory.event.seq));
  }
  return events.filter(e => (e.invoiceId ?? '').toLowerCase().startsWith(`${story}:`));
}
export function shotAvailable(engine: PlaybackEngine, id: number) {
  return id !== 3 && id !== 4 || settlements(engine).length >= (id === 3 ? 1 : 3);
}
export function playShot(engine: PlaybackEngine, id: number) {
  if (!shotAvailable(engine, id)) return;
  engine.beginShot(id);
  if (id === 1) {
    engine.setPosition(0, true);
    engine.fly(APPLE.lat, APPLE.lng, APPLE.altitude, 0);
    engine.after(3, () => engine.update({ shotRunning: false }));
  }
  if (id === 2) {
    engine.setPosition(0, true); engine.fly(APPLE.lat, APPLE.lng, APPLE.altitude, 0);
    engine.after(0.3, () => engine.fly(APPLE.lat, APPLE.lng, 2.15, 3000));
    engine.after(1.2, () => engine.update({ showDebt: true }));
    engine.after(2.5, () => engine.playRange(0, 4.999, 5.5));
  }
  if (id === 3 || id === 4) {
    const all = settlements(engine), events = id === 3 ? all.slice(0, 2) : all.slice(2, 5);
    const first = events[0], last = events.at(-1)!;
    const firm = engine.index.firms.get(first.from ?? '');
    engine.fly(firm?.lat ?? APPLE.lat, firm?.lng ?? APPLE.lng, 0.8, 0);
    engine.playRange(position(engine, first), position(engine, last, true), 12);
    events.forEach((e, i) => {
      const to = engine.index.firms.get(e.to ?? '');
      if (to?.lat != null && to.lng != null) {
        engine.after((i / events.length) * 10 + 0.4, () => engine.fly(to.lat!, to.lng!, 1.25, 2400));
      }
    });
  }
  if (id === 5) {
    engine.fly(28, -145, 2.35, 0);
    engine.update({ speed: 'year', caption: true });
    engine.playRange(0, 365, 15);
  }
}
