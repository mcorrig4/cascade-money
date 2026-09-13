import {BufferGeometry, Color, Float32BufferAttribute, LineBasicMaterial, LineLoop, Vector3} from 'three';
import type {GlobeInstance} from 'globe.gl';

export interface TimedRing {
  id: number; lat: number; lng: number; color: string; age: number; life: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** A bounded, explicitly sampled replacement for globe.gl's wall-clock ring ticker. */
export class PulseRingLayer {
  private readonly active = new Map<number, LineLoop>();
  constructor(private readonly globe: GlobeInstance) {}

  update(rings: TimedRing[]) {
    const wanted = new Set(rings.map(ring => ring.id));
    for (const [id, line] of this.active) if (!wanted.has(id)) {
      line.removeFromParent(); line.geometry.dispose(); (line.material as LineBasicMaterial).dispose(); this.active.delete(id);
    }
    const globeRadius = this.globe.getGlobeRadius();
    for (const ring of rings) {
      let line = this.active.get(ring.id);
      if (!line) {
        line = new LineLoop(new BufferGeometry(), new LineBasicMaterial({color: new Color(ring.color), transparent: true, depthTest: true, depthWrite: false}));
        line.renderOrder = 4; line.userData.skipBloom = true; line.name = `Cascade pulse ${ring.id}`;
        this.globe.scene().add(line); this.active.set(ring.id, line);
      }
      const progress = smooth(ring.age / ring.life), angle = (0.04 + 1.06 * progress) * Math.PI / 180;
      const center = this.globe.getCoords(ring.lat, ring.lng, 0.0008), up = new Vector3(center.x, center.y, center.z).normalize();
      const east = new Vector3(0, 1, 0).cross(up).normalize(), north = up.clone().cross(east).normalize();
      const positions: number[] = [];
      for (let i = 0; i < 64; i++) {
        const theta = i / 64 * Math.PI * 2;
        const point = up.clone().multiplyScalar(globeRadius * Math.cos(angle) * 1.0008)
          .addScaledVector(east, globeRadius * Math.sin(angle) * Math.cos(theta))
          .addScaledVector(north, globeRadius * Math.sin(angle) * Math.sin(theta));
        positions.push(point.x, point.y, point.z);
      }
      line.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const material = line.material as LineBasicMaterial; material.color.set(ring.color); material.opacity = 1 - progress;
    }
  }

  dispose() { this.update([]); }
}
