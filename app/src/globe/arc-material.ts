import { Color, Float32BufferAttribute, Mesh, ShaderMaterial, Vector3 } from 'three';
import type { Group } from 'three';
import type { LiveArc } from './arc-pool.ts';
import { DASH_KM, GAP_KM, GROUND_RADIUS_KM } from './animation.ts';

/** Globe.gl owns the tube; stable per-tube uniforms own its visible interval and ground-distance dashes. */
export function updateArcMaterials(arcs: LiveArc[], radius: number) {
  for (const arc of arcs) {
    const group = (arc as LiveArc & { __threeObjArc?: Group }).__threeObjArc;
    const mesh = group?.children[0] as Mesh | undefined;
    if (!mesh) continue;
    // Measure the actual ground projection of each tube ring once, not its 3D length.
    const positions = mesh.geometry.getAttribute('position');
    if (positions && !mesh.geometry.getAttribute('groundDistance')) {
      const stride = ((mesh.geometry as unknown as { parameters?: { radialSegments: number } }).parameters?.radialSegments ?? 4) + 1;
      const distances: number[] = [], previous = new Vector3(); let km = 0;
      for (let ring = 0; ring < positions.count; ring += stride) {
        const center = new Vector3();
        for (let side = 0; side < stride - 1; side++) center.add(new Vector3().fromBufferAttribute(positions, ring + side));
        center.normalize();
        if (ring) km += Math.acos(Math.max(-1, Math.min(1, previous.dot(center)))) * GROUND_RADIUS_KM;
        for (let side = 0; side < stride; side++) distances.push(km);
        previous.copy(center);
      }
      mesh.geometry.setAttribute('groundDistance', new Float32BufferAttribute(distances, 1));
    }
    let material = mesh.material as ShaderMaterial;
    if (!material.userData.cascadeArc) {
      material.dispose();
      material = new ShaderMaterial({
        uniforms: {
          clipStart: { value: 0 }, clipEnd: { value: 0 }, alpha: { value: 0 },
          groundKm: { value: arc.groundKm }, phaseKm: { value: 0 }, radius: { value: radius },
          moneyColor: { value: new Color('#69e6c0') }, dashKm: { value: DASH_KM }, gapKm: { value: GAP_KM },
        },
        vertexShader: /* glsl */ `
          #include <common>
          #include <logdepthbuf_pars_vertex>
          attribute float relDistance;
          attribute float groundDistance;
          varying float vGroundKm;
          varying float vProgress;
          varying vec3 vWorldPosition;
          void main() {
            // three-globe's distance attribute is reversed: payer=1, payee=0.
            vProgress = 1.0 - relDistance;
            vGroundKm = groundDistance;
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorldPosition = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
            #include <logdepthbuf_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          #include <logdepthbuf_pars_fragment>
          uniform float clipStart, clipEnd, alpha, groundKm, phaseKm, radius, dashKm, gapKm;
          uniform vec3 moneyColor;
          varying float vGroundKm;
          varying float vProgress;
          varying vec3 vWorldPosition;
          void main() {
            if (vProgress < clipStart || vProgress > clipEnd || clipEnd <= clipStart) discard;
            // Analytic Earth occlusion is also active during the bloom render.
            vec3 ray = vWorldPosition - cameraPosition;
            float distanceToArc = length(ray);
            float b = dot(cameraPosition, normalize(ray));
            float discriminant = b*b - (dot(cameraPosition,cameraPosition) - radius*radius);
            if (discriminant >= 0.0) {
              float hit = -b - sqrt(discriminant);
              if (hit > 0.0 && hit < distanceToArc - 0.002) discard;
            }
            float pattern = mod(vGroundKm - phaseKm, dashKm + gapKm);
            // Sub-dash routes stay visible; longer routes use the same physical dash spacing.
            if (groundKm > dashKm && pattern > dashKm) discard;
            gl_FragColor = vec4(moneyColor, alpha);
            #include <logdepthbuf_fragment>
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        transparent: true, depthTest: true, depthWrite: false,
      });
      material.userData.cascadeArc = true; mesh.material = material; mesh.renderOrder = 3;
    }
    material.uniforms.clipStart.value = arc.clipStart;
    material.uniforms.clipEnd.value = arc.clipEnd;
    material.uniforms.alpha.value = arc.alpha;
    material.uniforms.phaseKm.value = arc.phaseKm;
  }
}
