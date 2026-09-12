import {
  ACESFilmicToneMapping, AdditiveBlending, BufferGeometry, Color, DataTexture, Float32BufferAttribute,
  Mesh, Points, PointsMaterial, ShaderMaterial, SphereGeometry, SRGBColorSpace,
  TextureLoader, Vector3,
} from 'three';
import type { GlobeInstance } from 'globe.gl';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ArcBloomPass } from './selective-bloom.ts';

const vertexShader = /* glsl */ `
  varying vec2 vEarthUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vEarthUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
export function createEarthEffects(globe: GlobeInstance) {
  const loader = new TextureLoader();
  let disposed = false;
  const textures = new Set<import('three').Texture>();
  const pendingFrames = new Set<number>();
  let idle: number | undefined;
  const black = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  textures.add(black);
  const afterPaint = (run: () => void) => {
    const frame = requestAnimationFrame(() => {
      pendingFrames.delete(frame);
      const second = requestAnimationFrame(() => { pendingFrames.delete(second); if (!disposed) run(); });
      pendingFrames.add(second);
    }); pendingFrames.add(frame);
  };
  const load = (file: string, done: (texture: import('three').Texture) => void) => {
    const texture = loader.load(`${import.meta.env.BASE_URL}textures/${file}`, loaded => {
      if (disposed) { loaded.dispose(); return; }
      loaded.colorSpace = SRGBColorSpace;
      loaded.anisotropy = Math.min(4, globe.renderer().capabilities.getMaxAnisotropy());
      done(loaded);
    }); textures.add(texture);
  };
  const sunDirection = new Vector3(0.1, 0.35, -1).normalize();
  const earth = new ShaderMaterial({
    uniforms: { dayMap: { value: black }, nightMap: { value: black }, sunDirection: { value: sunDirection } },
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      varying vec2 vEarthUv;
      varying vec3 vWorldNormal;
      void main() {
        float sunDot = dot(normalize(vWorldNormal), normalize(sunDirection));
        float daylight = smoothstep(-0.12, 0.18, sunDot);
        vec3 surface = texture2D(dayMap, vEarthUv).rgb;
        vec3 lights = texture2D(nightMap, vEarthUv).rgb;
        // Keep the terminator soft, the ocean dark, and city lights on the night side only.
        vec3 dayColor = surface * (0.16 + 0.65 * max(sunDot, 0.0));
        vec3 nightColor = surface * 0.025 + lights * 0.8;
        gl_FragColor = vec4(mix(nightColor, dayColor, daylight), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  globe.globeMaterial(earth).showAtmosphere(false);
  earth.userData.textureStage = 'pending';
  afterPaint(() => load('earth-blue-marble-4k.jpg', low => {
    earth.uniforms.dayMap.value = low; earth.userData.textureStage = '4k';
    afterPaint(() => {
      const upgrade = () => {
        if (disposed) return;
        load('earth-night-4k.jpg', night => { earth.uniforms.nightMap.value = night; });
        // Devices capped at 4096 retain the fallback instead of resizing a larger upload.
        if (globe.renderer().capabilities.maxTextureSize >= 5400) load('earth-blue-marble-5400.jpg', high => {
          earth.uniforms.dayMap.value = high; earth.userData.textureStage = '5400';
          low.dispose(); textures.delete(low);
        });
      };
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(upgrade, { timeout: 2000 });
      else upgrade();
    });
  }));
  const atmosphereMaterial = new ShaderMaterial({
    uniforms: { sunDirection: { value: sunDirection } }, vertexShader,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
        float light = 0.25 + 0.75 * smoothstep(-0.4, 0.8, dot(normal, sunDirection));
        gl_FragColor = vec4(vec3(0.12, 0.38, 0.55), fresnel * light * 0.38);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `, transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const atmosphere = new Mesh(new SphereGeometry(globe.getGlobeRadius() * 1.007, 128, 64), atmosphereMaterial);
  atmosphere.userData.skipBloom = true;
  atmosphere.name = 'Cascade Fresnel atmosphere';
  globe.scene().add(atmosphere);
  // Fixed Fibonacci distribution: sparse, dim stars without a twinkling/random animation.
  const positions: number[] = [];
  for (let i = 0; i < 320; i++) {
    const y = 1 - (i + 0.5) / 160, radius = Math.sqrt(1 - y * y), angle = i * 2.399963229728653;
    positions.push(Math.cos(angle) * radius * 2600, y * 2600, Math.sin(angle) * radius * 2600);
  }
  const starsGeometry = new BufferGeometry(); starsGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const stars = new Points(starsGeometry, new PointsMaterial({ color: new Color('#72838f'), size: 0.8, sizeAttenuation: false, transparent: true, opacity: 0.36, depthWrite: false }));
  stars.name = 'Cascade stars'; globe.scene().add(stars);
  const renderer = globe.renderer(); renderer.toneMapping = ACESFilmicToneMapping;
  const bloom = new ArcBloomPass(renderer, globe.scene(), globe.camera());
  const output = new OutputPass(), composer = globe.postProcessingComposer();
  composer.addPass(bloom); composer.addPass(output);
  return {
    update(dayNumber: number, campusScale: boolean) {
      // A fixed UTC noon per calendar day; not tied to the host clock or playback speed.
      const declination = 23.44 * Math.sin(2 * Math.PI * (dayNumber + 172) / 365);
      const direction = globe.getCoords(declination, -150, 0);
      sunDirection.set(direction.x, direction.y, direction.z).normalize();
      atmosphere.visible = !campusScale; bloom.enabled = !campusScale;
    },
    dispose() {
      composer.removePass(bloom); composer.removePass(output); bloom.dispose(); output.dispose();
      globe.scene().remove(atmosphere, stars);
      atmosphere.geometry.dispose(); atmosphereMaterial.dispose(); starsGeometry.dispose(); stars.material.dispose();
      disposed = true; pendingFrames.forEach(cancelAnimationFrame);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      earth.dispose(); textures.forEach(texture => texture.dispose());
    },
  };
}
