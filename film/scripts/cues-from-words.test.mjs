import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// W4 broken-cut incident: exercise the real CLI in isolation so failed generation cannot erase good cues.
test('cue CLI rejects broken environments, permits partial cues, and offsets generic tails', () => {
  const required = ['scene-02.wav'];
  const missing = required.map(name => fileURLToPath(new URL(`../public/narration/${name}`, import.meta.url))).filter(path => !existsSync(path));
  if (missing.length) throw new Error(`Narration test setup missing: ${missing.join(', ')}. Copy the installed narration WAVs from the render host into film/public/narration/; these assets are intentionally gitignored.`);
  const root = mkdtempSync(join(tmpdir(), 'cascade-cues-'));
  const json = (path, value) => writeFileSync(path, JSON.stringify(value));
  const words = join(root, 'public/narration/words');
  const out = join(root, 'src/generated');
  const env = {...process.env};
  delete env.CASCADE_WORDS_DIR;
  const run = (args = [], extraEnv = {}, script = 'cues-from-words.mjs') => spawnSync(process.execPath,
    [join(root, 'scripts', script), ...args], {cwd: tmpdir(), env: {...env, ...extraEnv}, encoding: 'utf8'});
  try {
    for (const dir of ['scripts', 'src/generated', 'public/narration/words']) mkdirSync(join(root, dir), {recursive: true});
    for (const name of ['cues-from-words.mjs', 'check-cues.mjs']) copyFileSync(fileURLToPath(new URL(name, import.meta.url)), join(root, 'scripts', name));
    copyFileSync(fileURLToPath(new URL('../src/cues.ts', import.meta.url)), join(root, 'src/cues.ts'));
    for (const name of ['cues.json', 'cues.lock.json']) writeFileSync(join(out, name), 'sentinel');
    const unchanged = () => {
      for (const name of ['cues.json', 'cues.lock.json']) assert.equal(readFileSync(join(out, name), 'utf8'), 'sentinel');
    };
    let result = run([join(root, 'absent')]);
    assert.equal(result.status, 1); assert.match(result.stderr, /absent/); unchanged();
    result = run([join(out, 'cues.json')]);
    assert.equal(result.status, 1); assert.match(result.stderr, /not a directory/); unchanged();
    // A matching scene-2 WAV must not let manual overrides mask zero word matches.
    copyFileSync(fileURLToPath(new URL('../public/narration/scene-02.wav', import.meta.url)), join(root, 'public/narration/scene-02.wav'));
    result = run();
    assert.equal(result.status, 1); assert.match(result.stderr, /zero cues/); assert.ok(result.stderr.includes(words)); unchanged();
    json(join(words, 'scene-01.json'), {words: [{word: 'unrelated', start: 0, end: 1}]});
    assert.equal(run().status, 1); unchanged();
    json(join(words, 'scene-01.json'), {words: [{word: 'foldable', start: 1, end: 2}]});
    rmSync(join(root, 'public/narration/scene-02.wav'));
    result = run();
    assert.equal(result.status, 1); assert.match(result.stderr, /empty narration lock/); unchanged();
    writeFileSync(join(root, 'public/narration/scene-01.wav'), 'fixture WAV bytes for hashing');
    result = run();
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /no words file/);
    assert.equal(JSON.parse(readFileSync(join(out, 'cues.json')))['1']['phone-reveal'], 0.85);
    json(join(root, 'public/narration/narration.json'), [
      {scene: 1, duration: 7.1, tailFile: 'scene-01-tail.wav', tailGapSec: 0.85},
      {scene: 7, duration: 27.89, tailFile: 'scene-07-tail.wav', tailGapSec: 0.85},
    ]);
    const missingTail = run();
    assert.equal(missingTail.status, 0, missingTail.stderr);
    assert.match(missingTail.stderr, /transcript warning.*[\s\S]*no tail words file/);
    assert.doesNotMatch(missingTail.stdout, /no tail words file/);
    assert.equal(missingTail.stdout.match(/\d+ cue\(s\) left/)[0], result.stdout.match(/\d+ cue\(s\) left/)[0]);
    json(join(words, 'scene-01-tail.json'), {words: [{word: 'iPhone', start: 0.2, end: 0.5}]});
    json(join(words, 'scene-07.json'), {words: []});
    json(join(words, 'scene-07-tail.json'), {words: [{word: 'One', start: 0, end: 0.2}, {word: 'dollar', start: 0.2, end: 0.5}]});
    assert.equal(run().status, 0);
    const cues = JSON.parse(readFileSync(join(out, 'cues.json')));
    assert.equal(cues['1']['phone-reveal-fallback'], 8);
    assert.equal(cues['7']['final-card'], 28.74);
    assert.equal(run([], {CASCADE_WORDS_DIR: join(root, 'absent')}).status, 1);
    assert.equal(run([words], {CASCADE_WORDS_DIR: join(root, 'absent')}).status, 0);
    assert.equal(run([], {}, 'check-cues.mjs').status, 0);
    json(join(out, 'cues.lock.json'), {});
    result = run([], {}, 'check-cues.mjs');
    assert.equal(result.status, 1); assert.match(result.stderr, /empty narration lock/);
  } finally { rmSync(root, {recursive: true, force: true}); }
});

