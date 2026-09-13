import type { Mesh, Object3D } from 'three';
import type { SiteId } from './site-math.ts';

// Metres in the authored ENU frame, including the campus lift below.
export const CAMPUS_LIFT_METERS = 2;
export { CAMPUS_GROUND_METERS, HALL_FLOOR_METERS } from '../camera/primitives.ts';

/** Keep the satellite plate below the authored floor surfaces in both renderers. */
export function separateSiteSurfaces(root: Object3D, site: SiteId) {
  if (root.userData.cascadeSurfaces) return;
  root.userData.cascadeSurfaces = true;
  if (site !== 'apple-park') return;
  root.position.y += CAMPUS_LIFT_METERS;
  const replaced = new Set<import('three').Material>();
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.material) return;
    const plate = mesh.name === 'RegionalGround';
    const blend = mesh.name === 'RegisteredGroundColorBlend20';
    const floor = /^(AppleParkLandscapedCampus|CourtyardGround|GroundPlinth|RingPerimeterWalk)$/.test(mesh.name);
    if (plate) mesh.position.y -= .7;
    if (mesh.name === 'CourtyardGround') mesh.position.y += .8;
    mesh.renderOrder = plate ? 1 : blend ? 2 : floor ? 3 : 4;
    if (!plate && !blend && !floor) return;
    // Clone first: a shared ground material must not offset a wall or tree.
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => {
      const copy = material.clone(); replaced.add(material);
      copy.polygonOffset = true;
      copy.polygonOffsetFactor = plate ? 4 : blend ? 2 : -1;
      copy.polygonOffsetUnits = plate ? 4 : blend ? 2 : -1;
      copy.depthTest = true;
      copy.depthWrite = true;
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
  });
  // Dispose only replaced materials no longer referenced by another mesh.
  root.traverse(object=>{const mesh=object as Mesh;if(mesh.material)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])replaced.delete(m);});
  replaced.forEach(material=>material.dispose());
}
