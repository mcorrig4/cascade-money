# W2 cue onset evidence

PCM: ffmpeg mono float32 at 24 kHz; forward 8 ms RMS windows, 2 ms hops. Default search is −120/+220 ms from the transcript anchor. The floor is the local 10th percentile, not the absolute minimum. Threshold = max(floor × 10^(12/20), local peak × 0.035). A crossing must sustain the mean of four hops above threshold, and floor must be below 20% of peak. Select the nearest qualifying crossing to the anchor, or the first in an explicitly reviewed window. Timestamps identify window starts, as in W2. RMS alone cannot establish consonant identity. W6 retains unresolved estimates instead of promoting slopes to measurements; explicit windows, thresholds, candidates, WAV hashes and tail offsets are in W2-onset-evidence.json. WAV and tail MD5 guards remain fail-closed. No Chrome, browser, or film renderer was used. Frames still use Math.round(seconds × fps): 4 fps drafts cannot settle timing arguments; final is 30 fps (±16.7 ms quantisation).

| Scene | Cue | Onset (s) | Frame (30 fps) | Evidence |
|---|---|---:|---:|---|
| 2 | `hook-open` | 2.036 | 61 | approved prior waveform measurement |
| 2 | `stat-cost` | 2.702 | 81 | RMS rise |
| 2 | `stat-suppliers` | 5.416 | 162 | approved prior waveform measurement |
| 2 | `stat-factories` | 7.202 | 216 | approved prior waveform measurement |
| 2 | `stat-countries` | 9.148 | 274 | approved prior waveform measurement |
| 2 | `promises` | 11.748 | 352 | RMS rise |
| 2 | `payment-terms` | 11.748 | 352 | RMS rise; W6 remeasurement |
| 2 | `promises-fallback` | 12.672 | 380 | RMS rise |
| 2 | `promises-word` | 12.672 | 380 | RMS rise; W6 remeasurement |
| 2 | `wordmark` | 14.160 | 425 | RMS rise |
| 2 | `hook-arc` | 16.170 | 485 | RMS rise |
| 3 | `example-labels` | 24.536 | 736 | RMS rise |
| 4 | `question-card` | 1.850 | 56 | RMS rise |
| 4 | `question-card-fallback` | 2.342 | 70 | RMS rise |
| 4 | `dated-dollar` | 3.396 | 102 | RMS rise |
| 4 | `dated-dollar-fallback` | 3.580 | 107 | RMS rise |
| 4 | `not-as-cash` | 5.224 | 157 | RMS rise in W6 reviewed search window |
| 4 | `not-cash` | 5.642 | 169 | RMS rise |
| 4 | `as-dollar-with-date` | 6.332 | 190 | RMS rise in W6 reviewed search window |
| 5 | `cascade-open` | 0.140 | 4 | RMS rise |
| 5 | `window-mirror` | 15.900 | 477 | RMS rise in W6 reviewed search window |
| 6 | `deposited-value` | 0.126 | 4 | RMS rise |
| 6 | `committed-counter` | 1.116 | 33 | unresolved; existing estimate retained |
| 6 | `transacted-value` | 3.228 | 97 | RMS rise |
| 6 | `settled-counter` | 4.500 | 135 | unresolved; existing estimate retained |
| 6 | `invoice-value` | 6.358 | 191 | RMS rise |
| 6 | `companies-counter` | 6.712 | 201 | unresolved; existing estimate retained |
| 6 | `invoices-settled` | 7.288 | 219 | RMS rise |
| 7 | `coin` | 1.628 | 49 | RMS rise |
| 7 | `coin-pair` | 2.200 | 66 | unresolved; existing estimate retained |
| 7 | `swap` | 2.914 | 87 | RMS rise |
| 7 | `coin-principal` | 5.008 | 150 | RMS rise |
| 7 | `coin-date` | 9.432 | 283 | RMS rise |
| 7 | `earlier-pays-later` | 19.138 | 574 | unresolved; existing estimate retained |
| 7 | `face-value` | 21.794 | 654 | RMS rise |
| 7 | `extend` | 24.412 | 732 | RMS rise |
| 7 | `coin-yield` | 26.192 | 786 | unresolved; existing estimate retained |
| 7 | `final-card` | 28.798 | 864 | unresolved; existing estimate retained |
| 7 | `final-date` | 29.748 | 892 | RMS rise |
| 8 | `backing-card` | 0.744 | 22 | RMS rise |
| 8 | `contract` | 1.386 | 42 | RMS rise |
| 8 | `contract-fallback` | 1.970 | 59 | unresolved; existing estimate retained |
| 8 | `maturity-day` | 5.198 | 156 | RMS rise |
| 8 | `reserve` | 8.824 | 265 | RMS rise |
| 8 | `reserve-role` | 10.248 | 307 | RMS rise |
| 8 | `window-flatten` | 10.790 | 324 | unresolved; existing estimate retained |
| 9 | `window-center` | 0.388 | 12 | RMS rise in independently reviewed search window |
| 9 | `push-in-scrubber` | 1.164 | 35 | RMS rise |
| 9 | `pan-to-ledger` | 2.774 | 83 | RMS rise |
| 9 | `pull-back-full` | 6.418 | 193 | RMS rise |
| 9 | `stress-flash` | 16.416 | 492 | RMS rise in independently reviewed search window |
| 9 | `stress-flash-fallback` | 17.256 | 518 | RMS rise |
| 9 | `stress-operations` | 17.588 | 528 | RMS rise |
| 9 | `stress-end` | 24.702 | 741 | RMS rise in independently reviewed search window |
| 9 | `ui-origin` | 25.404 | 762 | RMS rise |
| 10 | `zoom-out-again` | 0.596 | 18 | RMS rise in independently reviewed search window |
| 10 | `word-loans` | 4.594 | 138 | RMS rise |
| 10 | `word-forwards` | 5.680 | 170 | RMS rise in independently reviewed search window |
| 10 | `word-bonds` | 6.634 | 199 | RMS rise |
| 10 | `word-derivatives` | 7.390 | 222 | RMS rise |
| 10 | `wordmark` | 12.988 | 390 | RMS rise |
| 10 | `money-plus-time` | 15.754 | 473 | RMS rise in independently reviewed search window |
| 10 | `money-plus` | 16.262 | 488 | RMS rise in independently reviewed search window |
| 10 | `money-time` | 16.530 | 496 | RMS rise |

