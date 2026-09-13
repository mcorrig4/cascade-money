import { chromium } from 'playwright-core';
import { resolve, extname, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
const executablePath='/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport:{width:1920,height:1080}});
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ndjson': 'application/x-ndjson', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
await context.route('http://cascade.test/**', async route => {
  const pathname = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
  const file = resolve(root, pathname || 'index.html');
  if (!file.startsWith(root + sep)) return route.fulfill({ status: 403 });
  try { await route.fulfill({ status: 200, body: await readFile(file), contentType: mime[extname(file)] ?? 'application/octet-stream' }); }
  catch(e) { console.log('404-for', pathname); await route.fulfill({ status: 404, body: 'Not found' }); }
});
const page = await context.newPage();
page.on('pageerror', err => console.log('PAGEERROR', err.stack ?? err.message));
const t0=Date.now();
await page.goto('http://cascade.test/?inspect=1', {waitUntil:'load'});
try {
  await page.waitForFunction(()=>typeof window.__cascade?.ready==='function',null,{timeout:30000});
  console.log('cascade.ready appeared after', Date.now()-t0, 'ms');
} catch(e){ console.log('waitForFunction timed out after', Date.now()-t0); }
try {
  const res = await Promise.race([
    page.evaluate(()=>window.__cascade.ready()).then(()=>'RESOLVED'),
    new Promise(r=>setTimeout(()=>r('TIMEOUT-20s'),20000))
  ]);
  console.log('ready() outcome', res, 'at', Date.now()-t0,'ms');
  if (res !== 'RESOLVED') process.exitCode = 1;
} catch(e){ console.log('ready() threw', e.message); process.exitCode = 1; }
const readiness = await page.evaluate(()=>window.__cascade.readiness?.()).catch(e=>({err:e.message}));
console.log('READINESS', JSON.stringify(readiness));
await browser.close();
