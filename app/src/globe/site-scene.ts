import {
  ACESFilmicToneMapping, AmbientLight, Box3, Color, DirectionalLight, DoubleSide, Group,
  Mesh, PerspectiveCamera, PMREMGenerator, Scene,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import type { Material, MeshPhysicalMaterial, Object3D, Texture } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import { ReorientationPlugin, TileCompressionPlugin } from '3d-tiles-renderer/three/plugins';
import type { PlaybackState } from '../playback/engine.ts';
import { disposeModel, loadSiteModel } from './load-site-model.ts';
import { globeDirectionToSite, globePointToSite, SITES } from './site-math.ts';
import type { SiteId } from './site-math.ts';
import { canUseTiles, enoughTiles, fetchOptionalTile, tileOpacity, tilePlan } from './tiles-policy.ts';
import { EARTH_BACKGROUND } from './readiness.ts';
import { CAMPUS_LIFT_METERS, separateSiteSurfaces } from './site-surfaces.ts';

const ROOT_TILESET = 'https://tile.googleapis.com/v1/3dtiles/root.json';
const MODEL_LIFT: Record<SiteId, number> = { 'apple-park': 0.18, 'fifth-avenue': 0.08 };
const SITE_GRADE: Record<SiteId, number> = { 'apple-park': 12.5, 'fifth-avenue': 2.56 };
// Both final exports are authored in metres and registered to their ENU origins.
const SITE_MODEL_SCALE: Record<SiteId, number> = { 'apple-park': 587 / 571, 'fifth-avenue': 1 };
const FIFTH_CLIP_HALF_EXTENT = 6.15;

export interface SiteSceneFrame {
  state: PlaybackState;
  lat: number;
  lng: number;
  altitude: number;
  globeRadius: number;
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  cameraUp: Vector3;
  fov: number;
  recording: boolean;
}

export interface SiteSceneStatus {
  site: SiteId | null;
  ready: boolean;
  failed: boolean;
  progress: number;
  visibleTiles: number;
  opacity: number;
  ground: number | null;
  modelSize: [number, number, number] | null;
  tileBounds: [number, number, number, number, number, number] | null;
}

export interface SiteSceneController {
  update(frame: SiteSceneFrame, elapsed: number): SiteSceneStatus;
  status(): SiteSceneStatus;
  releaseFallback(): void;
  dispose(): void;
}

function tuneModel(root: Object3D, environment: Texture, site: SiteId) {
  const tuned = new Set<Material>();
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.material) return;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[];
    for (const material of materials) {
      const physical = material as MeshPhysicalMaterial;
      if (tuned.has(material)) continue;
      tuned.add(material);
      if ('envMapIntensity' in physical) physical.envMapIntensity = Math.max(physical.envMapIntensity ?? 0, 1.15);
      if ('transmission' in physical && physical.transmission > 0.5) {
        physical.envMap = environment;
        physical.envMapIntensity = site === 'fifth-avenue' ? 2.6 : 1.8;
        physical.opacity = site === 'fifth-avenue' ? 0.14 : Math.max(physical.opacity, 0.2);
        physical.transmission = site === 'fifth-avenue' ? 0.94 : physical.transmission;
        physical.thickness = site === 'fifth-avenue' ? 0.06 : physical.thickness;
        physical.roughness = Math.min(physical.roughness, site === 'fifth-avenue' ? 0.035 : 0.08);
        physical.side = DoubleSide;
        physical.depthWrite = false;
        physical.transparent = true;
      }
      if (site === 'fifth-avenue' && /GlassPanel_|Entrance_door/.test(object.name)) {
        physical.color.set('#a9d7e2');
        physical.opacity = 0.24;
        physical.transmission = 0.78;
        physical.roughness = 0.075;
        physical.envMapIntensity = 4.2;
      }
      if (site === 'fifth-avenue' && /glass_(joint|edge)|Cube_(vertical|roof)_edge/i.test(object.name)) {
        if ('emissive' in physical) physical.emissive.set('#9bd6e8');
        if ('emissiveIntensity' in physical) physical.emissiveIntensity = Math.max(physical.emissiveIntensity, 1.1);
      }
      if (site === 'fifth-avenue' && /Apple_Plaza|Paving_joint|Fifth_Avenue_step/.test(object.name)) {
        if ('color' in physical) physical.color.multiplyScalar(0.68);
        physical.roughness = Math.max(physical.roughness, 0.72);
      }
      if (site === 'apple-park' && object.name === 'AppleParkLandscapedCampus') {
        // Seven surveyed campus vertices from the final Blender registration.
        // Signed edge distance keeps the authored surface opaque under the site,
        // then feathers inward over 24 metres into Google's surrounding tiles.
        material.transparent = true;
        material.depthWrite = true;
        material.onBeforeCompile = shader => {
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeGroundPosition;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCascadeGroundPosition = position;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeGroundPosition;')
            .replace('#include <dithering_fragment>', `
              vec2 p = vCascadeGroundPosition.xz;
              vec2 v0=vec2(-335.,-300.), v1=vec2(315.,-300.), v2=vec2(335.,-235.);
              vec2 v3=vec2(330.,455.), v4=vec2(245.,540.), v5=vec2(-190.,555.), v6=vec2(-335.,430.);
              float d=dot(p-v0,p-v0); float s=1.0; vec2 a=v6; vec2 b=v0;
              #define CASCADE_EDGE(A,B) { vec2 e=(B)-(A); vec2 w=p-(A); vec2 q=w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0); d=min(d,dot(q,q)); bool c1=p.y>=(A).y; bool c2=p.y<(B).y; bool c3=e.x*w.y>e.y*w.x; if(all(bvec3(c1,c2,c3))||all(bvec3(!c1,!c2,!c3))) s=-s; }
              CASCADE_EDGE(a,b) a=v0; b=v1; CASCADE_EDGE(a,b) a=v1; b=v2; CASCADE_EDGE(a,b)
              a=v2; b=v3; CASCADE_EDGE(a,b) a=v3; b=v4; CASCADE_EDGE(a,b)
              a=v4; b=v5; CASCADE_EDGE(a,b) a=v5; b=v6; CASCADE_EDGE(a,b)
              #undef CASCADE_EDGE
              float signedDistance=s*sqrt(d);
              float cascadeGroundFade=1.0-smoothstep(-24.0,0.0,signedDistance);
              gl_FragColor.a *= cascadeGroundFade;
              if (gl_FragColor.a < 0.015) discard;
              #include <dithering_fragment>
            `);
        };
        material.customProgramCacheKey = () => 'cascade-ground-survey-feather-v3';
      }
      if (site === 'apple-park' && object.name === 'RegionalGround') {
        physical.emissive.set('#33452b');
        physical.emissiveIntensity = Math.max(physical.emissiveIntensity, 0.7);
        material.transparent = true;
        material.depthWrite = true;
        material.onBeforeCompile = shader => {
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeExtendedGroundPosition;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCascadeExtendedGroundPosition = position;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeExtendedGroundPosition;')
            .replace('#include <dithering_fragment>', `
              float cascadeOuterEdge=max(abs(vCascadeExtendedGroundPosition.x),abs(vCascadeExtendedGroundPosition.z));
              gl_FragColor.a*=1.0-smoothstep(900.0,995.0,cascadeOuterEdge);
              if(gl_FragColor.a<0.015) discard;
              #include <dithering_fragment>
            `);
        };
        material.customProgramCacheKey = () => 'cascade-extended-ground-2km-v1';
      }
      material.needsUpdate = true;
    }
  });
}

