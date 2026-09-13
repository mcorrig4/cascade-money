import { createElement as h, useId } from 'react';

export type DatedDollarProps = { days?: number | null; isoDate?: string; size?: number };

// Coin-v3 geometry (Liam's 7 notes on the v2 sheet, msg 22232): smaller number,
// plus stroke matched to the ring thickness and shrunk overall, a condensed
// centred date with more air above the number, and the spot token (days=null)
// reading "+0" through the same layout as every other coin.
const RING_STROKE = 7;
const PLUS_ARM = 22;
const PLUS_THICK = RING_STROKE;
const NUMBER_SIZE = 82;
const NUM_DIGIT_WIDTH = NUMBER_SIZE * 0.62;
const DATE_SIZE = 26;
const DATE_CONDENSE = 0.82;
const DATE_GAP_FROM_NUM_BASELINE = 84;
const NUM_X = 208.87;
const NUM_BASELINE = 168.62;
const PLUS_CENTER: [number, number] = [168.87, 136.62];
const DATE_FONT = "'Inter Condensed', 'Roboto Condensed', 'Arial Narrow', Inter, 'DejaVu Sans', sans-serif";

/** Approved coin-v3 geometry. Size is the SVG height; null days denotes spot ("+0"). */
export function DatedDollar({ days = null, isoDate, size = 96 }: DatedDollarProps) {
  const gradient = `dated-dollar-${useId()}`;
  const spot = days === null;
  const shown = spot ? 0 : days;
  const digits = String(shown).length;
  const dateCenterX = NUM_X + (NUM_DIGIT_WIDTH * digits) / 2;
  const width = 462;
  return h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `18 18 ${width} 170`,
    width: size * width / 170, height: size, className: 'dated-dollar', role: 'img',
    'aria-label': spot ? 'USD spot' : `USD plus ${days} days${isoDate ? `, maturity ${isoDate}` : ''}`,
    'data-days': days ?? 'spot', 'data-maturity': isoDate,
  },
    h('defs', null, h('radialGradient', { id: gradient, cx: '38%', cy: '32%', r: '75%' },
      h('stop', { offset: '0%', stopColor: '#eef4f1' }), h('stop', { offset: '100%', stopColor: '#c9d6d1' }))),
    h('g', { fontFamily: "Inter, 'DejaVu Sans', Helvetica, Arial, sans-serif" },
      h('circle', { cx: 100, cy: 100, r: 78, fill: 'none', stroke: '#102824', strokeWidth: RING_STROKE }),
      h('circle', { cx: 100, cy: 100, r: 74.5, fill: 'none', stroke: '#548e7d', strokeWidth: RING_STROKE }),
      h('circle', { cx: 100, cy: 100, r: 69, fill: `url(#${gradient})` }),
      h('text', { x: 100, y: 111, textAnchor: 'middle', fontSize: 34, fontWeight: 700, fontStyle: 'italic', letterSpacing: 1, fill: '#0e7a5a' }, 'USD'),
      h('g', { transform: `translate(${PLUS_CENTER[0]} ${PLUS_CENTER[1]})`, fill: '#e8b768' },
        h('rect', { x: -PLUS_ARM, y: -PLUS_THICK / 2, width: 2 * PLUS_ARM, height: PLUS_THICK, rx: PLUS_THICK / 2 }),
        h('rect', { x: -PLUS_THICK / 2, y: -PLUS_ARM, width: PLUS_THICK, height: 2 * PLUS_ARM, rx: PLUS_THICK / 2 })),
      h('text', { x: NUM_X, y: NUM_BASELINE, fontSize: NUMBER_SIZE, fontWeight: 700, letterSpacing: -2, fill: '#e9f2ee', style: { fontVariantNumeric: 'tabular-nums' } }, shown),
      size >= 72 && isoDate && h('g', { transform: `translate(${dateCenterX} ${NUM_BASELINE - DATE_GAP_FROM_NUM_BASELINE}) scale(${DATE_CONDENSE} 1)` },
        h('text', { x: 0, y: 0, textAnchor: 'middle', fontFamily: DATE_FONT, fontSize: DATE_SIZE, fontWeight: 600,
          letterSpacing: 0.5, fill: '#8297a5', style: { fontStretch: 'condensed', fontVariantNumeric: 'tabular-nums' } }, isoDate))));
}
