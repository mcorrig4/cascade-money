import type { GlobeInstance } from 'globe.gl';
import { Vector3 } from 'three';
import { pickup } from './animation.ts';
import { displayDate } from '../data/types.ts';
import { dollars } from '../data/format.ts';
import type { LiveArc } from './arc-pool.ts';

export function visibleFromCamera(globe: GlobeInstance, lat: number, lng: number, altitude = 0) {
  const raw = globe.getCoords(lat, lng, altitude), p = new Vector3(raw.x, raw.y, raw.z);
  const camera = globe.camera().position, direction = p.clone().sub(camera), distance = direction.length();
  direction.normalize();
  const b = camera.dot(direction), c = camera.lengthSq() - globe.getGlobeRadius() ** 2;
  const discriminant = b * b - c;
  if (discriminant >= 0 && -b - Math.sqrt(discriminant) < distance - 0.01) return false;
  const projected = p.project(globe.camera());
  return projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
}
export class AmountLayer {
  private active = new Map<number, HTMLElement>();
  private spare: HTMLElement[] = [];
  private host: HTMLElement;
  constructor(host: HTMLElement) { this.host = host; }
  update(globe: GlobeInstance, arcs: LiveArc[], now: number, ledgerLeft: number, footerTop: number) {
    const ids = new Set(arcs.map(a => a.id));
    for (const [id, element] of this.active) {
      if (!ids.has(id)) { element.hidden = true; this.spare.push(element); this.active.delete(id); }
    }
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (const arc of [...arcs].sort((a, b) => Number(!!b.annotation) - Number(!!a.annotation) || b.id - a.id)) {
      let element = this.active.get(arc.id);
      if (!element) {
        element = this.spare.pop() ?? document.createElement('div');
        element.className = 'floating-amount';
        element.replaceChildren();
        const amount = document.createElement('strong'); amount.textContent = `+${dollars(arc.displayAmount??arc.event.amount, true)}`; element.append(amount);
        if(arc.maturity!=null){const maturity=document.createElement('span');maturity.textContent=displayDate(arc.maturity);element.append(maturity);}
        if (arc.annotation) { const annotation = document.createElement('span'); annotation.textContent = arc.annotation; element.append(annotation); }
        if (!element.parentNode) this.host.append(element);
        this.active.set(arc.id, element);
      }
      const { x, y: projectedY } = globe.getScreenCoords(arc.midLat, arc.midLng, arc.altitude);
      const motion = pickup(arc.held?Math.min(now-arc.born,arc.life*.5):now-arc.born, arc.life);
      const y = projectedY - motion.rise;
      const width = arc.annotation || arc.maturity!=null ? 280 : 115, height = arc.annotation ? 120 : arc.maturity!=null ? 78 : 44;
      const collision = boxes.some(b => Math.abs(b.x - x) < (b.width + width) / 2 && Math.abs(b.y - y) < (b.height + height) / 2);
      element.hidden = collision || x < width / 2 + 24 || x + width / 2 > ledgerLeft - 24 || y < 110 || y + height > footerTop || !visibleFromCamera(globe, arc.midLat, arc.midLng, arc.altitude);
      if (!element.hidden) {
        boxes.push({ x, y, width, height });
        element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%) scale(${motion.scale})`;
        element.style.opacity = String(motion.alpha);
      }
    }
  }
  dispose() { this.active.clear(); this.spare = []; this.host.replaceChildren(); }
}
