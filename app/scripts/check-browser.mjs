import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, delimiter, join } from 'node:path';
import { chromium } from 'playwright-core';

// Start `pnpm preview` separately. Pass its port-for URL explicitly; no hardcoded port.
const staticMode = process.argv.includes('--static');
const url = staticMode ? 'http://cascade.test/rehearsal/' : process.argv[2];
if (!url) throw new Error('Usage: pnpm check:browser --static OR pnpm check:browser <preview-url>');
await mkdir('artifacts', { recursive: true });
let executablePath = process.env.CHROME_PATH;
if (!executablePath) {
  for (const candidate of ['google-chrome', 'chromium', 'chromium-browser']) {
    executablePath = (process.env.PATH ?? '').split(delimiter).map(dir => join(dir, candidate)).find(existsSync);
    if (executablePath) break;
  }
}
if (!executablePath || !existsSync(executablePath)) throw new Error('Chrome not reachable. Set CHROME_PATH to an existing Chrome executable; no browser download is performed.');
let browser;
try { browser = await chromium.launch({ executablePath, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); } catch (error) {
  console.error(`Chrome launch failed (${executablePath}): ${error.message}\nRun outside the sandbox: pnpm --dir app check:browser --static`);
  process.exit(1);
}
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  if (staticMode) {
    // Fulfill the built app over an intercepted origin; no listening socket or port allocation.
    const root = resolve('dist');
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ndjson': 'application/x-ndjson' };
    await context.route('http://cascade.test/**', async route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/rehearsal\//, '');
      const file = resolve(root, pathname || 'index.html');
      if (!file.startsWith(root + sep)) return route.fulfill({ status: 403 });
      try { await route.fulfill({ status: 200, body: await readFile(file), contentType: mime[extname(file)] ?? 'application/octet-stream' }); }
      catch { await route.fulfill({ status: 404, body: 'Not found' }); }
    });
  }
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  const inspectUrl = new URL(url); inspectUrl.searchParams.set('inspect', '1');
  await page.goto(inspectUrl.href);
  await page.waitForFunction(() => window.__cascade?.geometry().every(a => a.geometry && a.alpha === 1) && window.__cascade.pool.arcs.length > 0);
  await page.waitForTimeout(500);
  const expectedYear = await page.evaluate(() => String(window.__cascade.engine.index.days[364].end.settled));
  assert.ok((await page.getByTestId('settled').innerText()).startsWith('$'));
  assert.ok((await page.getByTestId('committed').innerText()).startsWith('$'));
  assert.ok((await page.getByTestId('ratio').innerText()).endsWith('×'));
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
  assert.deepEqual(totals, { day: 364, playing: false, settled: expectedYear });
  for (let shot = 6; shot <= 12; shot++) {
    await page.keyboard.press('Shift+D');
    await page.locator('.shot-list button').nth(shot - 1).click();
    await page.keyboard.press('Shift+D');
    await page.getByTestId(`overlay-${shot}`).waitFor();
    if (shot === 10) {
      await page.waitForTimeout(4300);
      await page.screenshot({ path: 'artifacts/fifth-avenue-1920x1080.png' });
      await page.evaluate(() => window.__cascade.engine.tick(8));
    }
    await page.screenshot({ path: `artifacts/shot-${shot}-1920x1080.png` });
  }
  await page.getByText('Earth imagery: NASA', { exact: true }).waitFor();
  assert.equal(await page.locator('.close-card a').count(), 3);
  assert.deepEqual(errors, []);
  await writeFile('artifacts/browser-check.json', JSON.stringify({ viewport: '1920x1080', renderer: 'Chrome / SwiftShader', opacity: 'passed', retainedGeometry: 'passed', before, after, errors }, null, 2));
  console.log('Passed: counters, arc alpha, retained geometry, director, year endpoint. Screenshots: app/artifacts/');
} finally { await browser.close(); }
