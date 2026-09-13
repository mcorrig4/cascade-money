import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SHOTS,FILM_SECONDS,playFilm,playShot,COMPOSABLE_BEATS,COIN_BEATS} from '../src/director/shots.ts';
import {PlaybackEngine} from '../src/playback/engine.ts';
import {createIndex,appendEvent,finishIndex} from '../src/data/index.ts';
import {parseLine} from '../src/data/adapters.ts';
import {easeAt,longitudeDelta,orbitAt,splineAt,sampleCamera,EARTH_METERS,SUBSURFACE_INTERIOR_CAMERA_HOOK} from '../src/camera/primitives.ts';
const index=createIndex();(await readFile(new URL('./fixtures/events-v1.ndjson',import.meta.url),'utf8')).trim().split('\n').forEach(l=>appendEvent(index,parseLine(l)));finishIndex(index);
test('12 scenes cover narration v6, preserve API IDs and connect every declared boundary',()=>{
 // Scene-11-delete pass (2026-09-13, Liam 04:15 EDT): shot 10 ("New York",
 // the store flight + stair descent) is cut — the store beat is dropped.
 // Scene 8 ("Underneath it", shot 18) STAYS. 12 shots remain: ids 1, 2, 3,
 // 16, 4, 17, 6, 18, 5, 11, 19, 12 (in play order).
 assert.ok(Math.abs(FILM_SECONDS-186.4)<1e-7);assert.equal(new Set(SHOTS.map(s=>s.id)).size,12);
 assert.deepEqual(SHOTS.map(s=>s.seconds),[6.6,16.2,20.2,8.2,23,13,27.8,20.6,18.2,17.8,10.2,4.6]);
 for(let i=0;i<SHOTS.length;i++){
  // Stage 18's scene 2 (California zoom -> Apple marker approach -> pull-out)
  // legitimately names a hold beat in its motion string; every other shot
  // still must not describe itself as holding.
  const shot=SHOTS[i];assert.ok(shot.motion && (shot.id===2||!shot.motion.includes('hold')));
  if(i){assert.deepEqual(shot.start,SHOTS[i-1].end);assert.equal(shot.startTime,SHOTS[i-1].endTime);}
 }
 assert.equal(SHOTS.find(s=>s.id===6)?.scene,7);assert.equal(SHOTS.find(s=>s.id===18)?.scene,8);
 assert.equal(SHOTS.find(s=>s.id===19)?.scene,11);assert.equal(SHOTS.find(s=>s.id===11)?.seconds,17.8);
 assert.equal(COMPOSABLE_BEATS.at(-1)?.title,'Derivatives');assert.ok(COIN_BEATS.every((b,i)=>!i||b.at-COIN_BEATS[i-1].at<=8));
});
test('cubic and bezier moves are monotone, bounded and respect forced hemisphere travel',()=>{
 for(const ease of [{kind:'cubic'} as const,{kind:'bezier',points:[.12,.65,.18,1]} as const]){
  let previous=0;
  for(let i=0;i<=100;i++){const value=easeAt(i/100,ease as Parameters<typeof easeAt>[1]);assert.ok(value>=previous&&value<=1);previous=value;}
  assert.ok(easeAt(0,ease as Parameters<typeof easeAt>[1])<1e-7);assert.ok(easeAt(1,ease as Parameters<typeof easeAt>[1])>1-1e-7);
 }
 assert.equal(longitudeDelta(127.06,-84.85,'west'),-211.91);
 assert.ok(longitudeDelta(-157,127.06,'west')<0);
});
test('orbit uses real meters and spline preserves waypoint positions and endpoint tangents',()=>{
 const center={lat:0,lng:0,altitude:.001};const pose=orbitAt(center,1000,.002,0);
 assert.ok(Math.abs(pose.lat-1000/EARTH_METERS*180/Math.PI)<1e-10);assert.equal(pose.altitude,.002);
 const keys=[{lat:0,lng:0,altitude:.001,t:0,tangent:{lat:0,lng:0,altitude:0}},{lat:1,lng:2,altitude:.002,t:.5},{lat:0,lng:4,altitude:.0001,t:1,tangent:{lat:0,lng:0,altitude:0}}];
 assert.deepEqual(splineAt(keys,.5),{lat:1,lng:2,altitude:.002});assert.equal(splineAt(keys,1).lng,4);
 assert.ok(Math.abs(splineAt(keys,.00001).lng)<1e-7);
});
test('film advances exact boundaries without zero-duration camera cuts and exposes interior hook',()=>{
 const e=new PlaybackEngine(index);playFilm(e);
 const changes:{id:number;duration:number}[]=[];let camera=-1;
 e.subscribe(()=>{if(e.state.camera.id!==camera){camera=e.state.camera.id;changes.push({id:camera,duration:e.state.camera.duration});}});
 for(let i=0;i<SHOTS.length;i++){
  assert.equal(e.state.shot,SHOTS[i].id);e.tick(SHOTS[i].seconds);
  if(i<SHOTS.length-1)assert.equal(e.state.shotElapsed,0);
 }
 assert.equal(e.state.shotRunning,false);assert.equal(e.state.shot,12);
 assert.ok(changes.every(c=>c.duration>0));assert.equal(SUBSURFACE_INTERIOR_CAMERA_HOOK,'subsurface-interior-camera');
});
test('large ticks match frame-by-frame film timing; pause preserves the camera clock',()=>{
 // The old Rewind shot (id 13's global reverse-timelapse + flash) was cut
 // long before the scene-11-delete pass and has no table entry any more —
 // dropped the flash/exposure assertions that exercised its now-dead
 // playShot branch (removed alongside this test update) along with it.
 const a=new PlaybackEngine(index),b=new PlaybackEngine(index);playFilm(a);playFilm(b);
 a.tick(FILM_SECONDS);for(let i=0;i<Math.round(FILM_SECONDS*30);i++)b.tick(1/30);
 assert.equal(a.state.shot,b.state.shot);assert.ok(Math.abs(a.state.shotElapsed-b.state.shotElapsed)<1e-7);
 const e=new PlaybackEngine(index);playShot(e,3);e.tick(1);e.toggle();const before=sampleCamera(e.state.camera,e.state.cameraElapsed);e.tick(2);assert.deepEqual(sampleCamera(e.state.camera,e.state.cameraElapsed),before);
});

