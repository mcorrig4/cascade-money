import { arcLifecycle, GROUND_RADIUS_KM } from './animation.ts';
import { isPayment } from '../data/types.ts';
import type { Event, EventIndex } from '../data/types.ts';
export const ARC_CAP = 200;
export interface LiveArc {
  id: number; event: Event; startLat: number; startLng: number; endLat: number; endLng: number;
  altitude: number; midLat: number; midLng: number; born: number; life: number; alpha: number;
  groundKm: number; clipStart: number; clipEnd: number; phaseKm: number; annotation?: string;
}
export function midpoint(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180, a = lat1 * r, b = lat2 * r, delta = (lng2 - lng1) * r;
  const x = Math.cos(b) * Math.cos(delta), y = Math.cos(b) * Math.sin(delta);
  return { lat: Math.atan2(Math.sin(a) + Math.sin(b), Math.hypot(Math.cos(a) + x, y)) / r,
    lng: ((lng1 + Math.atan2(y, Math.cos(a) + x) / r + 540) % 360) - 180,
    distance: Math.acos(Math.max(-1, Math.min(1, Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b) * Math.cos(delta)))) };
}
export class ArcPool {
  arcs: LiveArc[] = [];
  clear() { this.arcs = []; }
  add(event: Event, index: EventIndex, time: number, life = 1800) {
    if (!isPayment(event) || event.amount <= 0n || this.arcs.some(a => a.id === event.seq)) return;
    const from = index.firms.get(event.from ?? ''), to = index.firms.get(event.to ?? '');
    if (from?.lat == null || from.lng == null || to?.lat == null || to.lng == null) return;
    const mid = midpoint(from.lat, from.lng, to.lat, to.lng);
    // Begin retirement before the hard cap. All retiring arcs count toward 200.
    if (this.arcs.length >= 160) {
      const oldest = this.arcs.find(a => a.life - (time - a.born) > 300);
      if (oldest) oldest.life = time - oldest.born + 300;
    }
    if (this.arcs.length >= ARC_CAP) this.arcs.shift();
    this.arcs.push({ id: event.seq, event, startLat: from.lat, startLng: from.lng, endLat: to.lat, endLng: to.lng,
      altitude: Math.max(0.008, Math.min(0.4, mid.distance * 0.18)), midLat: mid.lat, midLng: mid.lng,
      born: time, life, alpha: 0, groundKm: mid.distance * GROUND_RADIUS_KM, clipStart: 0, clipEnd: 0, phaseKm: 0, annotation: index.invoices.get(event.invoiceId ?? '')?.annotation });
  }
  tick(time: number) {
    this.arcs = this.arcs.filter(a => time - a.born < a.life);
    for (const a of this.arcs) {
      Object.assign(a, arcLifecycle(time - a.born, a.life));
    }
  }
}