// W2: the approved ending and measured-onset evidence are contracts across regeneration.
test('W2 evidence resolves with zero lead and locked scenes retain their approved times', () => {
  const read = name => JSON.parse(readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8'));
  const cues = read('../src/generated/cues.json');
  const evidence = read('../analysis/W2-onset-evidence.json');
  assert.deepEqual(cues['1'], {'phone-reveal': 5.53, 'phone-reveal-fallback': 6.09});
  assert.deepEqual(cues['11'], {'chain-reveal': 2.79, promises: 3.77, 'cascade-would': 5.67});
  assert.deepEqual(cues['12'], {wordmark: 1.67});
  for (const row of evidence) {
    assert.equal(cues[row.scene][row.cue], row.onset, `scene ${row.scene} ${row.cue}`);
    assert.equal(Math.round(row.onset * 30), row.frame30);
  }
  assert.ok(cues['9']['push-in-scrubber'] < cues['9']['pan-to-ledger']);
  assert.ok(cues['10']['money-plus-time'] < cues['10']['money-plus']);
  assert.ok(cues['10']['money-plus'] < cues['10']['money-time']);
  const lock = read('../src/generated/cues.lock.json');
  assert.ok(lock['scene-07-kokoro-tail.wav']);
});

test('a changed measured-onset WAV fails without overwriting the cue outputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'cascade-onset-guard-'));
  try {
    for (const dir of ['scripts', 'src/generated', 'public/narration/words']) mkdirSync(join(root, dir), {recursive: true});
    for (const [source, target] of [
      ['cues-from-words.mjs', 'scripts/cues-from-words.mjs'],
      ['../src/cues.ts', 'src/cues.ts'],
      ['../src/generated/onset-overrides.json', 'src/generated/onset-overrides.json'],
      ['../public/narration/words/scene-02.json', 'public/narration/words/scene-02.json'],
    ]) copyFileSync(fileURLToPath(new URL(source, import.meta.url)), join(root, target));
    writeFileSync(join(root, 'public/narration/scene-02.wav'), 'different audio');
    for (const name of ['cues.json', 'cues.lock.json']) writeFileSync(join(root, 'src/generated', name), 'preserve');
    const result = spawnSync(process.execPath, [join(root, 'scripts/cues-from-words.mjs'), join(root, 'public/narration/words')], {encoding: 'utf8'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /measured-onset WAV guard changed/);
    for (const name of ['cues.json', 'cues.lock.json']) assert.equal(readFileSync(join(root, 'src/generated', name), 'utf8'), 'preserve');
  } finally { rmSync(root, {recursive: true, force: true}); }
});
