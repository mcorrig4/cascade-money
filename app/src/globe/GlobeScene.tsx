import { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';
import type { GlobeInstance } from 'globe.gl';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, SRGBColorSpace, TextureLoader, TOUCH, Raycaster, Vector3 } from 'three';
import type { PerspectiveCamera, Group } from 'three';
import { isPayment } from '../data/types.ts';
import type { Firm } from '../data/types.ts';
import type { PlaybackEngine } from '../playback/engine.ts';
import { speedRate } from '../playback/engine.ts';
import { ArcPool } from './arc-pool.ts';
import type { LiveArc } from './arc-pool.ts';
import { AmountLayer } from './amount-layer.ts';
import { updateArcMaterials } from './arc-material.ts';
import { arcLifetime } from './animation.ts';
import { CompanyLayer } from './company-layer.ts';
import { createEarthEffects } from './earth-effects.ts';
import { createFifthAvenueCube } from './landmarks.ts';
import { atlasUv, GEO_REFERENCES } from './geography.ts';
import { createSiteModels } from './site-models.ts';
import { siteCamera, siteSun } from './site-math.ts';
import parkUrl from '../assets/apple-park.svg';

const MONEY = '#69e6c0';
export function GlobeScene({ engine }: { engine: PlaybackEngine }) {
  const host = useRef<HTMLDivElement>(null), amounts = useRef<HTMLDivElement>(null), companies = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!host.current || !amounts.current || !companies.current) return;
    const root = host.current;
    let globe: GlobeInstance;
    try { globe = new Globe(root, { animateIn: false, rendererConfig: { antialias: true, alpha: true, logarithmicDepthBuffer: true } }); }
    catch { setError('A WebGL-capable browser is needed to open the globe.'); return; }
    const firms = [...engine.index.firms.values()].flatMap(f => [f, ...(f.named ? (f.sites ?? []).filter(site => site.lat !== f.lat || site.lng !== f.lng).map(site => ({ ...f, id: `${f.id}:${site.id}`, name: `${f.name} · ${site.city ?? site.id}`, lat: site.lat, lng: site.lng })) : [])]).filter(f => f.lat != null && f.lng != null);
    const named = firms.filter(f => f.named), pool = new ArcPool(), layer = new AmountLayer(amounts.current);
    const companyLayer = new CompanyLayer(companies.current, named);
    let arcIds = '';
    let time = 250, last = performance.now(), lastColor = 0, raf = 0;
    let day = -1, cursor = 0, revision = -1, cameraId = -1, close = false;
    let flight: { from: { lat: number; lng: number; altitude: number }; to: typeof engine.state.camera; elapsed: number; eye: Vector3; target: Vector3; up: Vector3; local: boolean } | undefined;
    let pulseRings: { lat: number; lng: number; color: string; born: number }[] = [];
    globe.backgroundColor('#00000000')
      .pointsData(firms).pointLat('lat').pointLng('lng').pointAltitude(0.001)
      .pointRadius((d: object) => (d as Firm).named ? 0.19 : 0.045)
      .pointColor((d: object) => (d as Firm).role === 'anchor' ? '#f4f4e7' : MONEY).pointResolution(6).pointsMerge(true)
      .labelsData([])
      .arcsData([]).arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng')
      .arcAltitude('altitude').arcStroke(0.22).arcCurveResolution(64).arcCircularResolution(4)
      .arcDashLength(1).arcDashGap(0).arcDashAnimateTime(0).arcsTransitionDuration(0)
      // Keep new tubes invisible until their clip shader is attached on the next frame.
      // A bare string here is a per-datum field-name LOOKUP under three-globe's accessor
      // convention (Ke), not a literal color — it must be wrapped in a function.
      .arcColor(() => 'rgba(105,230,192,0)')
      .ringsData([]).ringLat('lat').ringLng('lng').ringMaxRadius(1.1).ringPropagationSpeed(2.3).ringRepeatPeriod(0)
      .ringColor((d: object) => (t: number) => (d as { color: string }).color === 'extension' ? `rgba(232,183,104,${1 - t})` : `rgba(105,230,192,${1 - t})`)
