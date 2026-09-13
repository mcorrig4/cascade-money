#!/usr/bin/env node
// W6 chimera incident: bind each encoded part to its inputs before allowing a splice.
import {openSync, readSync, closeSync, readFileSync, writeFileSync, renameSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join, resolve, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

export const matchingFields = ['commitSha', 'cuesLockMd5', 'cuesMd5', 'profile', 'fps', 'source'];
export const limitations = 'Matching stamps establish recorded commit/cue hashes and render settings, not identical builds: ignored captures and dependencies are not fingerprinted; two different dirty source states cannot be distinguished.';
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  renameSync(temporary, path);
};
export const md5File = path => {
  const hash = createHash('md5'), fd = openSync(path, 'r'), buffer = Buffer.alloc(1024 * 1024);
  try { let count; while ((count = readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, count)); }
  finally { closeSync(fd); }
  return hash.digest('hex');
};
export const snapshot = (filmDir, scene, profile, fps, source) => {
  const git = (...args) => execFileSync('git', ['-C', filmDir, ...args], {encoding: 'utf8'}).trim();
  const stamp = {
    schemaVersion: 1, scene: Number(scene), commitSha: git('rev-parse', 'HEAD'),
    dirty: git('status', '--porcelain', '--untracked-files=normal') !== '',
    cuesLockMd5: md5File(join(filmDir, 'src/generated/cues.lock.json')),
    cuesMd5: md5File(join(filmDir, 'src/generated/cues.json')),
    profile, fps: Number(fps), source, renderStartedAt: new Date().toISOString(),
  };
  validate(stamp, Number(scene), false);
  return stamp;
};
const validate = (stamp, scene, hasPart = true) => {
  const invalid = [];
  if (!stamp || typeof stamp !== 'object' || Array.isArray(stamp)) throw new Error('sidecar must be an object');
  if (stamp.schemaVersion !== 1) invalid.push('schemaVersion (expected 1)');
  if (!Number.isInteger(stamp.scene) || stamp.scene !== scene || scene < 1 || scene > 12) invalid.push(`scene (expected ${scene})`);
  if (typeof stamp.commitSha !== 'string' || !/^[a-f0-9]{40}$/.test(stamp.commitSha)) invalid.push('commitSha');
  for (const key of ['cuesLockMd5', 'cuesMd5', ...(hasPart ? ['partMd5'] : [])])
    if (typeof stamp[key] !== 'string' || !/^[a-f0-9]{32}$/.test(stamp[key])) invalid.push(key);
  if (typeof stamp.dirty !== 'boolean') invalid.push('dirty');
  if (!['draft', 'final'].includes(stamp.profile)) invalid.push('profile');
  if (!Number.isFinite(stamp.fps) || stamp.fps <= 0) invalid.push('fps');
  if (!['live', 'captures'].includes(stamp.source)) invalid.push('source');
  if (typeof stamp.renderStartedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(stamp.renderStartedAt) || !Number.isFinite(Date.parse(stamp.renderStartedAt))) invalid.push('renderStartedAt (ISO UTC)');
  if (invalid.length) throw new Error(`invalid sidecar fields: ${invalid.join(', ')}`);
};
export const finishPart = (filmDir, snapshotPath, part, sidecar) => {
  const stamp = readJson(snapshotPath);
  validate(stamp, stamp.scene, false);
  const after = snapshot(filmDir, stamp.scene, stamp.profile, stamp.fps, stamp.source);
  const changed = [...matchingFields, 'dirty'].filter(field => stamp[field] !== after[field]);
  if (changed.length) throw new Error(`scene ${stamp.scene}: inputs changed during render (${changed.join(', ')}); re-render`);
  writeJson(sidecar, {...stamp, partMd5: md5File(part)});
};

