import type { GlobeInstance } from 'globe.gl';
import type { Firm } from '../data/types.ts';
import { visibleFromCamera } from './amount-layer.ts';
import { brandFor, logoFor } from './brands.ts';

/** Crisp SVG marks and DOM text, projected at display resolution rather than a canvas label texture. */
export class CompanyLayer {
  private elements = new Map<string, HTMLElement>();
  private host: HTMLElement;
  constructor(host: HTMLElement, firms: Firm[]) {
    this.host = host;
    const ns = 'http://www.w3.org/2000/svg';
    for (const firm of firms) {
      const logo = logoFor(firm.name), element = document.createElement('div');
      element.className = 'company-label'; element.hidden = true; element.dataset.firm = firm.id;
      const disc = document.createElement('div'); disc.className = 'company-disc';
      if (logo) {
        // Official mark: pre-colored, single-fill SVG file (see public/logos/LICENSES.md), scaled
        // to fit the same 40x40 box the monogram used, letter-boxed rather than cropped.
        const img = document.createElement('img'); img.src = `/logos/${logo}.svg`; img.alt = '';
        img.width = 40; img.height = 40; img.className = 'company-logo';
        disc.append(img);
      } else {
        const brand = brandFor(firm.name);
        const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 40 40'); svg.setAttribute('aria-hidden', 'true');
        const text = document.createElementNS(ns, 'text'); text.textContent = brand.mark;
        text.setAttribute('x', '20'); text.setAttribute('y', '26'); text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', brand.color); text.setAttribute('stroke', '#ffffff55'); text.setAttribute('stroke-width', '0.35'); text.setAttribute('paint-order', 'stroke'); text.setAttribute('font-size', brand.mark.length > 1 ? '17' : '23'); text.setAttribute('font-weight', '650');
        svg.append(text); disc.append(svg);
      }
      const label = document.createElement('span'); label.textContent = firm.name;
      element.append(disc, label); host.append(element); this.elements.set(firm.id, element);
    }
  }
  update(globe: GlobeInstance, firms: Firm[], active: Set<string>, right: number, bottom: number, close: boolean, mobile: boolean) {
    const boxes: { x: number; y: number; w: number }[] = [];
    // Named companies are always eligible to show (subject only to on-screen bounds and
    // overlap with another visible label); the fixed count cap below applies solely to
    // anonymous suppliers, so a real company never loses its logo just because more than
    // 10/32 markers are in view. Sort named firms first so they claim overlap priority too.
    const cap = mobile ? 10 : 32;
    const ordered = [...firms].sort((a, b) => Number(active.has(b.id)) - Number(active.has(a.id)) || Number(b.named) - Number(a.named) || Number(b.role === 'anchor') - Number(a.role === 'anchor'));
    for (const firm of ordered) {
      const element = this.elements.get(firm.id)!;
      const p = globe.getScreenCoords(firm.lat!, firm.lng!, 0.009), w = Math.min(mobile ? 120 : 170, Math.max(65, firm.name.length * (mobile ? 6 : 7.5)));
      element.hidden = close || (!firm.named && boxes.length >= cap) || !visibleFromCamera(globe, firm.lat!, firm.lng!, 0.009)
        || p.x < w / 2 + 12 || p.x + w / 2 > right || p.y < (mobile ? 155 : 150) || p.y > bottom
        || boxes.some(b => Math.abs(b.x - p.x) < (b.w + w) / 2 + 6 && Math.abs(b.y - p.y) < 65);
      if (!element.hidden) {
        boxes.push({ ...p, w }); element.style.width = `${w}px`;
        element.style.transform = `translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%)`;
      }
    }
  }
  dispose() { this.elements.clear(); this.host.replaceChildren(); }
}
