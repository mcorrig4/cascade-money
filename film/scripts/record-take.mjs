import { readFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { sceneCaptureRanges } from '../../app/src/director/recording.ts';

// node --experimental-strip-types scripts/record-take.mjs take.mp4 transitions.json output-dir
// Enable app recording mode at capture start and disable it at capture stop.
// Save JSON.stringify(window.__cascade.recordingTake()) as transitions.json.
// The app retains the exact published scene events and capture-clock endpoints.
// Split on the same transition eligibility used by ShotOverlays, never SHOTS durations.
const [take, metadata, output] = process.argv.slice(2);
if (!take || !metadata || !output) throw new Error('Expected take.mp4 transitions.json output-dir');
const { sceneTransitions, captureStartMs, captureEndMs } = JSON.parse(await readFile(metadata, 'utf8'));
const ranges = sceneCaptureRanges(sceneTransitions, captureStartMs, captureEndMs);
if (!ranges.length || ranges.some(r=>!Number.isFinite(r.startMs)||r.startMs<0||!Number.isFinite(r.endMs)||r.endMs<=r.startMs)) throw new Error('Invalid capture-clock transitions');
await mkdir(output, {recursive:true});
for (const range of ranges) {
  const result=spawnSync('ffmpeg',['-v','error','-n','-i',take,'-ss',String(range.startMs/1000),'-t',String((range.endMs-range.startMs)/1000),'-c:v','libx264','-crf','18','-c:a','aac',join(output,`scene-${String(range.sceneIndex).padStart(2,'0')}.mp4`)],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Scene ${range.sceneIndex} split failed`);
}
