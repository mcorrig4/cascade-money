import {
  ACESFilmicToneMapping, AmbientLight, Box3, Color, DirectionalLight, DoubleSide, Fog, Group,
  Mesh, PerspectiveCamera, PMREMGenerator, Raycaster, Scene,
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
import { canUseTiles, enoughTiles, medianGroundHeight, tilePlan } from './tiles-policy.ts';

const ROOT_TILESET = 'https://tile.googleapis.com/v1/3dtiles/root.json';
const MODEL_LIFT: Record<SiteId, number> = { 'apple-park': 0.18, 'fifth-avenue': 0.08 };
const SKY: Record<SiteId, string> = { 'apple-park': '#a9bbc1', 'fifth-avenue': '#263640' };

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
}

export interface SiteSceneController {
  update(frame: SiteSceneFrame, elapsed: number): SiteSceneStatus;
  status(): SiteSceneStatus;
  dispose(): void;
}

function tuneModel(root: Object3D, environment: Texture) {
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.material) return;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[];
    for (const material of materials) {
      const physical = material as MeshPhysicalMaterial;
      if ('envMapIntensity' in physical) physical.envMapIntensity = Math.max(physical.envMapIntensity ?? 0, 1.15);
      if ('transmission' in physical && physical.transmission > 0.5) {
        physical.envMap = environment;
        physical.envMapIntensity = 1.8;
        physical.opacity = Math.max(physical.opacity, 0.2);
        physical.roughness = Math.min(physical.roughness, 0.08);
        physical.side = DoubleSide;
        physical.depthWrite = false;
        physical.transparent = true;
      }
      if (object.name === 'RegisteredGroundReference') {
        // The authored survey ground carries useful campus detail, but its hard
        // rectangular edge gives away the composite. Feather it into Google's
        // surrounding terrain in object space without changing the source map.
        material.transparent = true;
        material.depthWrite = false;
        material.onBeforeCompile = shader => {
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeGroundPosition;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCascadeGroundPosition = position;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vCascadeGroundPosition;')
            .replace('#include <dithering_fragment>', `
              float cascadeGroundEdge = max(abs(vCascadeGroundPosition.x) / 338.0, abs(vCascadeGroundPosition.z) / 551.0);
              float cascadeGroundFade = 1.0 - smoothstep(0.70, 0.985, cascadeGroundEdge);
              gl_FragColor.a *= cascadeGroundFade;
              if (gl_FragColor.a < 0.015) discard;
              #include <dithering_fragment>
            `);
        };
        material.customProgramCacheKey = () => 'cascade-ground-feather-v1';
      }
      material.needsUpdate = true;
    }
  });
}

