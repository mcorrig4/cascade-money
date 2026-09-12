import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, MeshBasicMaterial, Raycaster, SphereGeometry, Vector3 } from 'three';
import { atlasUv, GEO_REFERENCES, normalizeLongitude } from '../src/globe/geography.ts';
import { initializeTelegram, safeInsets } from '../src/platform/telegram.ts';

test('NASA west seam is -180; sphere rotation maps all five reference locations to atlas UVs', () => {
  assert.equal(atlasUv(0, -180).u, 0); assert.equal(atlasUv(0, 0).u, 0.5);
  assert.equal(normalizeLongitude(238), -122); assert.equal(normalizeLongitude(-482), -122);
  const sphere = new Mesh(new SphereGeometry(100, 180, 90), new MeshBasicMaterial());
  // Installed three-globe orients its prime meridian with this rotation.
  sphere.rotation.y = -Math.PI / 2; sphere.updateMatrixWorld();
  for (const site of GEO_REFERENCES) {
    const phi = site.lat * Math.PI / 180, theta = site.lng * Math.PI / 180;
    const origin = new Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)).multiplyScalar(300);
    const hit = new Raycaster(origin, origin.clone().negate().normalize()).intersectObject(sphere)[0];
    assert.ok(hit?.uv, site.name);
    const expected = atlasUv(site.lat, site.lng);
    assert.ok(Math.abs(hit.uv.x - expected.u) < 0.0001, `${site.name} longitude`);
    assert.ok(Math.abs(hit.uv.y - expected.v) < 0.0001, `${site.name} latitude`);
  }
  sphere.geometry.dispose(); sphere.material.dispose();
});
test('Telegram initialization calls available methods, updates safe areas, and cleans up listeners', () => {
  const calls: string[] = [], values = new Map(), events = new Map();
  const root = { style: { setProperty: (key: string, value: string) => values.set(key, value), removeProperty: (key: string) => values.delete(key) } } as unknown as HTMLElement;
  const app = {
    ready: () => calls.push('ready'), expand: () => calls.push('expand'), disableVerticalSwipes: () => calls.push('swipes'),
    safeAreaInset: { top: 24, bottom: 34 }, contentSafeAreaInset: { top: 50 },
    onEvent: (name: string, callback: () => void) => events.set(name, callback), offEvent: (name: string) => events.delete(name),
  };
  const cleanup = initializeTelegram(app, root);
  assert.deepEqual(calls, ['ready', 'expand', 'swipes']); assert.equal(values.get('--telegram-safe-top'), '50px');
  app.safeAreaInset.bottom = 40; events.get('safeAreaChanged')(); assert.equal(values.get('--telegram-safe-bottom'), '40px');
  cleanup(); assert.equal(events.size, 0); assert.equal(values.size, 0);
  assert.doesNotThrow(() => initializeTelegram(undefined, root)());
  assert.doesNotThrow(() => initializeTelegram({ ready: () => { throw new Error('unsupported'); } }, root)());
  assert.deepEqual(safeInsets({ safeAreaInset: { top: NaN, left: -1, bottom: Infinity } }), { top: 0, right: 0, bottom: 0, left: 0 });
});