/**
 * Remove only Google's damaged Apple cube. This is a fragment-space box cut,
 * rather than a tile or mesh deletion, so triangles shared with the GM Building,
 * Fifth Avenue and the Plaza Hotel remain present outside the 12.3 m footprint.
 */
function clipGoogleStore(root: Object3D) {
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.material) return;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[];
    for (const material of materials) {
      const previous = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeSitePosition;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvCascadeSitePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeSitePosition;')
          .replace('#include <clipping_planes_fragment>', `
            #include <clipping_planes_fragment>
            if (abs(vCascadeSitePosition.x) < ${FIFTH_CLIP_HALF_EXTENT.toFixed(2)} &&
                abs(vCascadeSitePosition.z) < ${FIFTH_CLIP_HALF_EXTENT.toFixed(2)} &&
                vCascadeSitePosition.y > ${(SITE_GRADE['fifth-avenue'] - 0.35).toFixed(2)}) discard;
          `);
      };
      material.customProgramCacheKey = () => 'cascade-fifth-tight-clip-v1';
      material.needsUpdate = true;
    }
  });
}

/** Replace Google terrain beneath the authored 2 km Apple Park context plate. */
function clipGoogleAppleGround(root: Object3D) {
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.material) return;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[];
    for (const material of materials) {
      const previous = material.onBeforeCompile;
      material.transparent = true;
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeAppleSitePosition;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvCascadeAppleSitePosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeAppleSitePosition;')
          .replace('#include <clipping_planes_fragment>', `
            #include <clipping_planes_fragment>
            float cascadeAppleEdge=max(abs(vCascadeAppleSitePosition.x),abs(vCascadeAppleSitePosition.z));
            if(cascadeAppleEdge<900.0 && vCascadeAppleSitePosition.y>${(SITE_GRADE['apple-park'] - 2).toFixed(2)}) discard;
            if(cascadeAppleEdge<995.0 && vCascadeAppleSitePosition.y>${(SITE_GRADE['apple-park'] - 2).toFixed(2)})
              gl_FragColor.a*=smoothstep(900.0,995.0,cascadeAppleEdge);
          `);
      };
      material.customProgramCacheKey = () => 'cascade-apple-extended-clip-v1';
      material.needsUpdate = true;
    }
  });
}

