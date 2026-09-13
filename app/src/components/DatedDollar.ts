import { createElement as h, useId } from 'react';

export type DatedDollarProps = { days?: number | null; isoDate?: string; size?: number };
/** Approved coin-v2 geometry. Size is the SVG height; null days denotes spot. */
export function DatedDollar({ days = null, isoDate, size = 96 }: DatedDollarProps) {
  const gradient = `dated-dollar-${useId()}`;
  const spot = days === null;
  const width = spot ? 164 : 462;
  return h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `18 18 ${width} 170`,
    width: size * width / 170, height: size, className: 'dated-dollar', role: 'img',
    'aria-label': spot ? 'USD spot' : `USD plus ${days} days${isoDate ? `, maturity ${isoDate}` : ''}`,
    'data-days': days ?? 'spot', 'data-maturity': isoDate,
  },
    h('defs', null, h('radialGradient', { id: gradient, cx: '38%', cy: '32%', r: '75%' },
      h('stop', { offset: '0%', stopColor: '#eef4f1' }), h('stop', { offset: '100%', stopColor: '#c9d6d1' }))),
    h('g', { fontFamily: "Inter, 'DejaVu Sans', Helvetica, Arial, sans-serif" },
      h('circle', { cx: 100, cy: 100, r: 78, fill: 'none', stroke: '#102824', strokeWidth: 7 }),
      h('circle', { cx: 100, cy: 100, r: 74.5, fill: 'none', stroke: '#548e7d', strokeWidth: 7 }),
      h('circle', { cx: 100, cy: 100, r: 69, fill: `url(#${gradient})` }),
      h('text', { x: 100, y: 111, textAnchor: 'middle', fontSize: 34, fontWeight: 700, fontStyle: 'italic', letterSpacing: 1, fill: '#0e7a5a' }, 'USD'),
      !spot && h('g', null,
        h('g', { transform: 'translate(168.87 136.62)', fill: '#e8b768' },
          h('rect', { x: -34, y: -10, width: 68, height: 20, rx: 10 }),
          h('rect', { x: -10, y: -34, width: 20, height: 68, rx: 10 })),
        h('text', { x: 220.87, y: 168.62, fontSize: 94, fontWeight: 700, letterSpacing: -2, fill: '#e9f2ee', style: { fontVariantNumeric: 'tabular-nums' } }, days),
        size >= 72 && isoDate && h('text', { x: 220.87, y: 92.62, fontSize: 26, fontWeight: 600, letterSpacing: 1, fill: '#8297a5' }, isoDate))));
}
