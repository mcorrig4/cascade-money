import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerMode, ledgerRowHeight, logDuration } from '../src/components/ledger-mode.ts';
import { IdleMotion } from '../src/globe/animation.ts';
import { COIN_BEATS, COMPOSABLE_BEATS, beatIndex, playShot } from '../src/director/shots.ts';
import { PlaybackEngine } from '../src/playback/engine.ts';
import { createIndex,appendEvent,finishIndex } from '../src/data/index.ts';
import { parseLine } from '../src/data/adapters.ts';
import { readFile } from 'node:fs/promises';
test('ledger switches immediately for playback, inspection and pause; log pace scales without queues',()=>{
 assert.equal(ledgerMode(true,false),'compact');assert.equal(ledgerMode(false,false),'expanded');assert.equal(ledgerMode(true,true),'expanded');
 assert.equal(ledgerMode(true,false),'compact');assert.equal(ledgerRowHeight('compact'),30);
 assert.ok(logDuration(1)>logDuration(10)&&logDuration(10)>logDuration(50));assert.ok(logDuration(365/15)<50);
 assert.ok(Math.floor(450/ledgerRowHeight('compact'))>=15);
});
test('composable and coin reveals honor narration boundaries and remain ordered',()=>{
 assert.deepEqual(COMPOSABLE_BEATS.map(b=>b.at),[0,1,2,3,4]);
 assert.deepEqual(COIN_BEATS.map(b=>b.at),[0,6,13,25,44]);
 for(const beats of [COIN_BEATS,COMPOSABLE_BEATS]) for(let i=1;i<beats.length;i++){
  assert.equal(beatIndex(beats,beats[i].at-.001),i-1);assert.equal(beatIndex(beats,beats[i].at),i);
 }
});
test('idle motion continues independently of simulation and stays bounded, frame-rate stable and suppressed in flights',()=>{
 const travel=[];
 for(const fps of [30,60,120]){const clock=new IdleMotion();let lng=0,lat=0,alt=0;
  for(let i=0;i<fps*60;i++){const d=clock.update(1000/fps,2,false);lng+=d.lng;lat+=d.lat;alt+=d.altitude;}
  assert.ok(Math.abs(lat)<=.6&&Math.abs(alt)<=.025);travel.push(lng);
  const before=clock.seconds;assert.deepEqual(clock.update(1000,2,true),{lng:0,lat:0,altitude:0,orbit:0});assert.equal(clock.seconds,before);
 }
 assert.ok(travel.every(n=>Math.abs(n-13.2)<1e-8));
 const clock=new IdleMotion();assert.ok(clock.update(1000,2,false).lng<=.022001);
});
test('shot 6 advances real event positions for all 53 seconds and pause freezes narration',async()=>{
 const index=createIndex();(await readFile(new URL('./fixtures/events-v1.ndjson',import.meta.url),'utf8')).trim().split('\n').forEach(l=>appendEvent(index,parseLine(l)));finishIndex(index);
 const engine=new PlaybackEngine(index);playShot(engine,6);const first=engine.state.position;
 engine.tick(20);assert.ok(engine.state.position>first);assert.equal(engine.state.shotRunning,true);
 engine.toggle();const elapsed=engine.state.shotElapsed;engine.tick(8);assert.equal(engine.state.shotElapsed,elapsed);
 engine.toggle();engine.tick(32.9);assert.equal(engine.state.playing,true);engine.tick(.1);assert.equal(engine.state.playing,false);
 assert.equal(beatIndex(COIN_BEATS,engine.state.shotElapsed),4);
});

test('scene captions contain only locations and narration fades on the shot clock', async () => {
  const { SCENE_LOCATIONS, SCENE_TEXT_BEATS, sceneTextAt } = await import('../src/director/shots.ts');
  assert.deepEqual(SCENE_LOCATIONS, [
    {shot:1,name:'Apple Park',place:'Cupertino, California'},
    {shot:10,name:'Apple Store NYC',place:'Fifth Avenue, New York City'},
  ]);
  for (const cue of SCENE_TEXT_BEATS) {
    assert.equal(sceneTextAt(cue.shot,cue.at - .01),null);
    assert.equal(sceneTextAt(cue.shot,cue.at)?.opacity,0);
    assert.ok(sceneTextAt(cue.shot,cue.at + .175)!.opacity > .49);
    assert.equal(sceneTextAt(cue.shot,(cue.at + cue.until)/2)?.opacity,1);
    assert.ok(sceneTextAt(cue.shot,cue.until - .1)!.opacity < .3);
    assert.equal(sceneTextAt(cue.shot,cue.until),null);
  }
  assert.equal(sceneTextAt(1,1.5)?.text,'September 9, 2025');
  assert.equal(sceneTextAt(10,4.5)?.text,'Money. And time.');
  assert.equal(sceneTextAt(10,12)?.text,'Time becomes a property of money.');
  assert.equal(sceneTextAt(null,1.5),null);
});

test('inspection retains the selected transaction and day while live rows churn', async()=>{
 const {inspectionSnapshot}=await import('../src/components/ledger-mode.ts');
 const live=[{seq:3},{seq:2},{seq:1}];
 const snapshot=inspectionSnapshot(5,live,2);
 live.unshift({seq:4});live.pop();
 assert.deepEqual(snapshot.events.map(e=>e.seq),[3,2,1]);
 assert.equal(snapshot.selectedSeq,2);assert.equal(snapshot.selectedIndex,1);assert.equal(snapshot.day,5);
 assert.equal(snapshot.events[1],live[2]);
 assert.equal(inspectionSnapshot(6,live,999).selectedSeq,4);
});
