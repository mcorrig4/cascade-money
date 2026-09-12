import { Matrix4, Quaternion, Vector3 } from 'three';
export const EARTH_METERS = 6_371_000;
export const SITES = {
  'apple-park': { lat: 37.3349, lng: -122.0090 },
  'fifth-avenue': { lat: 40.7638, lng: -73.9730 },
} as const;
export type SiteId = keyof typeof SITES;
export const metersToScene = (meters: number, radius: number) => meters * radius / EARTH_METERS;
/** Globe.gl axes; exported glTF +X east, +Y up, -Z true north. */
export function siteFrame(lat: number, lng: number, radius: number) {
  const phi = lat * Math.PI / 180, lambda = lng * Math.PI / 180;
  const up = new Vector3(Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda));
  const east = new Vector3(Math.cos(lambda), 0, -Math.sin(lambda));
  const north = new Vector3(-Math.sin(phi) * Math.sin(lambda), Math.cos(phi), -Math.sin(phi) * Math.cos(lambda));
  return { position: up.clone().multiplyScalar(radius), up, north, east,
    rotation: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(east, up, north.clone().negate())) };
}
export function sitePoint(site: SiteId, radius: number, east: number, height: number, north: number) {
  const f = siteFrame(SITES[site].lat, SITES[site].lng, radius), scale = metersToScene(1, radius);
  return f.position.addScaledVector(f.east, east * scale).addScaledVector(f.up, height * scale).addScaledVector(f.north, north * scale);
}
export function siteCamera(site: SiteId, radius: number, orbit = 0) {
  const campus = site === 'apple-park', distance = campus ? 910 : 35;
  const bearing = ((campus ? 155 : 135) + orbit) * Math.PI / 180;
  return { position: sitePoint(site, radius, Math.sin(bearing) * distance, campus ? 608 : 8, Math.cos(bearing) * distance),
    target: sitePoint(site, radius, campus ? -Math.cos(bearing) * 60 : 0, campus ? 8 : 12, campus ? -45 + Math.sin(bearing) * 60 : 0),
    up: siteFrame(SITES[site].lat, SITES[site].lng, radius).up };
}
export function siteSun(site: SiteId, radius: number) {
  const f = siteFrame(SITES[site].lat, SITES[site].lng, radius);
  const elevation = (site === 'apple-park' ? 32 : 3) * Math.PI / 180;
  // Southwest azimuth 225 degrees; the same vector lights the globe and model.
  return f.up.multiplyScalar(Math.sin(elevation)).addScaledVector(f.east, -Math.cos(elevation) / Math.SQRT2)
    .addScaledVector(f.north, -Math.cos(elevation) / Math.SQRT2).normalize();
}
export function nearSite(site: SiteId, lat: number, lng: number, altitude: number) {
  const a = siteFrame(lat, lng, 1).up, b = siteFrame(SITES[site].lat, SITES[site].lng, 1).up;
  return altitude < 0.002 && a.dot(b) > Math.cos(0.15 * Math.PI / 180);
}
