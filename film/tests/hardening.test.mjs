import assert from 'node:assert/strict';
import test from 'node:test';
import React, {useEffect, useState} from 'react';
import {create, act} from 'react-test-renderer';
import {componentHarness} from './componentHarness.mjs';
import {WINDOW_PRESETS, projectWindow, windowGeometryAt, interpolateWindowState} from '../src/components/windowGeometry.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('stateful children survive fullscreen boundaries, reverse playback and seeking', async () => {
  const harness = componentHarness();
  const {WindowLayout} = harness.load(new URL('../src/components/WindowLayout.tsx',import.meta.url).href);
  let mounts=0, unmounts=0, setValue;
  const Child = () => {
    const [value, set] = useState('initial'); setValue=set;
    useEffect(() => {mounts++; return () => {unmounts++;};},[]);
    return React.createElement('output',null,value);
  };
  let root;
  for (const [from,to] of [['fullscreen','skewLeft'],['skewRight','fullscreen']]) {
    for (const frame of [-1,0,1,15,29,30,31,0,30,1]) {
      harness.setFrame(frame);
      const tree=React.createElement(WindowLayout,{from,to,startFrame:0,durationInFrames:30},React.createElement(Child));
      await act(() => {if (root) root.update(tree); else root=create(tree);});
      if (mounts === 1 && root.root.findByType('output').children[0] === 'initial') {
        assert.equal(frame,-1);
        await act(() => setValue('retained'));
      }
      assert.equal(root.root.findByType('output').children[0],'retained');
      assert.equal(mounts,1); assert.equal(unmounts,0);
    }
  }
  await act(() => root.unmount()); assert.equal(unmounts,1);
});

test('pane establishes fixed containing block and paint containment; surface remains unclipped', () => {
  const harness=componentHarness();
  const {PresentationPane,AppSurface}=harness.load(new URL('../src/components/AppSurface.tsx',import.meta.url).href);
  const fixed=React.createElement('section',{style:{position:'fixed',inset:-200}});
  const pane=PresentationPane({side:'right',geometry:windowGeometryAt({preset:'skewLeft'},0),children:fixed});
  assert.equal(pane.props.style.contain,'layout paint');
  assert.equal(pane.props.style.overflow,'hidden');
  assert.equal(pane.props.children,fixed);
  assert.equal(AppSurface({children:pane}).props.style.overflow,'visible');
});

test('presets and nested states are frozen; invalid geometry fails before drawing', () => {
  assert.ok(Object.isFrozen(WINDOW_PRESETS));
  for (const state of Object.values(WINDOW_PRESETS)) assert.ok(Object.isFrozen(state));
  assert.throws(() => {WINDOW_PRESETS.skewLeft.targetScale=1;},TypeError);
  const valid=WINDOW_PRESETS.skewLeft;
  for (const key of Object.keys(valid)) for (const value of [NaN,Infinity,-Infinity]) {
    assert.throws(() => projectWindow({...valid,[key]:value},1920,1080),/finite/);
  }
  for (const patch of [{targetScale:0},{perspectivePx:-1},{originXFrac:2},{chromeProgress:-1}]) {
    assert.throws(() => projectWindow({...valid,...patch},1920,1080));
  }
  for (const size of [[0,1080],[1920,-1],[NaN,1080]]) assert.throws(() => projectWindow(valid,...size));
  assert.throws(() => interpolateWindowState('fullscreen','skewLeft',NaN),/finite/);
  assert.throws(() => windowGeometryAt({preset:'skewLeft'},Infinity),/finite/);
  assert.throws(() => windowGeometryAt({from:'fullscreen',to:'skewLeft',startFrame:NaN,durationInFrames:30},0),/finite/);
  assert.throws(() => projectWindow({...valid,skewYDeg:-90,perspectivePx:1},1920,1080),/camera plane/);
  assert.doesNotThrow(() => projectWindow({...valid,targetScale:2,anchorLeftFrac:-1},1920,1080));
});

test('probe covers all presets, requested transitions, fullscreen boundaries and debug modes', () => {
  const harness=componentHarness();
  const {W0_PROBE_SHOTS:shots,W0_PROBE_SHOT_FRAMES:duration}=harness.load(new URL('../src/compositions/w0ProbeSchedule.ts',import.meta.url).href);
  const {W0LayoutProbe}=harness.load(new URL('../src/compositions/W0LayoutProbe.tsx',import.meta.url).href);
  assert.equal(duration,90); assert.equal(shots.length,10);
  assert.deepEqual(shots.slice(0,5).map(s=>s.spec.preset),['skewLeft','centerSmall','skewRight','centerLarge','fullscreen']);
  assert.deepEqual(shots.slice(5).map(s=>[s.spec.from,s.spec.to]),[
    ['skewLeft','centerSmall'],['centerSmall','skewRight'],['skewRight','centerLarge'],['fullscreen','skewLeft'],['skewRight','fullscreen'],
  ]);
  for (let index=0;index<shots.length;index++) for (const local of [0,15,45,75,89]) {
    harness.setFrame(index*duration+local);
    for (const debugOutlines of [true,false]) {
      const tree=W0LayoutProbe({debugOutlines});
      const children=React.Children.toArray(tree.props.children);
      assert.equal(children.some(c=>c.type==='svg'),debugOutlines);
      assert.ok(JSON.stringify(children.at(-1).props.children).includes(shots[index].label));
    }
  }
});
