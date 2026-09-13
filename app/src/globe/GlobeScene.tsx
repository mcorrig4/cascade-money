import { sampleRewindEvents } from './rewind-events.ts';
import { companyCues } from '../director/company-cues.ts';
import { CameraBookmarks } from '../director/bookmarks.ts';
import { SHOTS, playShot, playFilm, shotSite } from '../director/shots.ts';
import { easeAt, sampleCamera, splineAt, EARTH_METERS, SITE_CLEARANCE_METERS, clampCamera, cameraClearance, cameraGround } from '../camera/primitives.ts';
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
import { arcLifetime, IdleMotion } from './animation.ts';
import { CompanyLayer } from './company-layer.ts';
import { createEarthEffects } from './earth-effects.ts';
import { createFifthAvenueCube } from './landmarks.ts';
import { atlasUv, GEO_REFERENCES } from './geography.ts';
import { createSiteModels } from './site-models.ts';
import { appleParkShotCamera, fifthAvenueShotCamera, nearSite, SITES, siteCamera, siteFrame, sitePoint, siteSun } from './site-math.ts';
import type { SiteSceneController, SiteSceneStatus } from './site-scene.ts';
import { canUseTiles } from './tiles-policy.ts';
import { EARTH_BACKGROUND } from './readiness.ts';
import parkUrl from '../assets/apple-park.svg';