test('every camera command inherits the preceding sampled pose at its exact cue boundary',()=>{
 const e=new PlaybackEngine(index);playFilm(e);
 let previous=sampleCamera(e.state.camera,e.state.cameraElapsed),id=e.state.camera.id;
 e.subscribe(()=>{
   if(e.state.camera.id!==id){
     const from=e.state.camera.from!;
     assert.ok(Math.abs(from.lat-previous.lat)<1e-7);
     assert.ok(Math.abs(longitudeDelta(from.lng,previous.lng))<1e-7);
     assert.ok(Math.abs(from.altitude-previous.altitude)<1e-7);
     id=e.state.camera.id;
   }
   previous=sampleCamera(e.state.camera,e.state.cameraElapsed);
 });
 e.tick(FILM_SECONDS);
});

test('capture offsets stay inside every scene and ignore intervening real-time frames',()=>{
 const e=new PlaybackEngine(index);
 e.setClockMode('manual');
 // Repeat on the same engine, as the two viewport passes do.
 for(let pass=0;pass<2;pass++){
  playFilm(e);
  let playing=e.state.playing,clock=0;
  e.update({playing:false,shotRunning:false});
  for(const shot of SHOTS){
   assert.ok(shot.captureAt>0&&shot.captureAt<shot.seconds);
   const target=shot.startTime+shot.captureAt;
   // A slow browser can spend longer than the entire opening rendering.
   e.tick(10);
   e.update({playing,shotRunning:true});
   e.tick(target-clock,'manual');
   playing=e.state.playing;
   e.update({playing:false,shotRunning:false});
   const snapshot=e.state;
   e.tick(30);
   assert.equal(e.state,snapshot);
   assert.equal(e.state.shot,shot.id);
   assert.ok(Math.abs(e.state.shotElapsed-shot.captureAt)<1e-7);
   clock=target;
  }
 }
 // Clock ownership, rather than paused flags, protects the startup window.
 playFilm(e);e.tick(10);assert.equal(e.state.shotElapsed,0);
 e.setClockMode('realtime');e.tick(SHOTS[0].seconds);assert.equal(e.state.shot,2);
});

