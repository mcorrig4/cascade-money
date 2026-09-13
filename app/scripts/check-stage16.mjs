import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, dirname, join, delimiter, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// Static interception deliberately binds no port. Run after `pnpm --dir app build`.
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(app, 'dist'), artifacts = join(app, 'artifacts');
await mkdir(artifacts, { recursive: true });
const proof = { viewport: [1920, 1080], outputs: [], checks: [], errors: [], inspectedByHuman: false };
const pathFor = name => join(artifacts, `stage16-${name}.png`);
let browser;
const check = async (name, action) => {
  try { const result = await action(); proof.checks.push({ name, passed: true, result }); console.log(`[stage16] PASS ${name}`); }
  catch (error) { proof.errors.push({ name, message: error.stack ?? String(error) }); console.error(`[stage16] FAIL ${name}: ${error.message}`); }
};
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ndjson': 'application/x-ndjson', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
try {
  const executablePath = process.env.CHROME_PATH || ['google-chrome', 'chromium', 'chromium-browser'].flatMap(name => (process.env.PATH ?? '').split(delimiter).map(dir => join(dir, name))).find(existsSync);
  assert.ok(executablePath, 'Set CHROME_PATH to an installed Chrome binary');
  browser = await chromium.launch({ executablePath, headless: true, timeout: 30000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  let releaseTextures;
  let holdTextures = true;
  const textureRelease = new Promise(resolve => { releaseTextures = resolve; });
  const textureRequests = [];
  await context.route('http://cascade.test/**', async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
    const file = resolve(dist, pathname || 'index.html');
    if (!file.startsWith(dist + sep)) return route.fulfill({ status: 403 });
    if (pathname.startsWith('textures/')) {
      textureRequests.push(pathname);
      if (holdTextures) await textureRelease;
    }
    try { await route.fulfill({ status: 200, body: await readFile(file), contentType: mime[extname(file)] ?? 'application/octet-stream' }); }
    catch { await route.fulfill({ status: 404, body: 'Not found' }); }
  });
  let tileRequests = 0;
  await context.route('https://tile.googleapis.com/**', route => {
    tileRequests++; return route.fulfill({ status: 403, body: '{}', contentType: 'application/json' });
  });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => proof.errors.push({ name: 'pageerror', message: error.stack ?? error.message }));
  const settle = async () => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => window.__cascade?.models().every(model => !model.pending), null, { timeout: 60000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  // Downsample the actual 1080p frame; never relayout the app at the output size.
  const canvasPage = await context.newPage();
  const scaled = async (buffer, width, height, name) => {
    const data = await canvasPage.evaluate(async ({ source, width, height }) => {
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(image, 0, 0, width, height); return canvas.toDataURL('image/png').split(',')[1];
    }, { source: `data:image/png;base64,${buffer.toString('base64')}`, width, height });
    await writeFile(pathFor(name), Buffer.from(data, 'base64')); proof.outputs.push(pathFor(name));
  };
  const capture = async (name, downscale = true) => {
    await settle(); const buffer = await page.screenshot({ path: pathFor(name), timeout: 60000 });
    proof.outputs.push(pathFor(name));
    if (downscale) for (const [width, height] of [[640, 360], [426, 240]]) await scaled(buffer, width, height, `${name}-${height}p`);
    return buffer;
  };
  const advance = async seconds => {
    await page.evaluate(seconds => { const e = window.__cascade.engine; e.tick(seconds, 'manual'); }, seconds); await settle();
  };
  const scene = async (id, seconds = 0) => {
    await page.evaluate(async id => {
      const c = window.__cascade; c.engine.setClockMode('manual'); await c.ready(); await c.playScene(id);
      c.engine.update({ recording: true, hud: true });
    }, id);
    await advance(seconds);
  };
  await page.goto('http://cascade.test/?inspect=1', { waitUntil: 'domcontentloaded' });
  await check('1: readiness waits for cold textures and render', async () => {
    await page.waitForFunction(() => typeof window.__cascade?.ready === 'function');
    await page.evaluate(() => {
      const c = window.__cascade; c.engine.setClockMode('manual'); window.__stage16Ready = false;
      c.ready().then(() => { window.__stage16Ready = true; });
      window.__stage16Film = false; Promise.resolve(c.playFilm()).then(() => { window.__stage16Film = true; });
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__stage16Ready), false, 'Readiness must remain pending while textures are withheld');
    assert.ok(textureRequests.length, 'The gate is tested with actual requested maps');
    await page.screenshot({ path: pathFor('1-cold-pending') }); proof.outputs.push(pathFor('1-cold-pending'));
    holdTextures = false; releaseTextures();
    await page.waitForFunction(() => window.__stage16Ready && window.__stage16Film, null, { timeout: 60000 });
    await capture('1-first-ready');
    const readiness = await page.evaluate(() => window.__cascade.readiness?.() ?? null);
    if (readiness) {
      assert.equal(readiness.fullFrame, true);
      assert.ok(readiness.textures.length > 0 && readiness.textures.every(texture => texture.decoded && texture.uploaded));
    }
    return { textureRequests, readiness };
  });
  // Ensure later checks can run even if a readiness assertion failed.
  holdTextures = false; releaseTextures();
  await page.waitForFunction(() => !!window.__cascade, null, { timeout: 60000 });
  await page.evaluate(async () => { if (window.__cascade.ready) await window.__cascade.ready(); });

  await check('1: texture failure rejects readiness promptly', async () => {
    const failedPage = await context.newPage();
    try {
      await failedPage.route('**/textures/**', route => route.fulfill({ status: 404, body: 'Missing texture' }));
      await failedPage.goto('http://cascade.test/', { waitUntil: 'domcontentloaded' });
      await failedPage.waitForFunction(() => typeof window.__cascade?.ready === 'function');
      const outcome = await failedPage.evaluate(() => Promise.race([
        window.__cascade.ready().then(() => 'resolved', () => 'rejected'),
        new Promise(resolve => setTimeout(() => resolve('pending'), 5000)),
      ]));
      assert.equal(outcome, 'rejected', 'An actual missing Earth texture must reject instead of hanging');
    } finally { await failedPage.close(); }
  });
  await check('2: forty fixed-time Apple orbit frames', async () => {
    await scene(2);
    const models = await page.evaluate(() => window.__cascade.models());
    assert.ok(models.some(model => model.id === 'apple-park' && model.loaded && !model.missing), 'The orbit proof includes the loaded Apple Park campus');
    const frames = [], diagnostics = [];
    for (let frame = 0; frame < 40; frame++) {
      if (frame) await advance(.2);
      frames.push((await capture(`2-orbit-${String(frame).padStart(2, '0')}`, false)).toString('base64'));
      const clearance = await page.evaluate(() => window.__cascade.cameraClearance?.() ?? null);
      if (clearance) assert.ok(clearance.actualMeters >= clearance.minimumMeters - .01, `Camera floor at orbit frame ${frame}`);
      diagnostics.push({ frame, tMs: frame * 200, clearance });
    }
    const sheet = await canvasPage.evaluate(async frames => {
      const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#071624'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const [i, data] of frames.entries()) {
        const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
        const x = i % 8 * 240, y = Math.floor(i / 8) * 216;
        ctx.drawImage(image, x, y, 240, 135); ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText(`${i}: ${(i * .2).toFixed(1)} s`, x + 8, y + 160);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    }, frames);
    await writeFile(pathFor('2-orbit-contact-sheet'), Buffer.from(sheet, 'base64')); proof.outputs.push(pathFor('2-orbit-contact-sheet'));
    return { diagnostics, visualReviewRequired: 'Inspect every orbit frame for courtyard/plate flicker; the contact sheet cannot certify absence of flicker.' };
  });
  await check('4: two-second rewind and date-card cue', async () => {
    const samples = []; await scene(13);
    let elapsed = 0;
    for (const seconds of [0, .5, 1, 1.9, 2.2, 2.8]) {
      await advance(seconds - elapsed); elapsed = seconds;
      await capture(`4-rewind-${String(seconds).replace('.', '-')}`);
      samples.push(await page.evaluate(() => { const s = window.__cascade.engine.state; return { elapsed: s.shotElapsed, position: s.position, timelapse: s.timelapse }; }));
    }
    assert.ok(samples.slice(0, 4).every((sample, index, list) => !index || sample.position < list[index - 1].position), 'Event stream visibly moves backwards during rewind');
    assert.ok(!samples[4].timelapse || samples[4].timelapse.elapsed >= samples[4].timelapse.duration, 'Rewind stops after two seconds');
    await scene(13);
    await page.evaluate(() => window.__cascade.cue('date-card', undefined, 5000));
    await advance(3);
    assert.equal(await page.locator('.scene-narration').filter({ hasText: 'September 9, 2025' }).count(), 0, 'A preloaded narration cue suppresses the default reveal');
    await advance(2.4); await capture('4-date-card-cued');
    assert.equal(await page.locator('.scene-narration').filter({ hasText: 'September 9, 2025' }).count(), 1, 'Date card can be triggered after its default appearance');
    return samples;
  });
  await check('5: scene-three narration beats', async () => {
    for (const [seconds, beat] of [[2.8, 'date'], [4.4, 'suppliers'], [6.3, 'factories'], [8.2, 'countries'], [10.2, 'costs'], [13.5, 'system'], [17.4, 'payment-layer']]) {
      await scene(13, seconds); await capture(`5-scene3-${beat}`);
    }
    return { visualReviewRequired: 'Read every beat in the 360p and 240p downsampled frames.' };
  });
  await check('6: company cue callouts', async () => {
    for (const [company, id, time] of [['Apple', 2, 4], ['Samsung', 3, 7], ['Corning', 3, 10], ['TSMC', 3, 5]]) {
      await scene(id, time);
      await page.evaluate(company => {
        const c = window.__cascade;
        const firm = [...c.engine.index.firms.values()].find(firm => firm.name.toLowerCase().startsWith(company.toLowerCase()));
        if (!firm) throw new Error(`No indexed company matching ${company}`);
        const site = firm.sites?.[0] ?? firm;
        if (typeof site.lat !== 'number' || typeof site.lng !== 'number') throw new Error(`No mapped site for ${company}`);
        c.engine.fly(site.lat, site.lng, .4, 0); c.engine.tick(0, 'manual'); c.cue('company', company);
      }, company); await advance(.5);
      await capture(`6-company-${company.toLowerCase()}`);
      const callout = page.locator('.company-callout').filter({ hasText: new RegExp(company, 'i') }).first();
      assert.ok(await callout.isVisible(), `${company} has a visible cue callout`);
      const logo = callout.locator('img').first();
      assert.ok(await logo.evaluate(image => image.complete && image.naturalWidth > 0), `${company} uses a decoded mark`);
    }
  });
  await check('7: token panel and recorded fallback', async () => {
    await page.evaluate(() => { const e = window.__cascade.engine; e.stopShot(); e.update({ recording: false, hud: true }); });
    await page.route('https://rpc.testnet.arc.io', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.getByRole('button', { name: 'On-chain', exact: true }).click();
    const panel = page.getByRole('dialog'); await panel.getByText(/recorded demo balances/).waitFor();
    for (const part of ['diagram', 'tickers', 'ladder', 'lifecycle', 'contract']) {
      await panel.getByTestId(`token-${part}`).scrollIntoViewIfNeeded(); await capture(`7-token-${part}`);
    }
    assert.ok((await panel.innerText()).includes('USD+30'));
    await panel.getByRole('button', { name: 'Close Verify on Arc' }).click();
  });
  await check('9/10: production site jumps, manual zoom, and Google 403 fallback', async () => {
    await page.evaluate(() => {
      const e = window.__cascade.engine; e.stopShot(); e.setClockMode('manual');
      e.update({ recording: false, hud: true, playing: false });
    });
    for (const [label, site] of [['Apple Park', 'apple-park'], ['Fifth Avenue', 'fifth-avenue']]) {
      await page.getByRole('navigation', { name: 'Explore sites' }).getByRole('button', { name: label, exact: true }).click();
      await advance(3);
      await page.waitForFunction(id => window.__cascade.models().some(model => model.id === id && model.loaded && model.fade === 1), site);
      assert.equal(await page.evaluate(() => window.__cascade.engine.state.camera.site), site);
      const navigation = page.getByRole('navigation', { name: 'Explore sites' });
      for (const name of ['Apple Park', 'Fifth Avenue', 'Globe']) assert.ok(await navigation.getByRole('button', { name, exact: true }).isVisible());
      await capture(`9-${site}-hud`);
      if (site === 'apple-park') {
        await page.waitForFunction(() => window.__cascade.tiles().failed);
        assert.ok(tileRequests > 0, 'The enabled production module actually attempted a Google request');
        assert.equal(await page.evaluate(() => window.__cascade.tiles().opacity), 0);
        assert.equal(await page.evaluate(() => window.__cascade.readiness().fullFrame), true);
        await capture('tiles-fallback');
      }
      // A real wheel gesture takes over from the authored pose and may reach the
      // same exterior floor. Keep the manual clock frozen during this assertion.
      await page.mouse.move(960, 500); await page.mouse.wheel(0, -2000);
      await page.waitForTimeout(600); await settle();
      const clearance = await page.evaluate(() => window.__cascade.cameraClearance());
      assert.ok(clearance.actualMeters >= clearance.minimumMeters - .01);
      assert.ok(clearance.actualMeters <= 20, `${label} manual zoom reaches the site's exterior floor`);
      await capture(`9-${site}-manual-zoom`);
    }
    await page.getByRole('navigation', { name: 'Explore sites' }).getByRole('button', { name: 'Globe', exact: true }).click();
    await advance(3);
    assert.ok(await page.evaluate(() => window.__cascade.globe.pointOfView().altitude > 1));
    await capture('9-globe-return');
    return { rejectedTileRequests: tileRequests };
  });
  await check('determinism: frozen manual time', async () => {
    await scene(13, 8.2);
    const state = () => page.evaluate(() => { const c = window.__cascade, s = c.engine.state; return { elapsed: s.shotElapsed, position: s.position, camera: c.globe.camera().position.toArray() }; });
    const before = await state(); await capture('determinism-a'); await page.waitForTimeout(250); await capture('determinism-b');
    const after = await state(); assert.deepEqual(after, before, 'A paused manual clock cannot advance scene or camera state');
    return { before, after, visualReviewRequired: 'Compare determinism-a/b pixels for effects that incorrectly use wall time.' };
  });
} catch (error) {
  proof.errors.push({ name: 'harness', message: error.stack ?? String(error) });
  console.error(`[stage16] ${error.message}`);
} finally {
  if (browser) await browser.close();
  await writeFile(join(artifacts, 'stage16-proof.json'), JSON.stringify(proof, null, 2));
}
if (proof.errors.length) process.exitCode = 1;
console.log(`[stage16] ${proof.checks.length} passed, ${proof.errors.length} failed; ${proof.outputs.length} proof images. Visual review remains required.`);
