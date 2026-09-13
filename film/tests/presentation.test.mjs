import assert from 'node:assert/strict';
import test from 'node:test';
import * as jsxRuntime from 'react/jsx-runtime';
import {interpolate} from 'remotion';
import {cueFrame} from '../src/cues.ts';
import postcss from 'postcss';
import {readFileSync} from 'node:fs';
import {swapPositions, swapProgress, extensionState, YEAR_INVOICES, STRESS_OPERATIONS} from '../src/components/presentation/presentationMath.ts';
import {windowGeometryAt, presentationRect} from '../src/components/windowGeometry.ts';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('swap follows opposite semicircles, pauses, retraces, and stops once', () => {
  assert.equal(swapProgress(-1), 0);
  assert.equal(swapProgress(.75), 1);
  assert.equal(swapProgress(1), 1);
  assert.equal(swapProgress(1.1), 1);
  assert.equal(swapProgress(1.85), 0);
  assert.equal(swapProgress(50), 0);
  for (let i = 0; i <= 150; i++) {
    const t = i / 200;
    const [a, b] = swapPositions(t);
    const [backA, backB] = swapPositions(1.85 - t);
    near(a.x, backA.x); near(a.y, backA.y);
    near(b.x, backB.x); near(b.y, backB.y);
    near(Math.hypot(a.x - 351.3, a.y - 775), 151);
    near(Math.hypot(b.x - 351.3, b.y - 775), 151);
    near(Math.hypot(a.x - b.x, a.y - b.y), 302);
    assert.ok(a.y <= 775 + 1e-9); assert.ok(b.y >= 775 - 1e-9);
  }
});

test('100px tokens clear one another, the text, and the mirrored window across the whole swap', () => {
  const geometry = windowGeometryAt({preset: 'skewRight'}, 0);
  const pane = presentationRect(geometry, 'left');
  const halfWidth = 100 * 462 / 170 / 2, halfHeight = 50;
  for (let i = 0; i <= 400; i++) {
    const [a, b] = swapPositions(i / 200);
    for (const coin of [a, b]) {
      assert.ok(coin.x - halfWidth >= pane.left);
      assert.ok(coin.x + halfWidth <= pane.right);
      assert.ok(coin.y - halfHeight > 540);
      assert.ok(coin.y + halfHeight <= 976);
    }
    assert.ok(Math.abs(a.x - b.x) >= 2 * halfWidth || Math.abs(a.y - b.y) >= 2 * halfHeight);
  }
});

test('extension yields only over the newly added interval and clamps at its endpoints', () => {
  const before = extensionState(10, 20, 80), midpoint = extensionState(50, 20, 80), after = extensionState(100, 20, 80);
  assert.equal(before.maturityDay, 30); assert.equal(before.ticks.filter(t => t.filled).length, 0);
  assert.equal(midpoint.maturityDay, 60); assert.equal(midpoint.ticks.filter(t => t.filled).length, 30);
  assert.equal(after.maturityDay, 90); assert.equal(after.ticks.filter(t => t.filled).length, 60);
  assert.ok(after.ticks.slice(0, 30).every(t => !t.filled));
});

test('film invoice figure follows the app constant and is distinct from adversarial operations', () => {
  const shots = readFileSync(new URL('../../app/src/director/shots.ts', import.meta.url), 'utf8');
  const match = shots.match(/VERIFIED_YEAR_INVOICES\s*=\s*([\d_]+)/);
  assert.ok(match, 'app must expose a literal verified-year count for the presentation check');
  assert.equal(YEAR_INVOICES, Number(match[1].replaceAll('_', '')));
  assert.equal(STRESS_OPERATIONS, 10_000);
  assert.notEqual(YEAR_INVOICES, STRESS_OPERATIONS);
});