;
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const effects = createEarthEffects(globe), fifth = createFifthAvenueCube(globe);
    let lastInteraction = performance.now();
    const interact = () => {
      lastInteraction = performance.now();
      if (engine.state.shot !== null) engine.stopShot();
      flight = undefined; cameraId = engine.state.camera.id;
      globe.controls().target.set(0, 0, 0); globe.camera().up.set(0, 1, 0);
    };
    const captureTouch = (event: TouchEvent) => { if (event.cancelable) event.preventDefault(); };
    root.addEventListener('touchstart', captureTouch, { passive: false });
    root.addEventListener('touchmove', captureTouch, { passive: false });
    const controls = globe.controls();
    controls.enableZoom = true; controls.enableRotate = true; controls.enablePan = false;
    controls.touches.ONE = TOUCH.ROTATE; controls.touches.TWO = TOUCH.DOLLY_ROTATE;
    globe.controls().addEventListener('start', interact);
    const camera = globe.camera() as PerspectiveCamera;
    camera.near = 0.000005; camera.updateProjectionMatrix();
    globe.controls().minDistance = globe.getGlobeRadius() * (1 + 0.00001);
    globe.controls().maxDistance = globe.getGlobeRadius() * 5;

    // A curved, geographically registered local SVG decal: no tile service or satellite dependency.
    const texture = new TextureLoader().load(parkUrl);
    texture.colorSpace = SRGBColorSpace;
    const geometry = new BufferGeometry(), vertices: number[] = [], uv: number[] = [], indices: number[] = [];
    const steps = 16;
    for (let y = 0; y <= steps; y++) for (let x = 0; x <= steps; x++) {
      const p = globe.getCoords(37.3349 + (0.5 - y / steps) * 0.01, -122.009 + (x / steps - 0.5) * 0.0126, 0.000001);
      vertices.push(p.x, p.y, p.z); uv.push(x / steps, 1 - y / steps);
      if (x < steps && y < steps) { const a = y * (steps + 1) + x; indices.push(a, a + steps + 1, a + 1, a + 1, a + steps + 1, a + steps + 2); }
    }
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, toneMapped: false, side: 2 });
    const park = new Mesh(geometry, material); park.visible = false; park.renderOrder = 2; park.name = 'Apple Park ring decal'; park.userData.skipBloom = true; globe.scene().add(park);
    const models = createSiteModels(globe, { 'apple-park': park, 'fifth-avenue': fifth.group });
    const resize = () => {
      globe.width(root.clientWidth).height(root.clientHeight);
      globe.globeOffset([root.clientWidth <= 600 ? 0 : root.clientWidth > 1100 ? -190 : -100, root.clientWidth <= 600 ? -95 : -40]);
    };
    const observer = new ResizeObserver(resize); observer.observe(root); resize();
    const frame = (now: number) => {
      const elapsed = now - last; last = now;
      if (document.hidden) { raf = requestAnimationFrame(frame); return; }
      const state = engine.state, moving = state.playing || state.shotRunning;
      if (moving) time += elapsed;
      if (state.camera.id !== cameraId) {
        cameraId = state.camera.id;
        flight = { from: globe.pointOfView(), to: state.camera, elapsed: 0,
          eye: camera.position.clone(), target: controls.target.clone(), up: camera.up.clone(),
          local: !!state.camera.site || controls.target.lengthSq() > 0 };
      }
      if (flight && (moving || state.shot === null || flight.to.duration === 0)) {
        flight.elapsed += elapsed;
        const t = flight.to.duration === 0 ? 1 : Math.min(1, flight.elapsed / flight.to.duration), eased = t * t * (3 - 2 * t);
        const deltaLng = ((flight.to.lng - flight.from.lng + 540) % 360) - 180;
        if (flight.local) {
          const pose = flight.to.site ? siteCamera(flight.to.site, globe.getGlobeRadius()) : {
            position: new Vector3().copy(globe.getCoords(flight.to.lat, flight.to.lng, flight.to.altitude)), target: new Vector3(), up: new Vector3(0, 1, 0) };
          controls.minDistance = 0.000005;
          camera.position.lerpVectors(flight.eye, pose.position, eased);
          controls.target.lerpVectors(flight.target, pose.target, eased);
          camera.up.lerpVectors(flight.up, pose.up, eased).normalize();
          camera.lookAt(controls.target);
        } else globe.pointOfView({ lat: flight.from.lat + (flight.to.lat - flight.from.lat) * eased,
          lng: flight.from.lng + deltaLng * eased, altitude: flight.from.altitude + (flight.to.altitude - flight.from.altitude) * eased }, 0);
        if (t === 1) flight = undefined;
      }
      if (!flight && state.camera.site && state.shot !== null) {
        const pose = siteCamera(state.camera.site, globe.getGlobeRadius(), state.shot === 1 ? Math.min(3, state.shotElapsed) * 2 : 0);
        camera.position.copy(pose.position); camera.up.copy(pose.up); controls.target.copy(pose.target); camera.lookAt(pose.target);
      }
      controls.minDistance = controls.target.lengthSq() > 0 ? 0.000005 : globe.getGlobeRadius() * (1 + 0.0000002);
      globe.controls().enabled = true;
      globe.controls().autoRotate = !flight && ((!moving && state.shot === null && !state.recording && now - lastInteraction > 6000) || (state.shot === 10 && state.stage === 'wide' && state.shotRunning));
      globe.controls().autoRotateSpeed = 0.12;
      const isClose = globe.pointOfView().altitude < 0.02;
      if (close !== isClose) { close = isClose; globe.pointsData(close ? [] : firms); }
      const pov = globe.pointOfView();
      models.update(pov.lat, pov.lng, pov.altitude, elapsed);
      effects.update(state.position, elapsed, isClose, !moving || state.shot === 1 || (state.shot === 10 && state.stage === 'cube') || (state.shot !== null && isClose),
        isClose && (state.shot === 1 || state.shot === 2) ? siteSun('apple-park', globe.getGlobeRadius()) :
          state.shot === 10 && state.stage === 'cube' ? siteSun('fifth-avenue', globe.getGlobeRadius()) : undefined, state.shot === 10 && state.stage === 'cube');
      const incoming = [] as typeof engine.index.days[number]['events'];
      if (revision !== state.revision || state.day < day) {
        pool.clear(); arcIds = '\0'; pulseRings = []; globe.ringsData([]); cursor = 0; day = state.day;
      }
      // Preserve retiring arcs across forward day boundaries; scrubs still reset the scene.
      for (let d = Math.max(0, day); d <= state.day; d++) {
        const bucket = engine.index.days[d].events;
        const lo = d === day ? cursor : 0, hi = d === state.day ? state.cursor : bucket.length;
        for (let i = lo; i < hi; i++) {
          const event = bucket[i];
          if (isPayment(event) || event.type === 'extend') {
            incoming.push(event);
            if (incoming.length > 200) incoming.shift();
          }
        }
      }
      if (engine.storyEvents !== null) incoming.splice(0, incoming.length, ...engine.drainStoryEvents());
      revision = state.revision; day = state.day;
      // Admission is bounded even for a scrub directly into an extremely dense day.
      for (const event of incoming.filter(isPayment).slice(-200)) {
        const life = arcLifetime(moving ? speedRate(state.speed) : 1, state.shot === 3 || state.shot === 4);
        pool.add(event, engine.index, time - (moving ? 0 : 750), life);
      }
      for (const event of incoming.slice(-40)) {
        if (!isPayment(event) && event.type !== 'extend') continue;
        const firm = engine.index.firms.get(event.to ?? event.accounts[0]);
        if (firm?.lat != null && firm.lng != null) pulseRings.push({ lat: firm.lat, lng: firm.lng, born: time, color: event.type === 'extend' ? 'extension' : 'money' });
      }
      cursor = state.cursor;
      pool.tick(time);
      const nextArcIds = pool.arcs.map(arc => arc.id).join(',');
      if (nextArcIds !== arcIds) { arcIds = nextArcIds; globe.arcsData(pool.arcs); }
      updateArcMaterials(pool.arcs, globe.getGlobeRadius());
      if ((moving && now - lastColor > 33) || incoming.length) {
        lastColor = now;
        const nextRings = pulseRings.filter(r => time - r.born < 650).slice(-40);
        if (nextRings.length !== pulseRings.length || incoming.length) globe.ringsData(nextRings);
        pulseRings = nextRings;
      }
      const ledgerLeft = root.clientWidth <= 600 ? root.clientWidth - 12 : root.clientWidth > 1100 ? root.clientWidth - 450 : root.clientWidth - 330;
      layer.update(globe, pool.arcs, time, ledgerLeft, root.clientHeight - (root.clientWidth <= 600 ? 330 : 230));
      companyLayer.update(globe, named, new Set(pool.arcs.flatMap(arc => [arc.event.from ?? '', arc.event.to ?? ''])), ledgerLeft,
        root.clientHeight - (root.clientWidth <= 600 ? 350 : 270), close, root.clientWidth <= 600);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    if (new URLSearchParams(location.search).has('inspect')) {
      window.__cascade = { engine, globe, pool, models: models.status, cameraFlightActive: () => !!flight,
        geography: () => {
          let earth: Mesh | undefined;
          globe.scene().traverse(object => { if ((object as Mesh).material === globe.globeMaterial()) earth = object as Mesh; });
          globe.scene().updateMatrixWorld(true);
          return GEO_REFERENCES.map(site => {
            const coords = globe.getCoords(site.lat, site.lng, 2), origin = new Vector3(coords.x, coords.y, coords.z);
            const hit = earth && new Raycaster(origin, origin.clone().negate().normalize()).intersectObject(earth)[0];
            return { ...site, expected: atlasUv(site.lat, site.lng), uv: hit?.uv ? { u: hit.uv.x, v: hit.uv.y } : null };
          });
        }, ageArcs: (milliseconds: number) => { time += milliseconds; pool.tick(time); updateArcMaterials(pool.arcs, globe.getGlobeRadius()); },
        geometry: () => pool.arcs.map(a => {
          const group = (a as LiveArc & { __threeObjArc?: Group }).__threeObjArc;
          const mesh = group?.children[0] as Mesh | undefined;
          const material = mesh?.material as import('three').ShaderMaterial | undefined;
          return { seq: a.id, geometry: mesh?.geometry.uuid, alpha: material?.uniforms?.alpha?.value ?? null, clipStart: a.clipStart, clipEnd: a.clipEnd, groundKm: a.groundKm, depthTest: material?.depthTest };
        }) };
    }
    return () => {
      root.removeEventListener('touchstart', captureTouch); root.removeEventListener('touchmove', captureTouch);
      cancelAnimationFrame(raf); observer.disconnect(); layer.dispose(); companyLayer.dispose();
      models.dispose();
      globe.scene().remove(park); geometry.dispose(); material.dispose(); texture.dispose();
      globe.controls().removeEventListener('start', interact); effects.dispose(); fifth.dispose();
      globe._destructor(); root.replaceChildren(); delete window.__cascade;
    };
  }, [engine]);
  return <><div className="globe-scene" ref={host} aria-label="Global payment network" /><div className="company-layer" ref={companies} aria-hidden="true" /><div className="amount-layer" ref={amounts} aria-hidden="true" />{error && <div className="globe-error" role="alert">{error}</div>}</>;
}
