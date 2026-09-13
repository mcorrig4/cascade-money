import { eventPosition, PlaybackEngine } from '../playback/engine.ts';
import type { PlaybackState } from '../playback/engine.ts';
import type { Event, EventIndex } from '../data/types.ts';
import { appleParkShotCamera, siteFrame } from '../globe/site-math.ts';
import { orbitAt, EARTH_METERS, type Pose, type Ease, type Bookmark, fromBookmarks } from '../camera/primitives.ts';
export const APPLE={lat:37.3349,lng:-122.009,altitude:.0003};
export const STORE={lat:40.7638,lng:-73.973,altitude:.05};
const p=(lat:number,lng:number,altitude:number):Pose=>({lat,lng,altitude});
// Spoken words from docs/script-v6-liam.md; contractions and hyphenated words count as one.
// IDs preserve the existing camera/API contracts; scene is the narration order.
// Scene 1's orbit starts at the authored site-camera eye, without replacing
// its 225 m height / 520 m campus offset with a globe-scale altitude.
const opening=appleParkShotCamera(EARTH_METERS,0);
const campus=siteFrame(APPLE.lat,APPLE.lng,EARTH_METERS);
const openingEast=opening.position.dot(campus.east),openingNorth=opening.position.dot(campus.north);
const openingOrbit={
 radius:Math.atan2(Math.hypot(openingEast,openingNorth),opening.position.dot(campus.up))*EARTH_METERS,
 altitude:opening.position.length()/EARTH_METERS-1,
 bearing:Math.atan2(openingEast,openingNorth)*180/Math.PI,
};
type ShotDefinition={id:number;title:string;words:number;end:Pose;motion:string;overlay:string;site?:'apple-park'|'fifth-avenue';path?:Bookmark[];openingOrbit?:typeof openingOrbit;orbitUntil?:number;pullOutAt?:number};
const table:ShotDefinition[]=[
 // Scene 1's camera is a recorded bookmark flight (dev-mac
 // ~/cascade-3d/capture/record-scene1-v6b.mjs, used to shoot the
 // scene-01 capture): cold load holds on the whole-Earth pose (alt 3),
 // then a 3200ms flight into the Apple Park pose (APPLE, alt .0003),
 // holding there. `path` overrides the orbit motion below via the
 // engine's bookmarkOverride guard (playback/engine.ts) — the loading
 // screen still runs first (AppFrame's own loading window), this only
 // takes over the camera once the app is ready.
 {id:1,title:"The object of desire",words:14,openingOrbit,end:orbitAt(APPLE,openingOrbit.radius,openingOrbit.altitude,openingOrbit.bearing+32),motion:'orbit',overlay:'none',site:'apple-park' as const,
  path:[
   {lat:0,lng:-122.009,altitude:3,sceneId:1,time:0,holdMs:900,travelMs:2500},
   {lat:APPLE.lat,lng:APPLE.lng,altitude:.0003,sceneId:1,time:0,holdMs:2500,travelMs:3200},
  ]},
 // Pull-out end altitude 1.72 (was 2.5): measured to fill ~85% of frame
 // height (post16 pass, 2026-09-13) — see DECISIONS.md for the render-
 // verified fraction (0.848) and the cubic-out handoff from the arch spline.
 {id:2,title:"Apple Park",words:38,orbitUntil:10,pullOutAt:13.6,end:p(37.3349,-122.009,1.72),motion:'orbit + arch spline + pull-out',overlay:'none',site:'apple-park' as const},
 // Reorder-to-13 pass (2026-09-13, product owner + Director/wingman 03:33
 // ET): old shots 13 (Rewind) and 15 (The contradiction) are CUT, and old
 // shots 9 (Stress test) and 8 (The rules survive) are CUT as standalone
 // scenes too (their headline figure folds into a closing beat on shot 5's
 // scene — see StressResultFlash in film/src/compositions/CascadeFilm.tsx).
 // The remaining shots below are reordered to the new play order: `scene`
 // (buildShots' `i+1` below) now runs 1..13 in THIS array order, which is
 // no longer the shots' own `id` order — ids are stable camera/API
 // contracts (unchanged), only the sequence changes.
 {id:3,title:"The hidden supply chain",words:48,end:p(37.8,-84.85,1.5),motion:'westward payment sweep',overlay:'none'},
 {id:16,title:"The question",words:18,end:p(34,-76,1.8),motion:'idle drift',overlay:'question'},
 {id:4,title:"The cascade",words:55,end:p(33.77,-118.2,1.9),motion:'westward chain sweep',overlay:'none'},
 {id:17,title:"Let it land",words:30,end:p(34,-112,2),motion:'idle drift',overlay:'totals'},
 {id:6,title:"A dollar with a date",words:67,end:p(34.6,135.5,1.6),motion:'Pacific drift',overlay:'coin'},
 {id:18,title:"Underneath it",words:49,end:p(30,145,2),motion:'east drift',overlay:'backing'},
 {id:5,title:"Run the year",words:43,end:p(34,-118,2.35),motion:'global sweep',overlay:'none'},
 {id:11,title:"Zoom out",words:42,end:p(37.3349,-122.009,2.6),motion:'pull-out + east sweep',overlay:'composable'},
 {id:10,title:"New York",words:26,end:{...STORE,altitude:8/EARTH_METERS},motion:'store flight + stair descent',overlay:'none',site:'fifth-avenue' as const},
 {id:19,title:"Beneath it",words:23,end:{...STORE,altitude:8/EARTH_METERS},motion:'hall drift',overlay:'none',site:'fifth-avenue' as const},
 {id:12,title:"Close",words:9,end:{...STORE,altitude:8/EARTH_METERS},motion:'hall drift + exposure',overlay:'wordmark',site:'fifth-avenue' as const},
];
export type NarrationDurations=Record<string,number>;
/** narration.json: {"durations":{"1":6.6,"2":16.2}}; keys are scene numbers, values seconds. */
export function parseNarrationDurations(value:unknown):NarrationDurations {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Expected narration duration map');
 const record=value as Record<string,unknown>, source=record.durations??record;
 if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('Expected durations keyed by scene');
 const result:NarrationDurations={};
 for(const [key,seconds] of Object.entries(source)){
  if(!/^(?:[1-9]|1[0-3])$/.test(key)||typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0)
   throw new Error('Narration durations require scenes 1–13 and positive seconds');
  result[key]=seconds;
 }
 return result;
}
export function buildShots(durations:NarrationDurations={}) {
 let time=0;
 return table.map((s,i)=>{
  const baseSeconds=Math.round((s.words*60/150+1)*10)/10;
  // A shot with a recorded bookmark `path` (currently shot 1's whole-Earth
  // -> Apple Park flight) has a real-time floor on its duration: the film
  // can't compress the flight below its own recorded length. Floor `seconds`
  // here (not just at playback in playShot) so every later shot's startTime
  // stays in sync with the engine's actual runtime clock even when narration
  // durations would otherwise shrink this shot below the flight's length.
  const pathFloor=s.path?Math.round(fromBookmarks(s.path).at(-1)!.t*10)/10:0;
  const seconds=Math.max(durations[String(i+1)]??baseSeconds,pathFloor),startTime=time;time+=seconds;
  // The closing card is captured after its line-to-wordmark transition.
  const captureAt=seconds*(s.id===12?.9:s.id===11?.5:s.id===13?.55:.8);
  if(!(captureAt>0&&captureAt<seconds))throw new Error('Capture must be strictly inside scene');
  return {...s,scene:i+1,baseSeconds,seconds,captureAt,start:i?table[i-1].end:orbitAt(APPLE,openingOrbit.radius,openingOrbit.altitude,openingOrbit.bearing),
   startTime,endTime:time,duration:`${seconds.toFixed(1)}s`,detail:s.motion};
 });
}
export const SHOTS=buildShots();
export type ShotSite='apple-park'|'fifth-avenue';
export function shotSite(id:number|null):ShotSite|null {
 return (SHOTS.find(shot=>shot.id===id) as ({site?:ShotSite}|undefined))?.site??null;
}
export let FILM_SECONDS=SHOTS.at(-1)!.endTime;
export function applyNarrationDurations(durations:NarrationDurations) {
 SHOTS.splice(0,SHOTS.length,...buildShots(durations));FILM_SECONDS=SHOTS.at(-1)!.endTime;
}
export async function loadNarrationDurations(url:string,fetcher:typeof fetch=fetch) {
 try {const response=await fetcher(url,{signal:AbortSignal.timeout(2000)});if(!response.ok)return false;
  applyNarrationDurations(parseNarrationDurations(await response.json()));return true;
 }catch{return false;}
}
export const filmDuration=()=>`${Math.floor(FILM_SECONDS/60)}:${(FILM_SECONDS%60).toFixed(1).padStart(4,'0')}`;
/** Clause cues use provisional narration seconds and scale with the recorded take. */
export function narrationTime(state:Pick<PlaybackState,'shot'|'shotElapsed'|'shotDuration'>) {
 const shot=SHOTS.find(s=>s.id===state.shot);
 return shot?state.shotElapsed*shot.baseSeconds/(state.shotDuration||shot.seconds):state.shotElapsed;
}
export const CASCADE_FIGURES={
 straight:{committed:100_000_00000n,settled:400_000_00000n,companies:4},
 branched:{committed:100_000_00000n,settled:450_000_00000n,companies:8},
};
// Keep this switch aligned with film Scene08Counters for a future straight-line re-cut.
export const USE_EXTENDED_FIGURES=true;
export const DEFAULT_CASCADE=USE_EXTENDED_FIGURES?CASCADE_FIGURES.branched:CASCADE_FIGURES.straight;
export const VERIFIED_YEAR_INVOICES=12028;
export const STRESS_FIGURES={operations:10000,violations:0};
export const COMPOSABLE_BEATS=[
 {at:4,title:'Loans',detail:''},{at:4.4,title:'Forwards',detail:''},
 {at:4.8,title:'Bonds',detail:''},{at:5.2,title:'Derivatives',detail:''},
];
export const COIN_BEATS=[
 {at:0,key:'coin',title:'One dollar.',text:'With a calendar date attached.'},
 {at:4.8,key:'date',title:'One dollar. One date.',text:'Redeemable on its calendar date.'},
 {at:6.4,key:'fungibility',title:'Same date. Same dollar.',text:'Completely interchangeable.'},
 {at:8.8,key:'claim',title:'Earlier pays later. At face.',text:'Earlier date ≤ bill due date'},
 {at:15.2,key:'extend',title:'Extend farther.',text:'Capital committed for longer.'},
 {at:21.2,key:'yield',title:'Yield for exactly that time.',text:'Only the additional interval.'},
 {at:25.2,key:'date',title:'One dollar. One date.',text:''},
];
export const beatIndex=(times:readonly {at:number}[],elapsed:number)=>Math.max(0,times.findLastIndex(b=>elapsed>=b.at));
export const SCENE_LOCATIONS=[
 {shot:1,name:'Apple Park',place:'Cupertino, California'},
 {shot:2,name:'Apple Park',place:'Cupertino, California'},
 {shot:10,name:'Apple Store NYC',place:'Fifth Avenue, New York City'},
];
// Shot 13 (Rewind)'s date-card/stat-line beats were already dead (Rewind
// was cut before this pass); removed here rather than left pointing at a
// shot id that no longer exists in `table` (reorder-to-13 pass, 2026-09-13).
export const SCENE_TEXT_BEATS=[
 {shot:11,id:'money-plus-time',at:12.4,until:15,text:'Money plus time'},
 {shot:11,id:'final-line',at:15.2,until:17.7,text:'a second dimension to money'},
];
export function sceneTextAt(shot:number|null,elapsed:number,cues:Record<string,number>={}){
 const scene=SHOTS.find(s=>s.id===shot),scale=scene?scene.seconds/scene.baseSeconds:1,t=elapsed*1000;
 const beats=SCENE_TEXT_BEATS.filter(c=>c.shot===shot).map(c=>({...c,start:cues[c.id]??c.at*1000*(c.id==='date-card'?1:scale),end:c.until*1000*scale})).sort((a,b)=>a.start-b.start);
 const cue=beats.findLast(c=>t>=c.start);if(!cue)return null;
 const next=beats.find(c=>c.start>cue.start),end=cues[cue.id]===undefined?Math.min(cue.end,next?.start??Infinity):Math.min(cue.start+1800,next?.start??Infinity);
 if(t>=end)return null;
 const opacity=Math.max(0,Math.min(1,(t-cue.start)/250,(end-t)/250));return {...cue,opacity,offset:(1-opacity)*12};
}
export function position(engine: PlaybackEngine, event: Event, after = false) {
  const events = engine.index.days[event.day].events;
  return event.day + eventPosition(events.indexOf(event), events.length) + (after ? 0.000001 : -0.000001);
}
export function proofPayments(index: EventIndex, story = 'apple') {
  const name = (id?: string) => `${id} ${index.firms.get(id ?? '')?.name ?? ''}`.toLowerCase();
  const first = index.payments.find(e => e.type === 'issue' && (story === 'tesla'
    ? name(e.from).includes('tesla') && name(e.to).includes('panasonic')
    : (index.schema === 1 || ![...index.firms.values()].some(f => f.name.toLowerCase().includes('samsung'))) ? (e.invoiceId ?? '').startsWith('apple:') : name(e.from).includes('apple') && name(e.to).includes('samsung')));
  if (!first) return [];
  const marker = index.stories.find(s => s.payment?.seq === first.seq);
  if (marker) {
    const marked = index.stories.filter(s => s.storyId === marker.storyId && s.payment).map(s => s.payment!);
    const unique = [...new Map(marked.map(e => [e.seq, e])).values()].sort((a, b) => a.seq - b.seq);
    if (unique.length > 1) return unique;
  }
  const chain = [first];
  while (chain.length < 4) {
    const prev = chain.at(-1)!;
    const next = index.payments.find(e => e.seq > prev.seq && e.type === 'pay' && e.from === prev.to && e.amount === first.amount && !chain.some(p => p.invoiceId === e.invoiceId));
    if (!next) break; chain.push(next);
  }
  return chain;
}
// A generation shares a beat; sibling payments from one payer remain consecutive.
export function cascadeBeats(events: Event[]) {
  const levels = new Map<string, number>(), beats: Event[][] = [];
  for (const event of events) {
    const level = levels.get(event.from!) ?? 0;
    (beats[level] ??= []).push(event);
    levels.set(event.to!, level + 1);
  }
  return beats.filter(Boolean);
}


