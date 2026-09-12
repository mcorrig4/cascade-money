import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Start `pnpm preview` separately. Pass its port-for URL explicitly; no hardcoded port.
const url = process.argv[2];
if (!url) throw new Error('Usage: pnpm check:browser http://127.0.0.1:<port-for port>');
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  const inspectUrl = new URL(url); inspectUrl.searchParams.set('inspect', '1');
  await page.goto(inspectUrl.href);
  await page.waitForFunction(() => window.__cascade?.geometry().every(a => a.geometry && a.alpha === 1) && window.__cascade.pool.arcs.length > 0);
  await page.waitForTimeout(500);
  assert.equal(await page.getByTestId('settled').innerText(), '$400M');
  assert.equal(await page.getByTestId('committed').innerText(), '$100M');
  assert.equal(await page.getByTestId('ratio').innerText(), '4.00×');
  await page.screenshot({ path: 'artifacts/globe-1920x1080.png' });
  const before = await page.evaluate(() => window.__cascade.geometry());
  await page.evaluate(() => window.__cascade.ageArcs(1400));
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__cascade.geometry());
  assert.equal(before.length, after.length);
  for (let i = 0; i < before.length; i++) {
    assert.equal(before[i].geometry, after[i].geometry, 'Fading must retain arc geometry');
    assert.ok(after[i].alpha > 0 && after[i].alpha < before[i].alpha, 'RGBA alpha must reach the shader');
  }
  await page.keyboard.press('Shift+D');
  await page.getByRole('region', { name: 'Shot director' }).waitFor();
  await page.locator('.shot-list button').nth(0).click();
  await page.keyboard.press('Shift+D');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/apple-park-1920x1080.png' });
  await page.keyboard.press('Escape');
  const totals = await page.evaluate(() => {
    const { engine } = window.__cascade;
    engine.setSpeed('year'); engine.tick(15);
    return { day: engine.state.day, playing: engine.state.playing, settled: String(engine.totals().settled) };
  });
  assert.deepEqual(totals, { day: 364, playing: false, settled: '40000000000' });
  assert.deepEqual(errors, []);
  await writeFile('artifacts/browser-check.json', JSON.stringify({ viewport: '1920x1080', renderer: 'Chrome / SwiftShader', opacity: 'passed', retainedGeometry: 'passed', before, after, errors }, null, 2));
  console.log('Passed: counters, arc alpha, retained geometry, director, year endpoint. Screenshots: app/artifacts/');
} finally { await browser.close(); }