## W6 before/after audit

Before values are prior cue measurements/estimates; new scene-4 cues have no prior measurement. Both scene-4 clauses previously appeared at 5.642 s. Scene 2’s promises span previously appeared at 11.748 s despite its existing 12.672 s word measurement.

| Scene | Cue | Before (s) | After (s) | Delta (s) | Result |
|---|---|---:|---:|---:|---|
| 2 | `payment-terms` | 11.748 | 11.748 | +0.000 | Measured RMS rise |
| 2 | `promises-word` | 12.672 | 12.672 | +0.000 | Measured RMS rise |
| 4 | `not-as-cash` | new | 5.224 | — | Measured RMS rise |
| 4 | `as-dollar-with-date` | new | 6.332 | — | Measured RMS rise |
| 5 | `window-mirror` | 16.134 | 15.900 | -0.234 | Measured RMS rise |
| 6 | `committed-counter` | 1.116 | 1.116 | +0.000 | Connected million/deposited boundary has no isolated 12 dB rise; retain the slope estimate. |
| 6 | `settled-counter` | 4.500 | 4.500 | +0.000 | Connected million/transacted boundary does not meet the floor/peak and sustained-rise criterion; retain the slope estimate. |
| 6 | `companies-counter` | 6.712 | 6.712 | +0.000 | Nine/invoices is continuously voiced; a later trough does not establish the initial vowel boundary. |
| 7 | `coin-pair` | 2.200 | 2.200 | +0.000 | The 2.140 s RMS rise belongs to the preceding word and the later rise to the vowel; /s/ requires phonetic review of the fricative band. Retain the existing fricative-band estimate. |
| 7 | `earlier-pays-later` | 19.138 | 19.138 | +0.000 | Due/earlier is connected speech with multiple nearby rises; RMS does not identify the initial vowel of earlier. |
| 7 | `coin-yield` | 26.192 | 26.192 | +0.000 | The/yield has a continuous voiced glide without an isolated 12 dB onset rise. |
| 7 | `final-card` | 28.798 | 28.798 | +0.000 | Tail PCM begins with nonzero energy and a gradual glide; there is no preceding floor or distinct onset crossing. Retain the estimate and the 28.740 s tail placement. |
| 8 | `contract-fallback` | 1.970 | 1.970 | +0.000 | The connected spoken digits have several syllabic rises; the transcript anchor does not establish the start of 1155. |
| 8 | `window-flatten` | 10.790 | 10.790 | +0.000 | Bearing/reserve is continuously voiced; the nearby rise cannot be assigned to reserve from RMS alone. |
