#!/usr/bin/env python3
"""W6: audit selected onsets without replacing unrelated W2 approvals.

8 ms forward RMS windows / 2 ms hops on mono float32 PCM at 24 kHz.
The local floor is the 10th percentile, not the absolute minimum. Threshold:
max(floor * 10**(12/20), peak * .035). A crossing must sustain its mean over
four hops and floor must be <20% of peak. Window-start timestamps follow W2.
Amplitude alone does not establish phonetic identity; unresolved values stay put.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
# W6 review: these silence-to-speech windows isolate clause beginnings which
# Whisper placed inside the preceding pause (scene 4) or inside speech (scene 5).
REVIEW_WINDOWS = {(4, 'not-as-cash'): (5.05, 5.42),
                  (4, 'as-dollar-with-date'): (6.15, 6.48),
                  (5, 'window-mirror'): (15.80, 16.10)}
ALIASES = {(2, 'payment-terms'): 'promises', (2, 'promises-word'): 'promises-fallback'}
# W6 phonetic honesty decision: a nearby rise is not necessarily the target word.
UNRESOLVED = {
    (6, 'committed-counter'): ('Connected million/deposited boundary has no isolated 12 dB rise; retain the slope estimate.', (.8, 1.5)),
    (6, 'settled-counter'): ('Connected million/transacted boundary does not meet the floor/peak and sustained-rise criterion; retain the slope estimate.', (4.1, 4.9)),
    (6, 'companies-counter'): ('Nine/invoices is continuously voiced; a later trough does not establish the initial vowel boundary.', (6.4, 7.0)),
    (7, 'coin-pair'): ('The 2.140 s RMS rise belongs to the preceding word and the later rise to the vowel; /s/ requires phonetic review of the fricative band. Retain the existing fricative-band estimate.', (2.05, 2.45)),
    (7, 'earlier-pays-later'): ('Due/earlier is connected speech with multiple nearby rises; RMS does not identify the initial vowel of earlier.', (18.8, 19.55)),
    (7, 'coin-yield'): ('The/yield has a continuous voiced glide without an isolated 12 dB onset rise.', (25.9, 26.5)),
    (7, 'final-card'): ('Tail PCM begins with nonzero energy and a gradual glide; there is no preceding floor or distinct onset crossing. Retain the estimate and the 28.740 s tail placement.', (0, .3)),
    (8, 'contract-fallback'): ('The connected spoken digits have several syllabic rises; the transcript anchor does not establish the start of 1155.', (1.65, 2.25)),
    (8, 'window-flatten'): ('Bearing/reserve is continuously voiced; the nearby rise cannot be assigned to reserve from RMS alone.', (10.45, 11.15)),
}
DEFAULT_TARGETS = list(ALIASES) + list(REVIEW_WINDOWS) + list(UNRESOLVED)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cue', action='append', help='Scene:cue to audit (repeatable); default is the W6 audit set')
parser.add_argument('--dry-run', action='store_true', help='Print evidence without changing any files')
args = parser.parse_args()
targets = {(int(s), cue) for s, cue in (item.split(':', 1) for item in args.cue)} if args.cue else set(DEFAULT_TARGETS)
phrases = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "import {CUE_PHRASES} from './film/src/cues.ts'; console.log(JSON.stringify(CUE_PHRASES))"], cwd=ROOT.parent))
meta = json.loads((ROOT / 'public/narration/narration.json').read_text())
rows = json.loads((ROOT / 'analysis/W2-onset-evidence.json').read_text())
overrides = json.loads((ROOT / 'src/generated/onset-overrides.json').read_text())
row_by_key = {(r['scene'], r['cue']): r for r in rows}
normalize = lambda s: re.sub('[^a-z0-9$]', '', s.lower())
md5 = lambda p: hashlib.md5(p.read_bytes()).hexdigest()
audited = []
for ss, items in phrases.items():
    scene = int(ss)
    if not any(s == scene for s, _ in targets):
        continue
    wav = ROOT / f'public/narration/scene-{scene:02}.wav'
    entry = next(x for x in meta if x['scene'] == scene)
    guard = overrides[ss]
    if md5(wav) != guard['wavMd5']:
        raise SystemExit(f'Scene {scene}: changed WAV; existing measurements require a fresh narration audit')
    words = json.loads((ROOT / f'public/narration/words/scene-{scene:02}.json').read_text())['words']
    sources = [(wav, 0)]
    if entry.get('tailFile'):
        tail = ROOT / 'public/narration' / entry['tailFile']
        if md5(tail) != guard.get('tailMd5'):
            raise SystemExit(f'Scene {scene}: changed tail WAV; remeasure before using existing cues')
        offset = entry['duration'] + entry.get('tailGapSec', .25)
        sources.append((tail, offset))
        tail_words = json.loads((ROOT / 'public/narration/words' / Path(entry['tailFile']).with_suffix('.json')).read_text())['words']
        words += [dict(w, start=w['start'] + offset, end=w['end'] + offset) for w in tail_words]
    envelopes = []
    for file, offset in sources:
        pcm = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file),
            '-f', 'f32le', '-ac', '1', '-ar', '24000', 'pipe:1']), dtype='<f4').astype(float)
        env = np.sqrt(np.convolve(pcm * pcm, np.ones(192) / 192, mode='valid')[::48])
        envelopes.append((file, offset, env))
    cursor = 0
    for item in items:
        tokens = [normalize(t) for t in item['phrase'].split()]
        match = next((i for i in range(cursor, len(words) - len(tokens) + 1)
            if [normalize(w['word']) for w in words[i:i + len(tokens)]] == tokens), None)
        key = (scene, item['cue'])
        if match is None:
            if key in targets:
                raise SystemExit(f'Unmatched requested cue: {key}')
            continue
        cursor = match
        if key not in targets:
            continue
        prior = row_by_key.get(key) or row_by_key.get((scene, ALIASES.get(key)))
        anchor = words[match]['start']
        file, offset, env = next(x for x in reversed(envelopes) if anchor >= x[1])
        t = anchor - offset
        window = REVIEW_WINDOWS.get(key, (max(0, t - .12), t + .22))
        lo = max(0, round(window[0] / .002))
        hi = min(len(env), round(window[1] / .002) + 1)
        local = env[lo:hi]
        floor, peak = float(np.percentile(local, 10)), float(np.max(local))
        threshold = max(floor * 10**(12/20), peak * .035)
        candidates = [j for j in range(lo + 1, hi) if env[j-1] < threshold <= env[j]
                      and np.mean(env[j:min(j + 4, len(env))]) >= threshold]
        strong = bool(candidates) and floor < peak * .20
        if key in UNRESOLVED or not strong:
            if prior is None:
                raise SystemExit(f'{key}: unresolved new onset; cannot invent a reveal time')
            onset = prior['onset']
            reason, inspected = UNRESOLVED.get(key, ('No isolated sustained 12 dB rise; existing value retained.', window))
            method = 'unresolved; existing estimate retained'
        else:
            index = candidates[0] if key in REVIEW_WINDOWS else min(candidates, key=lambda j: abs(j * .002 - t))
            onset = round(offset + index * .002, 3)
            method = 'RMS rise in W6 reviewed search window' if key in REVIEW_WINDOWS else 'RMS rise; W6 remeasurement'
            reason, inspected = None, window
        previous = prior.get('w6', {}).get('beforeOnset', prior['onset']) if prior else None
        row = dict(scene=scene, cue=item['cue'], phrase=item['phrase'], wordAnchor=anchor,
                   onset=onset, frame30=int(onset * 30 + .5), method=method,
                   reviewWindow=list(window), wav=file.name, localFloorRms=round(floor, 7), localPeakRms=round(peak, 7),
                   w6=dict(beforeOnset=previous, deltaSeconds=round(onset - previous, 3) if previous is not None else None,
                           status='unresolved' if reason else 'measured', reason=reason,
                           inspectedWindow=list(inspected), sourceOffsetSeconds=round(offset, 3),
                           thresholdRms=round(threshold, 7), candidateSeconds=[round(offset + j * .002, 3) for j in candidates],
                           passesRiseCriterion=strong, wavMd5=md5(file)))
        guard['cues'][item['cue']] = onset
        if key in row_by_key:
            rows[rows.index(row_by_key[key])] = row
        else:
            rows.append(row)
        audited.append(row)
missing = targets - {(r['scene'], r['cue']) for r in audited}
if missing:
    raise SystemExit(f'Unknown requested cues: {sorted(missing)}')
if args.dry_run:
    print(json.dumps(audited, indent=2))
else:
    # W6: preserve all unselected rows and guards, including other workers' scene data.
    rows.sort(key=lambda r: (r['scene'], next(i for i, item in enumerate(phrases[str(r['scene'])]) if item['cue'] == r['cue'])))
    (ROOT / 'src/generated/onset-overrides.json').write_text(json.dumps(overrides, indent=2) + '\n')
    (ROOT / 'analysis/W2-onset-evidence.json').write_text(json.dumps(rows, indent=2) + '\n')
    method = ('PCM: ffmpeg mono float32 at 24 kHz; forward 8 ms RMS windows, 2 ms hops. '
              'Default search is −120/+220 ms from the transcript anchor. The floor is the local 10th percentile, not the absolute minimum. '
              'Threshold = max(floor × 10^(12/20), local peak × 0.035). A crossing must sustain the mean of four hops above threshold, '
              'and floor must be below 20% of peak. Select the nearest qualifying crossing to the anchor, or the first in an explicitly reviewed window. '
              'Timestamps identify window starts, as in W2. RMS alone cannot establish consonant identity. '
              'W6 retains unresolved estimates instead of promoting slopes to measurements; explicit windows, thresholds, candidates, WAV hashes and tail offsets are in W2-onset-evidence.json. '
              'WAV and tail MD5 guards remain fail-closed. No Chrome, browser, or film renderer was used. '
              'Frames still use Math.round(seconds × fps): 4 fps drafts cannot settle timing arguments; final is 30 fps (±16.7 ms quantisation).')
    lines = ['# W2 cue onset evidence', '', method, '', '| Scene | Cue | Onset (s) | Frame (30 fps) | Evidence |', '|---|---|---:|---:|---|']
    lines += [f"| {r['scene']} | `{r['cue']}` | {r['onset']:.3f} | {r['frame30']} | {r['method']} |" for r in rows]
    lines += ['', '## W6 before/after audit', '', 'Before values are prior cue measurements/estimates; new scene-4 cues have no prior measurement. Both scene-4 clauses previously appeared at 5.642 s. Scene 2’s promises span previously appeared at 11.748 s despite its existing 12.672 s word measurement.', '', '| Scene | Cue | Before (s) | After (s) | Delta (s) | Result |', '|---|---|---:|---:|---:|---|']
    for r in rows:
        if 'w6' not in r:
            continue
        audit = r['w6']; before = 'new' if audit['beforeOnset'] is None else f"{audit['beforeOnset']:.3f}"
        delta = '—' if audit['deltaSeconds'] is None else f"{audit['deltaSeconds']:+.3f}"
        lines.append(f"| {r['scene']} | `{r['cue']}` | {before} | {r['onset']:.3f} | {delta} | {audit['reason'] or 'Measured RMS rise'} |")
    (ROOT / 'analysis/W2-cue-table.md').write_text('\n'.join(lines) + '\n')
    for r in audited:
        print(f"{r['scene']} {r['cue']}: {r['w6']['beforeOnset']} -> {r['onset']:.3f} ({r['w6']['status']})")
