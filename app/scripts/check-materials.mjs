import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(app,'dist'),output=join(app,'artifacts/materials-boundary');
await mkdir(output,{recursive:true});
const proof={checks:[],frames:[],errors:[]};
let browser;
const deadline=setTimeout(()=>{console.error('Browser proof exceeded 120 seconds');void browser?.close();},120000);
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
 await page.evaluate(()=>Promise.race([window.__cascade.ready(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Readiness timeout: '+JSON.stringify(window.__cascade.readiness()))),60000))]));console.log('scene ready');
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const capture=async name=>{const file=join(output,`${name}.png`);await page.screenshot({path:file,timeout:60000});proof.frames.push(file);console.log(`captured ${name}`);return file;};
 const readiness=await page.evaluate(()=>window.__cascade.readiness());
 assert.equal(readiness.siteMaterialsCompiled,true);assert.equal(readiness.fullFrame,true);
 const gpu=await page.evaluate(()=>{const gl=window.__cascade.globe.renderer().getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 proof.checks.push({name:'renderer',gpu,readiness});
 const materials=()=>page.evaluate(()=>{
   const c=window.__cascade,renderer=c.globe.renderer(),result=[];
   c.globe.scene().traverse(o=>{if(o.name.startsWith('Site model:')||o.name==='Apple Park ring decal')o.traverse(mesh=>{for(const m of mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[])result.push({root:o.name,material:m.name,programs:renderer.properties.get(m).programs?.size??0});});});
   return {models:c.models(),materials:result};
 });
 console.log('GPU identified',gpu);
 const initial=await materials();assert.ok(initial.models.every(m=>m.loaded&&!m.pending));
 assert.ok(initial.materials.length>0&&initial.materials.every(m=>m.programs>0));
 proof.checks.push({name:'all-site-and-decal-materials-compiled-before-capture',...initial});
 console.log('All site materials compiled');
 await writeFile(join(output,'proof.json'),JSON.stringify(proof,null,2));
 await page.setViewportSize({width:640,height:360});
 console.log('Boundary viewport ready');
 await page.evaluate(async()=>{const c=window.__cascade;c.engine.setClockMode('manual');await c.playFilm();c.engine.update({recording:true,hud:false});const second=c.shots.find(s=>s.id===2);c.engine.tick(second.startTime-.1,'manual');});
 console.log('Film clock at boundary');
 for(let i=0;i<9;i++){
   await page.evaluate(i=>{const c=window.__cascade;if(i)c.engine.tick(1/30,'manual');c.renderFrame(c.engine.state.shotElapsed*1000);},i);await settle();
   const status=await materials();assert.ok(status.models.every(m=>m.loaded&&!m.pending));assert.ok(status.materials.every(m=>m.programs>0));
   await capture(`boundary-${String(i).padStart(2,'0')}`);
 }
 const frozen=await page.screenshot({timeout:60000});
 await page.evaluate(()=>{const c=window.__cascade;c.renderFrame(c.engine.state.shotElapsed*1000);});await settle();
 assert.ok(frozen.equals(await page.screenshot({timeout:60000})),'Frozen boundary frame is pixel deterministic');
 proof.checks.push({name:'continuous-1-to-2-compiled-and-frozen-pixels',passed:true});
 assert.deepEqual(proof.errors,[]);
}catch(error){proof.errors.push(error.stack??String(error));throw error;}finally{clearTimeout(deadline);await browser?.close();await writeFile(join(output,'proof.json'),JSON.stringify(proof,null,2));}
console.log(JSON.stringify(proof,null,2));