// Static TypeScript inspection tests reveal ownership without executing React or media.
const ts = (await import('typescript')).default;
const presentationSource = readFileSync(new URL('../src/components/presentation/ScenePresentation.tsx', import.meta.url), 'utf8');
const source = ts.createSourceFile('ScenePresentation.tsx', presentationSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = (root, predicate) => {
  const result = [];
  const visit = node => {if (predicate(node)) result.push(node); ts.forEachChild(node, visit);};
  visit(root); return result;
};
const component = name => {
  const declaration = nodes(source, node => ts.isVariableDeclaration(node) && node.name.getText(source) === name)[0];
  assert.ok(declaration, `Missing ${name}`); return declaration.initializer;
};
const jsxWithText = (root, tag, text) => nodes(root, node => ts.isJsxElement(node)
  && node.openingElement.tagName.getText(source) === tag
  && node.children.some(child => ts.isJsxText(child) && child.text.trim() === text))[0];
const generatedCues = JSON.parse(readFileSync(new URL('../src/generated/cues.json', import.meta.url), 'utf8'));

test('each static presentation reveal has a generated cue in its own scene', () => {
  for (const [scene, name] of [[2, 'HookPresentation'], [3, 'ExamplePresentation'], [4, 'QuestionPresentation'],
    [6, 'TotalsPresentation'], [7, 'CoinPresentation'], [8, 'BackingPresentation'], [9, 'StressPresentation'], [10, 'ComposablePresentation']]) {
    for (const call of nodes(component(name), node => ts.isCallExpression(node)
      && ['shown', 'at'].includes(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0]))) {
      assert.equal(typeof generatedCues[scene]?.[call.arguments[0].text], 'number', `${scene}/${call.arguments[0].text}`);
    }
  }
  for (const title of ['loans', 'forwards', 'bonds', 'derivatives']) assert.equal(typeof generatedCues[10][`word-${title}`], 'number');
});

// Execute only the actual hook and its local dependencies; no app, media or browser.
const hookSource = ['requiredFrame', 'Wordmark', 'visibility', 'citations', 'HookPresentation']
  .map(name => `const ${name} = ${component(name).getText(source)};`).join('\n');
const hookCode = ts.transpileModule(`${hookSource}\nexport {HookPresentation, requiredFrame};`, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
}).outputText;
const renderHook = (frame, fps = 30, width = 1920, cues = generatedCues[2]) => {
  const exports = {};
  new Function('require', 'exports', 'interpolate', 'useCurrentFrame', 'useVideoConfig', 'cueFrame', hookCode)(
    name => {assert.equal(name, 'react/jsx-runtime'); return jsxRuntime;}, exports,
    interpolate, () => frame, () => ({fps}), cueFrame,
  );
  const geometry = windowGeometryAt({preset: 'centerSmall'}, frame, width, width * 1080 / 1920);
  return {geometry, band: exports.HookPresentation({geometry, at: name => exports.requiredFrame(cues, name, fps)})};
};
const children = element => [element.props.children].flat().filter(Boolean);
const expectedFacts = [
  ['hook-open', '$200B', 'of product costs', 'stat-cost', 'Apple 10-K FY2025', 'product cost of sales $194.1B'],
  ['stat-suppliers', '200', 'suppliers', 'stat-suppliers', 'Apple Supplier List 2025', 'about 200 direct suppliers, 98% of spend'],
  ['stat-factories', 'thousands', 'of factories', 'stat-factories', 'Apple Supply Chain 2025 Progress Report', 'thousands of facilities'],
  ['stat-countries', '50', 'countries', 'stat-countries', 'Apple Supply Chain 2025 Progress Report', '50+ countries'],
];

