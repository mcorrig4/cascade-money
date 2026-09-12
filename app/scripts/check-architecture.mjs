import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, delimiter, join } from 'node:path';
import { chromium } from 'playwright-core';

const origin = 'http://cascade.test';
const root = resolve('dist');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.ndjson':'application/x-ndjson' };
let executablePath = process.env.CHROME_PATH;
for (const candidate of ['google-chrome','chromium','chromium-browser']) {
  if (executablePath) break;
  executablePath = (process.env.PATH ?? '').split(delimiter).map(dir => join(dir,candidate)).find(existsSync);
}
if (!executablePath) throw Error('Set CHROME_PATH to an installed Chromium executable.');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
const errors = [], requests = [], results = [];
await mkdir('artifacts', { recursive: true });
async function context(options = {}) {
  const ctx = await browser.newContext(options);
  await ctx.route(`${origin}/**`, async route => {
    const request = route.request(), pathname = decodeURIComponent(new URL(request.url()).pathname);
    requests.push(pathname);
    const file = resolve(root, pathname.replace(/^\//, '') || 'index.html');
    if (!file.startsWith(root + sep)) return route.fulfill({ status:403 });
    try { return await route.fulfill({ body:await readFile(file), contentType:mime[extname(file)] ?? 'application/octet-stream' }); }
    catch {
      if (request.isNavigationRequest()) return route.fulfill({ body:await readFile(join(root,'index.html')), contentType:'text/html' });
      return route.fulfill({ status:404, body:'Missing asset' });
    }
  });
  ctx.on('page', page => { page.on('pageerror', e => errors.push(e.message)); });
  return ctx;
}
try {
  const desktop = await context({ viewport:{width:1440,height:1000} });
  const page = await desktop.newPage();
  await page.goto(`${origin}/architecture`);
  await page.locator('.architecture-section').last().waitFor();
  assert.equal(await page.locator('.architecture-section').count(), 6);
  assert.equal(await page.locator('.architecture-svg').count(), 6);
  assert.equal(requests.some(r => r.endsWith('.ndjson') || /\/globe[-/]|loader.worker/.test(r)), false, 'Architecture does not load globe data or rendering');
  assert.equal(await page.title(), 'Cascade — Architecture');
  assert.ok(await page.locator('#one-deposit [data-visible="false"]').count() > 0);
  await page.locator('#one-deposit [data-step="1"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#one-deposit [data-step="1"]').dataset.visible === 'true');
  await page.locator('#one-deposit [data-step="9"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#one-deposit [data-step="9"]').dataset.visible === 'true');
  assert.equal(await page.locator('#one-deposit [data-visible="false"]').count(), 0);
  await page.getByRole('button',{name:'Replay section 1',exact:true}).click();
  assert.equal(await page.locator('#one-deposit [data-visible="false"]').count(), 9);
  await page.waitForFunction(() => document.querySelectorAll('#one-deposit [data-visible="true"]').length === 1);
  await page.getByRole('button',{name:'Show all of section 1',exact:true}).click();
  assert.equal(await page.locator('#one-deposit [data-visible="false"]').count(), 0);
  for (let i=2;i<=6;i++) {
    await page.getByRole('button',{name:`Show all of section ${i}`,exact:true}).click();
  }
  const offCanvas = await page.locator('.architecture-svg').evaluateAll(svgs => svgs.flatMap(svg => [...svg.querySelectorAll('text')].flatMap(text => {
    const box = text.getBBox(), width=svg.viewBox.baseVal.width, height=svg.viewBox.baseVal.height;
    return box.x < -1 || box.x + box.width > width + 1 || box.y < 0 || box.y + box.height > height + 1 ? [text.textContent] : [];
  })));
  assert.deepEqual(offCanvas, [], 'Every SVG label fits within its canvas');
  const overflowingBoxes = await page.locator('.architecture-svg rect.box').evaluateAll(rects => rects.flatMap(rect => {
    const parent = rect.parentElement, r = rect.getBBox();
    return [...parent.children].filter(e => e.tagName.toLowerCase() === 'text').flatMap(text => { const b=text.getBBox(); return b.x+b.width>r.x+r.width-6 ? [text.textContent] : []; });
  }));
  assert.deepEqual(overflowingBoxes, [], 'Box labels fit their containers');
  for (const [i, section] of (await page.locator('.architecture-section').all()).entries()) {
    await section.screenshot({ path:`artifacts/architecture-${i+1}-desktop.png` });
  }
  await page.locator('.architecture-page').evaluate(el => el.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'artifacts/architecture-desktop.png'});
  await page.getByText('Open the existing overview diagram',{exact:true}).click();
  assert.equal(await page.locator('.architecture-inventory img').evaluate(img => img.complete && img.naturalWidth>0), true);
  // Every direct URL exercises the static host's document fallback and absolute asset paths.
  for (const path of ['/architecture/', '/#/architecture', '/missing-route']) {
    await page.goto(origin + path);
    if (path === '/missing-route') await page.getByRole('heading',{name:'Page not found'}).waitFor();
    else {
      await page.locator('#architecture-title').waitFor();
      if (path === '/#/architecture') {
        await page.getByRole('navigation',{name:'Architecture sections'}).getByText('Loss & recovery').click();
        assert.ok(page.url().endsWith('#/architecture/loss-and-recovery'));
        assert.equal(await page.locator('.architecture-section').count(),6);
      }
    }
  }
  await page.goto(`${origin}/architecture`);
  await page.locator('#architecture-title').waitFor();
  await page.evaluate(() => { history.pushState({},'', '/missing-route'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.getByRole('heading',{name:'Page not found'}).waitFor();
  await page.goBack();
  await page.locator('#architecture-title').waitFor();
  results.push('Desktop: direct history routes, hash fallback, back navigation, independent loading, scroll reveal, replay, SVG geometry.');
  for (const width of [320,390,768]) {
    const ctx = await context({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const phone = await ctx.newPage(); await phone.goto(`${origin}/architecture`);
    await phone.locator('.architecture-svg').last().waitFor();
    assert.equal(await phone.locator('[data-visible="false"]').count(),0);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth),width);
    assert.equal(await phone.locator('.architecture-page').evaluate(el => el.scrollWidth),width);
    assert.equal(await phone.locator('.architecture-svg').evaluate(el => parseFloat(getComputedStyle(el.querySelector('text')).fontSize) >= 13),true);
    const container = phone.locator('.architecture-diagram-scroll').first();
    assert.ok(await container.evaluate(el => el.scrollWidth > el.clientWidth));
    await container.evaluate(el => el.scrollLeft = 300);
    assert.ok(await container.evaluate(el => el.scrollLeft > 0));
    await phone.getByRole('button',{name:'Replay section 1',exact:true}).click();
    assert.equal(await phone.locator('[data-visible="false"]').count(),0);
    await phone.locator('.architecture-page').evaluate(el => el.scrollTo({top:0,behavior:'instant'}));
    await phone.screenshot({path:`artifacts/architecture-${width}.png`});
    results.push(`Mobile ${width}: no page overflow, contained SVG scrolling, readable type, reduced-motion end state.`);
    await ctx.close();
  }
  // Standalone SVGs parse without React and include all steps and source links.
  const { sections } = await import('../src/architecture/data.ts');
  for (const [i,s] of sections.entries()) {
    const svg = await readFile(resolve(`../docs/architecture/${i+1}-${s.slug}.svg`),'utf8');
    const valid = await page.evaluate(source => { const doc = new DOMParser().parseFromString(source,'image/svg+xml'); return !doc.querySelector('parsererror') && !!doc.querySelector('svg a[href]') && !doc.querySelector('[data-visible="false"]'); },svg);
    assert.equal(valid,true,`${s.slug} export parses and has linked sources`);
  }
  assert.deepEqual(errors, []);
  await writeFile('artifacts/architecture-check.json',JSON.stringify({results,errors},null,2));
  console.log(results.join('\n'));
  console.log('Passed. Screenshots and report: app/artifacts/architecture-*');
} finally { await browser.close(); }