test('opening shot rotates from its first frame and remains at whole-Earth scale',async()=>{
 const {siteFrame}=await import('../src/globe/site-math.ts');
 const {OPENING_ROTATION}=await import('../src/director/shots.ts');
 const e=new PlaybackEngine(index);playShot(e,1);
 const opening=sampleCamera(e.state.camera,0),next=sampleCamera(e.state.camera,1000/60);
 assert.ok(opening.altitude>1);assert.equal(e.state.camera.site,undefined);
 assert.equal(e.state.camera.bookmarkPath,undefined);
 assert.ok(Math.abs((next.lng-opening.lng)*60-OPENING_ROTATION)<1e-8,'First visible frame already has the authored angular velocity');
 for(let frame=0;frame<=Math.floor(SHOTS[0].seconds*60);frame++){
  const pose=sampleCamera(e.state.camera,frame*1000/60);
  assert.ok(Math.abs(pose.altitude-opening.altitude)<1e-12);assert.ok(Math.abs(pose.lat-opening.lat)<1e-12);
  const eye=siteFrame(pose.lat,pose.lng,EARTH_METERS).position.multiplyScalar(1+pose.altitude);
  assert.ok(eye.length()>2*EARTH_METERS,'Wide scene cannot enter a campus model');
 }
 e.tick(SHOTS[0].seconds);
 assert.deepEqual(sampleCamera(e.state.camera,e.state.cameraElapsed),SHOTS[0].end);
 assert.deepEqual(SHOTS[1].start,SHOTS[0].end,'The California take inherits the opening boundary');
});

test('scene 2 continuously zooms to California, holds, and returns wide at every narration scale',async()=>{
 const {applyNarrationDurations,CALIFORNIA_HOLD,APPLE_MARKER_APPROACH}=await import('../src/director/shots.ts');
 try{
  for(const scale of [1,.8,1.25]){
   applyNarrationDurations({'2':16.2*scale});
   const e=new PlaybackEngine(index);playShot(e,2);const shot=SHOTS[1],command=e.state.camera;
   assert.equal(command.primitive?.kind,'spline');assert.equal(command.site,undefined);assert.equal(command.landmarkPath,undefined);
   assert.deepEqual(sampleCamera(command,0),shot.start);
   let previous=shot.start.altitude;
   for(let sample=1;sample<=30;sample++){
    const pose=sampleCamera(command,command.duration*sample/100);
    assert.ok(pose.altitude<=previous+1e-12,'Zoom-in stays monotonic');previous=pose.altitude;
   }
   for(const fraction of [.3,.4,.5])for(const field of ['lat','lng','altitude'] as const)assert.ok(Math.abs(sampleCamera(command,command.duration*fraction)[field]-CALIFORNIA_HOLD[field])<1e-10);
   previous=APPLE_MARKER_APPROACH.altitude;
   assert.deepEqual(sampleCamera(command,command.duration*.75),APPLE_MARKER_APPROACH);
   assert.ok(shot.end.altitude<shot.start.altitude);
   for(let sample=76;sample<=100;sample++){
    const pose=sampleCamera(command,command.duration*sample/100);
    assert.ok(pose.altitude>=previous-1e-12,'Final clause zooms back out monotonically');previous=pose.altitude;
   }
   e.tick(shot.seconds);assert.equal(e.state.shotRunning,false);
   assert.deepEqual(sampleCamera(command,e.state.cameraElapsed),shot.end);
   assert.deepEqual(SHOTS[2].start,shot.end,'Next scene inherits wide framing');
  }
 }finally{applyNarrationDurations({});}
});

test('recording visibility always retains the product HUD',async()=>{
 const {recordingVisibility}=await import('../src/director/recording.ts');
 const e=new PlaybackEngine(index);
 assert.equal(e.state.hud,true);
 for(const recording of [false,true])for(const hud of [false,true]){
  e.update({recording,hud});
  assert.deepEqual(recordingVisibility(recording),{hud:true,director:!recording,story:!recording,network:!recording});
 }
 e.update({recording:true,hud:false});assert.equal(e.state.hud,true);
});

test('bookmarks append immutable camera snapshots and export the same JSON',async()=>{
 const {CameraBookmarks}=await import('../src/director/bookmarks.ts');
 const book=new CameraBookmarks(),pose={lat:37,lng:-122,altitude:.001};
 book.append(pose,2,3);pose.lat=0;
 book.append({lat:38,lng:-121,altitude:.002},2,6);
 let downloaded='';
 let logged='';
 const json=await book.export(async value=>{downloaded=value;},value=>{logged=value;});
 assert.equal(logged,json);assert.equal(book.items[0].holdMs,0);assert.equal(book.items[0].travelMs,2500);
 assert.equal(downloaded,json);assert.deepEqual(JSON.parse(json),book.items);
 assert.equal(book.items[0].lat,37);assert.equal(book.items.length,2);
});

