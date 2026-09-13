import assert from 'node:assert/strict';
import test from 'node:test';
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
const conditionalPath = node => {
  const path = [];
  for (let child = node, parent = child.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isConditionalExpression(parent)) path.push([parent.condition.getText(source), parent.whenTrue === child]);
  }
  return path;
};
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

test('scene 2 cumulative facts remain mounted until promises takes over, with countries independently gated', () => {
  const hook = component('HookPresentation');
  const country = jsxWithText(hook, 'strong', '50');
  assert.ok(country);
  assert.deepEqual(conditionalPath(country), [["shown('stat-suppliers')", true], ["shown('promises')", false], ["shown('wordmark')", false]]);
  assert.match(country.parent.openingElement.getText(source), /visibility\(shown\('stat-countries'\)\)/);
  assert.equal(nodes(hook, node => ts.isCallExpression(node) && /exit|fade|interpolate/.test(node.expression.getText(source))).length, 0);
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
