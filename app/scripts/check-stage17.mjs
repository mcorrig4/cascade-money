import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {spawnSync} from 'node:child_process';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(app,'dist'),output=join(app,'artifacts/stage17');
await mkdir(output,{recursive:true});
const arcsOnly=process.argv.includes('--arcs-only');
const proof={checks:[],frames:[],errors:[]};
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await context.addInitScript(()=>{window.__cascade={frameDriven:true};});
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.ndjson':'application/x-ndjson','.glb':'model/gltf-binary'};
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='cascade.test')return route.fulfill({status:404,body:''});
  const file=resolve(dist,decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');
  if(!file.startsWith(dist+sep))return route.fulfill({status:403,body:''});
  try{await route.fulfill({status:200,body:await readFile(file),contentType:mime[extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:''});}
 });
 console.log('browser launched');
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('console',m=>{if(m.type()==='error')console.log('browser:',m.text());});page.on('pageerror',error=>proof.errors.push(error.message));
 await page.goto('http://cascade.test/',{waitUntil:'domcontentloaded'});console.log('page loaded');
 await page.waitForFunction(()=>!!window.__cascade?.ready,null,{timeout:60000});
 console.log('API ready');
 await page.evaluate(()=>Promise.race([window.__cascade.ready(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Readiness timeout: '+JSON.stringify(window.__cascade.readiness()))),45000))]));console.log('scene ready');
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const sample=async(id,tMs,cues={})=>{
  await page.evaluate(({id,tMs,cues})=>{
   const c=window.__cascade,e=c.engine;e.setClockMode('manual');c.playScene(id);e.update({cues,recording:true,hud:true});e.tick(0,'manual');e.tick(tMs/1000,'manual');c.renderFrame(tMs);
  },{id,tMs,cues});await settle();
 };
 const capture=async name=>{const file=join(output,`${name}.png`);await page.screenshot({path:file,timeout:60000});proof.frames.push(file);console.log(`captured ${name}`);return file;};
 // A controlled 100K presentation uses the real indexed arc, maturity and camera.
 const arcSample=async()=>{
  await sample(3,6000);
  await page.evaluate(()=>{const c=window.__cascade;c.engine.update({paymentAmount:10000000n});const arc=c.pool.arcs[0];c.engine.fly(arc.midLat,arc.midLng,1.8,0);c.engine.tick(0,'manual');c.renderFrame(6000);});await settle();
  const label=page.locator('.floating-amount:not([hidden])').filter({hasText:'100K'}).first();
  await label.waitFor({state:'visible'});
  assert.equal(await label.locator('strong').innerText(),'100K');
  assert.ok(await label.evaluate(el=>{const a=el.getBoundingClientRect();return [...document.querySelectorAll('.company-callout:not([hidden])')].every(card=>{const b=card.getBoundingClientRect();return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;});}),'Arc coin does not overlap endpoint cards');
  assert.ok(await page.evaluate(()=>Number(getComputedStyle(document.querySelector('.amount-layer')).zIndex)>Number(getComputedStyle(document.querySelector('.company-layer')).zIndex)),'Arc coin paints above endpoint cards');
  const before=await label.locator('svg').getAttribute('data-days'),date=await label.locator('svg').getAttribute('data-maturity');
  assert.ok(Number(before)>0);
  await page.evaluate(()=>{const c=window.__cascade;c.engine.update({day:c.engine.state.day+1});c.renderFrame(6000);});await settle();
  assert.equal(Number(await label.locator('svg').getAttribute('data-days')),Number(before)-1);
  assert.equal(await label.locator('svg').getAttribute('data-maturity'),date);
  return {box:await label.boundingBox(),days:Number(before)-1,date,coin:await label.locator('svg').boundingBox()};
 };
 proof.checks.push({name:'arc-1080p',...await arcSample()});const full=await capture('arc-1080p');
 const canvasPage=await context.newPage();
 const source=(await readFile(full)).toString('base64');
 const downsample=await canvasPage.evaluate(async source=>{const image=new Image();image.src=`data:image/png;base64,${source}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.getContext('2d').drawImage(image,0,0,640,360);return canvas.toDataURL('image/png').split(',')[1];},source);
 const downsampleFile=join(output,'arc-downsample-360p.png');await writeFile(downsampleFile,Buffer.from(downsample,'base64'));proof.frames.push(downsampleFile);
 await page.setViewportSize({width:640,height:360});await settle();
 proof.checks.push({name:'arc-native-360p',...await arcSample()});await capture('arc-native-360p');
 if(!arcsOnly){
 await page.setViewportSize({width:1920,height:1080});await settle();
 // Delayed cue proves the exchange follows the named cue, rather than its fallback.
 await sample(6,6600,{'same-date':7000,'coin-claim':11000});
 assert.equal(await page.getByTestId('same-date-swap').count(),0);
 for(const [name,tMs] of [['start',7000],['over-under',8000],['swapped',9000],['return-arcs',10000],['returned',10999]]){
  await sample(6,tMs,{'same-date':7000,'coin-claim':11000});
  assert.equal(await page.locator('.swap-coin').count(),2);
  assert.equal(await page.locator('.coin-copy').count(),0);
  const coins=await page.locator('.swap-coin svg').evaluateAll(coins=>coins.map(c=>({days:c.dataset.days,date:c.dataset.maturity})));
  assert.deepEqual(coins[0],coins[1]);await capture(`same-date-${name}`);
 }
 const frozen=await page.screenshot();await settle();assert.ok(frozen.equals(await page.screenshot()),'Frozen frame pixels match');
 proof.checks.push({name:'same-date-cue-swap-and-deterministic-pixels',passed:true});
 await sample(6,18200);
 assert.equal(await page.locator('.extension-ticks [data-filled="true"]').count(),30);
 assert.equal(await page.locator('.extension-ticks [data-filled="true"]').first().getAttribute('data-day'),'30');
 await capture('extend-new-interval');
 await sample(18,6000,{contract:7000});assert.equal(await page.locator('.contract-line').evaluate(e=>Number(getComputedStyle(e).opacity)),0);
 await sample(18,7500,{contract:7000});assert.equal(await page.locator('.contract-line').evaluate(e=>Number(getComputedStyle(e).opacity)),1);await capture('contract');
 await sample(19,10199);assert.equal(await page.locator('.close-card,.ending-line').count(),0);await capture('before-close');
 await sample(12,1000);assert.equal(await page.locator('.ending-line').count(),1);await capture('close-own-scene');
 await sample(17,12000);assert.match(await page.locator('.cascade-totals').innerText(),/10\s+invoices settled/);
 assert.equal(await page.getByTestId('invoices-settled').innerText(),'10');
 assert.equal(await page.getByTestId('committed').innerText(),'$100M');assert.equal(await page.getByTestId('settled').innerText(),'$450M');
 proof.checks.push({name:'branched-panel-values',invoices:10,suppliers:8,deposited:'$100M',transacted:'$450M'});
 const sourceTotals=await page.evaluate(()=>{
  const index=window.__cascade.engine.index;
  const first=index.payments.find(e=>e.type==='issue'&&/apple/i.test(index.firms.get(e.from)?.name??'')&&/samsung/i.test(index.firms.get(e.to)?.name??''));
  const marker=index.stories.find(s=>s.payment?.seq===first?.seq);
  const payments=[...new Map(index.stories.filter(s=>s.storyId===marker?.storyId&&s.payment).map(s=>[s.payment.seq,s.payment])).values()];
  return {invoices:new Set(payments.map(p=>p.invoiceId)).size,suppliers:new Set(payments.map(p=>p.to)).size,settled:payments.reduce((n,p)=>n+p.amount,0n).toString(),deposited:payments.filter(p=>p.type==='issue').reduce((n,p)=>n+p.amount,0n).toString()};
 });
 assert.deepEqual(sourceTotals,{invoices:10,suppliers:8,settled:'45000000000',deposited:'10000000000'});
 proof.checks.push({name:'branched-source-reconciles-with-panels',...sourceTotals});
await capture('branched-totals');
 proof.checks.push({name:'extension-contract-close-and-totals',passed:true});
 // Exercise one uninterrupted live-app film, not separately mounted shots.
 await page.setViewportSize({width:640,height:360});await settle();
 await page.evaluate(async()=>{const c=window.__cascade,e=c.engine;e.update({recording:false});await c.playFilm();const close=c.shots.find(s=>s.id===12);e.tick(close.startTime-.1,'manual');e.update({recording:true});c.renderFrame(e.state.shotElapsed*1000);});await settle();
 const boundary=[];
 for(let i=0;i<12;i++){
  if(i)await page.evaluate(()=>{const c=window.__cascade;c.engine.tick(1/30,'manual');c.renderFrame(c.engine.state.shotElapsed*1000);});
  await settle();
  const frame=await page.evaluate(()=>{const c=window.__cascade,take=c.recordingTake();return {shot:c.engine.state.shot,tMs:c.engine.state.tMs,local:c.engine.state.shotElapsed,splitShot:take.sceneTransitions.at(-1).sceneId,closePresent:!!document.querySelector('.ending-line,.close-card')};});
  assert.equal(frame.shot,frame.splitShot);
  if(frame.shot===19)assert.equal(frame.closePresent,false);
  boundary.push(frame);await capture(`boundary-${String(i).padStart(2,'0')}`);
 }
 const take=await page.evaluate(()=>{const c=window.__cascade;c.engine.tick(1/30,'manual');c.engine.update({recording:false});return c.recordingTake();});
 assert.deepEqual(take.sceneTransitions.map(t=>t.sceneId),[19,12]);
 assert.equal(take.ranges[0].endMs,take.ranges[1].startMs);
 await writeFile(join(output,'boundary-take.json'),JSON.stringify(take,null,2));
 proof.checks.push({name:'live-recording-19-to-12',boundary,take});
 const run=(command,args)=>{const result=spawnSync(command,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr||String(result.error));return result.stdout;};
 run('ffmpeg',['-v','error','-y','-framerate','30','-i',join(output,'boundary-%02d.png'),'-frames:v','12','-c:v','libx264','-crf','18',join(output,'boundary-take.mp4')]);
 const clips=join(output,'boundary-scenes');await mkdir(clips,{recursive:true});
 for(const scene of [16,17])await rm(join(clips,`scene-${scene}.mp4`),{force:true});
 run(process.execPath,['--experimental-strip-types',resolve(app,'../film/scripts/record-take.mjs'),join(output,'boundary-take.mp4'),join(output,'boundary-take.json'),clips]);
 const clipFrames=[];
 for(const range of take.ranges){
  const file=join(clips,`scene-${range.sceneIndex}.mp4`);
  const result=JSON.parse(run('ffprobe',['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=nb_read_frames','-of','json',file]));
  const count=Number(result.streams[0].nb_read_frames);
  assert.equal(count,Math.round((range.endMs-range.startMs)/1000*30));clipFrames.push({scene:range.sceneIndex,count,file});
 }
 assert.equal(clipFrames.reduce((n,c)=>n+c.count,0),12);
 proof.checks.push({name:'live-app-video-splits-use-recorded-events',clipFrames});
 }
 assert.deepEqual(proof.errors,[]);
}catch(error){proof.errors.push(error.stack??String(error));throw error;}finally{await browser?.close();await writeFile(join(output,arcsOnly?'proof-arcs.json':'proof.json'),JSON.stringify(proof,null,2));}
console.log(JSON.stringify(proof,null,2));
