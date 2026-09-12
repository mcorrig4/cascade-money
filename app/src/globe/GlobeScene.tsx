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
import { AmountLayer, visibleFromCamera } from './amount-layer.ts';
import { createEarthEffects } from './earth-effects.ts';
import { createFifthAvenueCube } from './landmarks.ts';
import { atlasUv, GEO_REFERENCES } from './geography.ts';
import parkUrl from '../assets/apple-park.svg';

const MONEY = '#69e6c0';
export function GlobeScene({ engine }: { engine: PlaybackEngine }) {
  const host = useRef<HTMLDivElement>(null), amounts = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!host.current || !amounts.current) return;
    const root = host.current;
    let globe: GlobeInstance;
    try { globe = new Globe(root, { animateIn: false, rendererConfig: { antialias: true, alpha: true } }); }
    catch { setError('A WebGL-capable browser is needed to open the globe.'); return; }
    const firms = [...engine.index.firms.values()].flatMap(f => [f, ...(f.named ? (f.sites ?? []).filter(site => site.lat !== f.lat || site.lng !== f.lng).map(site => ({ ...f, id: `${f.id}:${site.id}`, name: `${f.name} · ${site.city ?? site.id}`, lat: site.lat, lng: site.lng })) : [])]).filter(f => f.lat != null && f.lng != null);
    const named = firms.filter(f => f.named), pool = new ArcPool(), layer = new AmountLayer(amounts.current);
    let visibleLabels = new Set<string>();
    let time = 250, last = performance.now(), lastColor = 0, lastLabels = 0, raf = 0;
    let day = -1, cursor = 0, revision = -1, cameraId = -1, paused = true, close = false;
    let flight: { from: { lat: number; lng: number; altitude: number }; to: typeof engine.state.camera; elapsed: number } | undefined;
    let pulseRings: { lat: number; lng: number; color: string; born: number }[] = [];
    globe.backgroundColor('#00000000')
      .pointsData(firms).pointLat('lat').pointLng('lng').pointAltitude(0.001)
      .pointRadius((d: object) => (d as Firm).named ? 0.19 : 0.045)
      .pointColor((d: object) => (d as Firm).role === 'anchor' ? '#f4f4e7' : MONEY).pointResolution(6).pointsMerge(true)
      .labelsData(named).labelLat('lat').labelLng('lng').labelText((d: object) => (d as Firm).name)
      .labelColor(() => '#dce9e7').labelSize(2).labelAltitude(0.008).labelDotRadius(0.15)
      .labelResolution(2).labelIncludeDot(false)
      .labelText((d: object) => visibleLabels.has((d as Firm).id) ? (d as Firm).name : '')
      .arcsData([]).arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng')
      .arcAltitude('altitude').arcStroke(0.35).arcCurveResolution(48).arcCircularResolution(4)
      .arcDashLength(0.12).arcDashGap(0.08).arcDashInitialGap((d: object) => ((d as LiveArc).id % 7) / 10)
      .arcDashAnimateTime(0).arcsTransitionDuration(0)
      .arcColor((d: object) => `rgba(105,230,192,${(d as LiveArc).alpha})`)
      .ringsData([]).ringLat('lat').ringLng('lng').ringMaxRadius(1.1).ringPropagationSpeed(2.3).ringRepeatPeriod(0)
      .ringColor((d: object) => (t: number) => (d as { color: string }).color === 'extension' ? `rgba(232,183,104,${1 - t})` : `rgba(105,230,192,${1 - t})`)
      .onLabelClick((d: object) => { const f = d as Firm; engine.stopShot(); engine.fly(f.lat!, f.lng!, 0.8); });
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const effects = createEarthEffects(globe), fifth = createFifthAvenueCube(globe);
    let lastInteraction = performance.now();
    const interact = () => {
      lastInteraction = performance.now();
      if (engine.state.shot !== null) engine.stopShot();
      flight = undefined; cameraId = engine.state.camera.id;
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
    const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: 2 });
    const park = new Mesh(geometry, material); park.visible = false; globe.scene().add(park);
    const resize = () => {
      globe.width(root.clientWidth).height(root.clientHeight);
      globe.globeOffset([root.clientWidth <= 600 ? 0 : root.clientWidth > 1100 ? -190 : -100, root.clientWidth <= 600 ? -95 : -40]);
    };
    const observer = new ResizeObserver(resize); observer.observe(root); resize();
    const colorAccessor = (d: object) => `rgba(105,230,192,${(d as LiveArc).alpha})`;
    const frame = (now: number) => {
      const elapsed = now - last; last = now;
      if (document.hidden) { raf = requestAnimationFrame(frame); return; }
      const state = engine.state, moving = state.playing || state.shotRunning;
      if (moving) time += elapsed;
      if (paused === moving) { paused = !moving; globe.arcDashAnimateTime(moving ? 900 : 0); }
      if (state.camera.id !== cameraId) {
        cameraId = state.camera.id;
        flight = { from: globe.pointOfView(), to: state.camera, elapsed: 0 };
      }
      if (flight && (moving || state.shot === null || flight.to.duration === 0)) {
        flight.elapsed += elapsed;
        const t = flight.to.duration === 0 ? 1 : Math.min(1, flight.elapsed / flight.to.duration), eased = t * t * (3 - 2 * t);
        const deltaLng = ((flight.to.lng - flight.from.lng + 540) % 360) - 180;
        globe.pointOfView({ lat: flight.from.lat + (flight.to.lat - flight.from.lat) * eased,
          lng: flight.from.lng + deltaLng * eased, altitude: flight.from.altitude + (flight.to.altitude - flight.from.altitude) * eased }, 0);
        if (t === 1) flight = undefined;
      }
      globe.controls().enabled = true;
      globe.controls().autoRotate = !flight && ((!moving && state.shot === null && !state.recording && now - lastInteraction > 6000) || (state.shot === 10 && state.stage === 'wide' && state.shotRunning));
      globe.controls().autoRotateSpeed = 0.12;
      const isClose = globe.pointOfView().altitude < 0.02;
      if (close !== isClose) { close = isClose; globe.pointsData(close ? [] : firms); park.visible = close; }
      fifth.group.visible = state.shot === 10 && isClose;
      effects.update(state.day, isClose);
      if (revision !== state.revision || day !== state.day) {
        pool.clear(); pulseRings = []; globe.ringsData([]); cursor = 0;
        revision = state.revision; day = state.day;
      }
      const events = engine.index.days[day].events;
      const incoming = events.slice(cursor, state.cursor);
      // Admission is bounded even for a scrub directly into an extremely dense day.
      for (const event of incoming.filter(isPayment).slice(-200)) {
        const life = !moving ? 1800 : state.shot === 3 || state.shot === 4 ? 3500 : Math.max(45, Math.min(1800, 1800 / speedRate(state.speed)));
        pool.add(event, engine.index, time - (moving ? 0 : 250), life);
      }
      for (const event of incoming.slice(-40)) {
        if (!isPayment(event) && event.type !== 'extend') continue;
        const firm = engine.index.firms.get(event.to ?? event.accounts[0]);
        if (firm?.lat != null && firm.lng != null) pulseRings.push({ lat: firm.lat, lng: firm.lng, born: time, color: event.type === 'extend' ? 'extension' : 'money' });
      }
      cursor = state.cursor;
      pool.tick(time);
      if ((moving && now - lastColor > 33) || incoming.length) {
        lastColor = now; globe.arcsData(pool.arcs).arcColor(colorAccessor);
        const nextRings = pulseRings.filter(r => time - r.born < 650).slice(-40);
        if (nextRings.length !== pulseRings.length || incoming.length) globe.ringsData(nextRings);
        pulseRings = nextRings;
      }
      const ledgerLeft = root.clientWidth <= 600 ? root.clientWidth - 12 : root.clientWidth > 1100 ? root.clientWidth - 450 : root.clientWidth - 330;
      layer.update(globe, pool.arcs, time, ledgerLeft, root.clientHeight - (root.clientWidth <= 600 ? 330 : 230));
      if (now - lastLabels > 150) {
        lastLabels = now;
        const boxes: { x: number; y: number; width: number }[] = [], next = new Set<string>();
        const active = new Set(pool.arcs.flatMap(a => [a.event.from, a.event.to]));
        const ordered = [...named].sort((a, b) => Number(active.has(b.id)) - Number(active.has(a.id)) || Number(b.role === 'anchor') - Number(a.role === 'anchor'));
        for (const f of ordered) {
          if (close || !visibleFromCamera(globe, f.lat!, f.lng!, 0.008)) continue;
          const p = globe.getScreenCoords(f.lat!, f.lng!, 0.008), width = f.name.length * 10 + 20;
          if (p.x < 30 || p.x + width > ledgerLeft || p.y < 110 || p.y > root.clientHeight - (root.clientWidth <= 600 ? 330 : 250) || boxes.some(b => Math.abs(b.x - p.x) < (b.width + width) / 2 && Math.abs(b.y - p.y) < 30)) continue;
          boxes.push({ ...p, width }); next.add(f.id);
        }
        if ([...next].join('|') !== [...visibleLabels].join('|')) {
          visibleLabels = next;
          globe.labelText((d: object) => visibleLabels.has((d as Firm).id) ? (d as Firm).name : '');
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    if (new URLSearchParams(location.search).has('inspect')) {
      window.__cascade = { engine, globe, pool,
        geography: () => {
          let earth: Mesh | undefined;
          globe.scene().traverse(object => { if ((object as Mesh).material === globe.globeMaterial()) earth = object as Mesh; });
          globe.scene().updateMatrixWorld(true);
          return GEO_REFERENCES.map(site => {
            const coords = globe.getCoords(site.lat, site.lng, 2), origin = new Vector3(coords.x, coords.y, coords.z);
            const hit = earth && new Raycaster(origin, origin.clone().negate().normalize()).intersectObject(earth)[0];
            return { ...site, expected: atlasUv(site.lat, site.lng), uv: hit?.uv ? { u: hit.uv.x, v: hit.uv.y } : null };
          });
        }, ageArcs: (milliseconds: number) => { time += milliseconds; pool.tick(time); globe.arcColor((d: object) => colorAccessor(d)); },
        geometry: () => pool.arcs.map(a => {
          const group = (a as LiveArc & { __threeObjArc?: Group }).__threeObjArc;
          const mesh = group?.children[0] as Mesh | undefined;
          const colors = mesh?.geometry.getAttribute('color');
          return { seq: a.id, geometry: mesh?.geometry.uuid, alpha: colors?.itemSize === 4 ? colors.getW(0) : null };
        }) };
    }
    return () => {
      root.removeEventListener('touchstart', captureTouch); root.removeEventListener('touchmove', captureTouch);
      cancelAnimationFrame(raf); observer.disconnect(); layer.dispose();
      globe.scene().remove(park); geometry.dispose(); material.dispose(); texture.dispose();
      globe.controls().removeEventListener('start', interact); effects.dispose(); fifth.dispose();
      globe._destructor(); root.replaceChildren(); delete window.__cascade;
    };
  }, [engine]);
  return <><div className="globe-scene" ref={host} aria-label="Global payment network" /><div className="amount-layer" ref={amounts} aria-hidden="true" />{error && <div className="globe-error" role="alert">{error}</div>}</>;
}
