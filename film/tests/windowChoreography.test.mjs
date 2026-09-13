import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {windowStateAt, WINDOW_PRESETS} from '../src/components/windowGeometry.ts';

const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/compositions/windowChoreography.ts',import.meta.url),'utf8');
const module={exports:{}};
new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(
  name=>require(name==='../cues'?'../src/cues.ts':'../src/components/windowGeometry.ts'),module,module.exports);
const {sceneWindowSpec, sourceFit, requiredCueFrame, FLAT_RIGHT}=module.exports;
const cues={'cascade-open':0.2,'same-dollars':12.1,'window-mirror':16.1,'window-flatten':10,'window-center':0.1,'zoom-out-again':0.1};

test('W2 holds locked window decisions and joins every continuous middle boundary',()=>{
  for(const fps of [15,30]) {
    const mirrorStart=Math.round(cues['same-dollars']*fps);
    const cascadeSpec={from:'centerLarge',to:'skewRight',startFrame:mirrorStart,durationInFrames:Math.round(1.2*fps)};
    for(let frame=0;frame<=1000;frame++) {
      const spec=sceneWindowSpec(5,frame,fps,cues);
      assert.deepEqual(spec,cascadeSpec,'scene 5 has one move, on same-dollars only');
      if(frame<=mirrorStart) assert.deepEqual(windowStateAt(spec,frame),WINDOW_PRESETS.centerLarge);
      if(frame>=mirrorStart+cascadeSpec.durationInFrames) assert.deepEqual(windowStateAt(spec,frame),WINDOW_PRESETS.skewRight);
    }
    for(const scene of [2,3,4,6,7]) for(const frame of [0,1000])
      assert.deepEqual(windowStateAt(sceneWindowSpec(scene,frame,fps,cues),frame),WINDOW_PRESETS[scene===2?'centerSmall':scene<=4?'centerLarge':'skewRight']);
    for(const [outgoing,incoming] of [[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10]])
      assert.deepEqual(windowStateAt(sceneWindowSpec(outgoing,1000,fps,cues),1000),windowStateAt(sceneWindowSpec(incoming,0,fps,cues),0));
    assert.deepEqual(windowStateAt(sceneWindowSpec(8,1000,fps,cues),1000),FLAT_RIGHT);
    const s9=sceneWindowSpec(9,0,fps,cues);
    assert.equal(s9.durationInFrames,Math.round(.9*fps));
    assert.deepEqual(windowStateAt(s9,s9.startFrame+s9.durationInFrames),WINDOW_PRESETS.centerLarge);
  }
});

test('W2 source fit preserves native aspect and the full footer below chrome',()=>{
  const fit=sourceFit();
  assert.equal(1080*fit.scale+65,1080);
  assert.equal(1920*fit.scale+2*fit.left,1920);
  assert.equal(fit.scale,1015/1080);
});

test('W2 choreography fails on missing cues rather than falling back to stale offsets',()=>{
  assert.throws(()=>requiredCueFrame({},'window-center',30),/Missing required film cue/);
  assert.equal(requiredCueFrame({'window-center':1.23},'window-center',30),37);
});

test('installed narration leaves enough time to finish incoming boundary poses',()=>{
  const installed=JSON.parse(readFileSync(new URL('../src/generated/cues.json',import.meta.url),'utf8'));
  const narration=JSON.parse(readFileSync(new URL('../public/narration/narration.json',import.meta.url),'utf8'));
  for(const fps of [15,30]) for(const scene of [5,8,9]) {
    const entry=narration.find(entry=>entry.scene===scene);
    const last=Math.round((entry.duration+.4)*fps)-1;
    const spec=sceneWindowSpec(scene,last,fps,installed[scene]);
    assert.ok(last>=spec.startFrame+spec.durationInFrames,`scene ${scene} must finish its move before the next scene`);
  }
  assert.ok(installed[10]['zoom-out-again']+.9<installed[10]['word-loans']);
});

test('offset and trim use SceneVO frame rounding, with untrimmed tail timing',()=>{
  const {narrationAdjustedCues}=module.exports;
  for(const fps of [15,30]) {
    const controls={offsetSec:.117,trimStartSec:.241};
    const cues={body:1.628,tail:29.748};
    const adjusted=narrationAdjustedCues(cues,fps,controls,Math.round(28*fps));
    assert.equal(requiredCueFrame(adjusted,'body',fps),Math.round(cues.body*fps)+Math.round(controls.offsetSec*fps)-Math.round(controls.trimStartSec*fps));
    assert.equal(requiredCueFrame(adjusted,'tail',fps),Math.round(cues.tail*fps)+Math.round(controls.offsetSec*fps));
    assert.equal(narrationAdjustedCues(cues,fps,{offsetSec:0,trimStartSec:0}),cues);
  }
});
