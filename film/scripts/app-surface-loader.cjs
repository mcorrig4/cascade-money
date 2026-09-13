const {containCss} = require('./app-surface-css.cjs');

// Opt-in query imports keep AppFrame's existing CSS path byte-for-byte intact.
module.exports = function appSurfaceLoader(source) {
  this.cacheable();
  this.addDependency(require.resolve('../src/components/app-surface-containment.json'));
  return containCss(source, this.resourcePath);
};