test('bookmark spline uses editable timing, unwraps longitude and rejects invalid poses',async()=>{
 const {fromBookmarks}=await import('../src/camera/primitives.ts');
 const a={lat:1,lng:179,altitude:1,time:5,sceneId:2};
 const b={lat:2,lng:-179,altitude:2,time:8,sceneId:2};
 const keys=fromBookmarks([a,b]);
 assert.deepEqual(keys,[{lat:1,lng:179,altitude:1,t:0},{lat:2,lng:181,altitude:2,t:2.5}]);
 assert.deepEqual(splineAt(keys,3),{lat:2,lng:181,altitude:2});
 assert.throws(()=>fromBookmarks([a]));
 assert.equal(fromBookmarks([a,{...b,time:5,sceneId:10}]).at(-1)!.t,2.5);
 assert.throws(()=>fromBookmarks([a,{...b,lat:NaN}]));
});

test('edited bookmarks replace in memory atomically and preserve defaults',async()=>{
 const {CameraBookmarks}=await import('../src/director/bookmarks.ts');
 const book=new CameraBookmarks(),reference=book.items;
 book.append({lat:1,lng:2,altitude:1},1,0);
 book.load(JSON.stringify([{lat:3,lng:4,altitude:2,sceneId:10,time:0,holdMs:1200,travelMs:4000}]));
 assert.equal(book.items,reference);assert.equal(book.items.length,1);
 assert.equal(book.items[0].holdMs,1200);assert.equal(book.items[0].travelMs,4000);
 assert.throws(()=>book.load('[{"lat":0}]'));assert.equal(book.items[0].lat,3);
});

test('bookmark flight has continuous velocity between legs and exact stationary dwell',async()=>{
 const {fromBookmarks}=await import('../src/camera/primitives.ts');
 const list=[0,1,2].map((lat,i)=>({lat,lng:lat,altitude:1,sceneId:1,time:i,holdMs:0,travelMs:i===2?4000:2000}));
 let keys=fromBookmarks(list);
 const epsilon=.00001;
 const before=(splineAt(keys,2).lat-splineAt(keys,2-epsilon).lat)/epsilon;
 const after=(splineAt(keys,2+epsilon).lat-splineAt(keys,2).lat)/epsilon;
 assert.ok(Math.abs(before-after)<.0001);assert.ok(after>0);
 list[1].holdMs=1000;keys=fromBookmarks(list);
 assert.equal(keys.at(-1)!.t,7);
 for(const t of [2,2.3,2.9,3])assert.deepEqual(splineAt(keys,t),{lat:1,lng:1,altitude:1});
 const e=new PlaybackEngine(index);assert.equal(e.playBookmarkPath(list),7000);
 assert.equal(e.state.camera.primitive?.kind,'spline');
});

test('shot bookmark path supersedes initial and scheduled authored moves',()=>{
 const shot=SHOTS.find(s=>s.id===2)!;
 shot.path=[0,1,2].map((n)=>({lat:37+n*.01,lng:-122,altitude:.001,sceneId:2,time:n,holdMs:0,travelMs:2000}));
 try{
  const e=new PlaybackEngine(index);playShot(e,2);
  const id=e.state.camera.id;
  assert.equal(e.state.camera.bookmarkPath,true);
  e.tick(14);
  assert.equal(e.state.camera.id,id,'Scheduled arch and pull-out do not replace edited path');
  assert.equal(e.state.camera.primitive?.kind,'spline');
  playShot(e,6);assert.notEqual(e.state.camera.id,id,'Next scene restores authored camera');
 }finally{delete shot.path;}
});

