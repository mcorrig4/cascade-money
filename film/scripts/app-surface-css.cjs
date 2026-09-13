const postcss = require('postcss');
const selectors = require('postcss-selector-parser');
const {readFileSync} = require('node:fs');

const SCOPE = '.film-app-surface';
const GUARD = `:where(${SCOPE}, ${SCOPE} *)`;
const KEYFRAME_PREFIX = 'cascade-surface-';

const inKeyframes = node => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return true;
  }
  return false;
};

/** Include media ancestry so moving an old selector into a new breakpoint needs review too. */
const contextOf = node => {
  const parents = [];
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule') parents.unshift(`@${parent.name} ${parent.params}`.trim());
  }
  return parents.join(' / ');
};

const splitSelectors = selector => {
  const result = [];
  selectors(root => root.each(s => result.push(s.toString().trim()))).processSync(selector);
  return result;
};

// Inventory every selector: sibling and logical selectors make inferred scope unsafe.
const inventory = (source, file) => {
  const entries = [];
  const root = postcss.parse(source, {from: file});
  root.walkRules(rule => {
    if (inKeyframes(rule)) return;
    for (const selector of splitSelectors(rule.selector)) {
      entries.push({file, context: contextOf(rule), kind: 'selector', selector});
    }
  });
  root.walkAtRules(rule => {
    const params = rule.name === 'font-face' ? rule.nodes.find(n => n.prop === 'font-family')?.value : rule.params;
    entries.push({file, context: contextOf(rule), kind: 'at-rule', selector: `@${rule.name} ${params ?? ''}`.trim()});
  });
  return [...new Map(entries.map(entry => [JSON.stringify(entry), entry])).values()];
};

const scopeSelector = selector => selectors(root => root.each(s => {
  // The app's document defaults become local defaults. Custom properties still
  // inherit into every card, without changing the film document or its ground.
  s.walk(node => {
    if ((node.type === 'pseudo' && node.value === ':root') ||
      (node.type === 'tag' && ['html', 'body'].includes(node.value)) ||
      (node.type === 'id' && node.value === 'root')) {
      node.replaceWith(selectors.className({value: 'film-app-surface'}));
    }
  });
  const guard = selectors().astSync(GUARD).first.first.clone();
  // Guard the selected subject, before ::before/::after. Ancestors such as
  // .recording-hud can be the wrapper itself; adding an ancestor prefix alone
  // would silently break those rules. :where keeps card specificity unchanged.
  const pseudoElement = s.nodes.find(node => node.type === 'pseudo' &&
    (node.value.startsWith('::') || [':before', ':after', ':first-line', ':first-letter'].includes(node.value)));
  if (pseudoElement) s.insertBefore(pseudoElement, guard);
  else s.append(guard);
})).processSync(selector);

const containCss = (source, file) => {
  const root = postcss.parse(source, {from: file});
  const reviewed = JSON.parse(readFileSync(require.resolve('../src/components/app-surface-containment.json'), 'utf8'));
  const names = [...new Set(reviewed.filter(e => e.selector.startsWith('@keyframes ')).map(e => e.selector.slice(11)))];
  const animationNames = new RegExp(`\\b(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
  root.walkAtRules(rule => {
    if (/keyframes$/i.test(rule.name)) rule.params = KEYFRAME_PREFIX + rule.params;
    else if (rule.name === 'font-face') {
      const family = rule.nodes.find(n => n.prop === 'font-family')?.value.replace(/['"]/g, '');
      // A second local('Inter') face can override the film's awaited FontFace
      // registrations. Reuse those instead; the condensed coin face is unique.
      if (family === 'Inter') rule.remove();
    } else if (!['media', 'supports'].includes(rule.name)) {
      throw new Error(`Unreviewed AppSurface at-rule: @${rule.name}`);
    }
  });
  root.walkRules(rule => {
    if (!inKeyframes(rule)) rule.selector = scopeSelector(rule.selector);
  });
  root.walkDecls(decl => {
    if (/^(?:-webkit-)?animation(?:-name)?$/.test(decl.prop)) {
      // Definitions and cross-sheet references share the reviewed namespace.
      decl.value = decl.value.replace(animationNames, `${KEYFRAME_PREFIX}$1`);
    }
  });
  return root.toString();
};

module.exports = {containCss, inventory, splitSelectors, scopeSelector, SCOPE, GUARD};
