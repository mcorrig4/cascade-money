# W2 cue onset evidence

PCM measurement: ffmpeg mono float32 at 24 kHz; 8 ms RMS windows, 2 ms hops; local search −120/+220 ms from transcript anchor. Select nearest sustained 12 dB rise above the local floor. Continuous voiced boundaries use the strongest local rising slope (−40/+60 ms), explicitly marked for phonetic review. An independent second pass widened or shifted seven named search windows where transcript anchors were in silence or the prior vowel; these explicit bounds are recorded in the evidence JSON. RMS analysis cannot establish exact consonant identity. This waveform audit used no Chrome, browser, or renderer. Four approved scene-2 measurements are retained. Onsets have zero lead and frames use `Math.round(seconds × 30)`. WAV MD5 guards are in `src/generated/onset-overrides.json`, including scene 7’s tail.

| Scene | Cue | Onset (s) | Frame (30 fps) | Evidence |
|---|---|---:|---:|---|
| 2 | `hook-open` | 2.036 | 61 | approved prior waveform measurement |
| 2 | `stat-cost` | 2.702 | 81 | RMS rise |
| 2 | `stat-suppliers` | 5.416 | 162 | approved prior waveform measurement |
| 2 | `stat-factories` | 7.202 | 216 | approved prior waveform measurement |
| 2 | `stat-countries` | 9.148 | 274 | approved prior waveform measurement |
| 2 | `promises` | 11.748 | 352 | RMS rise |
| 2 | `promises-fallback` | 12.672 | 380 | RMS rise |
| 2 | `wordmark` | 14.160 | 425 | RMS rise |
| 2 | `hook-arc` | 16.170 | 485 | RMS rise |
| 3 | `example-labels` | 24.536 | 736 | RMS rise |
| 4 | `question-card` | 1.850 | 56 | RMS rise |
| 4 | `question-card-fallback` | 2.342 | 70 | RMS rise |
| 4 | `dated-dollar` | 3.396 | 102 | RMS rise |
| 4 | `dated-dollar-fallback` | 3.580 | 107 | RMS rise |
| 4 | `not-cash` | 5.642 | 169 | RMS rise |
| 5 | `cascade-open` | 0.140 | 4 | RMS rise |
| 5 | `window-mirror` | 16.134 | 484 | connected-speech estimate; phonetic review needed |
| 6 | `deposited-value` | 0.126 | 4 | RMS rise |
| 6 | `committed-counter` | 1.116 | 33 | connected-speech estimate; phonetic review needed |
| 6 | `transacted-value` | 3.228 | 97 | RMS rise |
| 6 | `settled-counter` | 4.500 | 135 | connected-speech estimate; phonetic review needed |
| 6 | `invoice-value` | 6.358 | 191 | RMS rise |
| 6 | `companies-counter` | 6.712 | 201 | connected-speech estimate; phonetic review needed |
| 6 | `invoices-settled` | 7.288 | 219 | RMS rise |
| 7 | `coin` | 1.628 | 49 | RMS rise |
| 7 | `coin-pair` | 2.200 | 66 | fricative-band estimate (>3kHz energy majority, 3 hops); phonetic review needed |
| 7 | `swap` | 2.914 | 87 | RMS rise |
| 7 | `coin-principal` | 5.008 | 150 | RMS rise |
| 7 | `coin-date` | 9.432 | 283 | RMS rise |
| 7 | `earlier-pays-later` | 19.138 | 574 | connected-speech estimate; phonetic review needed |
| 7 | `face-value` | 21.794 | 654 | RMS rise |
| 7 | `extend` | 24.412 | 732 | RMS rise |
| 7 | `coin-yield` | 26.192 | 786 | connected-speech estimate; phonetic review needed |
| 7 | `final-card` | 28.798 | 864 | connected-speech estimate; phonetic review needed |
| 7 | `final-date` | 29.748 | 892 | RMS rise |
| 8 | `backing-card` | 0.744 | 22 | RMS rise |
| 8 | `contract` | 1.386 | 42 | RMS rise |
| 8 | `contract-fallback` | 1.970 | 59 | connected-speech estimate; phonetic review needed |
| 8 | `maturity-day` | 5.198 | 156 | RMS rise |
| 8 | `reserve` | 8.824 | 265 | RMS rise |
| 8 | `reserve-role` | 10.248 | 307 | RMS rise |
| 8 | `window-flatten` | 10.790 | 324 | connected-speech estimate; phonetic review needed |
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
