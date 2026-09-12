import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, delimiter, join } from 'node:path';
import { chromium } from 'playwright-core';

// Start `pnpm preview` separately. Pass its port-for URL explicitly; no hardcoded port.
const staticMode = process.argv.includes('--static');
const url = staticMode ? 'http://cascade.test/' : process.argv[2];
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
async function routeStatic(context) {
  if (staticMode) {
    // Fulfill the built app over an intercepted origin; no listening socket or port allocation.
    const root = resolve('dist');
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ndjson': 'application/x-ndjson', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
    await context.route('http://cascade.test/**', async route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
      const file = resolve(root, pathname || 'index.html');
      if (!file.startsWith(root + sep)) return route.fulfill({ status: 403 });
      try { await route.fulfill({ status: 200, body: await readFile(file), contentType: mime[extname(file)] ?? 'application/octet-stream' }); }
      catch { await route.fulfill({ status: 404, body: 'Not found' }); }
    });
  }
}
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await routeStatic(context);
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  const textureRequests = [], modelRequests = [];
  page.on('request', request => { if (/\/(models|draco)\//.test(request.url())) modelRequests.push(request.url()); });
  page.on('request', request => { if (request.url().includes('/textures/')) textureRequests.push(request.url().split('/').at(-1)); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  const inspectUrl = new URL(url); inspectUrl.searchParams.set('inspect', '1');
  await page.goto(inspectUrl.href);
  await page.waitForFunction(() => window.__cascade?.geometry().every(a => a.geometry && a.alpha === 1) && window.__cascade.pool.arcs.length > 0);
  await page.waitForTimeout(500);
  const expectedYear = await page.evaluate(() => String(window.__cascade.engine.index.days[364].end.settled));
  if (process.argv.includes('--real-data')) {
    const coverage = await page.evaluate(() => {
      const index = window.__cascade.engine.index;
      return { schema:index.schema, count:index.eventCount,
        active: index.days.slice(1,31).map(b => b.events.some(e => ['issue','pay','transfer'].includes(e.type))),
        proof: index.stories.filter(s => /apple|display/i.test(s.storyId) && s.payment).map(s => s.payment.day) };
    });
    assert.equal(coverage.schema,2,'Real-data check requires schema 2');
    assert.ok(coverage.active.every(Boolean),'Every day 1–30 must have payments');
    assert.ok(coverage.proof.length >= 4 && coverage.proof.every(day => day < 30),'Proof hops must occur in the first 30 simulated days');
    const timings = [];
    for (let day=1; day<=30; day++) {
      timings.push(await page.evaluate(day => { const start=performance.now(); window.__cascade.engine.seek(day); return performance.now()-start; },day));
      await page.waitForFunction(day => window.__cascade.pool.arcs.some(a => a.event.day === day),day);
    }
    console.log('Real-data coverage', coverage, 'maximum seek ms', Math.max(...timings));
    await page.evaluate(() => window.__cascade.engine.seek(0));
    await page.waitForTimeout(100);
  }
  assert.ok((await page.getByTestId('settled').innerText()).startsWith('$'));
  assert.ok((await page.getByTestId('committed').innerText()).startsWith('$'));
  assert.ok((await page.getByTestId('ratio').innerText()).endsWith('×'));
  await page.screenshot({ path: 'artifacts/globe-1920x1080.png' });
  await page.evaluate(() => window.__cascade.ageArcs(-600));
  await page.waitForTimeout(150);
  const growing = await page.evaluate(() => window.__cascade.geometry());
  assert.ok(growing.every(arc => arc.clipStart === 0 && arc.clipEnd > 0 && arc.clipEnd < 1), 'Arcs grow from the payer');
  await page.screenshot({ path: 'artifacts/arcs-grow-1920x1080.png' });
  await page.evaluate(() => window.__cascade.ageArcs(600));
  const before = await page.evaluate(() => window.__cascade.geometry());
  assert.ok(before.every(arc => arc.clipStart === 0 && arc.clipEnd === 1), 'Flow uses the full curve');
  await page.evaluate(() => window.__cascade.ageArcs(800));
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__cascade.geometry());
  assert.equal(before.length, after.length);
  for (let i = 0; i < before.length; i++) {
    assert.equal(before[i].geometry, after[i].geometry, 'Fading must retain arc geometry');
    assert.ok(after[i].alpha > 0 && after[i].alpha < before[i].alpha, 'Fade alpha must reach the shader');
  }
  assert.ok(after.every(arc => arc.clipStart > 0 && arc.clipEnd === 1 && arc.depthTest), 'Collapse moves into the payee with depth testing');
  await page.screenshot({ path: 'artifacts/arcs-collapse-1920x1080.png' });
  await page.waitForFunction(() => window.__cascade.globe.globeMaterial().userData.textureStage !== 'pending');
  assert.equal(await page.evaluate(() => window.__cascade.globe.renderer().capabilities.logarithmicDepthBuffer), true);
  assert.equal(await page.locator('.company-label svg').count() > 0, true, 'Named firms use vector marks');
  const alignment = await page.evaluate(() => window.__cascade.geography());
  for (const point of alignment) {
    assert.ok(point.uv, `${point.name}: ray intersects the Earth`);
    assert.ok(Math.abs(point.uv.u - point.expected.u) < 0.0002, `${point.name}: longitude alignment`);
    assert.ok(Math.abs(point.uv.v - point.expected.v) < 0.0002, `${point.name}: latitude alignment`);
  }
  for (const [name, lat, lng] of [['north-america', 37.3349, -122.009], ['east-asia', 30, 120]]) {
    await page.evaluate(({ lat, lng }) => { const { engine } = window.__cascade; engine.stopShot(); engine.fly(lat, lng, 1.2, 0); }, { lat, lng });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `artifacts/${name}-1920x1080.png` });
  }
  await page.mouse.move(850, 400);
  const wheelBefore = await page.evaluate(() => window.__cascade.globe.pointOfView().altitude);
  await page.mouse.wheel(0, -400); await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => window.__cascade.globe.pointOfView().altitude) < wheelBefore, 'Desktop wheel zooms in');
  const limits = await page.evaluate(() => {
    const { globe } = window.__cascade, controls = globe.controls(), radius = globe.getGlobeRadius();
    return { min: controls.minDistance / radius - 1, max: controls.maxDistance / radius - 1, zoom: controls.enableZoom };
  });
  assert.ok(limits.zoom && limits.min < 0.00022 && limits.max >= 3, 'Apple Park and the whole Earth are reachable');
  assert.equal(modelRequests.length,0,'Models and Draco are never fetched on first paint or distant views');
  await page.keyboard.press('Shift+D');
  await page.getByRole('region', { name: 'Shot director' }).waitFor();
  await page.locator('.shot-list button').nth(0).click();
  await page.keyboard.press('Shift+D');
  await page.waitForTimeout(500);
  await page.waitForFunction(() => window.__cascade.globe.scene().getObjectByName('Apple Park ring decal')?.material.map.image?.complete);
  await page.waitForFunction(() => window.__cascade.models().some(m => m.id === 'apple-park' && (m.missing || m.fade === 1)));
  const parkPose = await page.evaluate(() => {
    const { globe, models } = window.__cascade, park = globe.scene().getObjectByName('Apple Park ring decal');
    return { camera: globe.pointOfView(), fallback: park?.visible, model: models().find(m => m.id === 'apple-park'), target: globe.controls().target.length() };
  });
  assert.ok(parkPose.camera.altitude < .0002 && parkPose.target > 99,'Shot 1 looks at the campus from an oblique local camera');
  assert.ok(parkPose.model.loaded ? !parkPose.fallback : parkPose.fallback,'Model replaces decal only after its fade completes');
  if (staticMode && existsSync('dist/models/apple-park.glb')) assert.ok(parkPose.model.loaded,'Bundled Apple Park decodes successfully');
  await page.waitForFunction(() => window.__cascade.engine.state.shotElapsed >= 3 && !window.__cascade.cameraFlightActive());
  await page.screenshot({ path: 'artifacts/shot1-apple-park.png' });
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
      await page.waitForFunction(() => window.__cascade.engine.state.camera.site === 'fifth-avenue' && !window.__cascade.cameraFlightActive() && window.__cascade.globe.pointOfView().altitude < .000002);
      await page.evaluate(() => window.__cascade.engine.update({ playing:false, shotRunning:false }));
      await page.waitForFunction(() => window.__cascade.models().some(m => m.id === 'fifth-avenue' && (m.missing || m.fade === 1)));
      if (staticMode && existsSync('dist/models/fifth-avenue.glb')) assert.ok(await page.evaluate(() => window.__cascade.models().find(m => m.id === 'fifth-avenue').loaded),'Bundled Fifth Avenue decodes successfully');
      const cubePose = await page.evaluate(() => {
        const { globe } = window.__cascade;
        globe.scene().updateMatrixWorld(true);
        const model = globe.scene().getObjectByName('Site model: fifth-avenue');
        if (!model) return null;
        const eye = model.worldToLocal(globe.camera().position.clone());
        const target = model.worldToLocal(globe.controls().target.clone());
        return { distance: Math.hypot(eye.x,eye.z), height:eye.y, targetHeight:target.y };
      });
      if (cubePose) { assert.ok(Math.abs(cubePose.distance-35)<.1); assert.ok(Math.abs(cubePose.height-8)<.1); assert.ok(cubePose.targetHeight>cubePose.height); }
      assert.ok(modelRequests.filter(url => url.includes('/models/')).every(url => /[?]v=[a-f0-9]{16}$/.test(url)), 'Model URLs carry their build content hashes');
      await page.screenshot({ path: 'artifacts/shot10-cube.png' });
      await page.evaluate(() => { window.__cascade.engine.update({ shotRunning:true }); window.__cascade.engine.tick(2.1); });
      await page.waitForTimeout(6500);
      assert.ok(await page.evaluate(() => window.__cascade.models().every(m => !m.loaded && !m.pending)), 'Pullback releases site models');
    }
    await page.screenshot({ path: `artifacts/shot-${shot}-1920x1080.png` });
  }
  await page.getByText('Earth imagery: NASA', { exact: true }).waitFor();
  assert.equal(await page.locator('.close-card a').count(), 4);
  assert.equal(await page.locator('.close-card a[href="/architecture"]').count(), 1);
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await routeStatic(mobile);
  await mobile.addInitScript(() => {
    window.__telegramCalls = [];
    window.Telegram = { WebApp: {
      ready: () => window.__telegramCalls.push('ready'), expand: () => window.__telegramCalls.push('expand'),
      disableVerticalSwipes: () => window.__telegramCalls.push('swipes'), safeAreaInset: { top: 24, bottom: 34 },
      themeParams: { bg_color: '#ffffff' },
    } };
  });
  const phone = await mobile.newPage(); phone.setDefaultTimeout(90000);
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(inspectUrl.href);
  await phone.waitForFunction(() => window.__cascade?.globe.globeMaterial().userData.textureStage !== 'pending' && !!window.__cascade);
  assert.deepEqual(await phone.evaluate(() => window.__telegramCalls), ['ready', 'expand', 'swipes']);
  const layout = await phone.evaluate(() => ({
    width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
    canvasTouch: getComputedStyle(document.querySelector('canvas')).touchAction,
    hostTouch: getComputedStyle(document.querySelector('.globe-scene')).touchAction,
    overscroll: getComputedStyle(document.body).overscrollBehavior,
    top: getComputedStyle(document.documentElement).getPropertyValue('--telegram-safe-top'),
  }));
  assert.equal(layout.width, 390); assert.equal(layout.height, 844);
  assert.equal(layout.canvasTouch, 'none'); assert.equal(layout.hostTouch, 'none'); assert.equal(layout.overscroll, 'none');
  assert.equal(layout.top.trim(), '24px');
  assert.equal(await phone.evaluate(() => ['touchstart', 'touchmove'].every(type => !document.querySelector('canvas').dispatchEvent(new Event(type, { bubbles: true, cancelable: true })))), true, 'Globe touch listeners prevent host gestures');
  await phone.locator('.ledger').waitFor({ state: 'hidden' });
  await phone.getByRole('button', { name: 'Transactions', exact: false }).click();
  await phone.locator('.ledger').waitFor({ state: 'visible' });
  await phone.screenshot({ path: 'artifacts/ledger-390x844.png' });
  await phone.getByRole('button', { name: 'Close transactions', exact: false }).click();
  const cdp = await mobile.newCDPSession(phone);
  const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  const rotationBefore = await phone.evaluate(() => window.__cascade.globe.pointOfView());
  await touch('touchStart', [[155, 260]]);
  for (let step = 1; step <= 8; step++) { await touch('touchMove', [[155 + step * 8, 260 + step * 6]]); await phone.waitForTimeout(20); }
  await touch('touchEnd', []);
  const rotationAfter = await phone.evaluate(() => window.__cascade.globe.pointOfView());
  assert.ok(Math.abs(rotationAfter.lng - rotationBefore.lng) > 0.1 && Math.abs(rotationAfter.lat - rotationBefore.lat) > 0.1, 'Touch drag rotates both axes');
  await touch('touchStart', [[165, 300], [225, 300]]);
  for (let step = 1; step <= 8; step++) { await touch('touchMove', [[165 - step * 7, 300], [225 + step * 7, 300]]); await phone.waitForTimeout(20); }
  await touch('touchEnd', []);
  assert.ok(await phone.evaluate(() => window.__cascade.globe.pointOfView().altitude) < rotationAfter.altitude, 'Pinch zooms the globe');
  assert.equal(await phone.evaluate(() => window.scrollY), 0);
  const brand = await phone.locator('.brand').boundingBox();
  await touch('touchStart', [[brand.x + 30, brand.y + 15]]); await phone.waitForTimeout(750); await touch('touchEnd', []);
  await phone.getByRole('region', { name: 'Shot director' }).waitFor();
  await phone.screenshot({ path: 'artifacts/director-390x844.png' });
  await phone.getByRole('button', { name: 'Close director', exact: true }).click();
  await phone.screenshot({ path: 'artifacts/globe-390x844.png' });
  assert.equal(textureRequests[0], 'earth-blue-marble-4k.jpg', '4K loads before the night map and high-resolution upgrade');
  await mobile.close();
  assert.deepEqual(errors, []);
  await writeFile('artifacts/browser-check.json', JSON.stringify({ viewports: ['1920x1080', '390x844'], alignment, layout, textureRequests, growing, parkPose, renderer: 'Chrome / SwiftShader', opacity: 'passed', retainedGeometry: 'passed', before, after, errors }, null, 2));
  console.log('Passed: desktop/mobile gestures and layout, Telegram bridge, geography, texture order, arc opacity/geometry, director, and year endpoint. Screenshots: app/artifacts/');
} finally { await browser.close(); }
