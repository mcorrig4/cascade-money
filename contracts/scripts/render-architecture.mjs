import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../../docs/architecture.md', import.meta.url));
const output = fileURLToPath(new URL('../../docs/architecture.png', import.meta.url));
const code = readFileSync(source, 'utf8').match(/```mermaid\s*\n([\s\S]*?)```/)?.[1];
if (!code) throw Error('Missing Mermaid source block');
// Playwright uses a pipe to existing Chrome: no dev server or listening network port.
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome',
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-crash-reporter', '--disable-crashpad'] });
try {
  const page = await browser.newPage({ viewport: { width: 2200, height: 1300 }, deviceScaleFactor: 1.5 });
  await page.setContent('<html><body style="margin:0;padding:40px;background:#f8fafc;font-family:Arial"><h1 style="color:#0f172a">Cascade · dated dollars on Arc</h1><main id="diagram"></main></body></html>');
  await page.addScriptTag({ path: require.resolve('mermaid/dist/mermaid.min.js') });
  await page.evaluate(async (text) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base',
      themeVariables: { primaryColor: '#e0f2fe', primaryTextColor: '#0f172a', primaryBorderColor: '#0284c7',
        lineColor: '#475569', clusterBkg: '#eff6ff', clusterBorder: '#93c5fd', fontSize: '18px' },
      flowchart: { htmlLabels: false, useMaxWidth: true, curve: 'basis' } });
    const result = await mermaid.render('cascade-architecture', text);
    document.querySelector('#diagram').innerHTML = result.svg;
  }, code);
  await page.locator('#diagram svg').waitFor();
  mkdirSync(fileURLToPath(new URL('../../docs/', import.meta.url)), { recursive: true });
  await page.screenshot({ path: output, fullPage: true });
  console.log(`Rendered ${output}`);
} finally { await browser.close(); }
