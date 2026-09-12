/**
 * Self-hosted Inter loader — offline-safe (no network fetch at render time).
 * Weights live in public/fonts/Inter-{400,500,600,700}.woff2 and are loaded
 * via the FontFace API + delayRender/continueRender so Remotion (Studio and
 * headless render) always waits for real glyphs before it captures a frame.
 *
 * Import `ensureFontsLoaded()` once (Root.tsx does this at module scope) —
 * it's idempotent, so components never need to think about it again.
 */
import {continueRender, delayRender, staticFile} from 'remotion';

const WEIGHTS = [400, 500, 600, 700] as const;

let started = false;

export const ensureFontsLoaded = (): void => {
  if (started) return;
  started = true;

  for (const weight of WEIGHTS) {
    const handle = delayRender(`Loading Inter ${weight}`);
    const face = new FontFace(
      'Inter',
      `url(${staticFile(`fonts/Inter-${weight}.woff2`)}) format('woff2')`,
      {weight: String(weight), style: 'normal', display: 'block'},
    );
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        continueRender(handle);
      })
      .catch((err) => {
        // Never hang a render on a font — fall back to system sans and move on.
        console.error(`[video-lab] font load failed: Inter ${weight}`, err);
        continueRender(handle);
      });
  }
};