function attributionMarkup(attribution: HTMLElement, values: Array<{ type: string; value: unknown }>) {
  const text = values.filter(value => value.type !== 'image').map(value => String(value.value || '').trim().replace(/^Google[;,·\s]+/i, ''))
    .filter(value => value && value.toLowerCase() !== 'google').join(' · ');
  attribution.replaceChildren();
  const logo = document.createElement('span');
  logo.className = 'site-google-logo';
  for (const [letter, color] of [['G', '#4285f4'], ['o', '#ea4335'], ['o', '#fbbc05'], ['g', '#4285f4'], ['l', '#34a853'], ['e', '#ea4335']]) {
    const span = document.createElement('span'); span.textContent = letter; span.style.color = color; logo.append(span);
  }
  const credits = document.createElement('span');
  credits.className = 'site-google-credits'; credits.textContent = text || 'Photorealistic 3D Tiles';
  attribution.append(logo, credits);
}

export function createSiteScene(host: HTMLElement, attribution: HTMLElement, apiKey: string): SiteSceneController {
  if (!canUseTiles(true, apiKey)) throw new Error('Tiles unavailable');
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.replaceChildren(renderer.domElement);

  const scene = new Scene(), camera = new PerspectiveCamera(45, 1, 0.15, 20_000_000);
  const registrationMode = new URLSearchParams(location.search).get('registration');
  const ambient = new AmbientLight('#dce9ef', 1.25), sun = new DirectionalLight('#fff2dc', 3.2);
  sun.position.set(-400, 800, 450); scene.add(ambient, sun);
  const pmrem = new PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose(); pmrem.dispose();

  let site: SiteId | null = null, tiles: TilesRenderer | null = null, model: Group | null = null;
  let failed = false, ready = false, forcedFallback = false, opacity = 0, ground: number | null = null;
  let modelSize: [number, number, number] | null = null;
  let tileBounds: [number, number, number, number, number, number] | null = null;
  let request = 0, attributionFrame = -1;
  let modelAbort: AbortController | null = null;
  const resolution = new Vector2();
  const localPosition = new Vector3(), localTarget = new Vector3(), localUp = new Vector3();

  const status = (): SiteSceneStatus => ({ site, ready, failed, progress: tiles?.loadProgress ?? 0,
    visibleTiles: tiles?.visibleTiles.size ?? 0, opacity, ground, modelSize, tileBounds });

  function clearSite() {
    request++;
    modelAbort?.abort(); modelAbort = null;
    if (model) { disposeModel(model); model = null; }
    if (tiles) { scene.remove(tiles.group); tiles.dispose(); tiles = null; }
    site = null; failed = false; ready = false; forcedFallback = false; opacity = 0; ground = null; modelSize = null; tileBounds = null; attributionFrame = -1;
  }

  function fallback() {
    failed = true; ready = false; opacity = 0;
    if (tiles) tiles.group.visible = false;
    host.style.opacity = '0'; host.style.visibility = 'hidden';
    attribution.style.opacity = '0'; attribution.hidden = true;
  }

  async function mount(nextSite: SiteId) {
    clearSite(); site = nextSite;
    scene.background = new Color(EARTH_BACKGROUND);
    renderer.toneMappingExposure = nextSite === 'fifth-avenue' ? 0.82 : 1.02;
    scene.fog = null;
    const currentRequest = request, coords = SITES[nextSite];
    const nextTiles = new TilesRenderer(ROOT_TILESET);
    // Keep the renderer defaults. Ground-level Google views traverse a long
    // global hierarchy before reaching a city block; small cache caps silently
    // evict those ancestors and strand refinement at the planet-scale parents.
    nextTiles.maxTilesProcessed = nextSite === 'fifth-avenue' ? 360 : 240;
    const auth = new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true, useRecommendedSettings: true }) as GoogleCloudAuthPlugin & { fetchData(url:string, options:RequestInit):Promise<Response> };
    const fetchTile = auth.fetchData.bind(auth);
    auth.fetchData = (url, options) => fetchOptionalTile(fetchTile,url,options,()=>{
      if(currentRequest === request) fallback();
    });
    nextTiles.registerPlugin(auth);
    nextTiles.registerPlugin(new TileCompressionPlugin({ generateNormals: false, disableMipmaps: false }));
    nextTiles.registerPlugin(new ReorientationPlugin({ lat: coords.lat * Math.PI / 180, lon: coords.lng * Math.PI / 180, azimuth: Math.PI }));
    nextTiles.errorTarget = nextSite === 'fifth-avenue' ? 3 : 8;
    if (nextSite === 'fifth-avenue') {
      nextTiles.downloadQueue.maxJobsPerOrigin = 32;
      nextTiles.parseQueue.maxJobs = 8;
    }
    nextTiles.setCamera(camera);
    nextTiles.addEventListener('load-error', () => { if(currentRequest === request) fallback(); });
    if (nextSite === 'fifth-avenue') nextTiles.addEventListener('load-model', event => clipGoogleStore(event.scene));
    else if (!registrationMode) nextTiles.addEventListener('load-model', event => clipGoogleAppleGround(event.scene));
    tiles = nextTiles; scene.add(nextTiles.group);

    const file = nextSite === 'fifth-avenue' ? 'fifth-avenue-tiles' : nextSite;
    const version = __SITE_MODEL_VERSIONS__[file];
    const url = `${import.meta.env.BASE_URL}models/${file}.glb?v=${version}`;
    modelAbort = new AbortController();
    const loaded = await loadSiteModel(url, modelAbort.signal).catch(()=>null);
    modelAbort = null;
    if (currentRequest !== request || site !== nextSite) { if (loaded) disposeModel(loaded); return; }
    if (!loaded) { fallback(); return; }
    loaded.name = `Local site model: ${nextSite}`;
    loaded.visible = false;
    loaded.scale.setScalar(SITE_MODEL_SCALE[nextSite]);
    if (nextSite === 'fifth-avenue') loaded.rotation.y = -Math.PI / 2;
    separateSiteSurfaces(loaded, nextSite);
    tuneModel(loaded, environment, nextSite);
    if (nextSite === 'apple-park' && registrationMode === 'overlay') {
      loaded.traverse(object => {
        const mesh = object as Mesh;
        if (!mesh.material) return;
        for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]) {
          material.transparent = true; material.opacity = Math.min(material.opacity, 0.56);
          material.depthWrite = false; material.needsUpdate = true;
        }
      });
    }
    const size = new Box3().setFromObject(loaded).getSize(new Vector3()); modelSize = [size.x, size.y, size.z];
    model = loaded;
    scene.add(loaded);
  }

  return {
    update(frame, _elapsed) {
      const plan = tilePlan(frame.state, frame.lat, frame.lng, frame.altitude);
      if (plan.prefetch && plan.site && site !== plan.site) void mount(plan.site).catch(()=>fallback());
      const ratio = frame.recording ? 1 : Math.min(devicePixelRatio, 1.5);
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      renderer.getSize(resolution);
      if (resolution.x !== width || resolution.y !== height || renderer.getPixelRatio() !== ratio) {
        renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
      }
      if (site && tiles && !failed && !forcedFallback) {
        localPosition.copy(globePointToSite(site, frame.globeRadius, frame.cameraPosition));
        localTarget.copy(globePointToSite(site, frame.globeRadius, frame.cameraTarget));
        localUp.copy(globeDirectionToSite(site, frame.cameraUp));
        if (ground !== null) { localPosition.y += ground; localTarget.y += ground; }
        camera.position.copy(localPosition); camera.up.copy(localUp); camera.lookAt(localTarget);
        camera.fov = frame.fov; camera.aspect = width / height; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
        tiles.setResolution(camera, width * ratio, height * ratio);
        tiles.update();
        tiles.group.visible = registrationMode !== 'model' && !forcedFallback;
        const failedTiles = (tiles as TilesRenderer & { stats: { failed: number } }).stats.failed;
        // Refinement progress naturally dips again as a moving close-up exposes
        // new frustum edges. Once the local scene has reached detail quality,
        // keep it live while the renderer refines instead of flashing to fallback.
        const withinAuthoredView=localPosition.length()<(site==='apple-park'?5_000:2_500);
        ready = ready || (!failed && !!model && withinAuthoredView &&
          enoughTiles(tiles.loadProgress, tiles.visibleTiles.size, failedTiles));
        if (ready && tileBounds === null) {
          const bounds = new Box3();
          tiles.forEachLoadedModel(loaded => bounds.expandByObject(loaded));
          if (!bounds.isEmpty()) tileBounds = [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z];
        }
        if (ready && ground === null) {
          // These ellipsoid-relative grades are established from the stable
          // surrounding tiles. The source is absent over Apple Park and has
          // malformed vertical geometry at Fifth Avenue, so direct ray hits are
          // not reliable anchors at every LOD.
          ground = SITE_GRADE[site]; model!.position.y = ground + MODEL_LIFT[site] + (site === 'apple-park' ? CAMPUS_LIFT_METERS : 0);
        }
        if (model) model.visible = ready && ground !== null && registrationMode !== 'tiles';
        renderer.render(scene, camera);
        const nextAttributionFrame = Math.floor(frame.state.tMs / 500);
        if (attributionFrame !== nextAttributionFrame || !attribution.childElementCount) { attributionFrame = nextAttributionFrame; attributionMarkup(attribution, tiles.getAttributions()); }
      }
      opacity = tileOpacity(plan, ready, failed, forcedFallback, ground);
      host.style.opacity = opacity.toFixed(4);
      host.style.visibility = opacity > 0 ? 'visible' : 'hidden';
      attribution.style.opacity = opacity.toFixed(4);
      attribution.hidden = opacity <= 0;
      return status();
    },
    status,
    releaseFallback() {
      forcedFallback = true;
      fallback();
    },
    dispose() {
      clearSite(); environment.dispose(); renderer.dispose(); renderer.domElement.remove(); attribution.replaceChildren();
    },
  };
}
