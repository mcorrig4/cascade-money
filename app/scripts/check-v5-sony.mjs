import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('Usage: node scripts/check-v5-sony.mjs <url>');
const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('Set CHROME_PATH to an existing Chrome executable.');

const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', msg => { if (msg.type() === 'error') console.log('console.error:', msg.text()); });
page.on('pageerror', err => console.log('pageerror:', err.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__cascade?.ready === 'function', null, { timeout: 60000 });
await page.evaluate(() => window.__cascade.ready());

// --- Day 365 settled count ---
await page.evaluate(() => window.__cascade.engine.seek(364.999));
await page.waitForTimeout(200);
const settledText = await page.getByTestId('invoices-settled').innerText();
const settledCount = Number(settledText.replace(/,/g, ''));
console.log('Day 365 invoices-settled HUD:', settledText);
assert.ok(settledCount > 0, 'invoices-settled must be non-zero at day 365');
assert.equal(settledCount, 6943, `expected 6,943 settled invoices at day 365, saw ${settledCount}`);

// --- Shot 3: three orders including Sony ---
await page.evaluate(() => { window.__cascade.engine.seek(0); window.__cascade.playScene(3); });
await page.waitForFunction(() => window.__cascade.engine.state.shot === 3, null, { timeout: 15000 });
await page.evaluate(() => window.__cascade.engine.tick(8));
await page.waitForTimeout(200);
const bodyText = await page.evaluate(() => document.body.innerText);
const ordersFound = ['Samsung Display', 'Corning', 'Sony'].filter(name => bodyText.includes(name));
console.log('Shot 3 order names found in DOM:', ordersFound);
const storyEventCount = await page.evaluate(() => window.__cascade.engine.storyEvents?.length ?? 0);
console.log('Shot 3 engine.storyEvents length:', storyEventCount);
assert.equal(storyEventCount, 3, `shot 3 must focus exactly three orders, saw ${storyEventCount}`);
assert.ok(bodyText.includes('Sony'), 'Shot 3 must list the Sony order');
assert.ok(bodyText.includes('$50M'), 'Shot 3 must list the $50M Sony amount');

await page.screenshot({ path: 'artifacts/v5-day365-settled.png' });
await page.evaluate(() => window.__cascade.engine.seek(0));
await page.waitForTimeout(100);

console.log('PASS: day-365 settled count and shot-3 Sony order verified against', url);
await browser.close();
