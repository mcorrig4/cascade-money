import { createElement as h, useId } from 'react';

export type DatedDollarProps = { days?: number | null; isoDate?: string; size?: number };

// Coin-v4 = FINAL geometry (Liam voice 2026-09-13 06:39 EDT, msg 22297), on top
// of v3 (msg 22232): v3's number size/date-gap/date-centring/spot-"+0"/ring-USD
// are unchanged. This round: (2) plus reverted to v2's chunky bar/arm, amber as
// before; (3) date now uses a real bundled condensed light typeface (Roboto
// Condensed Light, app/public/fonts/RobotoCondensed-Light.woff2, @font-face'd
// as 'Coin Date Condensed' in styles.css — never a system-font assumption)
// plus negative tracking plus a small extra horizontal squeeze, so the date is
// close to the big number's width instead of dominating it; (4) palette A
// everywhere except the date colour, which takes glacier enamel's #A8C6CE.
const RING_STROKE = 7;
const PLUS_ARM = 34;
const PLUS_THICK = 20;
const NUMBER_SIZE = 82;
const NUM_DIGIT_WIDTH = NUMBER_SIZE * 0.62;
const DATE_SIZE = 25;
const DATE_LETTER_SPACING = -0.4;
const DATE_CONDENSE = 0.96;
const DATE_GAP_FROM_NUM_BASELINE = 84;
const NUM_X = 220.87;
const NUM_BASELINE = 168.62;
const PLUS_CENTER: [number, number] = [168.87, 136.62];
const DATE_COLOR = '#A8C6CE';
const DATE_FONT = "'Coin Date Condensed', 'Roboto Condensed', Arial, sans-serif";

/** Approved coin-v4 (FINAL) geometry. Size is the SVG height; null days denotes spot ("+0"). */
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
        h('text', { x: 0, y: 0, textAnchor: 'middle', fontFamily: DATE_FONT, fontSize: DATE_SIZE, fontWeight: 300,
          letterSpacing: DATE_LETTER_SPACING, fill: DATE_COLOR, style: { fontVariantNumeric: 'tabular-nums' } }, isoDate))));
}
