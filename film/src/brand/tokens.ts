/**
 * Cascade brand tokens — every value copied verbatim from the live app's
 * stylesheet (~/code/cascade/app/src/styles.css :root / .app / .brand rules)
 * and its public/mark.svg icon. This is a CASCADE-branded film, not a
 * claude.do product video: dark ground, teal money accent, amber for
 * extension/yield, no coral anywhere.
 */
export const color = {
  bgInner: '#142634',
  bgOuter: '#071019',
  fg: '#e6eceb',
  fgDim: '#abc0bd',
  fgFaint: '#819a98',
  muted: '#8297a5',
  money: '#69e6c0', // the one accent for backing/settlement/money facts
  amber: '#e8b768', // the one accent for extension/yield facts
  fail: '#f19178',
  hairline: 'rgba(170,199,204,0.16)',
  hairline2: 'rgba(170,199,204,0.08)',
  white: '#ffffff',
  black: '#000000',
} as const;

export const font = {
  family: "Inter, 'Helvetica Neue', Arial, sans-serif",
} as const;

/** Type scale — cascade's own (not a general design-system scale). */
export const type = {
  kicker: 13,
  lawEyebrow: 13,
  lawBody: 19,
  cardTitle: 56,
  cardBody: 24,
  statNumber: 120,
  statCaption: 30,
  closeTitle: 100,
  closeBody: 32,
  wordmark: 96,
  tag: 32,
} as const;

/** Ground gradient identical to the app's .app background. */
export const bgGradient = `radial-gradient(ellipse at 40% 42%, ${color.bgInner} 0%, ${color.bgOuter} 66%)`;

/** The scrim the app itself uses under overlay cards (.globe-dimmer equivalent). */
export const scrim = 'rgba(3,10,15,0.72)';
