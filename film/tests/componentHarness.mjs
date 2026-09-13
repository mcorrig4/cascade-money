import {readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as remotion from 'remotion';

// Node-only React reconciliation: no browser, video, DOM or network server.
export const componentHarness = () => {
  let frame = 0;
  const cache = new Map();
  const load = path => {
    if (cache.has(path)) return cache.get(path);
    const require = createRequire(path);
    const resolve = name => {
      if (name === 'remotion') return {...remotion, useCurrentFrame: () => frame,
        useVideoConfig: () => ({width:1920,height:1080,fps:30,durationInFrames:1000})};
      if (name.includes('.css')) return {};
      if (name === '../brand/fonts') return {ensureFontsLoaded() {}};
      if (name.startsWith('.')) {
        for (const ext of ['.ts','.tsx']) {
          const target = new URL(name + ext, path).href;
          if (existsSync(new URL(target))) return load(target);
        }
      }
      return require(name);
    };
    const {outputText} = ts.transpileModule(readFileSync(new URL(path),'utf8'), {compilerOptions:{
      module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,
    }});
    const module = {exports:{}};
    new Function('require','module','exports',outputText)(resolve,module,module.exports);
    cache.set(path,module.exports);
    return module.exports;
  };
  return {load, setFrame: value => {frame = value;}};
};
