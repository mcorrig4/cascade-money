import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, dirname, join, delimiter, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// A browser verification harness, serving the built app by interception: no port,
// recording pipeline, external publication, or replacement fixture event stream.
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(app,'dist'),artifacts=join(app,'artifacts');
await mkdir(artifacts,{recursive:true});
const proof={checks:[],outputs:[],errors:[],northSamples:[],visualReviewRequired:true};
const pathFor=name=>join(artifacts,`stage18-${name}.png`);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.ndjson':'application/x-ndjson','.glb':'model/gltf-binary','.json':'application/json','.wasm':'application/wasm'};
let browser,releaseTextures;let withholding=true;
const texturesReady=new Promise(resolve=>{releaseTextures=resolve;}),textureRequests=[];
async function check(name,run){try{const result=await run();proof.checks.push({name,result,passed:true});console.log(`[stage18] PASS ${name}`);}catch(error){proof.errors.push({name,message:error.stack??String(error)});console.error(`[stage18] FAIL ${name}: ${error.message}`);}}
try{
 const executablePath=process.env.CHROME_PATH||['google-chrome','chromium','chromium-browser'].flatMap(name=>(process.env.PATH??'').split(delimiter).map(dir=>join(dir,name))).find(existsSync);
 assert.ok(executablePath,'Set CHROME_PATH to an installed Chrome binary');
 browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await context.route('http://cascade.test/**',async route=>{
  const pathname=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,''),file=resolve(dist,pathname||'index.html');
  if(!file.startsWith(dist+sep))return route.fulfill({status:403});
  if(pathname.startsWith('textures/')){textureRequests.push(pathname);if(withholding)await texturesReady;}
  try{await route.fulfill({status:200,body:await readFile(file),contentType:mime[extname(file)]??'application/octet-stream'});}catch{await route.fulfill({status:404,body:'Not found'});}
 });
 const page=await context.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',error=>proof.errors.push({name:'pageerror',message:error.stack??error.message}));
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const draw=()=>page.evaluate(()=>{const c=window.__cascade;c.renderFrame(performance.now());return c.cameraOrientation();});
 const capture=async(name,label)=>{
  await settle();const diagnostic=await draw();
  await page.evaluate(label=>{let badge=document.getElementById('stage18-proof-label');if(!badge){badge=document.createElement('div');badge.id='stage18-proof-label';Object.assign(badge.style,{position:'fixed',right:'16px',top:'16px',zIndex:'100000',background:'#03131fee',color:'#c9ffe8',padding:'10px 14px',font:'16px monospace',pointerEvents:'none'});document.body.append(badge);}badge.textContent=label;},`${label} · north error ${diagnostic.angleDegrees.toFixed(6)}°${diagnostic.allowRoll?' · authored roll allowed':''}`);
  const path=pathFor(name);await page.screenshot({path,timeout:60000});proof.outputs.push({path,label,diagnostic});return diagnostic;
 };
 await page.goto('http://cascade.test/?inspect=1',{waitUntil:'domcontentloaded'});
 await check('ready holds the single loading cover until cold textures finish',async()=>{
  await page.waitForFunction(()=>typeof window.__cascade?.ready==='function');
  await page.evaluate(()=>{window.__stage18Ready=false;window.__cascade.ready().then(()=>{window.__stage18Ready=true;});});
  assert.ok(textureRequests.length,'Actual texture requests are withheld');
  assert.equal(await page.evaluate(()=>window.__stage18Ready),false);
  assert.ok(await page.locator('.loading').isVisible(),'The loading cover stays visible before composition readiness');
  const pending=pathFor('loading-pending');await page.screenshot({path:pending});proof.outputs.push({path:pending,label:'Cold textures withheld; loading cover still present'});
  withholding=false;releaseTextures();
  await page.waitForFunction(()=>window.__stage18Ready);await page.waitForTimeout(750);
  assert.equal(await page.locator('.loading:visible').count(),0,'The one reveal completes');
  const readiness=await page.evaluate(()=>window.__cascade.readiness());assert.equal(readiness.fullFrame,true);
  const before=await page.evaluate(()=>window.__cascade.globe.pointOfView());await settle();
  const after=await page.evaluate(()=>window.__cascade.globe.pointOfView());
  assert.ok(before.altitude>1&&after.altitude>1,'Opening is a wide globe');assert.notEqual(before.lng,after.lng,`Opening rotation is already live: ${JSON.stringify({before,after})}`);
  assert.ok((await page.locator('.ledger').innerText()).includes('2,000,000 camera sensors → Foxconn Zhengzhou'));
  await capture('opening-ready','Opening: composed and rotating');return {readiness,before,after,textureRequests};
 });
 withholding=false;releaseTextures();await page.waitForFunction(()=>!!window.__cascade);await page.evaluate(()=>window.__cascade.ready());
 await page.evaluate(()=>{const c=window.__cascade,e=c.engine;e.setClockMode('manual');c.globe.pauseAnimation();e.update({recording:true,hud:true});});
 const scene=async(id,seconds=0)=>{
  await page.evaluate(async id=>{const c=window.__cascade;await c.playScene(id);c.renderFrame(performance.now());},id);await settle();
  if(seconds)await page.evaluate(seconds=>window.__cascade.engine.tick(seconds,'manual'),seconds);
  await settle();return draw();
 };
 await check('all default-north authored shots stay north-up at starts, holds and ends',async()=>{
  const shots=await page.evaluate(()=>window.__cascade.shots.map(({id,seconds,allowRoll,scene})=>({id,seconds,allowRoll,scene})));
  for(const shot of shots){
   // Architectural opt-ins are exercised by the full-film engine test and
   // legibility gate; the north-up invariant applies to all remaining shots.
   if(shot.allowRoll)continue;
   await scene(shot.id);
   // Simulate incoming roll from a prior authored architecture shot.
   await page.evaluate(()=>window.__cascade.globe.camera().up.set(.8,-.2,.5).normalize());
   // The engine test samples every 30 frames; inspect live start, middle and end here.
   for(let sample=0;sample<3;sample++){
    if(sample)await page.evaluate(seconds=>window.__cascade.engine.tick(seconds,'manual'),shot.seconds*.499);
    const d=await draw();proof.northSamples.push({shot:shot.id,scene:shot.scene,seconds:sample*shot.seconds*.499,...d});
    assert.equal(d.allowRoll,shot.allowRoll===true);
    if(!shot.allowRoll)assert.ok(d.angleDegrees<1,`Scene ${shot.scene} at ${sample*shot.seconds*.499}s: ${d.angleDegrees} degrees`);
    if(sample===0&&[1,2,3,4,6,11].includes(shot.id))await capture(`north-start-scene-${String(shot.scene).padStart(2,'0')}`,`Scene ${shot.scene} start`);
   }
  }
  return {authoredScenes:shots.length,checkedScenes:shots.filter(s=>!s.allowRoll).length,samples:proof.northSamples.length,maxDefaultError:Math.max(...proof.northSamples.filter(s=>!s.allowRoll).map(s=>s.angleDegrees))};
 });
 await check('California hook holds on the decoded Apple coast marker',async()=>{
  const duration=await page.evaluate(()=>window.__cascade.shots.find(s=>s.id===2).seconds);
  await scene(1);await scene(2,duration*.4);
  assert.equal(await page.evaluate(()=>window.__cascade.engine.state.camera.site??null),null);
  const marker=page.locator('.company-label').filter({has:page.locator('img[src$="/apple.svg"]')}).first();
  assert.ok(await marker.isVisible(),'Apple company marker is the visible California subject');
  assert.ok(await marker.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0));
  assert.ok(await marker.locator('span').evaluate(el=>el.scrollWidth<=el.clientWidth),'California caption is not clipped');
  const pov=await page.evaluate(()=>window.__cascade.globe.pointOfView());assert.ok(pov.altitude<1&&pov.altitude>.02);
  await capture('california-hold','Scene 2: California / Apple logo hold');
  await page.evaluate(seconds=>window.__cascade.engine.tick(seconds,'manual'),duration*.35);await draw();
  const approach=await page.evaluate(()=>window.__cascade.globe.pointOfView());assert.ok(Math.abs(approach.altitude-.06)<1e-6);
  assert.equal(await page.evaluate(()=>window.__cascade.engine.state.camera.site??null),null);
  assert.ok(await marker.isVisible(),'Apple marker remains visible throughout its approach');
  assert.equal(await page.evaluate(()=>window.__cascade.globe.pointsData().length),0,'Scene 2 keeps the logo clear of globe data columns');
  const approachOrientation=await capture('apple-marker-approach','Scene 2: slow Apple Park marker approach');assert.equal(approachOrientation.allowRoll,false);assert.ok(approachOrientation.angleDegrees<1);
  await page.evaluate(seconds=>window.__cascade.engine.tick(seconds,'manual'),duration*.25);await draw();
  const exit=await page.evaluate(()=>{const c=window.__cascade,camera=c.globe.camera(),pov=c.globe.pointOfView();return {altitude:pov.altitude,angularRadius:Math.asin(1/(1+pov.altitude))*180/Math.PI,halfFov:camera.fov/2};});
  assert.ok(Math.abs(exit.altitude-1.65)<1e-6);assert.ok(exit.angularRadius<exit.halfFov,'Whole globe fits inside vertical field of view');
  await capture('california-pullout','Scene 2: closer full-globe endpoint at altitude 1.65');
  assert.ok(await page.evaluate(()=>window.__cascade.globe.pointOfView().altitude>1),'Hook returns wide');return {pov,marker:await marker.boundingBox()};
 });
 await check('literal Samsung, Corning, Sony cues reveal the real orders exactly once',async()=>{
  await scene(3);
  const cues=await page.evaluate(()=>window.__cascade.shots.find(s=>s.id===3).orderCues);
  assert.deepEqual(cues.map(cue=>cue.word),['Samsung','Corning','Sony']);
  await page.evaluate(()=>{const c=window.__cascade;c.cue('Samsung',undefined,1000);c.cue('Corning',undefined,2000);c.cue('Sony',undefined,3000);});
  await page.evaluate(()=>window.__cascade.engine.tick(.5,'manual'));await settle();
  assert.equal(await page.locator('.scene-orders [data-invoice]').count(),0,'Preloaded word timings suppress fallback visibility');
  await page.evaluate(()=>window.__cascade.engine.tick(3,'manual'));await settle();await draw();
  const orders=await page.locator('.scene-orders').innerText();
  for(const company of ['Samsung','Corning','Sony'])assert.ok(orders.includes(company),`${company} order is visible`);
  const data=await page.evaluate(()=>window.__cascade.engine.storyEvents.map(e=>({invoiceId:e.invoiceId,from:e.from,to:e.to,amount:String(e.amount),type:e.type})));
  assert.equal(data.filter(e=>e.to==='Sony').length,1);assert.ok(data.some(e=>e.from==='Apple'&&e.to==='Sony'&&e.amount==='5000000000'&&e.type==='issue'));
  await capture('three-orders','Scene 3: Samsung, Corning and Sony orders');return {cues,orders,data};
 });
 await check('scene five branched cascade still settles exactly nine invoices',async()=>{
  const duration=await page.evaluate(()=>window.__cascade.shots.find(s=>s.id===4).seconds);await scene(4,duration*.97);
  const count=await page.getByTestId('invoices-settled').innerText();assert.equal(count,'9');
  const settled=await page.evaluate(()=>window.__cascade.engine.invoicesSettled());assert.equal(settled,9);
  await capture('cascade-nine','Scene 5: branched cascade / 9 invoices settled');return {count,settled};
 });
 await check('year-end HUD counts only fully settled invoices',async()=>{
  await page.evaluate(()=>window.__cascade.engine.seek(364.999));await settle();await draw();
  const count=await page.getByTestId('invoices-settled').innerText();assert.equal(count,'6,943');
  await capture('year-settled','Year end: 6,943 fully settled invoices');return {count};
 });
 await check('scrubber seek resets the actual contaminated live camera',async()=>{
  await scene(3,1);
  await page.evaluate(()=>{const c=window.__cascade;c.globe.camera().up.set(.8,-.2,.5).normalize();c.engine.seek(20);});
  const d=await draw();assert.equal(d.allowRoll,false);assert.ok(d.angleDegrees<1);await capture('seek-north','Timeline seek: north-up reset');return d;
 });
}catch(error){proof.errors.push({name:'harness',message:error.stack??String(error)});console.error(error);}
finally{releaseTextures?.();await browser?.close();await writeFile(join(artifacts,'stage18-proof.json'),JSON.stringify(proof,null,2));}
console.log(`[stage18] ${proof.checks.length} passed; ${proof.errors.length} failed; ${proof.outputs.length} proof images`);
if(proof.errors.length)process.exitCode=1;
