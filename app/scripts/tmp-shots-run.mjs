import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const OUT = '/home/claude/claudes-world/tmp/cascade-app-shots-v2';
await mkdir(OUT, { recursive: true });
const PORT = process.env.CASCADE_PORT;
if (!PORT) throw new Error('CASCADE_PORT env var required');
const BASE = `http://127.0.0.1:${PORT}/`;

let executablePath = process.env.CHROME_PATH;
if (!executablePath) {
  for (const candidate of ['google-chrome', 'chromium', 'chromium-browser']) {
    executablePath = (process.env.PATH ?? '').split(delimiter).map(dir => join(dir, candidate)).find(existsSync);
    if (executablePath) break;
  }
}
console.log('Using Chrome at', executablePath);

const consoleLines = [];

async function launch(args) {
  return chromium.launch({ executablePath, headless: true, args });
}

let browser;
try {
  browser = await launch(['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']);
} catch (e) {
  console.log('swiftshader launch failed, trying angle:', e.message);
  browser = await launch(['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']);
}

const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', msg => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => consoleLines.push(`[pageerror] ${err.message}`));

const url = new URL(BASE);
url.searchParams.set('inspect', '1');
await page.goto(url.href);

// wait for cascade to init
await page.waitForFunction(() => !!window.__cascade, { timeout: 30000 }).catch(e => consoleLines.push(`[wait-init] ${e.message}`));

// (a) initial load after 8 seconds
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/a-initial-load-8s.png` });
console.log('captured a-initial-load-8s');

// helper to fly camera directly via engine
async function fly(lat, lng, alt, duration = 0) {
  await page.evaluate(({ lat, lng, alt, duration }) => {
    window.__cascade.engine.stopShot();
    window.__cascade.engine.fly(lat, lng, alt, duration);
  }, { lat, lng, alt, duration });
}

// (b) North America / Cupertino, altitude ~1.2, check Apple label on coast not ocean
await fly(37.3349, -122.009, 1.2, 0);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/b-north-america-cupertino-apple.png` });
console.log('captured b-north-america-cupertino-apple');

// (c) East Asia near 30N 120E - TSMC / Samsung Display or Corning
await fly(30, 120, 1.2, 0);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/c-east-asia-tsmc-samsung-or-corning.png` });
console.log('captured c-east-asia-tsmc-samsung-or-corning');

// check for presence of Samsung Display vs Corning in firm data
const firmNames = await page.evaluate(() => [...window.__cascade.engine.index.firms.values()].map(f => f.name));
consoleLines.push(`[info] firms: ${JSON.stringify(firmNames)}`);

// (d) director shots via Shift+D and shot-list buttons
async function openDirectorAndPlay(shotNum) {
  await page.keyboard.press('Shift+D');
  await page.getByRole('region', { name: 'Shot director' }).waitFor({ timeout: 10000 });
  await page.locator('.shot-list button').nth(shotNum - 1).click();
  await page.keyboard.press('Shift+D');
}

// shot 1: Apple Park close-up
await openDirectorAndPlay(1);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/d-shot1-apple-park.png` });
console.log('captured d-shot1-apple-park');
await page.keyboard.press('Escape');

// shot 6: dated coin overlay - needs shotElapsed > 25 for progress, shot duration 53s per shots.ts
await openDirectorAndPlay(6);
await page.getByTestId('overlay-6').waitFor({ timeout: 10000 }).catch(e => consoleLines.push(`[shot6-wait] ${e.message}`));
await page.waitForTimeout(30000);
await page.screenshot({ path: `${OUT}/d-shot6-dated-coin.png` });
console.log('captured d-shot6-dated-coin');
await page.keyboard.press('Escape');

// shot 8: conservation laws card
await openDirectorAndPlay(8);
await page.getByTestId('overlay-8').waitFor({ timeout: 10000 }).catch(e => consoleLines.push(`[shot8-wait] ${e.message}`));
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/d-shot8-conservation-laws.png` });
console.log('captured d-shot8-conservation-laws');
await page.keyboard.press('Escape');

// shot 9: vault balance sheet
await openDirectorAndPlay(9);
await page.getByTestId('overlay-9').waitFor({ timeout: 10000 }).catch(e => consoleLines.push(`[shot9-wait] ${e.message}`));
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/d-shot9-vault-balance-sheet.png` });
console.log('captured d-shot9-vault-balance-sheet');
await page.keyboard.press('Escape');

// shot 12: close card
await openDirectorAndPlay(12);
await page.getByTestId('overlay-12').waitFor({ timeout: 10000 }).catch(e => consoleLines.push(`[shot12-wait] ${e.message}`));
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/d-shot12-close-card.png` });
console.log('captured d-shot12-close-card');
await page.keyboard.press('Escape');

// (e) night side - Pacific/Asia
// Sun direction formula: subsolar longitude fixed at -150 (mid-Pacific); antipodal/night-center longitude ~ +30 (Europe/Africa/W-Asia)
// Fly to view night hemisphere; try centering near lng 150 (Asia/Pacific side) and near lng 30 (actual night center) for comparison.
await fly(10, 150, 2.3, 0);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/e-night-side-lng150-pacific-asia.png` });
console.log('captured e-night-side-lng150-pacific-asia');

await fly(10, 30, 2.3, 0);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/e-night-side-lng30-actual-terminator-center.png` });
console.log('captured e-night-side-lng30-actual-terminator-center');

await context.close();
await browser.close();

await import('node:fs/promises').then(fs => fs.writeFile(`${OUT}/console.txt`, consoleLines.join('\n') + '\n'));
console.log('DONE. console lines:', consoleLines.length);
