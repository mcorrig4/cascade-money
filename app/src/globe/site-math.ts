import { Matrix4, Quaternion, Vector3 } from 'three';
export const EARTH_METERS = 6_371_000;
export const WGS84_A = 6_378_137;
export const WGS84_E2 = 6.69437999014e-3;
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
export function siteLocalCamera(site: SiteId, orbit = 0) {
  const campus = site === 'apple-park';
  // The campus follows the validated northwest Blender view. Fifth Avenue follows
  // the centered Fifth Avenue elevation from the west side of the avenue,
  // putting the GM tower directly behind the cube as in the reference.
  const distance = campus ? 1000 : 48;
  const bearing = ((campus ? -43 : 270) + orbit) * Math.PI / 180;
  return {
    position: new Vector3(Math.sin(bearing) * distance, campus ? 600 : 5.2, -Math.cos(bearing) * distance),
    target: new Vector3(0, campus ? 12 : 7.4, 0),
    up: new Vector3(0, 1, 0),
    fov: campus ? 45 : 38,
  };
}
export function siteCamera(site: SiteId, radius: number, orbit = 0) {
  const local = siteLocalCamera(site, orbit);
  return { position: sitePoint(site, radius, local.position.x, local.position.y, -local.position.z),
    target: sitePoint(site, radius, local.target.x, local.target.y, -local.target.z),
    up: siteFrame(SITES[site].lat, SITES[site].lng, radius).up, fov: local.fov };
}

const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Shot 1: a low architectural orbit, descent, then a true arch fly-through. */
export function appleParkShotCamera(radius: number, elapsed: number) {
  let position: Vector3, target: Vector3, fov: number;
  if (elapsed < 6.5) {
    const t = ease(elapsed / 6.5), bearing = (-48 + 118 * t) * Math.PI / 180;
    const distance = 430 - 55 * t;
    position = new Vector3(Math.sin(bearing) * distance, 115 - 32 * t, -Math.cos(bearing) * distance);
    target = new Vector3(-2, 9, 2); fov = 47;
  } else if (elapsed < 10) {
    const t = ease((elapsed - 6.5) / 3.5), bearing = 70 * Math.PI / 180;
    const orbitEnd = new Vector3(Math.sin(bearing) * 375, 83, -Math.cos(bearing) * 375);
    position = orbitEnd.lerp(new Vector3(-4, 7.5, 78), t);
    target = new Vector3(-2, 9, 2).lerp(new Vector3(-4, 9.2, 4), t);
    fov = 47 + 3 * t;
  } else {
    const t = ease((elapsed - 10) / 3.7);
    position = new Vector3(-4, 7.5, 78 - 112 * t);
    target = new Vector3(-4, 8.3, position.z - 52);
    fov = 50;
  }
  return {
    position: sitePoint('apple-park', radius, position.x, position.y, -position.z),
    target: sitePoint('apple-park', radius, target.x, target.y, -target.z),
    up: siteFrame(SITES['apple-park'].lat, SITES['apple-park'].lng, radius).up,
    fov,
  };
}

interface LocalPose { position: Vector3; target: Vector3; fov: number }

const fifthPose = (position: [number, number, number], target: [number, number, number], fov: number): LocalPose => ({
  position: new Vector3(...position), target: new Vector3(...target), fov,
});

const interpolatePose = (from: LocalPose, to: LocalPose, amount: number): LocalPose => {
  const t = ease(amount);
  return {
    position: from.position.clone().lerp(to.position, t),
    target: from.target.clone().lerp(to.target, t),
    fov: from.fov + (to.fov - from.fov) * t,
  };
};

// Poses are the approved Blender review cameras transformed into the final ENU
// model convention after the Fifth Avenue asset's -90 degree registration turn.
export const FIFTH_AVENUE_POSES = {
  street: fifthPose([-31, 5.3, -8], [0, 5, 0], 38),
  cube: fifthPose([-8.2, 4.2, 2.4], [0, 2.2, 0], 52),
  descentTop: fifthPose([-2.85, 1.45, 3.2], [0.85, -3.75, -1.25], 58),
  descentMid: fifthPose([2.05, -2.25, 3.65], [-0.7, -5.65, -0.8], 54),
  hall: fifthPose([-10.5, -4.85, 12], [0, -0.8, 0], 47),
} as const;

/** Shot 10: street context, pass through the cube, spiral descent, hall hold. */
export function fifthAvenueShotCamera(radius: number, elapsed: number) {
  let pose: LocalPose;
  if (elapsed < 2.7) pose = FIFTH_AVENUE_POSES.street;
  else if (elapsed < 3.6) pose = interpolatePose(FIFTH_AVENUE_POSES.street, FIFTH_AVENUE_POSES.cube, (elapsed - 2.7) / .9);
  else if (elapsed < 4.65) pose = interpolatePose(FIFTH_AVENUE_POSES.cube, FIFTH_AVENUE_POSES.descentTop, (elapsed - 3.6) / 1.05);
  else if (elapsed < 5.85) pose = interpolatePose(FIFTH_AVENUE_POSES.descentTop, FIFTH_AVENUE_POSES.descentMid, (elapsed - 4.65) / 1.2);
  else if (elapsed < 7.15) pose = interpolatePose(FIFTH_AVENUE_POSES.descentMid, FIFTH_AVENUE_POSES.hall, (elapsed - 5.85) / 1.3);
  else pose = FIFTH_AVENUE_POSES.hall;
  return {
    position: sitePoint('fifth-avenue', radius, pose.position.x, pose.position.y, -pose.position.z),
    target: sitePoint('fifth-avenue', radius, pose.target.x, pose.target.y, -pose.target.z),
    up: siteFrame(SITES['fifth-avenue'].lat, SITES['fifth-avenue'].lng, radius).up,
    fov: pose.fov,
  };
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

/** WGS84 ECEF metres used by Google Photorealistic 3D Tiles. */
export function geodeticToEcef(lat: number, lng: number, height = 0) {
  const phi = lat * Math.PI / 180, lambda = lng * Math.PI / 180;
  const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);
  return new Vector3(
    (n + height) * cosPhi * Math.cos(lambda),
    (n + height) * cosPhi * Math.sin(lambda),
    (n * (1 - WGS84_E2) + height) * sinPhi,
  );
}

/** ECEF to the model convention: +X east, +Y up, -Z north. */
export function ecefToSiteMatrix(lat: number, lng: number, height = 0) {
  const phi = lat * Math.PI / 180, lambda = lng * Math.PI / 180;
  const east = new Vector3(-Math.sin(lambda), Math.cos(lambda), 0);
  const up = new Vector3(Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi));
  const south = new Vector3(Math.sin(phi) * Math.cos(lambda), Math.sin(phi) * Math.sin(lambda), -Math.cos(phi));
  return new Matrix4().makeBasis(east, up, south).setPosition(geodeticToEcef(lat, lng, height)).invert();
}

/** Convert globe.gl world units into the same local-metre frame as the site GLB. */
export function globePointToSite(site: SiteId, radius: number, point: Vector3) {
  const frame = siteFrame(SITES[site].lat, SITES[site].lng, radius);
  const delta = point.clone().sub(frame.position), scale = EARTH_METERS / radius;
  return new Vector3(delta.dot(frame.east) * scale, delta.dot(frame.up) * scale, -delta.dot(frame.north) * scale);
}

export function globeDirectionToSite(site: SiteId, direction: Vector3) {
  const frame = siteFrame(SITES[site].lat, SITES[site].lng, 1);
  return new Vector3(direction.dot(frame.east), direction.dot(frame.up), -direction.dot(frame.north)).normalize();
}
