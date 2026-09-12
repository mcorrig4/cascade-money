import { eventPosition, PlaybackEngine } from '../playback/engine.ts';
import type { Event, EventIndex } from '../data/types.ts';
import { orbitAt, EARTH_METERS, type Pose, type Ease, SUBSURFACE_INTERIOR_CAMERA_HOOK } from '../camera/primitives.ts';
export const APPLE={lat:37.3349,lng:-122.009,altitude:.0003};
export const STORE={lat:40.7638,lng:-73.973,altitude:.05};
const p=(lat:number,lng:number,altitude:number):Pose=>({lat,lng,altitude});
const orbitExit=orbitAt(APPLE,3822.6,.0003,36);
// IDs remain API-stable; scene is the film order, not an ID or array index.
const table=[
 {id:1,title:'Apple Park orbit',seconds:4,end:orbitExit,motion:'orbit',overlay:'none'},
 {id:2,title:'Rainbow arch → Earth',seconds:9,end:p(37.3349,-122.009,2.5),motion:'spline + pull-out',overlay:'network'},
 {id:13,title:'Rewind',seconds:4,end:p(37.3349,-122.009,2.5),motion:'timelapse + flash',overlay:'none'},
 {id:14,title:'September 9, 2025',seconds:3,end:p(37.3349,-122.009,2.5),motion:'idle + fade',overlay:'title'},
 {id:15,title:'The catch',seconds:12,end:p(37,-150,2.2),motion:'push + west sweep',overlay:'catch'},
 {id:16,title:'The question',seconds:3,end:p(37,-157,2.2),motion:'west sweep',overlay:'none'},
 {id:3,title:'The first payment',seconds:8,end:p(36.8,127.06,.8),motion:'bezier west',overlay:'none'},
 {id:4,title:'The cascade',seconds:10,end:p(37.8,-84.85,1.6),motion:'west sweep + fission',overlay:'none'},
 {id:5,title:'The year',seconds:15,end:p(34,-118,2.35),motion:'global sweep',overlay:'none'},
 {id:6,title:'A dollar with a date',seconds:53,end:p(34.6,135.5,1.6),motion:'Pacific drift',overlay:'coin'},
 {id:17,title:'The treasury decision',seconds:6,end:p(34.6,137.9,1.6),motion:'idle',overlay:'treasury'},
 {id:7,title:'Extend it.',seconds:5,end:p(30,-145,2.3),motion:'east pull-out',overlay:'curve'},
 {id:9,title:'The vault under pressure',seconds:15,end:p(25,-80,2.3),motion:'east drift',overlay:'vault'},
 {id:8,title:'The rules',seconds:20,end:p(30,-70,2.3),motion:'east drift',overlay:'laws'},
 {id:10,title:'The reframe',seconds:15,end:STORE,motion:'store → Earth → store',overlay:'reframe'},
 {id:11,title:'Composable',seconds:8,end:{...STORE,altitude:.02},motion:'push',overlay:'composable'},
 {id:18,title:'Close',seconds:6,end:{...STORE,altitude:.008},motion:'push',overlay:'close'},
 {id:19,title:'The descent',seconds:14,end:{...STORE,altitude:8/EARTH_METERS},motion:'bezier + interior hook',overlay:'descent'},
 {id:20,title:'global supply chains. settled.',seconds:8,end:{...STORE,altitude:8/EARTH_METERS},motion:'idle + white',overlay:'line'},
 {id:12,title:'Cascade Money',seconds:18,end:{...STORE,altitude:8/EARTH_METERS},motion:'idle + white + black',overlay:'wordmark'},
];
let time=0;
export const SHOTS=table.map((s,i)=>{const startTime=time;time+=s.seconds;
 const captureAt=({12:9,11:7.5,13:3.5,1:3} as Record<number,number>)[s.id]??s.seconds*.8;
 if(!(captureAt>0&&captureAt<s.seconds))throw new Error(`Scene ${i+1} capture must be strictly inside its duration`);
 return {...s,captureAt,scene:i+1,start:i?table[i-1].end:orbitAt(APPLE,3822.6,.0003,4),startTime,endTime:time,duration:`${s.seconds}s`,detail:s.motion};});