// Film v5 owns presentation typography and token demonstrations outside the app window.
// Render production JSX with the small fixture; this does not claim CSS/WebGL acceptance.
const {createElement:h}=await import('react');
const {renderToStaticMarkup:markup}=await import('react-dom/server');
const {transpileModule,JsxEmit,ModuleKind,ScriptTarget}=await import('typescript');
const componentUrls=new Map<string,string>();
async function componentUrl(file:URL,source?:string):Promise<string>{
 if(source===undefined&&componentUrls.has(file.href))return componentUrls.get(file.href)!;
 const input=(source??await readFile(file,'utf8')).replaceAll('import.meta.env',JSON.stringify({VITE_PUBLIC_APP_URL:'http://cascade.test/',BASE_URL:'/'})).replace(/^import ['"][^'"]+\.css['"];?$/gm,'');
 let code=transpileModule(input,{compilerOptions:{jsx:JsxEmit.ReactJSX,module:ModuleKind.ESNext,target:ScriptTarget.ESNext}}).outputText;
 for(const match of [...code.matchAll(/from (["'])([^"']+)\1/g)]){
  const specifier=match[2],url=specifier.startsWith('.')?new URL(specifier,file):null;
  const resolved=url?(url.pathname.endsWith('.tsx')?await componentUrl(url):url.href):import.meta.resolve(specifier);
  code=code.replace(match[0],`from ${match[1]}${resolved}${match[1]}`);
 }
 const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;componentUrls.set(file.href,url);return url;
}
const {ShotOverlays}=await import(await componentUrl(new URL('../src/director/ShotOverlays.tsx',import.meta.url)));
const {SceneLabels}=await import(await componentUrl(new URL('../src/director/SceneLabels.tsx',import.meta.url)));
const {FilmEffects}=await import(await componentUrl(new URL('../src/director/FilmEffects.tsx',import.meta.url)));
const {DatedDollar}=await import('../src/components/DatedDollar.ts');
const {SCENE_TEXT_BEATS,SCENE_LOCATIONS}=await import('../src/director/shots.ts');
function overlay(kind:typeof SHOTS[number]['overlay'],recording:boolean,elapsed=5){
 const scene=SHOTS.find(s=>s.overlay===kind)??SHOTS.find(s=>s.id===6)!,original=scene.overlay;
 try{
  scene.overlay=kind;
  const engine=new PlaybackEngine(index);
  engine.update({shot:scene.id,shotElapsed:elapsed,tMs:scene.startTime*1000+elapsed*1000,recording});
  return markup(h(ShotOverlays,{engine,state:engine.state}));
 }finally{scene.overlay=original;}
}
for(const [kind,card] of [['question','question-card'],['totals','cascade-totals'],['coin','coin-layout'],['backing','backing-card'],['composable','architecture-card'],['contradiction','contradiction-card'],['laws','laws-card'],['wordmark','close-card']] as const){
 test(`W1 recording omits ${kind} presentation overlay and its wrapper`,()=>{
  assert.ok(overlay(kind,false).includes(card),`${kind} remains available interactively`);
  assert.equal(overlay(kind,true),'',`${kind}: recording must have no card, overlay box, or dimmer`);
 });
}
for(const [element,elapsed] of [['coin-copy',5],['coin-stage',5],['same-date-stage',7],['ghost-bill',10],['extension-ticks',17],['date-interval',17],['meter-label',17]] as const){
 test(`W1 recording omits coin ${element}`,()=>{
  assert.ok(overlay('coin',false,elapsed).includes(`class="${element}"`),`${element} is active interactively at ${elapsed}s`);
  assert.equal(overlay('coin',true,elapsed).includes(`class="${element}"`),false,`${element} belongs to the film`);
 });
}
for(const beat of SCENE_TEXT_BEATS)test(`W1 recording omits narration ${beat.id}`,()=>{
 const scene=SHOTS.find(s=>s.id===beat.shot)!,elapsed=(beat.at+.4)*scene.seconds/scene.baseSeconds;
 const render=(recording:boolean)=>markup(h(SceneLabels,{shot:beat.shot,elapsed,recording}));
 assert.ok(render(false).includes(beat.text),'Interactive narration remains');
 assert.equal(render(true).includes('scene-narration'),false,`${beat.id} belongs to the film`);
});
test('W1 recording omits closing ending-line but preserves exposure',()=>{
 const scene=SHOTS.find(s=>s.id===12)!,engine=new PlaybackEngine(index);
 engine.update({shot:12,shotElapsed:1,tMs:scene.startTime*1000+1000,exposure:.25});
 assert.ok(markup(h(FilmEffects,{state:engine.state})).includes('ending-line'));
 engine.update({recording:true});const html=markup(h(FilmEffects,{state:engine.state}));
 assert.equal(html.includes('ending-line'),false,'Closing typography belongs to the film');
 assert.ok(html.includes('class="film-exposure" style="opacity:0.25"'),'Exposure is retained');
});
test('W1 recording omits vault heading but preserves its live balance sheet',()=>{
 assert.ok(overlay('vault',false).includes('Extensions.'));
 const html=overlay('vault',true);
 assert.ok(html.includes('vault-columns')&&html.includes('Backing')&&html.includes('Dated units'));
 assert.equal(html.includes('Extensions.'),false,'Authored operation heading belongs to the film');
});
test('W1 recording omits the presentation dimmer from the product vault',()=>{
 assert.ok(overlay('vault',false).includes('globe-dimmer'));
 assert.equal(overlay('vault',true).includes('globe-dimmer'),false,'Product vault must not retain the presentation scrim');
});
for(const [label,pattern,expected] of [
 ['face gradient',/<stop[^>]*stop-color="([^"]+)"/g,['#214b43','#0a2624','#071919']],
 ['USD lettering',/<text[^>]*fill="([^"]+)"[^>]*>USD<\/text>/g,['#9aedd0']],
 ['plus',/<g transform="translate\(168\.87 136\.62\)" fill="([^"]+)"/g,['#9aedd0']],
 ['number',/<text[^>]*fill="([^"]+)"[^>]*>90<\/text>/g,['#9aedd0']],
 ['date',/<text[^>]*fill="([^"]+)"[^>]*>2025-12-08<\/text>/g,['#94b9ac']],
] as const)test(`W1 green coin ${label} matches the original b6826bc palette`,()=>{
 const html=markup(h(DatedDollar,{days:90,isoDate:'2025-12-08',size:180}));
 assert.deepEqual([...html.matchAll(pattern)].map(match=>match[1]),expected,`${label} must use the original green one-dollar palette`);
});
test('W1 interactive question card uses the shared USD+ coin',()=>{
 const html=overlay('question',false,6);
 assert.ok(html.includes('class="dated-dollar"'),'Scene 4 uses DatedDollar');
 assert.equal(html.includes('class="dated-coin"'),false,'No duplicate $1 circle');
});
test('W1 preservation: coin geometry, rings and size-dependent date remain approved',()=>{
 for(const size of [64,72,96,180]){
  const html=markup(h(DatedDollar,{days:90,isoDate:'2025-12-08',size}));
  assert.ok(html.includes('viewBox="18 18 462 170"'));
  assert.equal((html.match(/<circle/g)??[]).length,3,'Two rings and one face; no historical third ring');
  assert.ok(html.includes('r="78" fill="none" stroke="#102824" stroke-width="7"'));
  assert.ok(html.includes('r="74.5" fill="none" stroke="#548e7d" stroke-width="7"'));
  assert.ok(html.includes('x="220.87" y="168.62" font-size="82"'));
  assert.equal(/>2025-12-08<\/text>/.test(html),size>=72);
 }
 assert.ok(markup(h(DatedDollar,{days:null})).includes('aria-label="USD spot"'));
});
test('W1 preservation: recording retains product location and revealed transaction labels',()=>{
 for(const location of SCENE_LOCATIONS)assert.ok(markup(h(SceneLabels,{shot:location.shot,elapsed:1,recording:true})).includes(location.name));
 const event=index.payments[0];assert.ok(event,'Small fixture has a revealed payment');
 assert.ok(markup(h(SceneLabels,{shot:3,elapsed:1,recording:true,orders:[event]})).includes('scene-orders'));
 assert.ok(markup(h(SceneLabels,{shot:4,elapsed:1,recording:true,payments:[event]})).includes('scene-cascade'));
});
test('W1 preservation: recording overlay ownership does not suppress capture timing boundaries',async()=>{
 const {shotOverlayVisible}=await import('../src/director/recording.ts');
 for(const scene of SHOTS){
  const state={shot:scene.id,shotElapsed:0,tMs:scene.startTime*1000,recording:true};
  assert.equal(shotOverlayVisible(state,scene),true,`Capture scene ${scene.scene} boundary remains visible`);
  assert.equal(shotOverlayVisible({...state,shotElapsed:-.001},scene),false);
 }
});

