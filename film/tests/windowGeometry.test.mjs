import assert from 'node:assert/strict';
import test from 'node:test';
import {Easing, interpolate} from 'remotion';
import {WINDOW_PRESETS, interpolateWindowState, windowGeometryAt, projectWindow,
  windowFrameStyle, presentationRect, transitionProgress} from '../src/components/windowGeometry.ts';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const legacy = (p, s) => ({
  scale: 1 - (1 - 0.62) * p,
  leftPct: (0.04 + ((1 - 0.62) / 2 - 0.04) * s) * p * 100,
  rotateY: (8 + (0 - 8) * s) * p,
  perspective: 1800,
});
const actual = (p, s) => projectWindow(interpolateWindowState('fullscreen',
  interpolateWindowState('skewLeft', 'centerSmall', s), p), 1920, 1080);

test('scene 1 equals the independent origin/main expressions for all sampled pull-back/swing pairs', () => {
  for (let i = 0; i <= 100; i++) for (let j = 0; j <= 100; j++) {
    const p = i / 100, s = j / 100, g = actual(p, s);
    const {scale, leftPct, rotateY, perspective} = g;
    assert.deepEqual({scale, leftPct, rotateY, perspective}, legacy(p, s));
    const style = windowFrameStyle(g, true);
    assert.equal(style.borderRadius, 8 + 14 * p);
    assert.equal(style.border, `1px solid rgba(170,199,204,${0.22 * p})`);
    assert.equal(style.boxShadow, `0 ${60 * p}px ${140 * p}px rgba(0,0,0,${0.55 * p})`);
    assert.equal(style.transformOrigin, 'left center');
  }
});