export const FILM_SECONDS=time;
export const COMPOSABLE_BEATS=[
 {at:0,title:'USDC',detail:'Principal'}, {at:1.5,title:'Cascade vault',detail:'On Arc'},
 {at:3,title:'Dated dollars',detail:'Pay at face'}, {at:4.5,title:'Yield entitlements',detail:'One owner per interval'},
 {at:6.5,title:'Discount window',detail:'A market for earlier dates'},
];
// Provisional clause cues: v5 has no timestamped audio take. Edit here after recording.
export const COIN_BEATS=[
 {at:0,key:'coin',title:'One dollar.',text:'Redeemable on a calendar date.'},
 {at:6,key:'date',title:'One dollar. One date.',text:'Redeemable on its calendar date.'},
 {at:12,key:'fungibility',title:'Same date. Same dollar.',text:'Completely interchangeable.'},
 {at:18,key:'claim',title:'Pay a later bill at face.',text:'No pricing. No negotiation. No credit check.'},
 {at:24,key:'extend',title:'Extend. Earn the interval.',text:'Sixty more days of capital.'},
 {at:31,key:'yield',title:'Exactly those sixty days.',text:'The added yield belongs to you.'},
 {at:38,key:'market',title:'Earlier needs a market.',text:'A price for commercial time.'},
 {at:44,key:'arc',title:'The vault lives on Arc.',text:'Dated dollars, on-chain.'},
 {at:49,key:'assets',title:'USDC. Built for USYC.',text:'Circle’s tokenized money market fund.'},
];
export const TREASURY_BEATS=[{at:0,key:'thirty'},{at:2,key:'ninety'},{at:4,key:'gap'}];
export const beatIndex=(times:readonly {at:number}[],elapsed:number)=>Math.max(0,times.findLastIndex(b=>elapsed>=b.at));
export const SCENE_LOCATIONS=[{shot:14,name:'Apple Park',place:'Cupertino, California'},{shot:10,name:'Apple Store NYC',place:'Fifth Avenue, New York City'}];
export const SCENE_TEXT_BEATS=[
 {shot:14,id:'flashback',at:.3,until:2.95,text:'September 9, 2025'},
 {shot:10,id:'money-time',at:4,until:5.8,text:'Money. And time.'},
 {shot:10,id:'derivatives',at:6.2,until:10.2,text:'$846 trillion'},
 {shot:10,id:'reframe',at:10.5,until:14.9,text:'A second dimension to money.'},
];
export function sceneTextAt(shot:number|null,elapsed:number){const cue=SCENE_TEXT_BEATS.find(c=>c.shot===shot&&elapsed>=c.at&&elapsed<c.until);if(!cue)return null;const opacity=Math.min(1,(elapsed-cue.at)/.35,(cue.until-elapsed)/.35);return {...cue,opacity,offset:(1-opacity)*12};}
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

