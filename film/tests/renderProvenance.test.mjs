import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync, execFileSync} from 'node:child_process';
import {md5File, snapshot, finishPart} from '../scripts/render-provenance.mjs';

const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const run = (cmd, args) => execFileSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const sha = 'a'.repeat(40);

// W6 chimera incident: exercise the real shell gate and concat with actual MP4s, never a film renderer.
test('splice provenance refusal matrix and persistent override evidence', async t => {
  const root = mkdtempSync(join(tmpdir(), 'cascade-provenance-'));
  try {
    for (const dir of ['scripts', 'src/generated', 'public/narration', 'out/parts', 'out/parts-final']) mkdirSync(join(root, dir), {recursive: true});
    for (const name of ['splice-draft.sh', 'check-cues.mjs', 'render-provenance.mjs'])
      copyFileSync(new URL(`../scripts/${name}`, import.meta.url), join(root, 'scripts', name));
    writeFileSync(join(root, 'public/narration/scene-01.wav'), 'fixture narration bytes (hash gate only)');
    json(join(root, 'src/generated/cues.lock.json'), {'1': md5File(join(root, 'public/narration/scene-01.wav'))});
    json(join(root, 'src/generated/cues.json'), {'1': {example: .1}});
    run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=30:d=0.2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', '2', join(root, 'synthetic.mp4')]);
    const partPath = (scene, profile = 'draft') => join(root, 'out', profile === 'draft' ? 'parts' : 'parts-final', `scene-${String(scene).padStart(2, '0')}.mp4`);
    const sidecar = (scene, profile = 'draft') => partPath(scene, profile).replace(/\.mp4$/, '.provenance.json');
    const stamp = (scene, profile = 'draft') => ({schemaVersion: 1, scene, commitSha: sha, dirty: false,
      cuesLockMd5: md5File(join(root, 'src/generated/cues.lock.json')), cuesMd5: md5File(join(root, 'src/generated/cues.json')),
      profile, fps: 30, source: 'live', renderStartedAt: `2026-09-13T12:00:${String(scene).padStart(2, '0')}.000Z`, partMd5: md5File(join(root, 'synthetic.mp4'))});
    const reset = () => {
      for (const profile of ['draft', 'final']) for (let scene = 1; scene <= 12; scene++) {
        copyFileSync(join(root, 'synthetic.mp4'), partPath(scene, profile)); json(sidecar(scene, profile), stamp(scene, profile));
      }
    };
    const change = (scene, values, profile = 'draft') => json(sidecar(scene, profile), {...stamp(scene, profile), ...values});
    const env = {...process.env}; delete env.SPLICE_FPS;
    const splice = (...args) => spawnSync('bash', [join(root, 'scripts/splice-draft.sh'), ...args], {encoding: 'utf8', env, maxBuffer: 4 * 1024 * 1024});
    const output = tag => join(root, 'out', `cascade-draft-360p-${tag}.mp4`);
    const manifest = tag => readJson(output(tag).replace(/\.mp4$/, '.provenance.json'));
    reset();
    await t.test('matching stamps pass despite different timestamps and an unrelated current checkout', () => {
      const result = splice('matching'); assert.equal(result.status, 0, result.stderr);
      assert.ok(existsSync(output('matching')));
      const report = manifest('matching'); assert.equal(report.mixed, false); assert.equal(report.parts.length, 12);
      assert.equal(report.output.md5, md5File(output('matching'))); assert.equal(report.output.streams[0].r_frame_rate, '30/1');
      assert.match(result.stderr, /ignored captures and dependencies are not fingerprinted/);
    });
    await t.test('dirty-only differences warn and pass', () => {
      change(4, {dirty: true}); change(5, {dirty: true});
      const result = splice('dirty'); assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /scene 4 .*dirty tree/); assert.match(result.stderr, /scene 5 .*dirty tree/);
      assert.match(result.stderr, /two different dirty source states cannot be distinguished/);
      assert.equal(manifest('dirty').mixed, false); reset();
    });
    const cases = [
      ['commitSha', {commitSha: 'b'.repeat(40)}], ['cuesLockMd5', {cuesLockMd5: 'b'.repeat(32)}],
      ['cuesMd5', {cuesMd5: 'c'.repeat(32)}], ['fps', {fps: 15}], ['source', {source: 'captures'}],
      ['profile', {profile: 'final'}], ['partMd5', {partMd5: '0'.repeat(32)}],
      ['schemaVersion', {schemaVersion: 99}], ['scene', {scene: 9}],
      ['cuesMd5', {cuesMd5: ['c'.repeat(32)]}],
    ];
    for (const [field, value] of cases) await t.test(`${field} differences refuse before producing output`, () => {
      change(4, value); change(5, value);
      const result = splice(`bad-${field}`); assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, new RegExp(field)); assert.match(result.stderr, /scene-04\.mp4/); assert.match(result.stderr, /scene-05\.mp4/);
      assert.match(result.stderr, new RegExp(`Re-render scenes 4, 5 at ${sha}`));
      assert.ok(!existsSync(output(`bad-${field}`))); reset();
    });
    for (const malformed of [false, true]) await t.test(`${malformed ? 'malformed' : 'missing'} sidecar refuses`, () => {
      if (malformed) writeFileSync(sidecar(4), '{invalid'); else rmSync(sidecar(4));
      const result = splice('absent'); assert.equal(result.status, 1); assert.match(result.stderr, /scene-04\.mp4/);
      assert.ok(!existsSync(output('absent'))); reset();
    });
    await t.test('final mode uses the same gate before normalization', () => {
      change(4, {commitSha: 'b'.repeat(40)}, 'final');
      const result = splice('--final'); assert.equal(result.status, 1); assert.match(result.stderr, /commitSha/);
      assert.ok(!existsSync(join(root, 'out/cascade-final-1080p.mp4'))); reset();
    });
    await t.test('--allow-mixed names every differing or unknown part and marks output and manifest', () => {
      change(2, {commitSha: 'b'.repeat(40)}); change(3, {cuesLockMd5: 'b'.repeat(32)});
      change(4, {cuesMd5: 'b'.repeat(32)}); change(5, {fps: 15}); change(6, {source: 'captures'});
      change(7, {profile: 'final'}); rmSync(sidecar(8)); writeFileSync(sidecar(9), '{invalid');
      change(10, {partMd5: '0'.repeat(32)}); change(11, {schemaVersion: 99}); change(12, {scene: 1});
      const result = splice('override', '--allow-mixed'); assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /!!! ALLOW-MIXED/);
      for (let scene = 2; scene <= 12; scene++) assert.match(result.stderr, new RegExp(`scene-${String(scene).padStart(2, '0')}\\.mp4`));
      assert.ok(!existsSync(output('override'))); assert.ok(existsSync(output('override-MIXED')));
      const report = manifest('override-MIXED'); assert.equal(report.mixed, true); assert.equal(report.allowMixed, true);
      assert.deepEqual([...new Set(report.issues.map(i => i.scene))].sort((a, b) => a - b), Array.from({length: 11}, (_, i) => i + 2));
      assert.equal(report.parts[7].provenance, null); assert.equal(report.parts[8].provenance, null);
      assert.equal(report.output.md5, md5File(output('override-MIXED'))); reset();
    });
    await t.test('--allow-mixed does not bypass missing media or stale narration', () => {
      rmSync(partPath(4)); let result = splice('--allow-mixed', 'missing-media'); assert.equal(result.status, 1);
      assert.match(result.stderr, /cannot override missing media/); reset();
      writeFileSync(join(root, 'public/narration/scene-01.wav'), 'changed narration');
      result = splice('--allow-mixed', 'stale'); assert.equal(result.status, 1); assert.match(result.stderr, /STALE/);
    });
  } finally { rmSync(root, {recursive: true, force: true}); }
});