export const inspectParts = (partsDir, profile) => {
  if (!['draft', 'final'].includes(profile)) throw new Error(`unknown splice profile: ${profile}`);
  const parts = [], issues = [], warnings = [], groups = new Map();
  for (let scene = 1; scene <= 12; scene++) {
    const part = join(resolve(partsDir), `scene-${String(scene).padStart(2, '0')}.mp4`);
    if (!existsSync(part)) throw new Error(`missing ${part} — render scene ${scene} first (cannot override missing media)`);
    const sidecar = part.replace(/\.mp4$/, '.provenance.json');
    const entry = {scene, part, sidecar, partMd5: md5File(part), sidecarMd5: existsSync(sidecar) ? md5File(sidecar) : null, provenance: null};
    parts.push(entry);
    try {
      if (!existsSync(sidecar)) throw new Error('missing sidecar');
      entry.provenance = readJson(sidecar);
      validate(entry.provenance, scene);
      if (entry.provenance.partMd5 !== entry.partMd5) throw new Error(`partMd5 differs: sidecar ${entry.provenance.partMd5}, MP4 ${entry.partMd5}`);
    } catch (error) {
      issues.push({scene, part, reason: error.message});
      continue;
    }
    const stamp = entry.provenance;
    if (stamp.dirty) warnings.push(`scene ${scene} (${basename(part)}) was rendered from a dirty tree; two different dirty source states cannot be distinguished.`);
    if (stamp.profile !== profile) issues.push({scene, part, reason: `profile ${stamp.profile} differs from requested ${profile}`});
    const key = JSON.stringify(matchingFields.map(field => stamp[field]));
    if (!groups.has(key)) groups.set(key, {provenance: Object.fromEntries(matchingFields.map(field => [field, stamp[field]])), scenes: []});
    groups.get(key).scenes.push(scene);
  }
  const ordered = [...groups.values()].sort((a, b) => b.scenes.length - a.scenes.length || a.scenes[0] - b.scenes[0]);
  const reference = ordered[0];
  for (const group of ordered.slice(1)) {
    const differences = matchingFields.filter(field => group.provenance[field] !== reference.provenance[field])
      .map(field => `${field}: ${group.provenance[field]} (reference ${reference.provenance[field]})`).join('; ');
    for (const scene of group.scenes) issues.push({scene, part: parts[scene - 1].part, reason: differences});
  }
  return {schemaVersion: 1, profile, checkedAt: new Date().toISOString(), mixed: issues.length > 0, parts, groups: ordered, issues, warnings, limitations};
};
export const gate = (partsDir, profile, allowMixed = false) => {
  const report = inspectParts(partsDir, profile);
  console.error(`provenance: ${limitations}`);
  for (const warning of report.warnings) console.error(`WARNING: ${warning}`);
  if (report.mixed) {
    console.error(allowMixed ? '!!! ALLOW-MIXED: MIXED / UNVERIFIED INPUTS — OUTPUT WILL BE MARKED MIXED !!!' : 'provenance: REFUSING mixed / unverified parts');
    for (const group of report.groups) console.error(`  scenes ${group.scenes.join(', ')}: ${JSON.stringify(group.provenance)}`);
    for (const issue of report.issues) console.error(`  scene ${issue.scene} (${basename(issue.part)}): ${issue.reason}`);
    const reference = report.groups[0];
    if (reference) {
      const tied = report.groups[1]?.scenes.length === reference.scenes.length;
      console.error(tied ? '  Equal-sized groups: choose the intended revision from the groups above.' : `  Suggested reference: largest consistent group, scenes ${reference.scenes.join(', ')}.`);
      if (!tied) console.error(`  Re-render scenes ${[...new Set(report.issues.map(issue => issue.scene))].join(', ')} at ${reference.provenance.commitSha}, cuesLockMd5=${reference.provenance.cuesLockMd5}, cuesMd5=${reference.provenance.cuesMd5}, profile=${profile}, fps=${reference.provenance.fps}, source=${reference.provenance.source}. Restore those inputs first; checkout alone cannot restore dirty edits.`);
    } else console.error('  No verified reference exists. Re-render all scenes from the intended revision.');
    if (!allowMixed) throw new Error('splice refused; re-render the named scenes, or use --allow-mixed to retain the uncertainty explicitly');
  }
  return {...report, allowMixed};
};
const manifest = (reportPath, output) => {
  const report = readJson(reportPath);
  // W6: inputs must still match the preflight evidence after a potentially long concat.
  for (const entry of report.parts) {
    if (md5File(entry.part) !== entry.partMd5 || (existsSync(entry.sidecar) ? md5File(entry.sidecar) : null) !== entry.sidecarMd5)
      throw new Error(`scene ${entry.scene}: input changed during splice; output is unverified`);
  }
  const media = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels', '-of', 'json', output], {encoding: 'utf8'}));
  writeJson(output.replace(/\.mp4$/, '.provenance.json'), {...report, splicedAt: new Date().toISOString(), output: {file: basename(output), md5: md5File(output), requestedFps: process.env.SPLICE_FPS ?? null, streams: media.streams}});
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'snapshot' && args.length === 6) writeJson(args[5], snapshot(...args.slice(0, 5)));
    else if (command === 'finish' && args.length === 4) finishPart(...args);
    else if (command === 'check' && args.length === 4) {
      const report = gate(args[0], args[1], args[2] === 'true');
      writeJson(args[3], report);
      console.log(report.mixed ? 'mixed' : 'consistent');
    } else if (command === 'manifest' && args.length === 2) manifest(...args);
    else throw new Error('usage: render-provenance.mjs snapshot <film> <scene> <profile> <fps> <source> <json> | finish <film> <snapshot> <part> <sidecar> | check <parts> <profile> <allowMixed> <report> | manifest <report> <output>');
  } catch (error) { console.error(`provenance: ${error.message}`); process.exitCode = 1; }
}
