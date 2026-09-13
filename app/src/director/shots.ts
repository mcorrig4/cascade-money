import { eventPosition, PlaybackEngine } from '../playback/engine.ts';
import type { PlaybackState } from '../playback/engine.ts';
import type { Event, EventIndex } from '../data/types.ts';
import { EARTH_METERS, type Pose, type Ease, type Bookmark, type Keyframe, fromBookmarks } from '../camera/primitives.ts';
export const APPLE={lat:37.3349,lng:-122.009,altitude:.0003};
export const STORE={lat:40.7638,lng:-73.973,altitude:.05};
const p=(lat:number,lng:number,altitude:number):Pose=>({lat,lng,altitude});
// Spoken words from docs/script-v6-liam.md; contractions and hyphenated words count as one.
// IDs preserve the existing camera/API contracts; scene is the narration order.
export const OPENING_WIDE=p(37.3349,-128,1.9);
export const OPENING_ROTATION=.4; // degrees per second, live from the first visible frame
export const CALIFORNIA_HOLD=p(37.65,-122.45,.18);
export const APPLE_MARKER_APPROACH=p(APPLE.lat,APPLE.lng,.06);
export const CALIFORNIA_EXIT=p(OPENING_WIDE.lat,APPLE.lng,1.65);
export type OrderCue={word:'Samsung'|'Corning'|'Sony';beat:string;at:number};
/**
 * `seconds` is an AUTHORED duration override. Without it a shot runs for
 * `baseSeconds` — a word-count estimate (words/150*60 + 1s) that has no
 * relationship to how long the finished narration for that scene actually
 * is. Shot 5 ("Run the year") is the case that broke: its 43 words estimate
 * to 18.2s while the recorded VO for the film's scene 9 runs 32.6s, so the
 * captured year run finished at day 365 fourteen seconds before the scene
 * did and the film showed the NEXT shot's card under the narration
 * (Director frame check, 2026-09-13). Set this whenever a shot's recorded
 * narration is the real clock.
 */