export function proofMaturity(event?:Event):number|null {
 const value=event?.data.mint_date??event?.data.accepted_maturity??event?.dates?.at(-1);
 return typeof value==='number'?value:null;
}
const engineFirmName=(index:EventIndex,id?:string)=>index.firms.get(id??'')?.name??id??'';
export function straightProofPayments(index:EventIndex,story='apple') {
 const all=proofPayments(index,story),chain:Event[]=[];
 if(all[0])chain.push(all[0]);
 while(chain.length<4){
  const previous=chain.at(-1);if(!previous)break;
  const candidates=all.filter(e=>e.seq>previous.seq&&e.from===previous.to&&!chain.includes(e));
  const next=(chain.length===3?candidates.find(e=>/freight|logistics|carrier/i.test(engineFirmName(index,e.to))):undefined)??candidates[0];
  if(!next)break;chain.push(next);
 }
 return chain;
}
/** Keep only descendants of the first order, even if a story contains other roots. */
export function branchedProofPayments(index:EventIndex,story='apple') {
 const all=proofPayments(index,story),chain:Event[]=[],reached=new Set<string>();
 for(const event of all){
  if(!chain.length || (event.type==='pay'&&reached.has(event.from!))){
   chain.push(event);reached.add(event.to!);
  }
 }
 return chain;
}
export const ORDER_SITES:Record<string,string>={
 'story:0':'samsung-display-asan','story:1':'corning-harrodsburg',
 'story:10':'tsmc-hsinchu','story:17':'foxconn-zhengzhou',
};
/** Presentation juxtaposes orders issued on days 0, 10 and 120; events keep their dates. */
export function appleOrders(index:EventIndex) {
 if(index.schema===1)return proofPayments(index).slice(0,1);
 const marked=new Set(index.stories.flatMap(s=>s.payment?[s.payment.seq]:[]));
 return ['story:0','story:10','story:17'].flatMap(id=>{
  const event=index.payments.find(e=>e.invoiceId===id&&e.type==='issue'&&e.from==='Apple'&&marked.has(e.seq));
  return event?[event]:[];
 });
}
export function shotAvailable(_engine:PlaybackEngine,id:number){return SHOTS.some(s=>s.id===id);}
const chase:Ease={kind:'bezier',points:[.12,.65,.18,1]};
export function nextShot(id:number,direction=1){return SHOTS[Math.max(0,Math.min(SHOTS.length-1,SHOTS.findIndex(s=>s.id===id)+direction))].id;}
export function playFilm(engine:PlaybackEngine):void|Promise<void>{if(!engine.isReady)return engine.ready().then(()=>playFilm(engine));engine.update({tMs:0});playShot(engine,SHOTS[0].id,true);}
export function playShot(engine:PlaybackEngine,id:number,continuous=false) {
 const shot=SHOTS.find(s=>s.id===id);if(!shot)return;
 const duration=shot.path?Math.max(shot.seconds,fromBookmarks(shot.path).at(-1)!.t):shot.seconds;
 engine.beginShot(id,duration);engine.update({film:continuous,tMs:shot.startTime*1000});
 if(shot.path)engine.playBookmarkPath(shot.path,true);
 const ms=shot.seconds*1000,scale=shot.seconds/shot.baseSeconds;
 const at=(seconds:number,run:()=>void)=>engine.after(seconds*scale,run);
 const fly=(target:Pose,duration:number,route:'west'|'east'|'shortest'='shortest')=>engine.fly(target.lat,target.lng,target.altitude,duration,{route,ease:chase});
 if(id!==12)engine.fadeFromWhite(Math.min(400,ms*.1));
 const show=(event:Event)=>{engine.reveal(event);engine.setPosition(position(engine,event,true));};
 const focus=(events:Event[],straight=false)=>{engine.storyEvents=[];engine.update({focusInvoices:events.map(e=>e.invoiceId!),paymentMaturity:straight?proofMaturity(events[0]):null,paymentAmount:straight?CASCADE_FIGURES.straight.committed:null});};
 if(id===1){engine.setPosition(0,true);engine.orbit(APPLE,openingOrbit.radius,openingOrbit.altitude,32/shot.seconds,ms,openingOrbit.bearing);}
 else if(id===2){
  const orbitUntil=table[1].orbitUntil!,pullOutAt=table[1].pullOutAt!;
  engine.orbit(APPLE,openingOrbit.radius,openingOrbit.altitude,18/(orbitUntil*scale),orbitUntil*scale*1000,openingOrbit.bearing+32);
  at(orbitUntil,()=>{
   // These are the same calibrated points previously resolved in GlobeScene.
   // Sampling them here gives the engine and renderer one exact handoff state.
   const geo=(v:ReturnType<typeof appleParkShotCamera>['position'],t:number)=>({lat:Math.asin(v.y/v.length())*180/Math.PI,lng:Math.atan2(v.x,v.z)*180/Math.PI,altitude:v.length()/EARTH_METERS-1,t});
   engine.splinePath([{...engine.currentCamera(),t:0},geo(appleParkShotCamera(EARTH_METERS,10).position,.5),
    geo(appleParkShotCamera(EARTH_METERS,13.7).position,1.2)],(pullOutAt-orbitUntil)*scale*1000,'apple-park-arch');
  });
  at(pullOutAt,()=>engine.snapAndPullOut(APPLE,.00005,shot.end.altitude,(shot.baseSeconds-pullOutAt)*scale*1000,{kind:'cubic-out',handoff:.25}));
 }else if(id===13){
  engine.timelapse('global',365,'reverse',2000);
  engine.playRange(364.999,0,2);
  engine.after(2,()=>engine.flashToWhite(250));
  engine.after(2.25,()=>{engine.fadeFromWhite(300);engine.update({timelapse:null});engine.setPosition(0,true);});
  at(12.3,()=>fly(shot.end,(shot.baseSeconds-12.3)*scale*1000));
 }else if(id===3){
  const orders=appleOrders(engine.index),branch=branchedProofPayments(engine.index,engine.state.story);
  const downstream=branch.slice(1);
  focus([...orders,...downstream]);engine.setPosition(0,true);engine.update({paymentPresentation:'waiting'});
  // A Pacific view keeps the three complete outbound arcs in one composition.
  fly(p(42,-170,1.8),4400*scale,'west');
  at(4.4,()=>orders.forEach(event=>engine.reveal(event)));
  cascadeBeats(downstream).forEach((generation,i)=>at(9.2+i*2.2,()=>generation.forEach(event=>engine.reveal(event))));
  at(16.4,()=>fly(shot.end,ms-16400*scale,'east'));
 }else if(id===4){
  const chain=USE_EXTENDED_FIGURES?branchedProofPayments(engine.index,engine.state.story):straightProofPayments(engine.index,engine.state.story);
  focus(chain,!USE_EXTENDED_FIGURES);
  engine.update({paymentPresentation:'settled'});
  const beats=cascadeBeats(chain),cues=USE_EXTENDED_FIGURES?[.4,5.2,9.6,13.8,17.4]:[.4,8.4,13.6,17.2];
  beats.forEach((generation,i)=>{
   const cue=cues[i]??17.4;
   const firm=engine.index.firms.get(generation[0].to??'');
   at(Math.max(0,cue-(i?2.4:.4)),()=>{
    if(USE_EXTENDED_FIGURES)fly(i<2?p(42,-170,1.8):p(39,-99,.65),scale*(i?2400:400));
    else if(firm?.lat!=null&&firm.lng!=null)fly(p(firm.lat,firm.lng,1.5+i*.1),scale*(i?2400:400),'west');
   });
   // Siblings light together, then the next generation fans out.
   at(cue,()=>generation.forEach(show));
  });
  at(19.2,()=>fly(shot.end,ms-19200*scale,'west'));
 }else if(id===15||id===16||id===17){fly(shot.end,ms,'east');if(id===17)engine.update({presentationTotals:DEFAULT_CASCADE});}
 else if(id===5){
  engine.update({speed:'year',caption:true});engine.playRange(0,365,shot.seconds);
  fly(p(25,-242,2.35),ms/3,'west');
  engine.after(shot.seconds/3,()=>fly(p(35,-362,2.35),ms/3,'west'));
  engine.after(shot.seconds*2/3,()=>fly(shot.end,ms/3,'west'));
 }else if(id===6){
  fly(shot.end,ms,'west');
  if(engine.index.payments.length)engine.playRange(position(engine,engine.index.payments[0]),position(engine,engine.index.payments.at(-1)!,true),shot.seconds);
 }else if(id===18){
  fly(shot.end,ms,'east');engine.setPosition(364.999,true);
  at(15.6,()=>engine.update({onchainGlimpse:true}));
 }else if(id===9){
  fly(shot.end,ms,'east');
  let day=0,busiest=-1;
  engine.index.days.forEach((bucket,i)=>{
   const count=bucket.events.reduce((n,e)=>n+Number(['extend','transfer','withdraw','sell'].includes(e.type)),0);
   if(count>busiest){day=i;busiest=count;}
  });
  engine.playRange(day,Math.min(365,day+.999),shot.seconds);
 }else if(id===8||id===11){fly(shot.end,ms,'east');}
 else if(id===10){
  engine.update({stage:'cube'});
  engine.fly(STORE.lat,STORE.lng,8/EARTH_METERS,ms*.28,'fifth-avenue');
  engine.after(shot.seconds*.28,()=>!shot.path&&engine.subsurfaceInteriorCameraHook?.(ms*.72));
 }else if(id===19){
  // Continue the landed hall pose; the camera layer retains the descent end
  // and adds the same quiet idle motion as the rest of the continuous take.
  if(!continuous){engine.update({stage:'cube'});engine.fly(STORE.lat,STORE.lng,8/EARTH_METERS,Math.min(ms*.15,1000),'fifth-avenue');engine.after(shot.seconds*.15,()=>!shot.path&&engine.subsurfaceInteriorCameraHook?.(ms*.25));}
 }else if(id===12){engine.flashToWhite(ms*.2);}
 engine.after(duration,()=>{const next=SHOTS[shot.scene];if(continuous&&next)playShot(engine,next.id,true);else engine.update({playing:false,shotRunning:false,film:false});});
}
