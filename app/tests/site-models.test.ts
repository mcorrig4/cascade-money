import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { EARTH_METERS, ecefToSiteMatrix, geodeticToEcef, globePointToSite, metersToScene, nearSite, SITES, siteFrame, sitePoint, siteCamera, siteLocalCamera, siteSun } from '../src/globe/site-math.ts';
import { disposeModel } from '../src/globe/load-site-model.ts';
const near = (a: number, b: number, epsilon = 1e-10) => assert.ok(Math.abs(a-b) < epsilon, `${a} != ${b}`);
test('meters convert linearly using the actual globe radius', () => {
  near(metersToScene(EARTH_METERS,100),100);
  near(metersToScene(1,200),2*metersToScene(1,100));
  near(metersToScene(0,100),0);
});
test('site origins lie on sphere; +Y is radial, -Z is geographic north, +X east', () => {
  for (const site of [...Object.values(SITES), {lat:0,lng:0}, {lat:0,lng:180}, {lat:89,lng:-45}]) {
    const frame = siteFrame(site.lat,site.lng,100);
    near(frame.position.length(),100);
    near(new Vector3(0,1,0).applyQuaternion(frame.rotation).distanceTo(frame.up),0);
    near(new Vector3(0,0,-1).applyQuaternion(frame.rotation).distanceTo(frame.north),0);
    near(new Vector3(1,0,0).applyQuaternion(frame.rotation).distanceTo(frame.east),0);
    const northStep = siteFrame(site.lat+.00001,site.lng,100).position.sub(frame.position).normalize();
    assert.ok(northStep.dot(frame.north) > .999999);
    near(frame.east.clone().cross(frame.up).dot(frame.north),-1);
  }
  near(siteFrame(0,0,100).position.distanceTo(new Vector3(0,0,100)),0);
  near(siteFrame(0,90,100).position.distanceTo(new Vector3(100,0,0)),0);
});
test('local camera and lighting use real height, true north and southwest sun', () => {
  for (const id of Object.keys(SITES) as (keyof typeof SITES)[]) {
    const frame=siteFrame(SITES[id].lat,SITES[id].lng,100), pose=siteCamera(id,100), sun=siteSun(id,100);
    near(sitePoint(id,100,0,0,0).distanceTo(frame.position),0);
    near(pose.position.clone().sub(frame.position).dot(frame.up),metersToScene(id==='apple-park'?600:5.5,100));
    if (id === 'fifth-avenue') {
      const offset = pose.position.clone().sub(frame.position);
      near(Math.hypot(offset.dot(frame.east), offset.dot(frame.north)), metersToScene(42,100));
      assert.ok(pose.target.clone().sub(pose.position).dot(frame.up) > 0, 'Cube view looks slightly upward');
      assert.ok(offset.dot(frame.east) < 0 && offset.dot(frame.north) < 0, 'Cube camera is southwest so the tower sits behind it');
    }
    assert.ok(sun.dot(frame.east)<0 && sun.dot(frame.north)<0 && sun.dot(frame.up)>0);
    assert.ok(nearSite(id,SITES[id].lat,SITES[id].lng,.0001));
    assert.equal(nearSite(id,SITES[id].lat,SITES[id].lng,1),false);
    assert.equal(nearSite(id,-SITES[id].lat,SITES[id].lng+180,.0001),false);
  }
});
test('WGS84 ECEF converts to the model ENU convention at both hero sites', () => {
  for (const site of Object.values(SITES)) {
    const phi=site.lat*Math.PI/180, lambda=site.lng*Math.PI/180;
    const origin=geodeticToEcef(site.lat,site.lng), matrix=ecefToSiteMatrix(site.lat,site.lng);
    const east=new Vector3(-Math.sin(lambda),Math.cos(lambda),0);
    const up=new Vector3(Math.cos(phi)*Math.cos(lambda),Math.cos(phi)*Math.sin(lambda),Math.sin(phi));
    const north=new Vector3(-Math.sin(phi)*Math.cos(lambda),-Math.sin(phi)*Math.sin(lambda),Math.cos(phi));
    near(origin.clone().applyMatrix4(matrix).length(),0,1e-6);
    near(origin.clone().addScaledVector(east,25).applyMatrix4(matrix).distanceTo(new Vector3(25,0,0)),0,1e-6);
    near(origin.clone().addScaledVector(up,12).applyMatrix4(matrix).distanceTo(new Vector3(0,12,0)),0,1e-6);
    near(origin.clone().addScaledVector(north,40).applyMatrix4(matrix).distanceTo(new Vector3(0,0,-40)),0,1e-6);
  }
});
test('globe and local hero cameras map into the same metre frame', () => {
  for (const id of Object.keys(SITES) as (keyof typeof SITES)[]) {
    const local=siteLocalCamera(id), globe=siteCamera(id,100);
    near(globePointToSite(id,100,globe.position).distanceTo(local.position),0,1e-6);
    near(globePointToSite(id,100,globe.target).distanceTo(local.target),0,1e-6);
  }
});
test('shared model resources dispose once and the model detaches', () => {
  const scene=new Group(), root=new Group(), geometry=new BoxGeometry(), material=new MeshBasicMaterial();
  root.add(new Mesh(geometry,material),new Mesh(geometry,material)); scene.add(root);
  let geometries=0,materials=0;
  geometry.addEventListener('dispose',()=>geometries++); material.addEventListener('dispose',()=>materials++);
  disposeModel(root);
  assert.equal(geometries,1); assert.equal(materials,1); assert.equal(scene.children.length,0);
});
test('site LOD stays lazy, fades in 300ms, unloads between visits and preserves missing fallback', async () => {
  const { createSiteModels } = await import('../src/globe/site-models.ts');
  const scene = new Group(), fallbacks = { 'apple-park':new Group(), 'fifth-avenue':new Group() };
  let requests=0, disposals=0;
  const globe = { getGlobeRadius:()=>100, scene:()=>scene } as unknown as import('globe.gl').GlobeInstance;
  const models=createSiteModels(globe,fallbacks,async()=>({
    loadSiteModel:async()=>{ requests++; const root=new Group(); root.add(new Mesh(new BoxGeometry(),new MeshBasicMaterial())); return root; },
    disposeModel:root=>{ disposals++; disposeModel(root); },
  }));
  const visit=()=>models.update(SITES['apple-park'].lat,SITES['apple-park'].lng,.0001,150);
  models.update(0,0,2,300); assert.equal(requests,0);
  for(let i=0;i<3;i++) {
    visit(); await new Promise(resolve=>setImmediate(resolve)); visit();
    assert.equal(models.status()[0].fade,.5); assert.equal(fallbacks['apple-park'].visible,true);
    visit(); assert.equal(models.status()[0].fade,1); assert.equal(fallbacks['apple-park'].visible,false);
    models.update(0,0,2,300); assert.equal(scene.children.length,0);
  }
  models.dispose(); assert.equal(requests,3); assert.equal(disposals,3);
  const missing=createSiteModels(globe,fallbacks,async()=>({loadSiteModel:async()=>null,disposeModel}));
  missing.update(SITES['apple-park'].lat,SITES['apple-park'].lng,.0001,300);
  await new Promise(resolve=>setImmediate(resolve));
  missing.update(SITES['apple-park'].lat,SITES['apple-park'].lng,.0001,300);
  assert.equal(missing.status()[0].missing,true); assert.equal(fallbacks['apple-park'].visible,true);
  missing.dispose();
});
