import { calloutMotion } from '../director/cues.ts';
import type { GlobeInstance } from 'globe.gl';
import type { Firm } from '../data/types.ts';
import { visibleFromCamera } from './amount-layer.ts';
import { brandFor, logoFor } from './brands.ts';

/** Crisp SVG marks and DOM text, projected at display resolution rather than a canvas label texture. */
export class CompanyLayer {
  private elements = new Map<string, HTMLElement>();
  private host: HTMLElement;
  private callouts = new Map<string,HTMLElement>();
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
        const img = document.createElement('img');
        const base = window.__cascade?.frameDriven ? `${(window as typeof window & {remotion_staticBase?:string}).remotion_staticBase ?? ''}/` : '/';
        img.src = `${base}logos/${logo}.svg`; img.alt = '';
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
  update(globe: GlobeInstance, firms: Firm[], active: Set<string>, right: number, bottom: number, close: boolean, mobile: boolean, scale=1) {
    const boxes: { x: number; y: number; w: number }[] = [];
    // Named companies are always eligible to show (subject only to on-screen bounds and
    // overlap with another visible label); the fixed count cap below applies solely to
    // anonymous suppliers, so a real company never loses its logo just because more than
    // 10/32 markers are in view. Sort named firms first so they claim overlap priority too.
    const cap = mobile ? 10 : 32;
    const ordered = [...firms].sort((a, b) => Number(active.has(b.id)) - Number(active.has(a.id)) || Number(b.named) - Number(a.named) || Number(b.role === 'anchor') - Number(a.role === 'anchor'));
    for (const firm of ordered) {
      const element = this.elements.get(firm.id)!;
      const p = globe.getScreenCoords(firm.lat!, firm.lng!, 0.009), w = Math.min(mobile ? 120 : 170, Math.max(65, firm.name.length * (mobile ? 6 : 7.5))) * scale;
      element.hidden = close || (!firm.named && boxes.length >= cap) || !visibleFromCamera(globe, firm.lat!, firm.lng!, 0.009)
        || p.x < w / 2 + 12*scale || p.x + w / 2 > right || p.y < (mobile ? 155 : 150)*scale || p.y > bottom
        || boxes.some(b => Math.abs(b.x - p.x) < (b.w + w) / 2 + 6*scale && Math.abs(b.y - p.y) < 65*scale);
      if (!element.hidden) {
        boxes.push({ ...p, w }); element.style.width = `${w}px`;
        element.style.transform = `translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%)`;
      }
    }
  }
  updateCallouts(globe:GlobeInstance,firms:Firm[],cues:{company:string;atMs:number}[],tMs:number,scale:number,bottom:number) {
    for(const element of this.callouts.values())element.hidden=true;
    const boxes:{x:number;y:number;width:number;height:number}[]=[];
    for(const node of document.querySelectorAll<HTMLElement>('.overlay-card,.scene-narration p')) {
      if(Number(getComputedStyle(node).opacity)<.05)continue;
      const b=node.getBoundingClientRect();if(b.width&&b.height)boxes.push({x:b.x-12*scale,y:b.y-12*scale,width:b.width+24*scale,height:b.height+24*scale});
    }
    this.host.style.zIndex='13';
    // The last explicit cue for a company supersedes an older entrance.
    const latest=new Map<string,{company:string;atMs:number}>();
    for(const cue of [...cues].sort((a,b)=>a.atMs-b.atMs))if(cue.atMs<=tMs){
      const firm=firms.find(f=>f.name.toLowerCase()===cue.company.toLowerCase())??firms.find(f=>f.name.toLowerCase().startsWith(cue.company.toLowerCase()));
      latest.set(firm?.id??cue.company,cue);
    }
    for(const cue of latest.values()) {
      const motion=calloutMotion(tMs,cue.atMs);if(!motion.visible)continue;
      const firm=firms.find(f=>f.name.toLowerCase()===cue.company.toLowerCase()) ?? firms.find(f=>f.name.toLowerCase().startsWith(cue.company.toLowerCase()));
      if(firm?.lat==null||firm.lng==null)continue;
      const logo=logoFor(firm.name);if(!logo)continue;
      const local=globe.pointOfView().altitude<.02;
      const altitude=local?3.2/6371000:.001;
      if(!visibleFromCamera(globe,firm.lat,firm.lng,altitude))continue;
      let element=this.callouts.get(cue.company);
      if(!element){
        element=document.createElement('section');element.className='company-callout';element.dataset.company=cue.company;
        const mark=document.createElement('img');mark.src=`${import.meta.env.BASE_URL}logos/${logo}.svg`;mark.alt=firm.name;mark.width=160;mark.height=160;
        const copy=document.createElement('div'),name=document.createElement('strong'),place=document.createElement('span');
        name.textContent=firm.name;place.textContent=[firm.city,firm.country].filter(Boolean).join(', ')||'Supply-chain site';
        copy.append(name,place);element.append(mark,copy);this.host.append(element);this.callouts.set(cue.company,element);
      }
      const p=globe.getScreenCoords(firm.lat,firm.lng,altitude),width=520*scale,height=220*scale;
      const left=24*scale,right=globe.width()-width-24*scale,top=115*scale;
      const low=bottom-height-(24+motion.offset)*scale;
      const preferred={x:Math.max(left,Math.min(right,p.x+32*scale)),y:Math.max(top,Math.min(low,p.y-height/2))};
      const candidates=[preferred,...[right,left].flatMap(x=>[top,top+height+12*scale,low].map(y=>({x,y})))];
      const chosen=candidates.find(({x,y})=>y>=top&&y<=low&&!boxes.some(b=>x<b.x+b.width&&x+width>b.x&&y<b.y+b.height&&y+height+motion.offset*scale>b.y));
      if(!chosen)continue;
      const {x,y}=chosen;
      boxes.push({x,y,width,height});element.hidden=false;
      element.style.setProperty('--film-unit',`${scale}px`);
      element.style.transform=`translate3d(${x}px,${y+motion.offset*scale}px,0)`;
      element.style.opacity=String(motion.alpha);
    }
  }
  dispose() { this.callouts.clear(); this.elements.clear(); this.host.replaceChildren(); }
}
