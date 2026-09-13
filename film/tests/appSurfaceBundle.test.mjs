import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import webpack from 'webpack';

test('real webpack CSS pipeline contains AppSurface imports without bundling app JavaScript', async () => {
  const filmDir = fileURLToPath(new URL('..', import.meta.url));
  const require = createRequire(new URL('../package.json', import.meta.url));
  const cliRequire = createRequire(require.resolve('@remotion/cli'));
  const bundlerRequire = createRequire(cliRequire.resolve('@remotion/bundler'));
  const {getSharedModuleRules, getResolveConfig} = bundlerRequire('./shared-bundler-config.js');
  const output = mkdtempSync(join(tmpdir(), 'cascade-w0-css-'));
  // Capture the repository's actual override without invoking CLI setup. This
  // is a compiler-only check: webpack does not launch a server or browser.
  let override;
  const configPath = join(filmDir, 'remotion.config.ts');
  const configSource = readFileSync(configPath, 'utf8').replace('process.cwd()', JSON.stringify(filmDir));
  const {outputText} = ts.transpileModule(configSource, {compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
  const configRequire = name => name === '@remotion/cli/config' ? {Config:{
    setVideoImageFormat(){}, setOverwriteOutput(){}, setChromiumOpenGlRenderer(){}, setDelayRenderTimeoutInMilliseconds(){},
    overrideWebpackConfig(fn){override=fn;},
  }} : require(name);
  new Function('require', 'exports', outputText)(configRequire, {});
  const compiler = webpack(override({
    context:filmDir, mode:'production', devtool:false, cache:false,
    entry:join(filmDir,'src/components/AppSurface.tsx'),
    output:{path:output,filename:'surface.js'}, optimization:{minimize:false},
    resolve:getResolveConfig(),
    module:{rules:[...getSharedModuleRules(),{test:/\.tsx?$/,use:[{
      loader:bundlerRequire.resolve('./esbuild-loader/index.js'),
      options:{target:'chrome85',loader:'tsx',implementation:bundlerRequire('esbuild'),remotionRoot:filmDir},
    }]}]},
  }));
  try {
    const stats = await new Promise((resolve,reject)=>compiler.run((error,stats)=>error?reject(error):resolve(stats)));
    assert.ok(!stats.hasErrors(), stats.toString({all:false,errors:true,errorDetails:true}));
    const appModules=[...new Set([...stats.compilation.modules].map(m=>m.resource).filter(p=>p?.includes('/app/src/')))];
    assert.equal(appModules.length,3);
    assert.ok(appModules.every(p=>/\/(styles|stage|film)\.css\?app-surface$/.test(p)),appModules.join('\n'));
    const bundle=readFileSync(join(output,'surface.js'),'utf8');
    assert.match(bundle,/film-app-surface/);
    assert.match(bundle,/cascade-surface-coin-float/);
    assert.doesNotMatch(bundle,/\.overlay-card\{position:relative/);
  } finally {
    await new Promise((resolve,reject)=>compiler.close(error=>error?reject(error):resolve()));
    rmSync(output,{recursive:true,force:true});
  }
});
