import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {interpolateWindowState, projectWindow, windowGeometryAt} from '../src/components/windowGeometry.ts';

const browserPath = fileURLToPath(new URL('../src/components/BrowserFrame.tsx', import.meta.url));
const baselineRevision = '5de49fa24665a0d162ed0b66913a594181d3979f';
const before = execFileSync('git', ['show', `${baselineRevision}:film/src/components/BrowserFrame.tsx`], {encoding:'utf8'});

// Inspect React element objects directly: no DOM, server, browser or renderer.
const loadComponent = source => {
  const {outputText} = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }});
  const localRequire = createRequire(browserPath);
  const resolve = name => {
    if (name.startsWith('.')) {
      const tsFile = fileURLToPath(new URL(`${name}.ts`, `file://${browserPath}`));
      if (existsSync(tsFile)) return localRequire(tsFile);
    }
    return localRequire(name);
  };
  const module = {exports:{}};
  new Function('require','module','exports',outputText)(resolve,module,module.exports);
  return module.exports.BrowserFrame;
};
const oldFrame = loadComponent(before);
const newFrame = loadComponent(readFileSync(browserPath,'utf8'));
const normalise = value => {
  if (React.isValidElement(value)) {
    const type = typeof value.type === 'string' ? value.type : typeof value.type === 'function' ? value.type.name
      : value.type?.render?.name ?? String(value.type);
    return {type, key:value.key, props:normalise(value.props)};
  }
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,normalise(v)]));
  return value;
};
const child = React.createElement('test-capture', {src:'unchanged', startFrom:0, playbackRate:1});

test('all existing BrowserFrame caller modes retain identical element trees and style values', () => {
  for (const mode of ['bleed','tilt','framed']) for (const chrome of ['simple','browser']) {
    for (const progress of [-1,0,0.01,0.25,0.5,0.9,1,2]) {
      const props = {mode,chrome,progress,children:child};
      assert.deepEqual(normalise(newFrame(props)), normalise(oldFrame(props)));
    }
  }
});

test('scene 1 preserves the complete browser tree, chrome offset, edges, shadows and transforms', () => {
  for (let i=0;i<=30;i++) for (let j=0;j<=30;j++) {
    const p=i/30, s=j/30;
    const geometry=projectWindow(interpolateWindowState('fullscreen',interpolateWindowState('skewLeft','centerSmall',s),p),1920,1080);
    const common={mode:'framed',chrome:'browser',progress:p,children:child};
    const original=oldFrame({...common,targetScale:0.62,anchorLeftFrac:0.04+((1-0.62)/2-0.04)*s,skewYDeg:8+(0-8)*s,perspectivePx:1800});
    const current=newFrame({...common,geometry,legacyFrameAppearance:true});
    assert.deepEqual(normalise(current),normalise(original));
  }
});

test('scene 2 preserves the complete browser tree and static centerSmall appearance', () => {
  const common={mode:'framed',chrome:'browser',progress:1,children:child};
  const original=oldFrame({...common,targetScale:0.62,anchorLeftFrac:(1-0.62)/2,skewYDeg:0,perspectivePx:1800});
  const current=newFrame({...common,geometry:windowGeometryAt({preset:'centerSmall'},0)});
  assert.deepEqual(normalise(current),normalise(original));
});

test('scene integration keeps capture/phone expressions and derives all named window constants from the table', () => {
  const source=readFileSync(new URL('../src/compositions/CascadeFilm.tsx',import.meta.url),'utf8');
  const original=execFileSync('git',['show',`${baselineRevision}:film/src/compositions/CascadeFilm.tsx`],{encoding:'utf8'});
  const phone=s=>s.slice(s.indexOf('const PhoneRevealOverlay:'));
  const expectedPhone=phone(original)
    .replace("Window's settled right edge (Scene1AppWindow's SCENE1_WINDOW_* consts):", "Window's settled, unrotated right edge (the original phone anchor):")
    .replace('SCENE1_WINDOW_LEFT_MARGIN_FRAC + SCENE1_WINDOW_TARGET_SCALE','WINDOW_PRESETS.skewLeft.anchorLeftFrac + WINDOW_PRESETS.skewLeft.targetScale');
  assert.equal(phone(source),expectedPhone);
  assert.doesNotMatch(source,/const (SCENE1_WINDOW_|WINDOW_TARGET_SCALE|WINDOW_CENTER_ANCHOR)/);
  const scene2=s=>s.slice(s.indexOf('<Series.Sequence name="Scene 2'),s.indexOf('<Series.Sequence name="Scene 3'));
  assert.equal(scene2(source),scene2(original));
  assert.match(source, /<WindowLayout preset="centerSmall">/);
  assert.match(source, /from="fullscreen" to=\{swingGeometry\}/);
  assert.match(source, /easing=\{Easing.out\(Easing.cubic\)\} legacyFrameAppearance/);
});
