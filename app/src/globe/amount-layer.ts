import type { GlobeInstance } from 'globe.gl';
import { Vector3 } from 'three';
import { pickup } from './animation.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatedDollar } from '../components/DatedDollar.ts';
import { datedUnit } from '../director/dated-dollar.ts';
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
  update(globe: GlobeInstance, arcs: LiveArc[], now: number, ledgerLeft: number, footerTop: number, scale=1, simulationDay=0) {
    const ids = new Set(arcs.map(a => a.id));
    for (const [id, element] of this.active) {
      if (!ids.has(id)) { element.hidden = true; this.spare.push(element); this.active.delete(id); }
    }
    const hostTop=this.host.getBoundingClientRect().top;
    const callouts=[...this.host.parentElement!.querySelectorAll<HTMLElement>('.company-callout:not([hidden])')].map(el=>el.getBoundingClientRect());
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (const arc of [...arcs].sort((a, b) => Number(!!b.annotation) - Number(!!a.annotation) || b.id - a.id)) {
      let element = this.active.get(arc.id);
      if (!element) {
        element = this.spare.pop() ?? document.createElement('div');
        element.className = 'floating-amount';
        element.replaceChildren();
        delete element.dataset.content;
        if (!element.parentNode) this.host.append(element);
        this.active.set(arc.id, element);
      }
      const maturity = arc.maturity ?? arc.event.dates?.at(-1);
      const unit = maturity == null ? {days:null,isoDate:undefined} : datedUnit(maturity,simulationDay);
      const coinSize = Math.max(64,96*scale), fontSize = Math.max(22,42*scale);
      const magnitude=dollars((arc.displayAmount??arc.event.amount)<0n?-(arc.displayAmount??arc.event.amount):(arc.displayAmount??arc.event.amount),true).replace('$','');
      const key=JSON.stringify([magnitude,unit,coinSize,arc.annotation]);
      if(element.dataset.content!==key){
        const amount=document.createElement('strong');amount.textContent=magnitude;
        amount.style.fontSize=`${fontSize}px`;
        const coin=document.createElement('div');coin.className='arc-coin';
        coin.innerHTML=renderToStaticMarkup(createElement(DatedDollar,{...unit,size:coinSize}),{identifierPrefix:`arc-${arc.id}-`});
        element.replaceChildren(amount,coin);
        if(arc.annotation){const note=document.createElement('span');note.textContent=arc.annotation;element.append(note);}
        element.dataset.content=key;
      }
      const { x, y: projectedY } = globe.getScreenCoords(arc.midLat, arc.midLng, arc.altitude);
      const motion = pickup(arc.held?Math.min(now-arc.born,arc.life*.5):now-arc.born, arc.life);
      const width = Math.max(coinSize*(unit.days===null?164:462)/170,arc.annotation?280*scale:0), height = fontSize*1.2+coinSize+(arc.annotation?36:0);
      element.style.width=`${width}px`;element.style.maxWidth='none';
      let y=Math.max(height+16*scale,Math.min(footerTop,projectedY+coinSize*.5-motion.rise*scale));
      // Keep the entire coin and date clear of the endpoint cards at every resolution.
      for(const card of callouts){
        if(x+width/2>card.left && x-width/2<card.right && y>card.top-hostTop && y-height<card.bottom-hostTop)
          y=Math.max(height+16*scale,card.top-hostTop-8*scale);
      }
      const collision = boxes.some(b => Math.abs(b.x - x) < (b.width + width) / 2 && Math.abs(b.y - y) < (b.height + height) / 2);
      element.hidden = collision || x < width / 2 + 24*scale || x + width / 2 > ledgerLeft - 24*scale || y-height < 0 || y > footerTop || !visibleFromCamera(globe, arc.midLat, arc.midLng, arc.altitude);
      if (!element.hidden) {
        boxes.push({ x, y, width, height });
        element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%) scale(${Math.max(1,motion.scale)})`;
        element.style.opacity = String(motion.alpha);
      }
    }
  }
  dispose() { this.active.clear(); this.spare = []; this.host.replaceChildren(); }
}
