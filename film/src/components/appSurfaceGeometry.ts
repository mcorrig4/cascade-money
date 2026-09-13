import type {CSSProperties} from 'react';

/** Remotion 4.0.484 make-page.js/render-still.js keep the CSS viewport at the
 * composition size and apply --scale as deviceScaleFactor. Pinning the app's
 * exact vw/vh coefficients here also avoids Studio's surrounding page size;
 * output scale must NEVER be applied a second time to these logical pixels.
 * Landscape @media rules still require a landscape viewport (all film renders).
 */
export const filmUnitFor = (width: number, height: number): number =>
  Math.min(0.0520833333 * width / 100, 0.0925925926 * height / 100);

export const appSurfaceStyle = (width: number, height: number): CSSProperties & {'--film-unit': string} => ({
  position: 'absolute', inset: 0, width, height, minHeight: 0,
  background: 'transparent', overflow: 'visible', pointerEvents: 'none',
  '--film-unit': `${filmUnitFor(width, height)}px`,
});
