import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import postcss from 'postcss';
import {filmUnitFor, appSurfaceStyle} from '../src/components/appSurfaceGeometry.ts';
const require = createRequire(import.meta.url);
const {containCss, inventory, GUARD, splitSelectors} = require('../scripts/app-surface-css.cjs');
const reviewed = require('../src/components/app-surface-containment.json');
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const sources = Object.fromEntries(['styles.css','stage.css','film.css'].map(file => [file, read(`../../app/src/${file}`)]));

test('containment inventory accounts for EVERY selector and at-rule, including media ancestry', () => {
  const current = Object.entries(sources).flatMap(([file, source]) => inventory(source, file));
  assert.deepEqual(current, reviewed.map(({containment, ...entry}) => entry),
    'Review new app rules in app-surface-containment.json and W0-foundations.md; do not silently refresh this list.');
  const policies = new Set(['local-document','scoped-subject','film-inter','coin-font','namespaced-keyframes','scoped-conditional']);
  for (const entry of reviewed) assert.ok(policies.has(entry.containment), JSON.stringify(entry));
});

test('documentation enumerates every reviewed selector and its implemented containment policy', () => {
  const escape = value => value.replaceAll('|','\\|');
  const rows = ['| File | Conditional context | Selector / at-rule | Containment |','| --- | --- | --- | --- |',
    ...reviewed.map(e => '| '+[e.file,e.context || '(all)',e.selector,e.containment].map(v=>'`'+escape(v)+'`').join(' | ')+' |')];
  const doc = read('../W0-foundations.md');
  assert.equal(doc.split('<!-- containment-table:start -->\n')[1].split('\n<!-- containment-table:end -->')[0],rows.join('\n'));
  for (const policy of new Set(reviewed.map(e=>e.containment))) assert.ok(doc.includes(`| \`${policy}\` |`));
});

test('every emitted selector guards its subject; document defaults and custom properties stay local', () => {
  for (const [file, source] of Object.entries(sources)) {
    const root = postcss.parse(containCss(source, file));
    root.walkRules(rule => {
      if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return;
      for (const selector of splitSelectors(rule.selector)) {
        assert.ok(selector.includes(GUARD), selector);
        assert.doesNotMatch(selector, /:root|\bhtml\b|\bbody\b|#root\b/);
      }
    });
  }
  const css = containCss(sources['styles.css'], 'styles.css');
  assert.match(css, /\.film-app-surface:where\([^}]+--money:#69e6c0/);
  assert.match(css, /--muted:#8297a5/); assert.match(css, /--line:rgba\(170,199,204,\.16\)/);
  assert.match(css, /\.film-app-surface:where\(/);
});

test('keyframe definitions/references are namespaced; Inter is reused and the unique coin face retained', () => {
  const stage = postcss.parse(containCss(sources['stage.css'], 'stage.css'));
  stage.walkAtRules('keyframes', rule => assert.ok(rule.params.startsWith('cascade-surface-')));
  stage.walkDecls(/animation/, decl => assert.doesNotMatch(decl.value, /(?<!cascade-surface-)\b(?:card-in|coin-float|date-flip|pay-bill|bill-paid|coin-enter)\b/));
  const fonts = [];
  postcss.parse(containCss(sources['styles.css'], 'styles.css')).walkAtRules('font-face', rule => fonts.push(rule.toString()));
  assert.equal(fonts.length, 1);
  assert.match(fonts[0], /Coin Date Condensed/);
  assert.match(fonts[0], /RobotoCondensed-Light\.woff2/);
});

test('containment preserves authored card declarations and media conditions', () => {
  for (const [file, source] of Object.entries(sources)) {
    const before = [], after = [];
    const collect = (root, output) => root.walkDecls(decl => {
      if (decl.parent.type === 'atrule' && decl.parent.name === 'font-face') return;
      if (/animation/.test(decl.prop)) return;
      output.push([decl.prop, decl.value, decl.important]);
    });
    collect(postcss.parse(source), before);
    collect(postcss.parse(containCss(source, file)), after);
    assert.deepEqual(after, before);
    const conditions = css => {const a = [];postcss.parse(css).walkAtRules('media', rule => a.push(rule.params));return a;};
    assert.deepEqual(conditions(containCss(source, file)), conditions(source));
  }
});

test('film-unit matches app coefficients at 1080p and does not multiply output render scale', () => {
  const match = sources['film.css'].match(/--film-unit:\s*min\(([\d.]+)vw,\s*([\d.]+)vh\)/);
  assert.ok(match);
  for (const [width, height] of [[1920,1080],[1280,720],[3840,2160]]) {
    const expected = Math.min(Number(match[1])*width/100, Number(match[2])*height/100);
    for (const outputScale of [1/3, 1, 2]) {
      assert.equal(appSurfaceStyle(width, height)['--film-unit'], `${expected}px`, `scale ${outputScale}`);
    }
  }
  assert.ok(Math.abs(filmUnitFor(1920,1080)-1) < 1e-9);
  for (const [selector, pixels] of [['.app .cascade-stat strong',120],['.app .cascade-stat span',44],['.app .overlay-card h2',84]]) {
    let value;
    postcss.parse(sources['film.css']).walkRules(selector, rule => rule.walkDecls('font-size', decl => {value = decl.value;}));
    assert.equal(value, `calc(${pixels} * var(--film-unit))`);
    assert.ok(Math.abs(pixels * filmUnitFor(1920,1080) - pixels) < 1e-6);
  }
});

test('surface is transparent, unclipped and non-interactive, including card descendants', () => {
  const style = appSurfaceStyle(1920,1080);
  assert.equal(style.background,'transparent'); assert.equal(style.overflow,'visible');
  assert.equal(style.position,'absolute'); assert.equal(style.width,1920); assert.equal(style.height,1080);
  assert.equal(style.pointerEvents,'none');
  const css = read('../src/components/AppSurface.css');
  assert.match(css, /\.film-app-surface \*/);
  assert.match(css, /pointer-events: none !important/);
  assert.match(css, /animation: none !important/);
  assert.match(css, /transition: none !important/);
});

test('surface imports only scoped app CSS, in app order, followed by local containment', () => {
  const component = read('../src/components/AppSurface.tsx');
  const imports = [...component.matchAll(/import ['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.deepEqual(imports, ['@cascade-app/styles.css?app-surface','@cascade-app/stage.css?app-surface',
    '@cascade-app/film.css?app-surface','./AppSurface.css']);
  assert.doesNotMatch(component, /from ['"]@cascade-app\//);
  assert.match(component, /ledger-sidebar/);
  assert.match(read('../remotion.config.ts'), /enforce: 'pre'/);
  assert.match(read('../remotion.config.ts'), /resourceQuery: \/app-surface\//);
});

test('conservative inventory includes app siblings, descendants and logical selectors', () => {
  const selectors=['.app + .caption','.app ~ .caption','.app .caption','.app',':not(.app) .caption',':is(.app, body) > .caption'];
  for (const selector of selectors) {
    const entries=inventory(`${selector}{color:red}`, 'fixture.css');
    assert.deepEqual(entries,[{file:'fixture.css',context:'',kind:'selector',selector}]);
    assert.ok(containCss(`${selector}{color:red}`,'fixture.css').includes(GUARD));
  }
});
