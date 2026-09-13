# W6 render provenance and clause onset audit

The mixed-build draft incident requires provenance on each part, not only a
freshness check against today's narration. `render-scenes.sh` now samples inputs
after cue/capture preparation and before each scene render. Encoding and metadata
are prepared in a temporary directory. Successful publication removes the old
sidecar before replacing the MP4 and then publishes its new sidecar; interruption
between these steps leaves missing metadata or a detectable MP4 hash mismatch.
A failed render/encode before publication preserves the previous part and stamp.
Completion checks detect changes to commit, cue hashes, or dirty status during a
render; they cannot detect changes between two dirty source states.

Each `out/parts/scene-NN.mp4` or `out/parts-final/scene-NN.mp4` has an adjacent
`scene-NN.provenance.json` with this version-1 schema:

| Field | Value |
|---|---|
| `schemaVersion` | `1` |
| `scene` | Integer 1–12, matching the filename |
| `commitSha` | Full `git rev-parse HEAD` |
| `dirty` | Boolean; staged, unstaged, or nonignored untracked changes |
| `cuesLockMd5` | MD5 of the bytes of `src/generated/cues.lock.json` |
| `cuesMd5` | MD5 of the bytes of `src/generated/cues.json` |
| `profile` | `draft` or `final` |
| `fps` | Positive numeric render FPS |
| `source` | `live` or `captures` |
| `renderStartedAt` | ISO-8601 UTC with milliseconds and `Z` |
| `partMd5` | MD5 of the completed encoded MP4 |

`splice-draft.sh` keeps `check-cues.mjs`'s narration freshness gate and then reads
all 12 original parts' sidecars before audio normalization or concatenation.
A coherent older build need not match the current checkout's SHA or cue hashes.
The stamps identify that older build; the gate checks consistency among parts.

| Condition | Default | With `--allow-mixed` | Regression result |
|---|---|---|---|
| Matching metadata; varying timestamps | Pass | Pass | Passed |
| Dirty state alone, including clean/dirty mix | Warn, pass | Warn, pass | Passed |
| Commit, cue-lock hash, or cue-data hash differs | Refuse | Warn, mark mixed | Passed |
| FPS, source, or profile differs | Refuse | Warn, mark mixed | Passed |
| Profile differs from requested splice mode | Refuse | Warn, mark mixed | Passed |
| Missing/malformed sidecar, unsupported schema | Refuse | Warn, mark unknown/mixed | Passed |
| Wrong scene or mismatched MP4 hash | Refuse | Warn, mark unverified/mixed | Passed |
| Missing MP4 or stale installed narration | Refuse | Still refuse | Passed |

Errors list all provenance groups and the offending scene filenames/fields.
The largest group is suggested as a reference, never assumed to be editorially
correct. Ties require choosing the intended group. Re-render hints include the
SHA, both cue hashes, profile, FPS, and source; checking out a SHA cannot recover
uncommitted source changes.

```sh
film/scripts/splice-draft.sh review
film/scripts/splice-draft.sh --allow-mixed review
film/scripts/splice-draft.sh --final --allow-mixed
```

Overridden mixes get `-MIXED` before `.mp4`, including both final derivatives.
Every completed output also gets an adjacent `.provenance.json` containing all
input metadata, input/sidecar hashes, unknown entries, differences, warnings,
splice time, actual output stream settings, and output MD5. Parts and sidecars
are checked again when writing the output manifest; a change during splicing
invalidates the output. Final master and 720p copy each have their own manifest.

**Matching stamps are evidence, not proof of identical builds.** They identify
recorded commit/cue hashes and render settings. They establish nothing about
ignored captures or dependencies, which are not fingerprinted, and cannot
distinguish two different dirty source states. This limitation is printed at
splice time and retained in manifests. Dirty inputs are named individually.

## Clause timing

The 2026-09-13 decision is clause-level reveals: scene 2 shows “payment terms”
then “and promises”; scene 4 shows “Not as cash.” then “As a dollar with a date.”
Only those two presentation components changed. Scene 6, 7, and 8 component
bodies and all styles are unchanged.

| Displayed clause | Previous reveal (s) | New reveal (s) | Delta (s) |
|---|---:|---:|---:|
| Scene 2: payment terms | 11.748 | 11.748 | 0.000 |
| Scene 2: and promises | 11.748 | 12.672 | +0.924 |
| Scene 4: Not as cash. | 5.642 | 5.224 | −0.418 |
| Scene 4: As a dollar with a date. | 5.642 | 6.332 | +0.690 |

See [W2-cue-table.md](W2-cue-table.md) for all 14 audited cue rows, including
unchanged measurements and nine unresolved estimates with their reasons.
Scene 5's `$450 million` cue moved from 16.134 to 15.900 s. Scene 4's transcript
placed “not” in the preceding pause; its explicit waveform window resolves the
clause at 5.224 s. Scene 7's closing phrase still uses the existing estimate at
28.798 s, with the tail's 28.740 s placement and both WAV guards preserved.

The repeatable audit uses `python3 film/scripts/measure-cue-onsets.py`, optionally
`--cue SCENE:NAME` (repeatable) or `--dry-run`. Unselected evidence and overrides
are preserved. Regenerate cues with `node film/scripts/cues-from-words.mjs`.
The full method and per-cue thresholds/windows are recorded in the W2 evidence:
10th-percentile local floor, noise threshold, sustained crossing, 8 ms forward
RMS window, 2 ms hop. A slope estimate is never promoted to a measurement.
The changed-WAV fail-closed behavior remains in place; transcripts do not carry
WAV guards and cannot provide a safe automatic fallback.

`cueFrame` rounding is unchanged. Draft defaults to 4 fps, which cannot settle
timing arguments; `DRAFT_FPS=15` remains available. Final is 30 fps with at most
approximately ±16.7 ms frame quantisation relative to the measured timestamp.

## Validation

- `pnpm --dir film test:w0`: 59/59 passed, including the 19 provenance tests/subtests.
- `node --test film/scripts/cues-from-words.test.mjs film/scripts/splice-audio.test.mjs`: 5/5 passed.
- Both real splice modes retain audio in all 12 synthetic segments; all 180 final
  decoded video frames match the inputs, and final master/720p manifests validate.
- TypeScript diagnostics match the untouched baseline byte-for-byte: the same
  116 pre-existing diagnostics, zero new diagnostics.
- Measurement plus cue regeneration is byte-for-byte repeatable; cue lock is unchanged.
- Shell syntax and whitespace checks pass. No Chrome, Playwright, film renderer,
  narration edits, capture edits, simulation edits, or commits were made.