test('scene 1 frame timing preserves both easings, rounding, clamping, and overlapping spans', () => {
  const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
  for (const fps of [4, 15, 30]) for (const duration of [10, Math.round(163 * fps / 30), Math.round(26.53 * fps)]) {
    const pullback = Math.round(36 * fps / 30), swing = Math.round(27 * fps / 30);
    for (let frame = -3; frame < duration + 4; frame++) {
      const p = interpolate(frame, [0, pullback], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
      const s = interpolate(frame, [duration - 1 - swing, duration - 1], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
      const destination = windowGeometryAt({from: 'skewLeft', to: 'centerSmall', startFrame: duration - 1 - swing, durationInFrames: swing}, frame);
      const g = windowGeometryAt({from: 'fullscreen', to: destination, startFrame: 0, durationInFrames: pullback, easing: Easing.out(Easing.cubic)}, frame);
      const {scale, leftPct, rotateY, perspective} = g;
      assert.deepEqual({scale, leftPct, rotateY, perspective}, legacy(p, s));
      assert.equal(transitionProgress(frame, duration - 1 - swing, swing), s);
    }
  }
});

test('scene 2 centerSmall is exactly the old WindowedBeat geometry', () => {
  const g = windowGeometryAt({preset: 'centerSmall'}, 0);
  assert.equal(g.scale, 1 - (1 - 0.62));
  assert.equal(g.leftPct, ((1 - 0.62) / 2) * 100);
  assert.equal(g.rotateY, 0);
  assert.equal(g.perspective, 1800);
  assert.deepEqual(windowFrameStyle(g), windowFrameStyle(g, true));
});

test('centerLarge includes chrome inside 2.5% outer margins; fullscreen is genuine bleed', () => {
  const g = windowGeometryAt({preset: 'centerLarge'}, 0);
  near(g.rect.left, 48); near(g.rect.right, 1872); near(g.rect.top, 27); near(g.rect.bottom, 1053);
  const full = windowGeometryAt({preset: 'fullscreen'}, 0);
  assert.deepEqual(full.rect, {left: 0, right: 1920, top: 0, bottom: 1080, width: 1920, height: 1080});
  assert.equal(full.chromeProgress, 0);
  assert.equal(windowFrameStyle(full).borderRadius, 0);
  assert.equal(windowFrameStyle(full).border, '0px solid rgba(170,199,204,0)');
  assert.equal(windowFrameStyle(full, true).borderRadius, 8);
});

test('skewRight mirrors all four projected corners, including the transform origin', () => {
  const left = windowGeometryAt({preset: 'skewLeft'}, 0);
  const right = windowGeometryAt({preset: 'skewRight'}, 0);
  for (const [i, j] of [[0, 1], [1, 0], [2, 3], [3, 2]]) {
    near(left.corners[i].x, 1920 - right.corners[j].x);
    near(left.corners[i].y, right.corners[j].y);
  }
  assert.equal(windowFrameStyle(right).transformOrigin, 'right center');
});

// Independent homogeneous-matrix oracle, using CSS's right-to-left transform
// order. This catches both unrotated-box approximations and accidental Z scale.
const mul = (matrix, vector) => matrix.map(row => row.reduce((sum, n, i) => sum + n * vector[i], 0));
test('projected corners match CSS translate/scale/rotate/origin/parent-perspective matrices', () => {
  for (const [width, height] of [[1920, 1080], [1280, 720]]) {
    for (const from of Object.keys(WINDOW_PRESETS)) for (const to of Object.keys(WINDOW_PRESETS)) for (const t of [0, 0.2, 0.5, 0.9, 1]) {
      const state = interpolateWindowState(from, to, t), g = projectWindow(state, width, height);
      const a = state.skewYDeg * Math.PI / 180, s = state.targetScale, ox = state.originXFrac * width;
      const rotation = [[Math.cos(a),0,Math.sin(a),0],[0,1,0,0],[-Math.sin(a),0,Math.cos(a),0],[0,0,0,1]];
      const scale = [[s,0,0,0],[0,s,0,0],[0,0,1,0],[0,0,0,1]];
      const perspective = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,-1/state.perspectivePx,1]];
      for (const [i, [x, y]] of [[0,0],[width,0],[width,height],[0,height]].entries()) {
        let v = mul(scale, mul(rotation, [x - ox, y - height/2, 0, 1]));
        v[0] += state.anchorLeftFrac * width - (1-s)*ox + ox - width/2;
        v = mul(perspective, v);
        near(g.corners[i].x, v[0]/v[3]+width/2);
        near(g.corners[i].y, v[1]/v[3]+height/2);
      }
    }
  }
  const towardCamera = projectWindow({...WINDOW_PRESETS.skewLeft, skewYDeg: -8}, 1920, 1080);
  assert.ok(towardCamera.rect.right > (0.04+0.62)*1920);
});

test('all preset transitions clamp and interpolate perspective, origin, chrome, scale, position, rotation', () => {
  const spec = {from: 'skewRight', to: 'centerLarge', startFrame: 20, durationInFrames: 30};
  assert.deepEqual(windowGeometryAt(spec, -1), windowGeometryAt({preset: 'skewRight'}, 0));
  assert.deepEqual(windowGeometryAt(spec, 99), windowGeometryAt({preset: 'centerLarge'}, 0));
  const g = windowGeometryAt({...spec, to: {...WINDOW_PRESETS.centerLarge, perspectivePx: 2400}}, 35);
  assert.equal(g.perspectivePx, 2100); assert.equal(g.originXFrac, 0.5);
  near(g.targetScale, (0.62+0.95)/2); near(g.skewYDeg, -4);
  assert.throws(() => transitionProgress(0, 0, 0), /positive/);
});

test('presentation columns clear the projected rectangle throughout every preset transition', () => {
  for (const from of Object.keys(WINDOW_PRESETS)) for (const to of Object.keys(WINDOW_PRESETS)) {
    for (let frame = 0; frame <= 30; frame++) {
      const g = windowGeometryAt({from, to, startFrame: 0, durationInFrames: 30}, frame);
      for (const side of ['left','right']) {
        const rect = presentationRect(g, side);
        assert.ok(rect.width >= 0 && rect.left >= 0 && rect.right <= g.width);
        if (rect.width > 0) assert.ok(side === 'left' ? rect.right < g.rect.left : rect.left > g.rect.right);
      }
    }
  }
});
