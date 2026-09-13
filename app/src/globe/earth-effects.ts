import { EARTH_BACKGROUND, RenderReadiness, finishFirstFrame } from './readiness.ts';
import {
  AmbientLight, DirectionalLight, ACESFilmicToneMapping, AdditiveBlending, BufferGeometry, Color, DataTexture, Float32BufferAttribute,
  Mesh, Points, PointsMaterial, ShaderMaterial, SphereGeometry, SRGBColorSpace,
  TextureLoader, Vector3,
} from 'three';
import type { GlobeInstance } from 'globe.gl';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { siteFrame, SITES, metersToScene } from './site-math.ts';
import { SunClock } from './animation.ts';
import { ArcBloomPass } from './selective-bloom.ts';

const vertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vEarthUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vEarthUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`;
export function createEarthEffects(globe: GlobeInstance) {
  const loader = new TextureLoader();
  let disposed = false;
  const textures = new Set<import('three').Texture>();
  const gate = new RenderReadiness(60_000);
  const textureStatus: {name:string;decoded:boolean;uploaded:boolean}[] = [];
  let fullFrame = false;
  const black = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  textures.add(black);
  const load = async (name: string) => {
    const status = {name, decoded:false, uploaded:false}; textureStatus.push(status);
    const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}textures/${name}`);
    if (disposed) { texture.dispose(); throw new Error('Earth scene disposed'); }
    textures.add(texture);
    await (texture.image as HTMLImageElement).decode();
    if (disposed) throw new Error('Earth scene disposed');
    status.decoded = true;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(4, globe.renderer().capabilities.getMaxAnisotropy());
    globe.renderer().initTexture(texture);
    status.uploaded = true;
    return texture;
  };
  const sunDirection = new Vector3(0.1, 0.35, -1).normalize();
  const interior = siteFrame(SITES['fifth-avenue'].lat,SITES['fifth-avenue'].lng,globe.getGlobeRadius());
  const earth = new ShaderMaterial({
    uniforms: { interiorOpen:{value:false},interiorOrigin:{value:interior.position},interiorEast:{value:interior.east},interiorNorth:{value:interior.north},interiorScale:{value:metersToScene(1,globe.getGlobeRadius())}, dayMap: { value: black }, nightMap: { value: black }, sunDirection: { value: sunDirection }, shutterRadians:{value:0},rewindPhase:{value:0},rewindStrength:{value:0} },
    vertexShader,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform bool interiorOpen;
      uniform vec3 interiorOrigin;
      uniform vec3 interiorEast;
      uniform vec3 interiorNorth;
      uniform float interiorScale;
      varying vec3 vWorldPosition;
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      uniform float shutterRadians;
      uniform float rewindPhase;
      uniform float rewindStrength;
      varying vec2 vEarthUv;
      varying vec3 vWorldNormal;
      void main() {
        // Only the loaded, modeled hall has an opening through the base sphere.
        vec3 local = (vWorldPosition-interiorOrigin)/interiorScale;
        if(interiorOpen && abs(dot(local,interiorEast))<24.0 && abs(dot(local,interiorNorth))<21.0) discard;
        float sunDot = dot(normalize(vWorldNormal), normalize(sunDirection));
        float daylight = 0.0;
        float illumination = 0.0;
        // Integrate the moving terminator across a shutter interval instead of
        // displaying alternating unblurred day/night frames at rewind speed.
        for(int i=0;i<7;i++) {
          float a=(float(i)/6.0-0.5)*shutterRadians;
          vec3 d=vec3(cos(a)*sunDirection.x-sin(a)*sunDirection.z,sunDirection.y,sin(a)*sunDirection.x+cos(a)*sunDirection.z);
          float light=dot(normalize(vWorldNormal),normalize(d));
          daylight+=smoothstep(-0.12,0.18,light)/7.0;
          illumination+=max(light,0.0)/7.0;
        }
        vec3 surface = texture2D(dayMap, vEarthUv).rgb;
        vec3 lights = texture2D(nightMap, vEarthUv).rgb;
        // Keep the terminator soft, the ocean dark, and city lights on the night side only.
        vec3 dayColor = surface * (0.16 + 0.65 * illumination);
        vec3 nightColor = surface * 0.025 + lights * 0.8;
        vec3 color = mix(nightColor, dayColor, daylight);
        // One-sided trails sweep west in reverse, sampled only from film time.
        float streak = pow(1.0-fract(vEarthUv.x*12.0+rewindPhase), 9.0);
        float bands = pow(max(0.0,cos(vEarthUv.y*65.0)),18.0);
        color += vec3(0.25,0.7,0.8)*streak*bands*rewindStrength;
        gl_FragColor = vec4(color, 1.0);
        #include <logdepthbuf_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  earth.depthTest = true; earth.depthWrite = true;
  globe.globeMaterial(earth).showAtmosphere(false);
  earth.userData.textureStage = 'pending';
  // These are the only maps consumed by this shader. Select the final day map
  // up front: no idle-time quality or night-map swap after recording starts.
  const dayFile = globe.renderer().capabilities.maxTextureSize >= 5400 ? 'earth-blue-marble-5400.jpg' : 'earth-blue-marble-4k.jpg';
  const maps = Promise.all([load(dayFile), load('earth-night-4k.jpg')]);
  const atmosphereMaterial = new ShaderMaterial({
    uniforms: { sunDirection: { value: sunDirection }, shutterRadians:{value:0},rewindPhase:{value:0},rewindStrength:{value:0} }, vertexShader,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 sunDirection;
      uniform float shutterRadians;
      uniform float rewindPhase;
      uniform float rewindStrength;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
        float light = 0.25 + 0.75 * smoothstep(-0.4, 0.8, dot(normal, sunDirection));
        gl_FragColor = vec4(vec3(0.12, 0.38, 0.55), fresnel * light * 0.38);
        #include <logdepthbuf_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `, transparent: true, depthTest: true, depthWrite: false, blending: AdditiveBlending,
  });
  const atmosphere = new Mesh(new SphereGeometry(globe.getGlobeRadius() * 1.007, 128, 64), atmosphereMaterial);
  atmosphere.renderOrder = 1;
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
  const contextLost=()=>gate.fail(new Error('WebGL context lost before Earth readiness'));
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  const bloom = new ArcBloomPass(renderer, globe.scene(), globe.camera());
  const output = new OutputPass(), composer = globe.postProcessingComposer();
  composer.addPass(bloom);composer.addPass(output);
  const sunClock = new SunClock();
  const previousLights = globe.lights();
  const ambient = new AmbientLight('#c8d6e8', 0.75), sunlight = new DirectionalLight('#fff0d9', 3);
  globe.lights([ambient, sunlight]);
  void maps.then(([day, night]) => {
    if (disposed) return;
    earth.uniforms.dayMap.value = day; earth.uniforms.nightMap.value = night;
    globe.backgroundColor(EARTH_BACKGROUND);
    renderer.setClearColor(EARTH_BACKGROUND, 1);
    globe.scene().updateMatrixWorld(true);
    // Explicitly complete the same full-screen postprocessing render used by
    // playback, including texture uploads. No timing heuristic counts as ready.
    const previousShaderError = renderer.debug.onShaderError;
    renderer.debug.onShaderError = () => { throw new Error('Earth frame shader compilation failed'); };
    try { finishFirstFrame(()=>composer.render(0),renderer.getContext()); }
    finally { renderer.debug.onShaderError = previousShaderError; }
    fullFrame = true;
    earth.userData.textureStage = dayFile.includes('5400') ? '5400' : '4k';
    gate.finish();
  }).catch(error => { earth.userData.textureStage = 'failed'; gate.fail(error instanceof Error ? error : new Error(String(error))); });
  return {
    ready: () => gate.promise,
    setInterior: (open:boolean) => {earth.uniforms.interiorOpen.value=open;},
    readiness: () => ({textures:textureStatus.map(s=>({...s})),fullFrame,background:EARTH_BACKGROUND}),
    update(position: number, elapsed: number, campusScale: boolean, holdSun: boolean, shotSun?: Vector3, dusk = false, timelapse?:{days:number;direction:number;duration:number;elapsed:number}|null, scripted=false) {
      const sun = scripted ? {lng:-150-position*360/30,lat:23.44*Math.sin(2*Math.PI*(position+172)/365)} : sunClock.update(position, elapsed, holdSun);
      const sweeping=!!timelapse && timelapse.elapsed<timelapse.duration;

      earth.uniforms.shutterRadians.value=sweeping?2.8:0;
      earth.uniforms.rewindPhase.value=(timelapse?.elapsed??0)/160;
      earth.uniforms.rewindStrength.value=sweeping?.65:0;
      const rewindLng=sun.lng;
      const direction = globe.getCoords(sun.lat,rewindLng,0);
      earth.userData.sunLongitude = rewindLng;
      sunDirection.set(direction.x, direction.y, direction.z).normalize();
      if (shotSun) sunDirection.copy(shotSun);
      sunlight.position.copy(sunDirection).multiplyScalar(globe.getGlobeRadius() * 4);
      sunlight.color.set(dusk ? '#ffc48e' : '#fff0d9'); sunlight.intensity = dusk ? 1.6 : 3;
      atmosphere.visible = !campusScale; bloom.enabled = !campusScale;
    },
    dispose() {
      renderer.domElement.removeEventListener('webglcontextlost',contextLost);
      globe.lights(previousLights);
      composer.removePass(bloom); composer.removePass(output); bloom.dispose(); output.dispose();
      globe.scene().remove(atmosphere, stars);
      atmosphere.geometry.dispose(); atmosphereMaterial.dispose(); starsGeometry.dispose(); stars.material.dispose();
      disposed = true; gate.fail(new Error('Earth scene disposed before readiness'));
      earth.dispose(); textures.forEach(texture => texture.dispose());
    },
  };
}
