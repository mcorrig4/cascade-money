// This entire module (including both loaders) is imported only on a site approach.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { BufferGeometry, Material, Texture } from 'three';
import type { Object3D, Mesh, InstancedMesh, SkinnedMesh } from 'three';
export function disposeModel(root: Object3D) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  root.traverse(object => {
    const mesh = object as Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    if ((object as InstancedMesh).isInstancedMesh) (object as InstancedMesh).dispose();
    if ((object as SkinnedMesh).isSkinnedMesh) (object as SkinnedMesh).skeleton.dispose();
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) { texture.dispose(); const image = texture.source.data; if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close(); }
  geometries.forEach(geometry => geometry.dispose()); root.removeFromParent();
}
export async function loadSiteModel(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const data = await response.arrayBuffer();
  if (signal.aborted) return null;
  const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`).setWorkerLimit(2);
  try {
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const gltf = await loader.parseAsync(data, url.slice(0, url.lastIndexOf('/') + 1));
    if (signal.aborted) { disposeModel(gltf.scene); return null; }
    return gltf.scene;
  } finally { draco.dispose(); }
}