export type ShotDefinition={id:number;title:string;words:number;seconds?:number;end:Pose;motion:string;overlay:string;allowRoll?:boolean;site?:'apple-park'|'fifth-avenue';path?:Bookmark[];orderCues?:OrderCue[]};
const table:ShotDefinition[]=[
 {id:1,title:"The object of desire",words:14,end:OPENING_WIDE,motion:'wide globe rotation',overlay:'none'},
 {id:2,title:"California",words:38,end:CALIFORNIA_EXIT,motion:'California hold · Apple marker approach · full globe',overlay:'none'},
 // Reorder-to-13 pass (2026-09-13, product owner + Director/wingman 03:33
 // ET): old shots 13 (Rewind) and 15 (The contradiction) are CUT, and old
 // shots 9 (Stress test) and 8 (The rules survive) are CUT as standalone
 // scenes too (their headline figure folds into a closing beat on shot 5's
 // scene — see StressResultFlash in film/src/compositions/CascadeFilm.tsx).
 // The remaining shots below are reordered to the new play order: `scene`
 // (buildShots' `i+1` below) now runs 1..13 in THIS array order, which is
 // no longer the shots' own `id` order — ids are stable camera/API
 // contracts (unchanged), only the sequence changes.
 {id:3,title:"The hidden supply chain",words:48,end:p(37.8,-84.85,1.5),motion:'westward payment sweep',overlay:'none',orderCues:[
  {word:'Samsung',beat:'display',at:4.4},{word:'Corning',beat:'cover-glass',at:9.2},{word:'Sony',beat:'camera-sensors',at:13.4}]},
 {id:16,title:"The question",words:18,end:p(34,-76,1.8),motion:'idle drift',overlay:'question'},
 {id:4,title:"The cascade",words:55,end:p(33.77,-118.2,1.9),motion:'westward chain sweep',overlay:'none'},
 {id:17,title:"Let it land",words:30,end:p(34,-112,2),motion:'idle drift',overlay:'totals'},
 {id:6,title:"A dollar with a date",words:67,end:p(34.6,135.5,1.6),motion:'Pacific drift',overlay:'coin'},
 {id:18,title:"Underneath it",words:49,end:p(30,145,2),motion:'east drift',overlay:'backing'},
 // 35.6s = the film's own scene-9 length (narration 32.6s + settle + the
 // 2.5s stress-result flash the film lays over the tail), so the capture
 // covers the whole scene. See YEAR_RUN_TAIL_SECONDS for where day 365 lands.
 {id:5,title:"Run the year",words:43,seconds:35.6,end:p(34,-118,2.35),motion:'global sweep',overlay:'none'},
 {id:11,title:"Zoom out",words:42,end:p(37.3349,-122.009,2.6),motion:'pull-out + east sweep',overlay:'composable'},
 // Scene-11-delete pass (2026-09-13, Liam 04:15 EDT): shot 10 ("New York" —
 // the store flight + stair descent) is CUT, the store visit dropped. Shot
 // 19 (Beneath it) now opens the fifth-avenue site itself instead of
 // continuing New York's descent — see its now-unconditional fly-in in
 // playShot below. allowRoll:true carries stage 18's camera-never-rolls
 // exception for the Fifth Avenue interior (architectural surface-normal
 // framing) onto both remaining fifth-avenue shots.
 {id:19,title:"Beneath it",words:23,end:{...STORE,altitude:8/EARTH_METERS},motion:'store flight + hall drift',overlay:'none',site:'fifth-avenue' as const,allowRoll:true},
 {id:12,title:"Close",words:9,end:{...STORE,altitude:8/EARTH_METERS},motion:'hall drift + exposure',overlay:'wordmark',site:'fifth-avenue' as const,allowRoll:true},
];
export type NarrationDurations=Record<string,number>;
/** narration.json: {"durations":{"1":6.6,"2":16.2}}; keys are scene numbers, values seconds. */
export function parseNarrationDurations(value:unknown):NarrationDurations {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Expected narration duration map');
 const record=value as Record<string,unknown>, source=record.durations??record;
 if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('Expected durations keyed by scene');
 const result:NarrationDurations={};
 for(const [key,seconds] of Object.entries(source)){
  if(!/^(?:[1-9]|1[0-2])$/.test(key)||typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0)
   throw new Error('Narration durations require scenes 1–12 and positive seconds');
  result[key]=seconds;
 }
 return result;
}
export function buildShots(durations:NarrationDurations={}) {
 let time=0,previous:Pose=OPENING_WIDE;
 return table.map((s,i)=>{
  const baseSeconds=Math.round((s.words*60/150+1)*10)/10;
  // Bookmark travel and holds remain a duration floor for explicitly authored paths.
  const pathFloor=s.path?Math.round(fromBookmarks(s.path).at(-1)!.t*10)/10:0;
  const seconds=Math.max(durations[String(i+1)]??s.seconds??baseSeconds,pathFloor),startTime=time;time+=seconds;
  // The closing card is captured after its line-to-wordmark transition.
  const captureAt=seconds*(s.id===12?.9:s.id===11?.5:s.id===13?.55:.8);
  if(!(captureAt>0&&captureAt<seconds))throw new Error('Capture must be strictly inside scene');
  const start=previous,end=s.id===1?{...OPENING_WIDE,lng:OPENING_WIDE.lng+OPENING_ROTATION*seconds}:s.end;
  previous=end;
  return {...s,end,scene:i+1,baseSeconds,seconds,captureAt,start,
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
// docs/BRANCHING_REPORT.md: one Issue + nine Pays settle ten invoices to eight suppliers.
export const CASCADE_FIGURES={
 straight:{committed:100_000_00000n,settled:400_000_00000n,companies:4,invoices:4},
 branched:{committed:100_000_00000n,settled:450_000_00000n,companies:8,invoices:9},
};
// Keep this switch aligned with film Scene08Counters for a future straight-line re-cut.
export const USE_EXTENDED_FIGURES=true;
export const DEFAULT_CASCADE=USE_EXTENDED_FIGURES?CASCADE_FIGURES.branched:CASCADE_FIGURES.straight;
export const VERIFIED_YEAR_INVOICES=12029;
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
 {shot:19,name:'Apple Store NYC',place:'Fifth Avenue, New York City'},
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
/** Resolve narration against semantic story markers, never positional invoice IDs. */
export function narratedOrder(index:EventIndex,beat:string) {
 return index.stories.find(s=>s.storyId==='apple-duo'&&s.beat===beat)?.payment;
}
export function appleOrders(index:EventIndex) {
 if(index.schema===1)return proofPayments(index).slice(0,1);
 return ['display','camera-sensors'].flatMap(beat=>{
  const event=narratedOrder(index,beat);
  return event?.type==='issue'&&event.from==='Apple'?[event]:[];
 });
}
export function sceneThreeOrders(index:EventIndex) {
 if(index.schema===1)return appleOrders(index);
 return ['display','cover-glass','camera-sensors'].flatMap(beat=>{
  const event=narratedOrder(index,beat);return event?[event]:[];
 });
}
/** One C1 path; zero tangents at both hold knots keep the subject completely still. */
export function californiaPath(from:Pose,seconds:number,incomingLngVelocity=0):Keyframe[] {
 const zero={lat:0,lng:0,altitude:0};
 return [{...from,t:0,tangent:{...zero,lng:incomingLngVelocity}},
  {...CALIFORNIA_HOLD,t:seconds*.3,tangent:zero},
  {...CALIFORNIA_HOLD,t:seconds*.5,tangent:zero},
  {...APPLE_MARKER_APPROACH,t:seconds*.75,tangent:zero},
  {...table[1].end,t:seconds,tangent:zero}];
}
// Scenes 3 and 5-10 keep the product's right-hand event ledger on screen while recording
// (Liam 2026-09-13: the film keeps the app UI). Shot ids, in scene order: 3, 4, 17, 6, 18, 5, 11.
// The opening two scenes and the two store-interior scenes stay clean.
export const LEDGER_SIDEBAR_SHOTS=[3,4,17,6,18,5,11];
export function ledgerSidebar(recording:boolean,shot:number|null){return recording&&LEDGER_SIDEBAR_SHOTS.includes(shot??0);}
export function shotAvailable(_engine:PlaybackEngine,id:number){return SHOTS.some(s=>s.id===id);}
const chase:Ease={kind:'bezier',points:[.12,.65,.18,1]};
export function nextShot(id:number,direction=1){return SHOTS[Math.max(0,Math.min(SHOTS.length-1,SHOTS.findIndex(s=>s.id===id)+direction))].id;}
export function playFilm(engine:PlaybackEngine):void|Promise<void>{if(!engine.isReady)return engine.ready().then(()=>playFilm(engine));engine.update({tMs:0});playShot(engine,SHOTS[0].id,true);}
/**
 * How long shot 5's year view keeps holding after it reaches day 365. The
 * year run is scaled to the shot so the scrubber lands on the last day just
 * before the narration ends, leaving the film's closing stress-result flash
 * (2.5s, CascadeFilm.tsx's StressResultFlash) something settled to sit over
 * instead of a scrubber still travelling under it.
 */
const YEAR_RUN_TAIL_SECONDS=3;

export function playShot(engine:PlaybackEngine,id:number,continuous=false) {
 const shot=SHOTS.find(s=>s.id===id);if(!shot)return;
 const duration=shot.path?Math.max(shot.seconds,fromBookmarks(shot.path).at(-1)!.t):shot.seconds;
 const incoming=engine.currentCamera();
 engine.beginShot(id,duration,shot.startTime*1000,shot.allowRoll??false);engine.update({film:continuous});
 // Every direct entry starts from its authored wide pose; film transitions inherit.
 if(!continuous||id===1)engine.update({camera:{...shot.start,id:engine.state.camera.id+1,duration:0,allowRoll:shot.allowRoll??false},cameraElapsed:0});
 if(shot.path)engine.playBookmarkPath(shot.path,true);
 const ms=shot.seconds*1000,scale=shot.seconds/shot.baseSeconds;
 const at=(seconds:number,run:()=>void)=>engine.after(seconds*scale,run);
 const fly=(target:Pose,duration:number,route:'west'|'east'|'shortest'='shortest')=>engine.fly(target.lat,target.lng,target.altitude,duration,{route,ease:chase});
 if(id!==12)engine.fadeFromWhite(Math.min(400,ms*.1));
 const show=(event:Event)=>{engine.reveal(event);engine.setPosition(position(engine,event,true));};
 const focus=(events:Event[],straight=false)=>{engine.storyEvents=[];engine.update({focusInvoices:events.map(e=>e.invoiceId!),paymentMaturity:straight?proofMaturity(events[0]):null,paymentAmount:straight?CASCADE_FIGURES.straight.committed:null});};
 if(id===1){
  engine.setPosition(0,true);
  const tangent={lat:0,lng:OPENING_ROTATION,altitude:0};
  engine.splinePath([{...shot.start,t:0,tangent},{...shot.end,t:shot.seconds,tangent}],ms);
 }else if(id===2){
  engine.splinePath(californiaPath(continuous?incoming:shot.start,shot.seconds,continuous?OPENING_ROTATION:0),ms);
 }else if(id===3){
  const orders=sceneThreeOrders(engine.index);
  focus(orders);engine.setPosition(0,true);engine.update({paymentPresentation:'waiting'});
  // Keep the narrated orders together, independently of their simulation days.
  fly(p(42,-170,1.8),4400*scale,'west');
  for(const cue of shot.orderCues??[])engine.atWord(cue.word,cue.at*scale,()=>{
   const event=narratedOrder(engine.index,cue.beat)??(cue.word==='Samsung'?orders[0]:undefined);
   if(event)engine.reveal(event);
  });
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
  engine.update({speed:'year',caption:true});engine.playRange(0,365,Math.max(1,shot.seconds-YEAR_RUN_TAIL_SECONDS));
  fly(p(25,-242,2.35),ms/3,'west');
  engine.after(shot.seconds/3,()=>fly(p(35,-362,2.35),ms/3,'west'));
  engine.after(shot.seconds*2/3,()=>fly(shot.end,ms/3,'west'));
 }else if(id===6){
  fly(shot.end,ms,'west');
  // The primitive extends a maturity while its simulation day stays fixed.
  engine.setPosition(0,true);
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
 else if(id===19){
  // Scene-11-delete pass (2026-09-13): shot 10 ("New York", the store
  // flight + stair descent) is cut, so this shot now opens the
  // fifth-avenue site itself (the store-flight fly-in shot 10 used to do)
  // instead of continuing a descent already in progress.
  engine.update({stage:'cube'});
  engine.fly(STORE.lat,STORE.lng,8/EARTH_METERS,ms*.28,'fifth-avenue');
  engine.after(shot.seconds*.28,()=>!shot.path&&engine.subsurfaceInteriorCameraHook?.(ms*.72));
 }else if(id===12){engine.flashToWhite(ms*.2);}
 engine.after(duration,()=>{const next=SHOTS[shot.scene];if(continuous&&next)playShot(engine,next.id,true);else engine.update({playing:false,shotRunning:false,film:false});});
}
