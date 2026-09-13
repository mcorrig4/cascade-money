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
const nativeGl=process.env.CHROME_GL==='native';
let browser;
try { browser = await chromium.launch({ executablePath, headless: true,
  // Software WebGL is deterministic for the production suite but far too slow
  // to drive a second photogrammetry renderer in the local-only tile frames.
  args: staticMode ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--no-sandbox', '--disable-dev-shm-usage'] }); } catch (error) {
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
async function expectLedgerMode(page, mode, phase) {
  try {
    await page.waitForFunction(mode=>document.querySelector('#daily-ledger')?.getAttribute('data-mode')===mode,mode,{timeout:10000,polling:50});
  } catch (error) {
    const state=await page.evaluate(()=>{
      const e=window.__cascade?.engine, ledger=document.querySelector('#daily-ledger');
      return {playing:e?.state.playing,shotRunning:e?.state.shotRunning,day:e?.state.day,position:e?.state.position,
        mode:ledger?.getAttribute('data-mode'),classes:ledger?.className,hovered:ledger?.matches(':hover'),
        focused:document.activeElement?.outerHTML.slice(0,300)};
    });
    await writeFile('artifacts/ledger-transition-failure.json',JSON.stringify({phase,expectedMode:mode,state,pageErrors:errors},null,2));
    throw new Error(`${phase}: expected ledger ${mode}; state=${JSON.stringify(state)}`,{cause:error});
  }
}
async function captureScenes(context, legibility=false) {
  const page=await context.newPage();page.setDefaultTimeout(300000);
  page.on('pageerror',e=>errors.push(e.message));
  const target=new URL(url);target.searchParams.set('inspect','1');
  await page.goto(target.href);await page.waitForFunction(()=>!!window.__cascade&&window.__cascade.globe.globeMaterial().userData.textureStage!=='pending');
  await page.keyboard.press('Shift+D');
  await page.keyboard.press('b');
  assert.equal(await page.evaluate(()=>window.__cascade.bookmarks.length),1,'B appends a rendered view');
  await page.evaluate(()=>{window.__bookmarkClipboard='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__bookmarkClipboard=text;}}});});
  const logged=page.waitForEvent('console',{predicate:message=>message.type()==='log'&&message.text().includes('travelMs')});
  await page.keyboard.press('Shift+B');await logged;
  assert.equal(await page.evaluate(()=>JSON.parse(window.__bookmarkClipboard)[0].travelMs),2500);

  await page.keyboard.press('Shift+D');
  const shots=await page.evaluate(()=>window.__cascade.shots);
  assert.equal(shots.length,17,'Narration v6 has exactly 17 scenes');
  const directory=legibility?'legibility':'scenes';await mkdir(`artifacts/${directory}`,{recursive:true});
  const manifest=[];
  for(const [width,height] of legibility?[[640,360],[426,240]]:[[1920,1080],[640,360]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(()=>{const e=window.__cascade.engine;e.setClockMode('manual');window.__cascade.playFilm();
      window.__capturePlaying=e.state.playing;e.update({recording:true,hud:true,playing:false,shotRunning:true});});
    let clock=0;
    for(const shot of shots) {
      const seconds=shot.captureAt;
      assert.ok(seconds>0&&seconds<shot.seconds, `Scene ${shot.scene} capture is strictly inside its duration`);
      const targetTime=shot.startTime+seconds;
      await page.evaluate(delta=>{
        const e=window.__cascade.engine;
        if(window.__capturePlaying!==undefined)e.update({playing:window.__capturePlaying,shotRunning:true});
        e.tick(delta,'manual');window.__capturePlaying=e.state.playing;e.update({playing:false,shotRunning:true});
      },targetTime-clock);clock=targetTime;
      await page.waitForTimeout(700);
      await page.waitForFunction(()=>window.__cascade.models().every(m=>!m.pending));
      const path=`artifacts/${directory}/scene-${String(shot.scene).padStart(2,'0')}-${width}x${height}.png`;
      await page.screenshot({path});
      const audit=await page.evaluate(()=>{
        const visible=selector=>{const e=document.querySelector(selector);return !!e&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).opacity!=='0'&&e.getBoundingClientRect().height>0;};
        const hud=document.querySelector('.bottom-panel'),bottom=hud&&getComputedStyle(hud).visibility!=='hidden'?hud.getBoundingClientRect().top:innerHeight;
        const ledger=document.querySelector('.ledger');
        const safeBottom=document.querySelector('.overlay-active')?Math.min(bottom,ledger.getBoundingClientRect().top):bottom;
        const content=[...document.querySelectorAll('.law:last-child,.invariant-list>div,.vault-card dt,.vault-card dd,.vault-card h2,.vault-card .eyebrow,.composable-items li:last-child')];
        return {hud:['.topbar','.ledger','.bottom-panel','.volume-chart','.scrubber'].every(visible),hidden:['.director','.story-selector','.network-status'].every(s=>!visible(s)),mode:window.__cascade.engine.state.shot,elapsed:window.__cascade.engine.state.shotElapsed,exposure:window.__cascade.engine.state.exposure,
          clipped:content.filter(e=>e.getBoundingClientRect().bottom>safeBottom+1).map(e=>e.textContent),
          vaultClipped:[...document.querySelectorAll('.vault-card dt,.vault-card dd,.vault-card .invariant-list>div,.vault-card h2,.vault-card .eyebrow')].filter(e=>{
            const r=e.getBoundingClientRect(),card=e.closest('.overlay-card').getBoundingClientRect();
            return r.top<card.top-1||r.bottom>card.bottom+1||r.left<card.left-1||r.right>card.right+1;
          }).map(e=>e.textContent),
          overflow:[...document.querySelectorAll('.overlay-card')].filter(e=>e.scrollHeight>e.clientHeight+2).map(e=>e.getAttribute('aria-label'))};
      });
      manifest.push({scene:shot.scene,id:shot.id,title:shot.title,seconds,width,height,path,audit});
      assert.equal(audit.hud,true,'Recording keeps the product HUD');assert.equal(audit.hidden,true,'Recording hides production controls');
      assert.equal(audit.mode,shot.id,`Capture follows the 17-scene order (scene ${shot.scene}, film time ${targetTime}s)`);
      assert.ok(Math.abs(audit.elapsed-seconds)<1e-7, 'Capture uses the declared scene-relative time');
      assert.deepEqual(audit.vaultClipped,[], 'Every stress-test label fits inside its card');
      assert.deepEqual(audit.clipped,[],`${shot.title} stays above the visible HUD at ${width}×${height}`);
    }
    await page.evaluate(()=>{delete window.__capturePlaying;window.__cascade.engine.update({recording:true,hud:false});});
    assert.equal(await page.locator('.topbar').evaluate(e=>getComputedStyle(e).opacity),'0','Clean-frame option hides HUD');
    await page.evaluate(()=>window.__cascade.engine.update({hud:true}));
  }
  await writeFile(`artifacts/${directory}/manifest.json`,JSON.stringify(manifest,null,2));
  assert.deepEqual(errors,[],'Scene captures have no page errors');
  await page.close();
}
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await routeStatic(context);
  if(process.argv.includes('--legibility')||process.argv.includes('--scenes')) { await captureScenes(context,process.argv.includes('--legibility')); await browser.close(); process.exit(0); }
  const page = await context.newPage();
  page.setDefaultTimeout(300000);
  const textureRequests = [], modelRequests = [];
  page.on('request', request => { if (/\/(models|draco)\//.test(request.url())) modelRequests.push(request.url()); });
  page.on('request', request => { if (request.url().includes('/textures/')) textureRequests.push(request.url().split('/').at(-1)); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  const inspectUrl = new URL(url); inspectUrl.searchParams.set('inspect', '1');
  await page.goto(inspectUrl.href);
  await page.waitForFunction(() => window.__cascade?.geometry().every(a => a.geometry && a.alpha === 1) && window.__cascade.pool.arcs.length > 0);
  await page.waitForTimeout(500);
  // Deterministic RPC failure exercises the recorded fallback without relying on a public service.
  await page.route('https://rpc.testnet.arc.io', route => route.fulfill({status:503,body:'Unavailable'}));
  await page.getByRole('button',{name:'On-chain',exact:true}).click();
  const arcPanel=page.getByRole('dialog');
  await arcPanel.getByText('Arc RPC unavailable. Showing the recorded demo balances.').waitFor();
  assert.equal(await arcPanel.locator('tbody tr').count(),16);
  await arcPanel.locator('summary').click();
  assert.equal(await arcPanel.locator('.arc-actors li').count(),5);
  await page.screenshot({path:'artifacts/verify-on-arc-1920x1080.png'});
  await arcPanel.screenshot({path:'artifacts/verify-on-arc-panel.png'});
  await arcPanel.getByRole('button',{name:'Close Verify on Arc'}).click();
  const expectedYear = await page.evaluate(() => String(window.__cascade.engine.index.days[364].end.settled));
  if (process.argv.includes('--real-data')) {
    const coverage = await page.evaluate(() => {
      const index = window.__cascade.engine.index;
      return { schema:index.schema, count:index.eventCount,
        active: index.days.slice(1,31).map(b => b.events.some(e => ['issue','pay','transfer'].includes(e.type))),
        proof: index.stories.filter(s => s.storyId === 'apple-duo' && s.payment).map(s => s.payment.day) };
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
  await page.evaluate(()=>{const e=window.__cascade.engine;e.seek(0);e.setPosition(.55);e.update({playing:true});});
  await expectLedgerMode(page,'compact','Playing without inspection');
  // Move the real pointer into the stable live-log surface, without waiting
  // for a transient row to stop moving (a human cannot wait for that either).
  const logBounds=await page.locator('.ledger-scroll').boundingBox();
  assert.ok(logBounds);
  await page.mouse.move(logBounds.x+24,logBounds.y+15);
  await expectLedgerMode(page,'expanded','Pointer enters live log');
  const inspected=await page.locator('.ledger-row').evaluateAll(rows=>rows.map(row=>row.dataset.seq));
  const beforeInspectionTick=await page.evaluate(()=>window.__cascade.engine.state.position);
  await page.evaluate(()=>window.__cascade.engine.tick(1.1));
  assert.ok(await page.evaluate(()=>window.__cascade.engine.state.position)>beforeInspectionTick,'Playback keeps advancing during inspection');
  assert.equal(await page.locator('.ledger').getAttribute('data-mode'),'expanded');
  assert.deepEqual(await page.locator('.ledger-row').evaluateAll(rows=>rows.map(row=>row.dataset.seq)),inspected,'Inspected transactions survive new admissions and the next day');
  const heldBounds=await page.locator('.ledger-scroll').boundingBox();
  assert.ok(heldBounds && Math.abs(heldBounds.width-logBounds.width)<1,'Expansion keeps the pointer hit area stable');
  await page.mouse.move(0,0);
  await expectLedgerMode(page,'compact','Pointer exits inspection');
  const seekState=await page.evaluate(()=>{
    const e=window.__cascade.engine;e.seek(0);
    return {playing:e.state.playing,shotRunning:e.state.shotRunning,shot:e.state.shot,day:e.state.day,position:e.state.position};
  });
  assert.deepEqual(seekState,{playing:false,shotRunning:false,shot:null,day:0,position:.999},'Seek explicitly pauses and resets the day');
  await expectLedgerMode(page,'expanded','Seek to first day pauses playback');
  await page.evaluate(()=>window.__cascade.engine.tick(1));
  await expectLedgerMode(page,'expanded','Seek stays paused on subsequent ticks');
  assert.equal(modelRequests.length,0,'Models and Draco are never fetched on first paint or distant views');
  await captureScenes(context);
  await page.evaluate(()=>{window.__cascade.playScene(12);const e=window.__cascade.engine;e.tick(e.state.shotDuration*.9);e.update({playing:false,shotRunning:false});});
  await page.getByText('Earth imagery: NASA', { exact: true }).waitFor();
  await page.getByRole('button',{name:'Verify on Arc',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'Close Verify on Arc'}).click();
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
  const telegramCalls = await phone.evaluate(() => window.__telegramCalls);
  assert.ok(telegramCalls.length >= 3 && telegramCalls.length % 3 === 0);
  for (let index = 0; index < telegramCalls.length; index += 3) {
    assert.deepEqual(telegramCalls.slice(index, index + 3), ['ready', 'expand', 'swipes']);
  }
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
  await writeFile('artifacts/browser-check.json', JSON.stringify({ viewports: ['1920x1080', '390x844'], alignment, layout, textureRequests, growing, scenes: 'artifacts/scenes/manifest.json', renderer: nativeGl?'Chrome / native GL':'Chrome / SwiftShader', opacity: 'passed', retainedGeometry: 'passed', before, after, errors }, null, 2));
  console.log('Passed: desktop/mobile gestures and layout, Telegram bridge, geography, texture order, arc opacity/geometry, director, and year endpoint. Screenshots: app/artifacts/');
} finally { await browser.close(); }