test('scene 2 holds four fixed columns through the close, with independent sources, countries and a 0.4 dim', () => {
  for (const fps of [24, 30, 60]) {
    const at = name => cueFrame(generatedCues[2], name, fps, NaN);
    for (let frame = 0; frame < Math.round(19.24 * fps); frame++) {
      const {band} = renderHook(frame, fps);
      const [facts, phrase, close] = children(band);
      assert.equal(facts.props.className, 'film-hook-facts');
      const columns = children(facts);
      assert.equal(columns.length, 4, 'all four columns exist from frame zero through the end');
      near(facts.props.style.opacity, 1 - .75 * Math.max(0, Math.min(1, (frame - at('payment-terms')) / (.4 * fps))));
      columns.forEach((column, i) => {
        const [cue, figure, label, sourceCue, sourceName, fact] = expectedFacts[i];
        assert.equal(column.key, cue, 'stable column order and identity');
        assert.equal(column.props.style.visibility, frame < at(cue) ? 'hidden' : 'visible');
        near(column.props.style.opacity, Math.max(0, Math.min(1, (frame - at(cue)) / (.2 * fps))));
        const [number, caption, citation] = children(column);
        assert.equal(number.props.children, figure);
        assert.equal(caption.props.children, label);
        assert.deepEqual(children(citation).map(child => child.props.children), [sourceName, fact]);
        assert.equal(citation.props.style.visibility, frame < at(sourceCue) ? 'hidden' : 'visible');
        near(citation.props.style.opacity, Math.max(0, Math.min(1, (frame - at(sourceCue)) / (.2 * fps))));
      });
      assert.equal(phrase.props.style.visibility, frame >= at('payment-terms') && frame < at('wordmark') ? 'visible' : 'hidden');
      // The spans explicitly set visibility, so the parent must also zero opacity at the close.
      near(phrase.props.style.opacity, frame >= at('wordmark') ? 0 : Math.max(0, Math.min(1, (frame - at('payment-terms')) / (.2 * fps))));
      const clauses = children(phrase);
      assert.deepEqual(clauses.map(clause => clause.props.children), ['payment terms', ' and promises']);
      for (const [i, cue] of ['payment-terms', 'promises-word'].entries()) {
        assert.equal(clauses[i].props.style.visibility, frame < at(cue) ? 'hidden' : 'visible');
        near(clauses[i].props.style.opacity, Math.max(0, Math.min(1, (frame - at(cue)) / (.2 * fps))));
      }
      assert.equal(close.props.style.visibility, frame < at('wordmark') ? 'hidden' : 'visible');
      assert.equal(children(close)[1].props.style.visibility, frame < at('hook-arc') ? 'hidden' : 'visible');
    }
  }
  // Moving just the countries cue must leave the other three columns intact.
  const cues = {...generatedCues[2], 'stat-countries': 18};
  const [facts] = children(renderHook(17 * 30, 30, 1920, cues).band);
  assert.deepEqual(children(facts).map(column => column.props.style.visibility), ['visible', 'visible', 'visible', 'hidden']);
  for (const cue of new Set([...expectedFacts.flatMap(f => [f[0], f[3]]), 'payment-terms', 'promises-word', 'wordmark', 'hook-arc'])) {
    const missing = {...generatedCues[2]}; delete missing[cue];
    assert.throws(() => renderHook(0, 30, 1920, missing), {message: `Missing presentation cue: ${cue}`});
  }
});

