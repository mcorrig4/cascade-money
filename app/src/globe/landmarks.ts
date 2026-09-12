import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { siteFrame } from './site-math.ts';
import type { GlobeInstance } from 'globe.gl';

export const FIFTH_AVENUE = { lat: 40.7638, lng: -73.9730, altitude: 0.000012 };

export function createFifthAvenueCube(globe: GlobeInstance) {
  const group = new Group(), radius = globe.getGlobeRadius(), scale = radius / 6_371_000;
  const frame = siteFrame(FIFTH_AVENUE.lat, FIFTH_AVENUE.lng, radius);
  group.position.copy(frame.position).addScaledVector(frame.up, 0.1 * scale);
  group.quaternion.copy(frame.rotation);
  const plaza = new Mesh(new PlaneGeometry(100 * scale, 100 * scale), new MeshBasicMaterial({ color: '#293943', side: 2 }));
  plaza.rotation.x = -Math.PI / 2;
  const cubeGeometry = new BoxGeometry(12 * scale, 12 * scale, 12 * scale);
  const cube = new Mesh(cubeGeometry, new MeshBasicMaterial({ color: '#8ac9ce', transparent: true, opacity: 0.3, depthWrite: false }));
  cube.position.y = 6 * scale;
  const edges = new LineSegments(new EdgesGeometry(cubeGeometry), new LineBasicMaterial({ color: '#d4efed', transparent: true, opacity: 0.9 }));
  cube.add(edges); group.add(plaza, cube); group.name = 'Fifth Avenue glass cube';
  globe.scene().add(group);
  return { group, dispose() { globe.scene().remove(group); plaza.geometry.dispose(); plaza.material.dispose(); cubeGeometry.dispose(); cube.material.dispose(); edges.geometry.dispose(); edges.material.dispose(); } };
}
