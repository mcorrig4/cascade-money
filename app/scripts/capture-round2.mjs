import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const onlyApple = process.argv.includes('--apple');
const onlyFifth = process.argv.includes('--fifth');
const nadir = process.argv.includes('--nadir');
const registration = process.argv.includes('--tiles-only') ? 'tiles' : process.argv.includes('--model-only') ? 'model' : 'overlay';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await mkdir('artifacts/round2-final', { recursive: true });

async function openShot(id) {
  await page.goto(`${base}?inspect&shot=${id}${nadir ? `&registration=${registration}` : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__cascade?.engine);
  await page.waitForFunction(() => {
    const tiles = window.__cascade?.tiles();
    return tiles && (tiles.failed || tiles.ready && tiles.ground !== null);
  }, undefined, { timeout: 120_000 });
  if (await page.evaluate(() => window.__cascade.tiles().failed)) throw new Error(`Tiles failed in shot ${id}`);
}

if (!onlyApple) {
  await openShot(10);
  await page.waitForFunction(() => window.__cascade.engine.state.shotElapsed >= 1.05);
  await page.evaluate(() => window.__cascade.engine.update({ shotRunning: false, recording: true }));
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/round2-final/shot10-fly-in-mid.png' });

  await page.evaluate(() => window.__cascade.engine.update({ shotRunning: true }));
  await page.waitForFunction(() => window.__cascade.engine.state.shotElapsed >= 6.35);
  await page.evaluate(() => window.__cascade.engine.update({ shotRunning: false, recording: true }));
  await page.waitForFunction(() => window.__cascade.tiles().opacity > .985);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/round2-final/shot10-street.png' });
}

if (!onlyFifth) {
  await openShot(1);
  await page.evaluate(nadir => {
    if (nadir) window.__cascade.siteNadir('apple-park', 900);
    else window.__cascade.engine.update({ shotElapsed: 11.35, shotRunning: false });
    window.__cascade.engine.update({ shotRunning: false, recording: true });
  }, nadir);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: nadir ? `artifacts/round2-final/apple-park-registration-${registration}.png` : 'artifacts/round2-final/shot1-rainbow-approach.png' });
}

await browser.close();