test('scene 2 grid, typography and centred scrim fit wholly below the projected window', () => {
  const css = postcss.parse(readFileSync(new URL('../src/components/presentation/presentation.css', import.meta.url), 'utf8'));
  const rule = name => {
    const found = css.nodes.find(node => node.selector === `.app.film-app-surface.film-presentation .${name}`);
    assert.ok(found, name);
    return Object.fromEntries(found.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
  };
  const facts = rule('film-hook-facts'), figure = rule('film-hook-figure'), label = rule('film-hook-label');
  const citation = rule('film-hook-source'), phrase = rule('film-hook-phrase'), bandCSS = rule('film-hook-band');
  assert.equal(facts['grid-template-columns'], 'repeat(4, minmax(0, 1fr))');
  assert.equal(facts.gap, 'calc(32 * var(--film-unit))');
  assert.equal(facts.width, '100%'); assert.equal(facts['text-align'], 'left');
  assert.equal(figure['font-size'], 'calc(76 * var(--film-unit))');
  assert.equal(figure['letter-spacing'], 'calc(-3 * var(--film-unit))');
  assert.equal(figure['font-variant-numeric'], 'tabular-nums'); assert.equal(figure.color, 'var(--money)');
  assert.equal(label['font-size'], 'calc(22 * var(--film-unit))'); assert.equal(label.color, '#8ba0ad');
  assert.equal(citation['font-size'], 'calc(16 * var(--film-unit))'); assert.equal(citation.color, '#8297a5');
  assert.equal(citation['border-top'], 'calc(1 * var(--film-unit)) solid var(--line)');
  assert.equal(rule('film-hook-source strong')['font-weight'], '500');
  assert.equal(phrase['font-size'], 'calc(84 * var(--film-unit))');
  assert.equal(phrase['white-space'], 'pre', 'the hidden second span reserves its width, including the space');
  assert.equal(phrase.background, 'linear-gradient(90deg, #071019, #071019)');
  // The phrase and the close both stretch across the band so their scrim covers
  // the dimmed figures behind them instead of only their own line box.
  for (const entry of [phrase, rule('film-hook-close')]) {
    assert.equal(entry['justify-self'], 'stretch');
    assert.equal(entry['align-self'], 'stretch');
    assert.equal(entry.background, 'linear-gradient(90deg, #071019, #071019)');
    assert.equal(entry['align-items'], 'center');
  }
  for (const entry of [facts, phrase, rule('film-hook-close')]) assert.equal(entry['grid-area'], '1 / 1');
  assert.equal(bandCSS.overflow, 'hidden'); assert.equal(bandCSS.contain, 'layout paint');
  assert.doesNotMatch(presentationSource, /film-hook-sources/);
  const pixels = value => Number(value.match(/calc\((-?[\d.]+) \* var\(--film-unit\)\)/)[1]);
  const columnHeight = pixels(figure['font-size']) * Number(figure['line-height']) + pixels(label['margin-top'])
    + pixels(label['font-size']) * Number(label['line-height']) + pixels(citation['margin-top'])
    + pixels(citation['border-top']) + pixels(citation['padding-top']) + pixels(citation.gap)
    + 2 * pixels(citation['font-size']) * Number(citation['line-height']);
  for (const width of [960, 1920, 3840]) {
    const {geometry, band} = renderHook(400, 30, width);
    const unit = width / 1920, top = band.props.style.top;
    const bottom = geometry.height - band.props.style.bottom;
    near(top - geometry.rect.bottom, 8 * unit);
    near(band.props.style.left, 32 * unit); near(band.props.style.right, 32 * unit);
    assert.ok(columnHeight * unit <= bottom - top, 'figure, label and both source lines fit');
    // The phrase scrim now stretches to the band box itself, so the band's own
    // clearance from the projected window is the whole guarantee.
    assert.ok(top > geometry.rect.bottom, 'the band, and so the scrim, clears the window');
    assert.ok(pixels(phrase['font-size']) * Number(phrase['line-height']) * unit <= bottom - top,
      'the phrase line fits inside the band it now spans');
  }
});

test('scene 6 draws the reserve-to-settlement proportion, cue-gated, with no counter stack', () => {
  const totals = component('TotalsPresentation');
  const text = totals.getText(source);
  // The three app-footer counters must NOT be restated as a stack of captions.
  for (const gone of ['invoices settled', 'cascade-stat', 'cascade-totals']) assert.ok(!text.includes(gone));
  // Both figures stay, but as labels on the bars rather than a column of stats.
  for (const figure of ['$100M', '$450M']) assert.ok(jsxWithText(totals, 'strong', figure));
  // Every reveal is keyed to a scene-6 cue and nothing is a fixed frame offset.
  for (const cue of ['deposited-value', 'committed-counter', 'transacted-value', 'settled-counter',
    'invoice-value', 'companies-counter', 'invoices-settled']) {
    assert.ok(text.includes(`at('${cue}')`), `scene 6 must consume cue ${cue}`);
  }
  // The settlement bar is nine segments; the reserve bar never changes length.
  assert.match(text, /length: 9/);
  assert.ok(text.includes('film-totals-reserve') && text.includes('film-totals-settlement'));
  // Motion comes from Remotion interpolate, clamped at both ends.
  const clamped = nodes(totals, node => ts.isCallExpression(node)
    && node.expression.getText(source) === 'interpolate');
  assert.ok(clamped.length > 0);
  for (const call of clamped) assert.match(call.getText(source), /extrapolateLeft: 'clamp'/);
  assert.equal(nodes(totals, node => ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'h2').length, 0);
});

test('scene 10 final card takes priority and reveals plus/time independently; stress operations have their own gate', () => {
  const composable = component('ComposablePresentation');
  const statements = composable.body.statements;
  assert.ok(ts.isIfStatement(statements[0]));
  assert.equal(statements[0].expression.getText(source), "shown('money-plus-time')");
  assert.ok(ts.isReturnStatement(statements[0].thenStatement));
  assert.match(statements[0].thenStatement.getText(source), /shown\('money-plus'\)/);
  assert.match(statements[0].thenStatement.getText(source), /shown\('money-time'\)/);
  assert.equal(statements[1].expression.getText(source), "shown('wordmark')");
  const stress = component('StressPresentation');
  const operations = nodes(stress, node => ts.isBinaryExpression(node)
    && node.left.getText(source) === "shown('stress-operations')")[0];
  assert.ok(operations); assert.equal(operations.operatorToken.kind, ts.SyntaxKind.AmpersandAmpersandToken);
  assert.match(operations.right.getText(source), /STRESS_OPERATIONS/);
  assert.match(operations.right.getText(source), /Separate adversarial test/);
});