const MONEY = '#69e6c0';
const TILES_ENABLED = import.meta.env.VITE_ENABLE_TILES === '1';
export function GlobeScene({ engine }: { engine: PlaybackEngine }) {
  const host = useRef<HTMLDivElement>(null), siteHost = useRef<HTMLDivElement>(null), siteAttribution = useRef<HTMLDivElement>(null);
  const amounts = useRef<HTMLDivElement>(null), companies = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!host.current || !siteHost.current || !siteAttribution.current || !amounts.current || !companies.current) return;
    const root = host.current;
    const frameDriven = window.__cascade?.frameDriven === true;
    let globe: GlobeInstance;
    try { globe = new Globe(root, { animateIn: false, rendererConfig: { antialias: true, alpha: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: frameDriven } }); }
    catch { const message='A WebGL-capable browser is needed to open the globe.'; engine.prepareScene().fail(new Error(message)); setError(message); return; }
    // Every named firm label reads "Name · City" consistently: the firm's own HQ/plant entry
    // gets its city suffixed exactly like the per-site entries below (previously only the extra
    // site entries did, so single-site firms — Apple, Corning, Glencore's own HQ row — showed a
    // bare name while multi-site firms showed the city only on their secondary markers).
    const firms = [...engine.index.firms.values()].flatMap(f => [f.named && f.city ? { ...f, name: `${f.name} · ${f.city}` } : f, ...(f.named ? (f.sites ?? []).filter(site => site.lat !== f.lat || site.lng !== f.lng).map(site => ({ ...f, id: `${f.id}:${site.id}`, name: `${f.name} · ${site.city ?? site.id}`, lat: site.lat, lng: site.lng })) : [])]).filter(f => f.lat != null && f.lng != null);
    const named = firms.filter(f => f.named), pool = new ArcPool(), layer = new AmountLayer(amounts.current);
    const companyLayer = new CompanyLayer(companies.current, named);
    let localFocus:Vector3|undefined;
    let arcIds = '', cinematic=false, campusFraming=0;
    let time = 250, last = frameDriven ? 0 : performance.now(), lastColor = 0, raf = 0;
    let day = -1, cursor = 0, revision = -1, cameraId = -1, close = false, disposed = false, previousShot: number | null = null;
    let flight: { from: { lat: number; lng: number; altitude: number }; to: typeof engine.state.camera; elapsed: number; eye: Vector3; target: Vector3; up: Vector3; fromFov: number; targetFov: number; local: boolean } | undefined;
    let siteScene: SiteSceneController | undefined, siteScenePromise: Promise<void> | undefined, siteIdle = 0, globePaused = false;

    const sceneTransitions:{sceneIndex:number;sceneId:number;tMs:number}[]=[];
    let filmStartMs:number|null=null,lastTransitionShot:number|null=null;
    const unsubscribeTransitions=engine.subscribe(()=>{
      const id=engine.state.shot;
      if(id===null){lastTransitionShot=null;return;}
      if(id===lastTransitionShot)return;
      lastTransitionShot=id;
      const shot=SHOTS.find(candidate=>candidate.id===id);
      if(shot)sceneTransitions.push({sceneIndex:shot.scene,sceneId:id,tMs:performance.now()});
    });
    let siteStatus: SiteSceneStatus = { site: null, ready: false, failed: false, progress: 0, visibleTiles: 0, opacity: 0, ground: null, modelSize: null, tileBounds: null };
    let pulseRings: { lat: number; lng: number; color: string; born: number }[] = [];
    // The descent scene (shot 19) hands off to this hook rather than a bare
    // shot-id check: the fifth-avenue interior camera engages for whatever
    // window the director schedules, independent of scene numbering.
    let interiorDescent: { start: number; shot: number | null; duration: number; eye: Vector3; target: Vector3; fov:number } | undefined;
    engine.subsurfaceInteriorCameraHook = (durationMs) => { interiorDescent = { start: engine.state.shotElapsed, shot: engine.state.shot, duration: durationMs, eye: camera.position.clone(), target: controls.target.clone(), fov:camera.fov }; return true; };
    globe.backgroundColor(EARTH_BACKGROUND)
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
    root.style.visibility = 'hidden';
    const readinessGate = engine.prepareScene();
    let effects: ReturnType<typeof createEarthEffects>;
    try { effects = createEarthEffects(globe); }
    catch (reason) {
      readinessGate.fail(reason instanceof Error ? reason : new Error(String(reason)));
      setError('Earth could not be prepared. Reload to retry.'); unsubscribeTransitions();
      engine.subsurfaceInteriorCameraHook = undefined; globe._destructor(); return;
    }
    const fifth = createFifthAvenueCube(globe);
    void effects.ready().then(() => {
      if (disposed) return;
      root.style.visibility = 'visible'; readinessGate.finish();
    }).catch(reason => { if(!disposed){readinessGate.fail(reason);setError('Earth textures could not be prepared. Reload to retry.');} });
    let clearance = cameraClearance(engine.state.camera);
    let interacting = false;
    const idle = new IdleMotion();
    const interact = () => {
      interacting = true; localFocus=undefined;
      if(engine.state.camera.site)engine.update({camera:{...engine.state.camera,site:undefined}});
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
    const interactionEnd = () => { interacting = false; };
    globe.controls().addEventListener('start', interact);
    globe.controls().addEventListener('end', interactionEnd);
    const camera = globe.camera() as PerspectiveCamera;
    const globeFov = camera.fov;
    camera.near = 0.000005; camera.updateProjectionMatrix();
    globe.controls().minDistance = globe.getGlobeRadius() * (1 + SITE_CLEARANCE_METERS/EARTH_METERS);
    globe.controls().maxDistance = globe.getGlobeRadius() * 5;
    const maintainSiteControls=()=>{
      // globe.gl's earlier change listener resets the target and shrinks zoom
      // speed toward zero at site scale. Keep the authored focus until drag.
      if(localFocus&&!interacting){controls.target.copy(localFocus);camera.lookAt(localFocus);}
      controls.zoomSpeed=Math.max(.4,Math.min(1.2,Math.sqrt(Math.max(0,globe.pointOfView().altitude))*.5));
    };
    controls.addEventListener('change',maintainSiteControls);

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
    const material = new MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, polygonOffset:true, polygonOffsetFactor:4, polygonOffsetUnits:4, toneMapped: false, side: 2 });
    const park = new Mesh(geometry, material); park.visible = false; park.renderOrder = 2; park.name = 'Apple Park ring decal'; park.userData.skipBloom = true; globe.scene().add(park);
    const models = createSiteModels(globe, { 'apple-park': park, 'fifth-avenue': fifth.group });
    const resize = () => {
      globe.width(root.clientWidth).height(root.clientHeight);
      globe.globeOffset([root.clientWidth <= 600 ? 0 : root.clientWidth > 1100 ? -190 : -100, root.clientWidth <= 600 ? -95 : -40]);
    };
    const observer = new ResizeObserver(resize); observer.observe(root); resize();
    const frame = (now: number, schedule = !frameDriven) => {
      const elapsed = frameDriven ? 0 : now - last; last = now;
      if (document.hidden && !frameDriven) { raf = requestAnimationFrame(frame); return; }
      const state = engine.state, moving = state.playing || state.shotRunning;
      if(state.shot!==previousShot){
        previousShot=state.shot;

        // A URL/director entry has no preceding scene to provide its camera.
        // Start from the authored pose; continuous film transitions still inherit.
        if(state.shot!==null&&!state.film&&state.shotElapsed<.1){
          const authored=SHOTS.find(shot=>shot.id===state.shot);
          if(authored){flight=undefined;globe.pointOfView(state.camera.bookmarkPath?state.camera.from!:authored.start,0);cameraId=-1;}
        }
      }
      if(cinematic!==(state.shot!==null||!!state.camera.site)){cinematic=state.shot!==null||!!state.camera.site;if(cinematic)globe.globeOffset([0,0]);else resize();}
      const desiredPixelRatio = state.recording ? 1 : Math.min(window.devicePixelRatio, 1.5);
      if (globe.renderer().getPixelRatio() !== desiredPixelRatio) globe.renderer().setPixelRatio(desiredPixelRatio);
      if (state.shot !== null) time = 250 + ((SHOTS.find(s=>s.id===state.shot)?.startTime??0)+state.shotElapsed)*1000;
      else if (moving) time += elapsed;
      if (state.camera.id !== cameraId) {
        cameraId = state.camera.id;
        flight = { from: globe.pointOfView(), to: state.camera, elapsed: 0,
          eye: camera.position.clone(), target: controls.target.clone(), up: camera.up.clone(),
          fromFov: camera.fov, targetFov: state.camera.site ? siteCamera(state.camera.site, globe.getGlobeRadius()).fov : globeFov,
          local: !!state.camera.site || controls.target.lengthSq() > 0 };
      }
      if (flight) {
        flight.elapsed = state.cameraElapsed;
        const t = flight.to.duration === 0 ? 1 : Math.min(1, flight.elapsed / flight.to.duration), eased = easeAt(t,flight.to.ease);
        const sampled=sampleCamera({...flight.to,from:flight.to.from??flight.from},flight.elapsed);
        const primitive=flight.to.primitive;
        if(primitive?.kind==='orbit') {
          const base=appleParkShotCamera(globe.getGlobeRadius(),0);
          camera.position.copy(globe.getCoords(sampled.lat,sampled.lng,sampled.altitude));
          controls.target.copy(globe.getCoords(primitive.center.lat,primitive.center.lng,0));
          camera.up.copy(base.up);camera.fov=base.fov;camera.updateProjectionMatrix();camera.lookAt(controls.target);
        } else if(primitive?.kind==='spline' && flight.to.landmarkPath==='apple-park-arch') {
          // Resolve the landmark against the other lane's calibrated camera
          // functions, not the script's approximate kilometre-scale altitudes.
          const radius=globe.getGlobeRadius();
          const entry=appleParkShotCamera(radius,10),exit=appleParkShotCamera(radius,13.7);
          const geo=(v:Vector3,t:number)=>({lat:Math.asin(v.y/v.length())*180/Math.PI,lng:Math.atan2(v.x,v.z)*180/Math.PI,altitude:v.length()/radius-1,t});
          const frame=splineAt([geo(flight.eye,0),geo(entry.position,.5),geo(exit.position,1.2)],t*1.2);
          camera.position.copy(globe.getCoords(frame.lat,frame.lng,frame.altitude));
          const look=appleParkShotCamera(radius,6.5+t*7.2);
          controls.target.lerpVectors(flight.target,look.target,eased);camera.up.copy(look.up);camera.fov=look.fov;camera.updateProjectionMatrix();camera.lookAt(controls.target);
        } else if(primitive?.kind==='spline') {
          camera.position.copy(globe.getCoords(sampled.lat,sampled.lng,sampled.altitude));
          controls.target.copy(flight.target).multiplyScalar(1-eased);
          camera.up.lerpVectors(flight.up,new Vector3(0,1,0),eased).normalize();camera.lookAt(controls.target);
        } else if (flight.local) {
          const pose = flight.to.site ? siteCamera(flight.to.site, globe.getGlobeRadius()) : {
            position: new Vector3().copy(globe.getCoords(flight.to.lat, flight.to.lng, flight.to.altitude)), target: new Vector3(), up: new Vector3(0, 1, 0) };
          controls.minDistance = 0.000005;
          camera.position.lerpVectors(flight.eye, pose.position, eased);
          controls.target.lerpVectors(flight.target, pose.target, eased);
          camera.up.lerpVectors(flight.up, pose.up, eased).normalize();
          camera.fov = flight.fromFov + (flight.targetFov - flight.fromFov) * eased; camera.updateProjectionMatrix();
          camera.lookAt(controls.target);
        } else {
          globe.pointOfView(sampled,0);
          camera.fov = flight.fromFov + (flight.targetFov - flight.fromFov) * eased; camera.updateProjectionMatrix();
        }
        if (t === 1) flight = undefined;
      }
      // Ring center at 60% of the frame, easing back to center for the arch.
      const framingTarget=state.camera.primitive?.kind==='orbit'?.1:0;
      campusFraming = framingTarget * easeAt(Math.min(1,state.cameraElapsed/350));
      if(campusFraming>.00001)camera.setViewOffset(root.clientWidth,root.clientHeight,-root.clientWidth*campusFraming,0,root.clientWidth,root.clientHeight);
      else if(camera.view?.enabled)camera.clearViewOffset();
      const idleDelta = state.shot !== null || state.camera.site ? {lng:0,lat:0,altitude:0,orbit:0} : idle.update(elapsed,globe.pointOfView().altitude,(!!flight && moving) || interacting);
      if(interiorDescent && (state.shot===null || state.camera.site!=='fifth-avenue'))interiorDescent=undefined;
      if (!flight && state.camera.site && !interacting && state.camera.primitive?.kind!=='orbit') {
        const progress=interiorDescent?(state.shot===interiorDescent.shot
          ?Math.min(1,Math.max(0,(state.shotElapsed-interiorDescent.start)*1000/interiorDescent.duration)):1):0;
        const pose = interiorDescent
          ? fifthAvenueShotCamera(globe.getGlobeRadius(), progress*7.8)
          : siteCamera(state.camera.site, globe.getGlobeRadius(), idleDelta.orbit);
        if(interiorDescent){
          // Blend the live fly-in endpoint into the calibrated street pose.
          // Keep the final hall pose across scene boundaries; no reset to street.
          const blend=easeAt(Math.min(1,progress/.12));
          pose.position.lerpVectors(interiorDescent.eye,pose.position,blend);
          pose.target.lerpVectors(interiorDescent.target,pose.target,blend);
          pose.fov=interiorDescent.fov+(pose.fov-interiorDescent.fov)*blend;
          pose.position.sub(pose.target).applyAxisAngle(pose.up,idleDelta.orbit*Math.PI/180).add(pose.target);
        }
        camera.position.copy(pose.position); camera.up.copy(pose.up); controls.target.copy(pose.target); camera.fov = pose.fov; camera.updateProjectionMatrix(); camera.lookAt(pose.target);
      }
      if((!flight || !moving) && state.camera.primitive?.kind==='orbit') {
        const normal=controls.target.clone().normalize();camera.position.sub(controls.target).applyAxisAngle(normal,idleDelta.lng*Math.PI/180).add(controls.target);camera.lookAt(controls.target);
      }
      controls.minDistance = controls.target.lengthSq() > 0 ? 0.000005 : globe.getGlobeRadius() * (1 + SITE_CLEARANCE_METERS/EARTH_METERS);
      globe.controls().enabled = true;
      globe.controls().autoRotate = false;
      if (!flight && !interacting && !state.camera.site) {
        const view=globe.pointOfView();
        // Scale motion down near the surface so a close site never drifts out of view.
        const scale=Math.min(1,view.altitude/.1);
        globe.pointOfView({lat:Math.max(-85,Math.min(85,view.lat+idleDelta.lat*scale)),lng:view.lng+idleDelta.lng*scale,
          altitude:Math.max(.0000002,Math.min(4,view.altitude+idleDelta.altitude))},0);
      }
      // Last guard covers Cartesian interpolation, site paths, idle poses and
      // bookmark paths as well as the geographic primitives themselves.
      const eye = {lat:Math.asin(camera.position.y/camera.position.length())*180/Math.PI,
        lng:Math.atan2(camera.position.x,camera.position.z)*180/Math.PI,
        altitude:camera.position.length()/globe.getGlobeRadius()-1};
      const hasInterior = !!interiorDescent && models.status().some(m=>m.id==='fifth-avenue'&&m.loaded);
      const reference = cameraGround(eye, hasInterior);
      const safeEye = clampCamera(eye,reference);
      camera.position.copy(globe.getCoords(safeEye.lat,safeEye.lng,safeEye.altitude));camera.lookAt(controls.target);
      clearance = cameraClearance(safeEye,reference);
      localFocus=state.camera.site&&!interacting?controls.target.clone():undefined;
      effects.setInterior(reference.site==='fifth-avenue'&&reference.minimumMeters<12);
      const isClose = globe.pointOfView().altitude < 0.02;
      if (close !== isClose) { close = isClose; globe.pointsData(close ? [] : firms); }
      const pov = globe.pointOfView();
      if(!flight)engine.observeCamera(pov);
      models.update(pov.lat, pov.lng, pov.altitude, elapsed);
      const nearHero = (['apple-park', 'fifth-avenue'] as const).some(id => nearSite(id, pov.lat, pov.lng, Math.min(pov.altitude, 0.001)));
      const wantsSite = !!state.camera.site || shotSite(state.shot)!==null || (state.shot === null && pov.altitude < 0.008 && nearHero);
      if (TILES_ENABLED && canUseTiles(true,import.meta.env.VITE_GOOGLE_TILES_KEY) && wantsSite && !siteStatus.failed && !siteScene && !siteScenePromise) {
        siteScenePromise = import('./site-scene.ts').then(module => {
          if (disposed || !siteHost.current || !siteAttribution.current) return;
          siteScene = module.createSiteScene(siteHost.current, siteAttribution.current, import.meta.env.VITE_GOOGLE_TILES_KEY!);

        }).catch(() => { siteStatus = { ...siteStatus, failed: true }; }).finally(() => { siteScenePromise = undefined; });
      }
      if (siteScene) {
        siteStatus = siteScene.update({ state, lat: pov.lat, lng: pov.lng, altitude: pov.altitude, globeRadius: globe.getGlobeRadius(),
          cameraPosition: camera.position, cameraTarget: controls.target, cameraUp: camera.up, fov: camera.fov, recording: state.recording }, elapsed);
        siteIdle = wantsSite || siteStatus.opacity > 0 ? 0 : siteIdle + elapsed;
        if (siteIdle > 1800) { siteScene.dispose(); siteScene = undefined; siteStatus = { site: null, ready: false, failed: false, progress: 0, visibleTiles: 0, opacity: 0, ground: null, modelSize: null, tileBounds: null }; }
      }
      const fullSiteShot = shotSite(state.shot)!==null && siteStatus.opacity > 0.985;
      if (fullSiteShot !== globePaused) {
        globePaused = fullSiteShot;
        if (globePaused) globe.pauseAnimation(); else globe.resumeAnimation();
      }
      globe.renderer().toneMappingExposure=1+state.exposure*5;
      effects.update(state.position, elapsed, isClose, !moving || state.shot === 1 || (state.shot === 10 && state.stage === 'cube') || (state.shot !== null && isClose),
        isClose && (state.shot === 1 || state.shot === 2) ? siteSun('apple-park', globe.getGlobeRadius()) :
          state.camera.site === 'fifth-avenue' ? siteSun('fifth-avenue', globe.getGlobeRadius()) : undefined, state.camera.site === 'fifth-avenue',state.timelapse,state.shot !== null);
      const reversing = state.timelapse?.direction===-1 && state.timelapse.elapsed<2000;
      const incoming = [] as typeof engine.index.days[number]['events'];
      if (revision !== state.revision || state.day < day) {
        pool.clear(); arcIds = '\0'; pulseRings = []; globe.ringsData([]); cursor = 0; day = state.day;
      }
      // Preserve retiring arcs across forward day boundaries; scrubs still reset the scene.
      for (let d = Math.max(0, day); !reversing && d <= state.day; d++) {
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
      const scripted=engine.drainStoryEvents();
      if (engine.storyEvents !== null) incoming.splice(0,incoming.length,...scripted);
      else incoming.push(...scripted);
      if(state.shot===16 && !pulseRings.length)pulseRings.push({lat:37.3349,lng:-122.009,color:MONEY,born:time});
      revision = state.revision; day = state.day;
      // Admission is bounded even for a scrub directly into an extremely dense day.
      for (const event of incoming.filter(isPayment).slice(-200)) {
        const life = arcLifetime(moving ? speedRate(state.speed) : 1, state.shot === 3 || state.shot === 4);
        pool.add(event, engine.index, time - (moving ? 0 : 750), life, state.paymentMaturity??undefined,state.paymentAmount??undefined);
      }
      for (const event of incoming.slice(-40)) {
        if (!isPayment(event) && event.type !== 'extend') continue;
        const firm = engine.index.firms.get(event.to ?? event.accounts[0]);
        if (firm?.lat != null && firm.lng != null) pulseRings.push({ lat: firm.lat, lng: firm.lng, born: time, color: event.type === 'extend' ? 'extension' : 'money' });
      }
      if(reversing) {
        pool.clear(); pulseRings=[]; globe.ringsData([]);
        for(const sample of sampleRewindEvents(engine.index,state.position,state.timelapse!.elapsed,{windowDays:50,maxEvents:80})) {
          pool.add(sample.event,engine.index,time-sample.age,sample.life);
          const arc=pool.arcs.find(a=>a.id===sample.event.seq);if(arc)arc.reverse=true;
        }
        // Newly sampled objects need to replace three-globe's cached data too.
        arcIds='\0';
      }
      cursor = state.cursor;
      pool.tick(time,state.paymentPresentation==='waiting');
      const nextArcIds = pool.arcs.map(arc => arc.id).join(',');
      if (nextArcIds !== arcIds) { arcIds = nextArcIds; globe.arcsData(pool.arcs); }
      updateArcMaterials(pool.arcs, globe.getGlobeRadius());
      if ((moving && now - lastColor > 33) || incoming.length) {
        lastColor = now;
        const nextRings = pulseRings.filter(r => time - r.born < 650).slice(-40);
        if (nextRings.length !== pulseRings.length || incoming.length) globe.ringsData(nextRings);
        pulseRings = nextRings;
      }
      const landscape=root.clientWidth/root.clientHeight>=4/3;
      const filmScale=landscape?Math.min(root.clientWidth/1920,root.clientHeight/1080):1;
      const ledgerLeft = !landscape?root.clientWidth-12:state.recording?root.clientWidth-24*filmScale:root.clientWidth-760*filmScale;
      layer.update(globe, pool.arcs, time, ledgerLeft, root.clientHeight - 330*filmScale,filmScale);
      companyLayer.update(globe, named, new Set(pool.arcs.flatMap(arc => [arc.event.from ?? '', arc.event.to ?? ''])), ledgerLeft,
        root.clientHeight - 330*filmScale, close, !landscape,filmScale);
      companyLayer.updateCallouts(globe,named,companyCues(state),state.shot===null?state.tMs:state.shotElapsed*1000,landscape?filmScale:root.clientWidth/1920,root.clientHeight-330*filmScale);
      if (schedule) raf = requestAnimationFrame(frame);
    };
    if (!frameDriven) raf = requestAnimationFrame(frame);
    {
      const bookmarks=new CameraBookmarks();
      window.__cascade = { frameDriven,ready:()=>engine.ready(),cue:(name,value,atMs)=>engine.cue(name,value,atMs),readiness:effects.readiness,cameraClearance:()=>({...clearance}), bookmarks:bookmarks.items,exportBookmarks:()=>bookmarks.export(),loadBookmarks:(json)=>{const result=bookmarks.load(json);engine.update({});return result;},fromBookmarks:(list)=>{engine.stopShot();return engine.playBookmarkPath(list);},addBookmark:()=>{const result=bookmarks.append(globe.pointOfView(),engine.state.shot,engine.state.shotElapsed);engine.update({});return result;}, engine, globe, pool, shots:SHOTS,sceneTransitions,get filmStartMs(){return filmStartMs;},
        playScene:(id)=>playShot(engine,id),playFilm:async()=>{await engine.ready();sceneTransitions.length=0;lastTransitionShot=null;filmStartMs=frameDriven?0:performance.now();playFilm(engine);}, models: models.status, cameraFlightActive: () => !!flight,
        renderFrame:(tMs:number)=>{frame(tMs,false);camera.lookAt(controls.target);camera.updateMatrixWorld(true);globe.scene().updateMatrixWorld(true);globe.renderer().setRenderTarget(null);globe.renderer().render(globe.scene(),camera);},
        tiles: () => siteStatus,
        siteView: (site, orbit = 0) => {
          engine.stopShot(); flight = undefined;
          const pose = siteCamera(site, globe.getGlobeRadius(), orbit);
          camera.position.copy(pose.position); camera.up.copy(pose.up); controls.target.copy(pose.target);
          camera.fov = pose.fov; camera.updateProjectionMatrix(); camera.lookAt(pose.target);
        },
        siteNadir: (site, altitude = 900) => {
          engine.stopShot(); flight = undefined;
          const radius = globe.getGlobeRadius(), frame = siteFrame(SITES[site].lat, SITES[site].lng, radius);
          const position = sitePoint(site, radius, 0, altitude, 0), target = sitePoint(site, radius, 0, 0, 0);
          camera.position.copy(position); camera.up.copy(frame.north); controls.target.copy(target);
          camera.fov = 45; camera.updateProjectionMatrix(); camera.lookAt(target);
        },
        geography: () => {
          let earth: Mesh | undefined;
          globe.scene().traverse(object => { if ((object as Mesh).material === globe.globeMaterial()) earth = object as Mesh; });
          globe.scene().updateMatrixWorld(true);
          return GEO_REFERENCES.map(site => {
            const coords = globe.getCoords(site.lat, site.lng, 2), origin = new Vector3(coords.x, coords.y, coords.z);
            const hit = earth && new Raycaster(origin, origin.clone().negate().normalize()).intersectObject(earth)[0];
            return { ...site, expected: atlasUv(site.lat, site.lng), uv: hit?.uv ? { u: hit.uv.x, v: hit.uv.y } : null };
          });
        }, ageArcs: (milliseconds: number) => { time += milliseconds; pool.tick(time,engine.state.paymentPresentation==='waiting'); updateArcMaterials(pool.arcs, globe.getGlobeRadius()); },
        geometry: () => pool.arcs.map(a => {
          const group = (a as LiveArc & { __threeObjArc?: Group }).__threeObjArc;
          const mesh = group?.children[0] as Mesh | undefined;
          const material = mesh?.material as import('three').ShaderMaterial | undefined;
          return { seq: a.id, geometry: mesh?.geometry.uuid, alpha: material?.uniforms?.alpha?.value ?? null, clipStart: a.clipStart, clipEnd: a.clipEnd, groundKm: a.groundKm, depthTest: material?.depthTest };
        }) };
    }
    return () => {
      disposed = true;
      root.removeEventListener('touchstart', captureTouch); root.removeEventListener('touchmove', captureTouch);
      cancelAnimationFrame(raf); observer.disconnect(); layer.dispose(); companyLayer.dispose();
      models.dispose();
      if (globePaused) globe.resumeAnimation(); siteScene?.dispose();
      globe.scene().remove(park); geometry.dispose(); material.dispose(); texture.dispose();
      controls.removeEventListener('change',maintainSiteControls);
      globe.controls().removeEventListener('start', interact); globe.controls().removeEventListener('end', interactionEnd); effects.dispose(); fifth.dispose();
      unsubscribeTransitions();globe._destructor(); root.replaceChildren(); delete window.__cascade;
      delete engine.subsurfaceInteriorCameraHook;
    };
  }, [engine]);
  return <><div className="globe-scene" ref={host} aria-label="Global payment network" /><div className="site-scene" ref={siteHost} aria-hidden="true" /><div className="site-attribution" ref={siteAttribution} hidden />
    <div className="company-layer" ref={companies} aria-hidden="true" /><div className="amount-layer" ref={amounts} aria-hidden="true" />{error && <div className="globe-error" role="alert">{error}</div>}</>;
}
