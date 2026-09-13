import test from 'node:test';
import {md5File} from './render-provenance.mjs';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, mkdtempSync, mkdirSync, copyFileSync, symlinkSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const run = (command, args) => execFileSync(command, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024});
// W4 v4 splice incident: decoded signal in every part catches silent loss that stream metadata misses.
test('both real splice modes retain audio across alternating mono/stereo parts', () => {
  const lock = JSON.parse(readFileSync(new URL('../src/generated/cues.lock.json', import.meta.url)));
  const required = Object.keys(lock).map(scene => scene.endsWith('.wav') ? scene : `scene-${scene.padStart(2, '0')}.wav`);
  const missing = required.map(name => fileURLToPath(new URL(`../public/narration/${name}`, import.meta.url))).filter(path => !existsSync(path));
  if (missing.length) throw new Error(`Narration test setup missing: ${missing.join(', ')}. Copy the installed narration WAVs from the render host into film/public/narration/; these assets are intentionally gitignored.`);
  const root = mkdtempSync(join(tmpdir(), 'cascade-splice-'));
  try {
    for (const dir of ['scripts', 'public', 'src', 'out/parts', 'out/parts-final']) mkdirSync(join(root, dir), {recursive: true});
    for (const name of ['splice-draft.sh', 'check-cues.mjs', 'render-provenance.mjs']) copyFileSync(fileURLToPath(new URL(name, import.meta.url)), join(root, 'scripts', name));
    symlinkSync(fileURLToPath(new URL('../public/narration', import.meta.url)), join(root, 'public/narration'));
    symlinkSync(fileURLToPath(new URL('../src/generated', import.meta.url)), join(root, 'src/generated'));
    for (const [kind, channels, rate, frequency] of [['mono', 1, 44100, 440], ['stereo', 2, 48000, 880]]) {
      run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${kind === 'mono' ? 'red' : 'blue'}:s=160x90:r=30:d=0.5`,
        '-f', 'lavfi', '-i', `sine=frequency=${frequency}:sample_rate=${rate}:duration=0.5`,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', String(channels), join(root, `${kind}.mp4`)]);
    }
    for (let i = 1; i <= 12; i++) for (const dir of ['parts', 'parts-final']) {
      const part = join(root, 'out', dir, `scene-${String(i).padStart(2, '0')}.mp4`);
      copyFileSync(join(root, `${i % 2 ? 'mono' : 'stereo'}.mp4`), part);
      writeFileSync(part.replace(/\.mp4$/, '.provenance.json'), JSON.stringify({
        schemaVersion: 1, scene: i, commitSha: 'a'.repeat(40), dirty: false,
        cuesLockMd5: md5File(join(root, 'src/generated/cues.lock.json')),
        cuesMd5: md5File(join(root, 'src/generated/cues.json')),
        profile: dir === 'parts' ? 'draft' : 'final', fps: 30, source: 'live',
        renderStartedAt: '2026-09-13T12:00:00.000Z', partMd5: md5File(part),
      }));
    }
    // MP4 concat can repeat H.264 parameter sets; decoded frame hashes compare picture bytes independently of container headers.
    const videoFrames = file => run('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v:0', '-fps_mode', 'passthrough', '-f', 'framemd5', '-']).split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split(',').at(-1).trim());
    const expectedVideo = Array.from({length: 12}, (_, i) => videoFrames(join(root, `${i % 2 ? 'stereo' : 'mono'}.mp4`))).flat();
    for (const mode of ['draft', 'final']) {
      run('bash', [join(root, 'scripts/splice-draft.sh'), mode === 'draft' ? 'test' : '--final']);
      const output = join(root, 'out', mode === 'draft' ? 'cascade-draft-360p-test.mp4' : 'cascade-final-1080p.mp4');
      const streams = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels,channel_layout,sample_rate,duration', '-of', 'json', output])).streams;
      assert.equal(streams[0].channels, 2); assert.equal(streams[0].channel_layout, 'stereo'); assert.equal(streams[0].sample_rate, '48000');
      const duration = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output]));
      assert.equal(duration, 6, `${mode} container duration`);
      assert.equal(Number(streams[0].duration), 6, `${mode} audio duration`);
      for (const file of [output, ...(mode === 'final' ? [join(root, 'out/cascade-final-720p.mp4')] : [])]) {
        const manifest = JSON.parse(readFileSync(file.replace(/\.mp4$/, '.provenance.json')));
        assert.equal(manifest.mixed, false); assert.equal(manifest.parts.length, 12);
        assert.equal(manifest.output.md5, md5File(file));
      }
      if (mode === 'final') {
        assert.deepEqual(videoFrames(output), expectedVideo);
        console.log(`Final video: all ${expectedVideo.length} decoded frame MD5 hashes match input parts in order.`);
      }
      const levels = [];
      for (let i = 0; i < 12; i++) {
        const start = (i * 0.5 + 0.15).toFixed(2);
        const graph = `amovie=${output},atrim=start=${start}:duration=0.2,asetpts=PTS-STARTPTS,astats=metadata=1:reset=0`;
        const frames = JSON.parse(run('ffprobe', ['-v', 'error', '-f', 'lavfi', '-i', graph, '-show_frames', '-show_entries', 'frame_tags=lavfi.astats.Overall.RMS_level', '-of', 'json'])).frames;
        const level = Number(frames.at(-1)?.tags?.['lavfi.astats.Overall.RMS_level']);
        assert.ok(Number.isFinite(level) && Math.abs(level - (-24.08)) < 0.2, `${mode} segment ${i + 1}: ${level} dBFS`);
        levels.push(Number(level.toFixed(2)));
      }
      console.log(JSON.stringify({mode, audio: streams[0], segmentRmsDbfs: levels}));
    }
  } finally { rmSync(root, {recursive: true, force: true}); }
});
