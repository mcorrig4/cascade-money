import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BufferGeometry, ShaderMaterial, Curve, TubeGeometry, Vector3 } from 'three';
import { arcLifecycle, arcLifetime, DASH_KM, GAP_KM, pickup, SunClock } from '../src/globe/animation.ts';
import { updateArcMaterials } from '../src/globe/arc-material.ts';
import { BRANDS, brandFor } from '../src/globe/brands.ts';
import type { LiveArc } from '../src/globe/arc-pool.ts';

test('grow, flow and collapse run in the same direction at ordinary and year speed', () => {
  for (const life of [1800, arcLifetime(365 / 15, false), 3500]) {
    assert.deepEqual([arcLifecycle(0, life).clipStart, arcLifecycle(0, life).clipEnd], [0, 0]);
    const grow = arcLifecycle(life * 0.16, life), flow = arcLifecycle(life * 0.5, life), collapse = arcLifecycle(life * 0.8, life), end = arcLifecycle(life, life);
    assert.equal(grow.clipStart, 0); assert.ok(grow.clipEnd > 0 && grow.clipEnd < 1);
    assert.equal(flow.clipStart, 0); assert.equal(flow.clipEnd, 1); assert.equal(flow.alpha, 1);
    assert.ok(collapse.clipStart > 0 && collapse.clipStart < 1); assert.equal(collapse.clipEnd, 1); assert.ok(collapse.alpha < 1);
    assert.equal(end.clipStart, 1); assert.equal(end.alpha, 0);
    let previous = arcLifecycle(0, life);
    for (let age = 1; age <= life; age++) {
      const current = arcLifecycle(age, life);
      assert.ok(current.clipStart >= previous.clipStart && current.clipEnd >= previous.clipEnd && current.phaseKm > previous.phaseKm);
      previous = current;
    }
  }
  assert.equal(arcLifetime(365 / 15, false), 320);
});
test('fixed physical dashes have proportionally more repetitions on long routes', () => {
  assert.equal(1500 / (DASH_KM + GAP_KM), 10);
  assert.equal(150 / (DASH_KM + GAP_KM), 1);
  const phase = arcLifecycle(900, 1800).phaseKm;
  // d - phase = constant: a dash advances by the positive phase delta toward the payee.
  assert.ok(phase > arcLifecycle(600, 1800).phaseKm);
});
test('pickup bursts, settles, rises, expands and fades with its annotation', () => {
  const start = pickup(0, 1800), burst = pickup(162, 1800), settle = pickup(450, 1800), fade = pickup(1550, 1800), end = pickup(1800, 1800);
  assert.equal(start.alpha, 0); assert.ok(burst.scale > 1.2 && burst.scale > settle.scale);
  assert.ok(fade.scale > settle.scale && fade.rise > settle.rise && fade.alpha < settle.alpha);
  assert.equal(end.alpha, 0);
});
test('uniform animation retains geometry and material, and both clip and depth protection reach the shader', () => {
  const mesh = new Mesh(new BufferGeometry(), new ShaderMaterial()), group = new Group(); group.add(mesh);
  const arc = { id: 1, groundKm: 1500, ...arcLifecycle(900, 1800), __threeObjArc: group } as unknown as LiveArc;
  updateArcMaterials([arc], 100);
  const geometry = mesh.geometry.uuid, material = mesh.material.uuid;
  Object.assign(arc, arcLifecycle(1550, 1800)); updateArcMaterials([arc], 100);
  assert.equal(mesh.geometry.uuid, geometry); assert.equal(mesh.material.uuid, material);
  assert.equal(mesh.material.uniforms.clipStart.value, arc.clipStart);
  assert.equal(mesh.material.uniforms.alpha.value, arc.alpha);
  assert.equal(mesh.material.depthTest, true); assert.equal(mesh.material.depthWrite, false);
  assert.match(mesh.material.fragmentShader, /distanceToArc/); assert.match(mesh.material.fragmentShader, /logdepthbuf_fragment/);
  mesh.geometry.dispose(); mesh.material.dispose();
});
test('sun takes one revolution per 30 simulated days, freezes in close-ups and never catches up faster', () => {
  const sun = new SunClock(); sun.update(0, 0, false);
  for (let frame = 1; frame <= 600; frame++) sun.update(frame / 20, 1000 / 60, false);
  assert.ok(Math.abs(sun.phase - 30) < 0.001);
  const held = sun.update(35, 1000, true); assert.equal(sun.phase, 30);
  assert.deepEqual(sun.update(40, 1000, true), held);
  sun.update(100, 1000, false); assert.ok(sun.phase - 30 <= 365 / 15 * 0.05);
  const year = new SunClock(); year.update(0, 0, false);
  for (let f = 1; f <= 900; f++) year.update(Math.floor(f / 2) * 365 / 450, 1000 / 60, false);
  assert.ok(year.phase > 364 && year.phase <= 365);
});
test('all 23 requested brands have local marks, including aliases and operational site labels', () => {
  assert.equal(Object.keys(BRANDS).length, 23);
  assert.equal(brandFor('Samsung Display · Asan'), BRANDS.Samsung);
  assert.equal(brandFor('Glencore · Kolwezi'), BRANDS.Glencore);
  assert.equal(brandFor('SUMCO'), BRANDS.Sumco);
});


test('dash distance follows ground projection despite the elevated curve', () => {
  class QuarterEarth extends Curve<Vector3> {
    getPoint(t: number, target = new Vector3()) {
      const angle = t * Math.PI / 2, radius = 100 * (1 + 0.3 * Math.sin(t * Math.PI));
      return target.set(radius * Math.sin(angle), 0, radius * Math.cos(angle));
    }
  }
  const mesh = new Mesh(new TubeGeometry(new QuarterEarth(), 64, 0.1, 4), new ShaderMaterial());
  const group = new Group(); group.add(mesh);
  const arc = { groundKm: Math.PI / 2 * 6371, ...arcLifecycle(900, 1800), __threeObjArc: group } as unknown as LiveArc;
  updateArcMaterials([arc], 100);
  const distance = mesh.geometry.getAttribute('groundDistance');
  assert.equal(distance.getX(0), 0);
  assert.ok(Math.abs(distance.getX(distance.count - 1) - Math.PI / 2 * 6371) < 1);
  for (let i = 1; i < distance.count; i++) assert.ok(distance.getX(i) >= distance.getX(i - 1));
  mesh.geometry.dispose(); mesh.material.dispose();
});