// W6: a part is stamped with pre-render inputs, and changes detected at completion invalidate publication.
test('render snapshot records actual inputs and finish rejects changed inputs', () => {
  const film = new URL('..', import.meta.url).pathname;
  const root = mkdtempSync(join(tmpdir(), 'cascade-stamp-'));
  try {
    const stamp = snapshot(film, 4, 'draft', 15, 'captures');
    assert.equal(stamp.commitSha, run('git', ['-C', film, 'rev-parse', 'HEAD']).trim());
    assert.equal(typeof stamp.dirty, 'boolean'); assert.equal(stamp.fps, 15); assert.equal(stamp.source, 'captures');
    assert.equal(stamp.cuesMd5, md5File(join(film, 'src/generated/cues.json')));
    assert.match(stamp.renderStartedAt, /Z$/);
    const input = join(root, 'snapshot.json'), part = join(root, 'part.mp4'), sidecar = join(root, 'part.provenance.json');
    json(input, stamp); writeFileSync(part, 'encoded bytes'); finishPart(film, input, part, sidecar);
    assert.deepEqual(readJson(sidecar), {...stamp, partMd5: md5File(part)});
    rmSync(sidecar); json(input, {...stamp, cuesMd5: '0'.repeat(32)});
    assert.throws(() => finishPart(film, input, part, sidecar), /inputs changed during render.*cuesMd5/);
    assert.equal(existsSync(sidecar), false);
  } finally { rmSync(root, {recursive: true, force: true}); }
});
