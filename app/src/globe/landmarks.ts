import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import type { GlobeInstance } from 'globe.gl';

export const FIFTH_AVENUE = { lat: 40.7637, lng: -73.9723, altitude: 0.000012 };

export function createFifthAvenueCube(globe: GlobeInstance) {
  const group = new Group(), radius = globe.getGlobeRadius(), scale = radius / 6_371_000;
  const position = globe.getCoords(FIFTH_AVENUE.lat, FIFTH_AVENUE.lng, 0.000001);
  group.position.set(position.x, position.y, position.z);
  group.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), group.position.clone().normalize());
  const plaza = new Mesh(new PlaneGeometry(100 * scale, 100 * scale), new MeshBasicMaterial({ color: '#293943', side: 2 }));
  const cubeGeometry = new BoxGeometry(12 * scale, 12 * scale, 12 * scale);
  const cube = new Mesh(cubeGeometry, new MeshBasicMaterial({ color: '#8ac9ce', transparent: true, opacity: 0.3, depthWrite: false }));
  cube.position.z = 6 * scale;
  const edges = new LineSegments(new EdgesGeometry(cubeGeometry), new LineBasicMaterial({ color: '#d4efed', transparent: true, opacity: 0.9 }));
  cube.add(edges); group.add(plaza, cube); group.name = 'Fifth Avenue glass cube';
  globe.scene().add(group);
  return { group, dispose() { globe.scene().remove(group); plaza.geometry.dispose(); plaza.material.dispose(); cubeGeometry.dispose(); cube.material.dispose(); edges.geometry.dispose(); edges.material.dispose(); } };
}