function attributionMarkup(attribution: HTMLElement, values: Array<{ type: string; value: unknown }>) {
  const text = values.filter(value => value.type !== 'image').map(value => String(value.value || '').trim())
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
  const ambient = new AmbientLight('#dce9ef', 1.25), sun = new DirectionalLight('#fff2dc', 3.2);
  sun.position.set(-400, 800, 450); scene.add(ambient, sun);
  const pmrem = new PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose(); pmrem.dispose();

  let site: SiteId | null = null, tiles: TilesRenderer | null = null, model: Group | null = null;
  let failed = false, ready = false, opacity = 0, ground: number | null = null;
  let modelSize: [number, number, number] | null = null;
  let request = 0, attributionClock = 0, alignmentClock = 0;
  let modelAbort: AbortController | null = null;
  const resolution = new Vector2(), raycaster = new Raycaster();
  const localPosition = new Vector3(), localTarget = new Vector3(), localUp = new Vector3();

  const status = (): SiteSceneStatus => ({ site, ready, failed, progress: tiles?.loadProgress ?? 0,
    visibleTiles: tiles?.visibleTiles.size ?? 0, opacity, ground, modelSize });

  function clearSite() {
    request++;
    modelAbort?.abort(); modelAbort = null;
    if (model) { disposeModel(model); model = null; }
    if (tiles) { scene.remove(tiles.group); tiles.dispose(); tiles = null; }
    site = null; failed = false; ready = false; ground = null; modelSize = null; alignmentClock = 0;
  }

  async function mount(nextSite: SiteId) {
    clearSite(); site = nextSite;
    scene.background = new Color(SKY[nextSite]);
    scene.fog = nextSite === 'fifth-avenue' ? new Fog(SKY[nextSite], 95, 450) : null;
    const currentRequest = request, coords = SITES[nextSite];
    const nextTiles = new TilesRenderer(ROOT_TILESET);
    nextTiles.lruCache.minBytesSize = 160 * 1024 * 1024;
    nextTiles.lruCache.maxBytesSize = 224 * 1024 * 1024;
    nextTiles.lruCache.minSize = 280;
    nextTiles.lruCache.maxSize = 420;
    nextTiles.maxTilesProcessed = 180;
    nextTiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true, useRecommendedSettings: true }));
    nextTiles.registerPlugin(new TileCompressionPlugin({ generateNormals: false, disableMipmaps: false }));
    nextTiles.registerPlugin(new ReorientationPlugin({ lat: coords.lat * Math.PI / 180, lon: coords.lng * Math.PI / 180, azimuth: Math.PI }));
    nextTiles.errorTarget = 12;
    nextTiles.setCamera(camera);
    nextTiles.addEventListener('load-error', () => { failed = true; ready = false; });
    tiles = nextTiles; scene.add(nextTiles.group);

    const file = nextSite === 'fifth-avenue' ? 'fifth-avenue-tiles' : nextSite;
    const version = __SITE_MODEL_VERSIONS__[file];
    const url = `${import.meta.env.BASE_URL}models/${file}.glb?v=${version}`;
    modelAbort = new AbortController();
    const loaded = await loadSiteModel(url, modelAbort.signal);
    modelAbort = null;
    if (currentRequest !== request || site !== nextSite) { if (loaded) disposeModel(loaded); return; }
    if (!loaded) { failed = true; return; }
    loaded.name = `Local site model: ${nextSite}`;
    loaded.visible = false;
    tuneModel(loaded, environment);
    const size = new Box3().setFromObject(loaded).getSize(new Vector3()); modelSize = [size.x, size.y, size.z];
    model = loaded;
    scene.add(loaded);
  }

  function alignModel(nextSite: SiteId) {
    if (!tiles || !model) return;
    const offsets = [[-24, -24], [0, -26], [24, -24], [-28, 0], [28, 0], [-24, 24], [0, 26], [24, 24]];
    const hits: Vector3[] = [];
    tiles.group.updateMatrixWorld(true);
    for (const [x, z] of offsets) {
      raycaster.set(new Vector3(x, 800, z), new Vector3(0, -1, 0));
      let gradeHit: Vector3 | undefined;
      // Loaded tile scenes have the tiles group as their parent for transforms but
      // are intentionally not inserted into its child list in renderer 0.5.x.
      tiles.forEachLoadedModel(tileScene => {
        tileScene.updateWorldMatrix(true, true);
        for (const hit of raycaster.intersectObject(tileScene, true)) {
          // The Fifth Avenue source includes malformed triangles kilometres
          // above and below grade. Only plausible local elevations may anchor
          // the authored model.
          if (Number.isFinite(hit.point.y) && hit.point.y > -100 && hit.point.y < 200 &&
            (!gradeHit || Math.abs(hit.point.y + 16) < Math.abs(gradeHit.y + 16))) gradeHit = hit.point.clone();
        }
      });
      if (gradeHit) hits.push(gradeHit);
    }
    const height = medianGroundHeight(hits);
    if (height !== null) {
      ground = height; model.position.y = height + MODEL_LIFT[nextSite];
    }
  }

  return {
    update(frame, elapsed) {
      const plan = tilePlan(frame.state, frame.lat, frame.lng, frame.altitude);
      if (plan.prefetch && plan.site && site !== plan.site) void mount(plan.site);
      const ratio = frame.recording ? 1 : Math.min(devicePixelRatio, 1.5);
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      renderer.getSize(resolution);
      if (resolution.x !== width || resolution.y !== height || renderer.getPixelRatio() !== ratio) {
        renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
      }
      if (site && tiles) {
        localPosition.copy(globePointToSite(site, frame.globeRadius, frame.cameraPosition));
        localTarget.copy(globePointToSite(site, frame.globeRadius, frame.cameraTarget));
        localUp.copy(globeDirectionToSite(site, frame.cameraUp));
        if (ground !== null) { localPosition.y += ground; localTarget.y += ground; }
        camera.position.copy(localPosition); camera.up.copy(localUp); camera.lookAt(localTarget);
        camera.fov = frame.fov; camera.aspect = width / height; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
        tiles.setResolution(camera, width * ratio, height * ratio);
        tiles.update();
        const failedTiles = (tiles as TilesRenderer & { stats: { failed: number } }).stats.failed;
        ready = !failed && !!model && enoughTiles(tiles.loadProgress, tiles.visibleTiles.size, failedTiles);
        if (ready && ground === null) {
          // Google has no current 3D coverage over Apple Park itself. Its local
          // ellipsoid-relative grade was established from the surrounding tiles.
          if (site === 'apple-park') { ground = 12.5; model!.position.y = ground + MODEL_LIFT[site]; }
          else if ((alignmentClock += elapsed) >= 180) { alignmentClock = 0; alignModel(site); }
        }
        if (model) model.visible = ready && ground !== null;
        renderer.render(scene, camera);
        if ((attributionClock += elapsed) >= 500) { attributionClock = 0; attributionMarkup(attribution, tiles.getAttributions()); }
      }
      const targetOpacity = ready && ground !== null && !failed ? plan.blend : 0;
      opacity += (targetOpacity - opacity) * Math.min(1, elapsed / 700);
      if (targetOpacity === 0 && opacity < 0.002) opacity = 0;
      host.style.opacity = opacity.toFixed(4);
      host.style.visibility = opacity > 0 ? 'visible' : 'hidden';
      attribution.style.opacity = opacity.toFixed(4);
      attribution.hidden = opacity <= 0;
      return status();
    },
    status,
    dispose() {
      clearSite(); environment.dispose(); renderer.dispose(); renderer.domElement.remove(); attribution.replaceChildren();
    },
  };
}
