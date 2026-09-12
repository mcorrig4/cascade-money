import { Group, Material } from 'three';
import type { GlobeInstance } from 'globe.gl';
import type { Object3D, Mesh } from 'three';
import { metersToScene, nearSite, SITES, siteFrame } from './site-math.ts';
import type { SiteId } from './site-math.ts';

type Loaded = { root: Group; fade: number; materials: { material: Material; opacity: number; transparent: boolean; depthWrite: boolean }[]; release: () => void };
export function createSiteModels(globe: GlobeInstance, fallbacks: Record<SiteId, Object3D>, open = () => import('./load-site-model.ts')) {
  let disposed = false;
  const entries = (Object.keys(SITES) as SiteId[]).map(id => ({ id, wanted: false, pending: false, missing: false,
    loaded: undefined as Loaded | undefined, controller: undefined as AbortController | undefined }));
  async function load(entry: typeof entries[number]) {
    entry.pending = true; const controller = new AbortController(); entry.controller = controller;
    try {
      const { loadSiteModel, disposeModel } = await open();
      if (disposed || !entry.wanted) return;
      const scene = await loadSiteModel(`${(import.meta.env?.BASE_URL ?? '/')}models/${entry.id}.glb`, controller.signal);
      if (!scene) { if (!controller.signal.aborted) entry.missing = true; return; }
      if (disposed || !entry.wanted) { disposeModel(scene); return; }
      const root = new Group(), site = SITES[entry.id], frame = siteFrame(site.lat, site.lng, globe.getGlobeRadius());
      root.position.copy(frame.position); root.quaternion.copy(frame.rotation); root.scale.setScalar(metersToScene(1, globe.getGlobeRadius()));
      root.name = `Site model: ${entry.id}`; root.userData.skipBloom = true; root.add(scene);
      const unique = new Set<Material>();
      scene.traverse(object => { const mesh = object as Mesh; if (mesh.material) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) unique.add(m); });
      const materials = [...unique].map(material => ({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite }));
      materials.forEach(({ material }) => { material.opacity = 0; material.transparent = true; material.depthWrite = false; material.needsUpdate = true; });
      entry.loaded = { root, fade: 0, materials, release: () => disposeModel(root) };
      globe.scene().add(root);
    } catch (error) {
      if (!controller.signal.aborted) entry.missing = true; // Keep the local fallback for missing or invalid assets.
    } finally { entry.pending = false; entry.controller = undefined; }
  }
  return {
    update(lat: number, lng: number, altitude: number, elapsed: number) {
      for (const entry of entries) {
        entry.wanted = nearSite(entry.id, lat, lng, altitude);
        if (!entry.wanted) entry.controller?.abort();
        if (entry.wanted && !entry.loaded && !entry.pending && !entry.missing) void load(entry);
        const loaded = entry.loaded;
        if (loaded) {
          loaded.fade = Math.max(0, Math.min(1, loaded.fade + (entry.wanted ? 1 : -1) * elapsed / 300));
          for (const original of loaded.materials) {
            const { material } = original, full = loaded.fade === 1;
            const transparent = full ? original.transparent : true;
            if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
            material.opacity = original.opacity * loaded.fade; material.depthWrite = full && original.depthWrite;
          }
          if (!entry.wanted && loaded.fade === 0) { loaded.release(); entry.loaded = undefined; }
        }
        fallbacks[entry.id].visible = entry.wanted && (!entry.loaded || entry.loaded.fade < 1);
      }
    },
    status: () => entries.map(e => ({ id: e.id, pending: e.pending, missing: e.missing, loaded: !!e.loaded, fade: e.loaded?.fade ?? 0 })),
    dispose() { disposed = true; entries.forEach(e => { e.controller?.abort(); e.loaded?.release(); e.loaded = undefined; }); },
  };
}