// Execute App's actual frame JSX with injected engine state. WebGL and browser
// lifecycle are outside these node tests; child product/presentation JSX is real.
const appFile=new URL('../src/App.tsx',import.meta.url),appSource=await readFile(appFile,'utf8');
const frameBody=appSource.slice(appSource.indexOf('  const visibility=recordingVisibility'),appSource.indexOf('\nexport default function App()'));
const frameImports=[...appSource.matchAll(/^import .* from ['"]\.(?:\/director\/(?:shots|recording)\.ts|\/components\/(?:DayLedger|Timeline|OnchainPanel)\.tsx|\/director\/(?:ShotOverlays|SceneLabels|FilmEffects)\.tsx)['"];$/gm)].map(match=>match[0]).join('\n');
const frameSource=`import {Suspense} from 'react';\nimport {speedRate} from './playback/engine.ts';\n${frameImports}\nconst GlobeScene=()=>null,Brand=()=>null,SiteNavigation=()=>null,ShotPanel=()=>null;\nexport function Frame({engine,onchain=false}){const state=engine.state,index=engine.index,director=false,ledgerOpen=false;const openDirector=()=>{},openOnchain=()=>{},setLedgerOpen=()=>{},setOnchain=()=>{},setDirector=()=>{};\n${frameBody}`;
const {Frame}=await import(await componentUrl(appFile,frameSource));
function appFrame(recording:boolean,shot:number|null=5,elapsed=1,options:{engine?:PlaybackEngine;onchain?:boolean;patch?:Partial<PlaybackEngine['state']>}={}){
 const dimensions=['innerWidth','innerHeight'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
 Object.defineProperties(globalThis,{innerWidth:{value:1920,configurable:true},innerHeight:{value:1080,configurable:true}});
 try{
  const engine=options.engine??new PlaybackEngine(index),scene=SHOTS.find(s=>s.id===shot);
  if(!options.engine)engine.update({hud:true,shot,caption:true,shotElapsed:elapsed,tMs:(scene?.startTime??0)*1000+elapsed*1000});
  engine.update({recording,...options.patch});
  return markup(h(Frame,{engine,onchain:options.onchain}));
 }finally{for(const [key,descriptor] of dimensions)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
}
test('W1 recording omits App year-caption',()=>{
 assert.ok(appFrame(false).includes('year-caption'));
 assert.equal(appFrame(true).includes('year-caption'),false,'Year caption belongs to the film');
});
test('W1 recording does not activate presentation overlay layout during coin swapping',()=>{
 assert.ok(appFrame(false,6,7).includes('overlay-active'));
 const html=appFrame(true,6,7);
 assert.equal(html.includes('overlay-active'),false,'No overlay-active layout for a film-owned card');
 assert.equal(html.includes('same-date-stage'),false,'No swap stage in the recording frame');
});
test('W1 preservation: recorded App keeps topbar, ledger sidebar, timeline and live counters',()=>{
 for(const shot of [3,16,4,17,6,18,5,11]){
  const html=appFrame(true,shot,7);
  for(const element of ['recording-hud','topbar','id="daily-ledger"','headline-counters','class="scrubber"','data-testid="committed"','data-testid="settled"','data-testid="invoices-settled"'])assert.ok(html.includes(element),`Shot ${shot} retains ${element}`);
  assert.ok(html.includes('ledger-sidebar'),`Shot ${shot} retains the sidebar`);
 }
});
test('W1 recording omits the fully revealed totals tagline',()=>{
 const text='The payments add up. The backing does not multiply.';
 assert.ok(overlay('totals',false,11).includes(text));
 assert.equal(overlay('totals',true,11).includes(text),false,'Totals h2 belongs to the film alongside the statistics');
});
test('W1 green coin face gradient keeps the original 65% middle stop',()=>{
 const html=markup(h(DatedDollar,{days:90}));
 assert.deepEqual([...html.matchAll(/<stop offset="([^"]+)"/g)].map(match=>match[1]),['0%','65%','100%']);
});
test('W1 preservation: globe AmountLayer still renders simulation amounts and dated coins',async()=>{
 const {AmountLayer}=await import('../src/globe/amount-layer.ts');
 const {PerspectiveCamera}=await import('three');
 // A minimal element host exercises amount/coin construction without a DOM,
 // browser, or claims about the eventual pixel layout.
 class Element {
  children:Element[]=[];parentNode:Element|null=null;parentElement={querySelectorAll:()=>[]};
  className='';textContent='';innerHTML='';hidden=false;dataset:Record<string,string>={};style:Record<string,string>={};
  append(...children:Element[]){for(const child of children){child.parentNode=this;this.children.push(child);}}
  replaceChildren(...children:Element[]){this.children=[];this.append(...children);}
  getBoundingClientRect(){return {top:0};}
 }
 const prior=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{value:{createElement:()=>new Element()},configurable:true});
 try{
  const host=new Element(),layer=new AmountLayer(host as unknown as HTMLElement);
  const camera=new PerspectiveCamera(60,1920/1080,.1,100);camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const globe={getCoords:()=>({x:0,y:0,z:1}),camera:()=>camera,getGlobeRadius:()=>1,getScreenCoords:()=>({x:600,y:400})};
  const event=index.payments[0],arc={id:1,event,maturity:90,midLat:0,midLng:0,altitude:0,born:0,life:5000,held:true};
  layer.update(globe as Parameters<AmountLayer['update']>[0],[arc as Parameters<AmountLayer['update']>[1][number]],1000,1500,900);
  assert.equal(host.children.length,1);const amount=host.children[0];
  assert.equal(amount.hidden,false);assert.ok(amount.children[0].textContent.length>0,'Simulation dollar amount remains');
  assert.equal(amount.children[1].className,'arc-coin');
  assert.ok(amount.children[1].innerHTML.includes('class="dated-dollar"'),'Globe labels retain shared DatedDollar');
  assert.ok(amount.children[1].innerHTML.includes('data-days="90"'));
 }finally{if(prior)Object.defineProperty(globalThis,'document',prior);else Reflect.deleteProperty(globalThis,'document');}
});

test('W1 Stage4 recording omits scene-8 automatic on-chain proof after its real cue',()=>{
 const engine=new PlaybackEngine(index);playShot(engine,18);engine.tick(16);
 assert.equal(engine.state.onchainGlimpse,true,'The authored scene-8 cue is active');
 const interactive=appFrame(false,18,16,{engine});
 assert.ok(interactive.includes('<dialog class="onchain-panel"'),'Interactive cue mounts the real proof dialog');
 assert.ok(interactive.includes('data-testid="token-diagram"'),'Proof child JSX is rendered, not a panel stub');
 assert.equal(appFrame(true,18,16,{engine}).includes('class="onchain-panel"'),false,'Entering recording after the cue removes the automatic dialog');
 assert.equal(engine.state.onchainGlimpse,true,'Ownership gating preserves the authored cue');
});
test('W1 Stage4 recording omits automatic on-chain proof when its cue fires during capture',()=>{
 const engine=new PlaybackEngine(index);engine.update({recording:true});playShot(engine,18);engine.tick(16);
 assert.equal(engine.state.onchainGlimpse,true);
 assert.equal(appFrame(true,18,16,{engine}).includes('class="onchain-panel"'),false,'The automatic cue cannot mount the proof in a recording');
});
test('W1 Stage4 preservation: manually opened on-chain proof remains product UI while recording',()=>{
 const engine=new PlaybackEngine(index);engine.update({onchainGlimpse:false});
 assert.ok(appFrame(true,null,0,{engine,onchain:true}).includes('<dialog class="onchain-panel"'),'Manual Verify on Arc remains available');
});
test('W1 Stage4 recording omits the startup introduction without a shot',()=>{
 assert.ok(appFrame(false,null).includes('class="scene-heading"'),'Interactive startup retains its introduction');
 assert.equal(appFrame(true,null).includes('class="scene-heading"'),false,'No presentation introduction in a recording without a shot');
});
test('W1 Stage4 recording omits a requested debt card',()=>{
 assert.ok(appFrame(false,null,0,{patch:{showDebt:true}}).includes('class="debt-card"'));
 assert.equal(appFrame(true,null,0,{patch:{showDebt:true}}).includes('class="debt-card"'),false,'The authored debt statistic is presentation');
});
test('W1 Stage4 recording visibility cannot select a clean frame',async()=>{
 const {recordingVisibility}=await import('../src/director/recording.ts');
 assert.equal(Reflect.apply(recordingVisibility,null,[true,false]).hud,true,'Recording always includes the product HUD');
});
test('W1 Stage4 entering recording through the helper restores a disabled HUD',async()=>{
 const {setRecordingMode}=await import('../src/director/recording.ts');
 const engine=new PlaybackEngine(index);engine.update({hud:false});
 assert.equal(engine.state.hud,false);setRecordingMode(engine,true);
 assert.equal(engine.state.hud,true,'Recording entry restores product HUD state');
});
test('W1 Stage4 external recording entry overrides an accompanying HUD-disable patch',()=>{
 const engine=new PlaybackEngine(index);engine.update({recording:true,hud:false});
 assert.equal(engine.state.hud,true,'External capture entry cannot disable the HUD');
});
test('W1 Stage4 active recording rejects subsequent HUD-disable updates',()=>{
 const engine=new PlaybackEngine(index);engine.update({recording:true});engine.update({hud:false});
 assert.equal(engine.state.hud,true,'HUD remains required throughout a recording');
});
test('W1 Stage4 preservation: exiting recording permits disabling the interactive HUD',async()=>{
 const {setRecordingMode}=await import('../src/director/recording.ts');
 const engine=new PlaybackEngine(index);setRecordingMode(engine,true);setRecordingMode(engine,false);engine.update({hud:false});
 assert.equal(engine.state.recording,false);assert.equal(engine.state.hud,false);
 engine.update({recording:true});engine.update({recording:false,hud:false});assert.equal(engine.state.hud,false);
});