export function shotAvailable(_engine:PlaybackEngine,id:number){return SHOTS.some(s=>s.id===id);}
const chase:Ease={kind:'bezier',points:[.12,.65,.18,1]};
const descent:Ease={kind:'bezier',points:[.1,.75,.25,1]};
export function nextShot(id:number,direction=1){return SHOTS[Math.max(0,Math.min(SHOTS.length-1,SHOTS.findIndex(s=>s.id===id)+direction))].id;}
export function playFilm(engine:PlaybackEngine){playShot(engine,SHOTS[0].id,true);}
export function playShot(engine:PlaybackEngine,id:number,continuous=false) {
 const shot=SHOTS.find(s=>s.id===id);if(!shot)return;
 engine.beginShot(id,shot.seconds);engine.update({film:continuous});
 // Each move starts from the live camera. Random-access previews ease into the
 // scene rather than teleporting to its declared start; sequential playback
 // inherits the preceding scene's actual final frame, including idle motion.
 if(!continuous&&![13,14,20,12].includes(id))engine.fadeFromWhite(400);
 const fly=(target:Pose,ms:number,route:'west'|'east'|'shortest'='shortest',ease?:Ease)=>engine.fly(target.lat,target.lng,target.altitude,ms,{route,ease});
 const later=(at:number,target:Pose,ms:number,route:'west'|'east'|'shortest'='shortest')=>engine.after(at,()=>fly(target,ms,route));
 const show=(event:Event)=>{engine.reveal(event);engine.setPosition(position(engine,event,true));};
 if(id===1){engine.setPosition(0,true);engine.orbit(APPLE,3822.6,.0003,8,4000,4);}
 else if(id===2){
  engine.splinePath([{...engine.currentCamera(),t:0},{lat:37.3355,lng:-122.0085,altitude:.0006,t:.5,tangent:{lat:0,lng:0,altitude:0}},{...APPLE,altitude:.00005,t:1.2,tangent:{lat:0,lng:0,altitude:0}}],1200,'apple-park-arch');
  engine.after(1.2,()=>engine.snapAndPullOut(APPLE,.00005,2.5,4300));
  engine.after(5.5,()=>engine.playRange(0,4.999,3.5));
 }else if(id===13){engine.timelapse('global',365,'reverse',2600);engine.after(3.2,()=>engine.flashToWhite(400));}
 else if(id===14){if(!continuous)engine.update({exposure:1});engine.fadeFromWhite(600);engine.update({timelapse:null});}
 else if(id===15){fly({...APPLE,altitude:.35},4000);later(4,shot.end,8000,'west');}
 else if(id===16){fly(shot.end,3000,'west');}
 else if(id===3){
  const all=proofPayments(engine.index,engine.state.story),events=all.slice(0,2);
  engine.storyEvents=[];engine.update({focusInvoices:all.map(e=>e.invoiceId!)});
  // Decelerate into Asan before the commitment cue; no hard longitude wrap.
  fly(shot.end,3200,'west',chase);
  events.forEach((e,i)=>engine.after(3.2+i*3.6,()=>show(e)));
 }else if(id===4){
  const all=proofPayments(engine.index,engine.state.story);engine.storyEvents=all.slice(0,2);engine.update({focusInvoices:all.map(e=>e.invoiceId!)});
  if(all[1])engine.setPosition(position(engine,all[1],true));
  fly(p(43,40,1.8),2600,'west');later(2.6,p(45,-30,2),2500,'west');later(5.1,shot.end,1900,'west');
  const beats=cascadeBeats(all.slice(2));beats.forEach((beat,i)=>beat.forEach((event,j)=>engine.after(7+i*.9+j*.22,()=>show(event))));
 }else if(id===5){engine.update({speed:'year',caption:true});engine.playRange(0,365,15);fly(p(24.8,121,2.35),5000,'west');later(5,p(36.8,127.06,2.35),5000);later(10,shot.end,5000);}
 else if(id===6){
  fly(p(37,-122,1.65),8000);later(8,shot.end,45000,'west');
  const payments=engine.index.payments;if(payments.length)engine.playRange(position(engine,payments[0]),position(engine,payments.at(-1)!,true),53);
  const tesla=proofPayments(engine.index,'tesla');tesla.forEach((e,i)=>{if(i<4)engine.after(8+i*12,()=>engine.reveal(e));});
 }else if(id===17){/* Idle-only: inherit the Osaka view, no establishing move. */}
 else if(id===7){fly(shot.end,5000,'east');const trade=engine.index.trades.at(-1);if(trade)engine.setPosition(position(engine,trade,true),true);}
 else if(id===9){fly(shot.end,15000,'east');const maturity=engine.index.checkpoints.find(e=>Number(e.data.matured_cents)>0);if(maturity)engine.playRange(Math.max(0,maturity.day-1),Math.min(365,maturity.day+1.999),15);}
 else if(id===8){fly(shot.end,20000,'east');}
 else if(id===10){
  engine.update({stage:'cube'});engine.fly(STORE.lat,STORE.lng,8/EARTH_METERS,5800,'fifth-avenue');
  engine.after(5.8,()=>{engine.update({stage:'wide'});fly(p(30,-65,2.6),6000);});
  // Scene 15's prose and continuity table conflict. Return continuously after
  // the macro reveal so scene 16 really begins at the store, as §0.7 requires.
  later(11.8,STORE,3200);
 }else if(id===11||id===18){fly(shot.end,shot.seconds*1000);}
 else if(id===19){engine.update({stage:'cube'});engine.fly(STORE.lat,STORE.lng,8/EARTH_METERS,13000,{site:'fifth-avenue',ease:descent});engine.after(4,()=>engine.subsurfaceInteriorCameraHook?.(9000));engine.after(11,()=>engine.flashToWhite(6000));void SUBSURFACE_INTERIOR_CAMERA_HOOK;}
 else if(id===20){engine.flashToWhite(3000);}
 else if(id===12){engine.update({exposure:1,flash:null});}
 engine.after(shot.seconds,()=>{const next=SHOTS[shot.scene];if(continuous&&next)playShot(engine,next.id,true);else engine.update({playing:false,shotRunning:false,film:false});});
}
