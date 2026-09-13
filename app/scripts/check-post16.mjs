// Focused static browser checks; no server, film capture, or camera-delta burst.
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {chromium} from 'playwright-core';
const root=resolve(import.meta.dirname,'../dist'),output=resolve(import.meta.dirname,'../artifacts/post16');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.ndjson':'application/x-ndjson','.glb':'model/gltf-binary'};
 await context.route('http://localhost/**',async route=>{
  const file=resolve(root,decodeURIComponent(new URL(route.request().url()).pathname).slice(1)||'index.html');
  if(!file.startsWith(root+sep))return route.fulfill({status:403});
  try{await route.fulfill({body:await readFile(file),contentType:mime[extname(file)]??'application/octet-stream'});}
  catch{await route.fulfill({status:404});}
 });
 const page=await context.newPage(),errors=[];
 page.on('response',r=>{if(r.status()>=400)console.log('HTTP ERROR',r.status(),new URL(r.url()).pathname);});
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
 page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text());}});
 console.log('Opening app');
 await page.goto('http://localhost/');console.log('App loaded');
 await page.waitForFunction(()=>window.__cascade?.ready);
 console.log('API ready');
 console.log('Readiness',await page.evaluate(()=>window.__cascade.readiness()));
 await page.evaluate(()=>window.__cascade.ready());console.log('Earth ready');
 await page.evaluate(()=>{const e=window.__cascade.engine;e.setClockMode('manual');e.update({recording:true});});
 const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const play=async scene=>{
  // Existing API accepts stable IDs despite its name. Resolve narration scene first.
  await page.evaluate(scene=>{const c=window.__cascade;c.playScene(c.shots.find(s=>s.scene===scene).id);},scene);await paint();console.log('Scene',scene);
 };
 const tick=async seconds=>{await page.evaluate(seconds=>window.__cascade.engine.tick(seconds,'manual'),seconds);await paint();console.log('Tick',seconds);};
 await play(2);await tick(10);
 const handoff=[];let handoffTime=10;
 for(const at of [13.59,13.6,13.61,13.7]){
  await tick(at-handoffTime);handoffTime=at;
  const pose=await page.evaluate(()=>{const c=window.__cascade,p=c.globe.camera().position;return {time:c.engine.state.shotElapsed,engine:c.engine.currentCamera(),rendered:c.globe.pointOfView(),xyz:p.toArray()};});
  console.log('Handoff',JSON.stringify(pose));handoff.push(pose);
 }
 assert.ok(handoff.every(p=>p.xyz.every(Number.isFinite)));
 assert.ok(handoff.every((p,i)=>!i||p.rendered.altitude>=handoff[i-1].rendered.altitude-1e-10));
 await tick(16.2-handoffTime);
 const measurement=await page.evaluate(()=>{
  const {globe}=window.__cascade,camera=globe.camera(),radius=globe.getGlobeRadius(),height=innerHeight;
  camera.updateMatrixWorld();
  const center=camera.position.clone().set(0,0,0).project(camera),hits=[];
  // Pixel rays through the live camera, using the live globe radius. No FOV-only estimate.
  for(let y=0;y<height;y++){
   const direction=camera.position.clone().set(center.x,1-2*(y+.5)/height,.5).unproject(camera).sub(camera.position).normalize();
   const b=camera.position.dot(direction),d=b*b-camera.position.lengthSq()+radius*radius;
   if(d>=0&&-b-Math.sqrt(d)>0)hits.push(y);
  }
  const pixels=hits.at(-1)-hits[0]+1;
  return {fov:camera.fov,radius,altitude:globe.pointOfView().altitude,pixels,fraction:pixels/height};
 });
 await page.screenshot({path:resolve(output,'pull-out.png')});
 console.log('Pull-out',measurement);assert.ok(measurement.fraction>=.82&&measurement.fraction<=.88);
 // Reorder-to-13 pass (2026-09-13): "the example" is scene 3 now (was scene 4).
 await play(3);await tick(4.4);await tick(3);
 const orders=await page.locator('.scene-orders>div').allTextContents();
 assert.equal(orders.length,3);
 for(const [i,amount,day] of [[0,'$100M',90],[1,'$80M',100],[2,'$50M',210]]){
  assert.ok(orders[i].includes(amount)&&orders[i].includes(`day ${day}`));
 }
 assert.equal(await page.locator('.scene-location').count(),0);
 assert.deepEqual(await page.evaluate(()=>window.__cascade.pool.arcs.filter(a=>a.event.from==='Apple').map(a=>[a.clipStart,a.clipEnd,a.alpha])),[[0,1,1],[0,1,1],[0,1,1]]);
 await page.screenshot({path:resolve(output,'orders.png')});
 // "The cascade" is scene 5 now (was scene 7).
 await play(5);let previous=0;
 for(const [time,count] of [[.4,1],[5.2,2],[9.6,4],[13.8,8],[17.4,10]]){
  await tick(time-previous);previous=time;
  assert.equal(await page.evaluate(()=>window.__cascade.pool.arcs.length),count);
  console.log('Cascade generation',time,count);
  await tick(.6);previous+=.6;await page.screenshot({path:resolve(output,`branch-${count}.png`)});
 }
 await tick(1);await page.screenshot({path:resolve(output,'branch.png')});
 // "Let it land" is scene 6 now (was scene 8).
 await play(6);await tick(11);
 assert.deepEqual(await page.locator('.cascade-stat strong').allTextContents(),['$100M','$450M','8']);
 await page.screenshot({path:resolve(output,'counters.png')});
 // Optional missing resources produce expected network diagnostics; JS failures never do.
 // The 3D-tiles 403s (referrer-restricted key, not configured for this ad-hoc
 // localhost origin) and the optional narration.json 404 (no recorded-take
 // durations file shipped — falls back to word-count timing, by design) are
 // both handled-and-logged, not real errors; anything else must be empty.
 const benign=/Optional imagery unavailable|responded with a status of (403|404)/;
 const unexpected=errors.filter(e=>!benign.test(e));
 await writeFile(resolve(output,'measurements.json'),JSON.stringify({measurement,handoff,errors},null,2));
 console.log('Console errors',errors.length,'(unexpected:',unexpected.length,')');assert.deepEqual(unexpected,[]);
 console.log('PASS: framing, three real orders, branch generations, and $100M / $450M / 8');
}finally{await browser.close();}
