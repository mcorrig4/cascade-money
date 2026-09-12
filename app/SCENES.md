# Narration v6 — 17 scenes

Source: [Liam's final narration](../docs/script-v6-liam.md).
603 spoken words, 150 words/minute, plus one second per scene: **258.2 seconds (4:18.2)**.
These are provisional timings, not an assertion that the cut meets the four-minute upload limit.

The director displays scene numbers 01–17. URL `?shot=` and inspector APIs retain
the stable IDs below. Every scene inherits the previous end state; the orbit,
arch spline, snap/pull-out, eased flights, rewind, flash and idle drift remain.
New York calls the existing Fifth Avenue street/cube/stair/hall camera sequence.
The hall continues under the payment graph and the closing exposure ramp.

| Scene | API ID | Title | Words | Seconds | Expected captures under app/artifacts/scenes/ |
|---|---|---|---:|---:|---|
| 1 | 1 | The object of desire | 14 | 6.6 | scene-01-1920x1080.png · scene-01-640x360.png |
| 2 | 2 | Apple Park | 38 | 16.2 | scene-02-1920x1080.png · scene-02-640x360.png |
| 3 | 13 | Rewind | 47 | 19.8 | scene-03-1920x1080.png · scene-03-640x360.png |
| 4 | 3 | The hidden supply chain | 48 | 20.2 | scene-04-1920x1080.png · scene-04-640x360.png |
| 5 | 15 | The contradiction | 39 | 16.6 | scene-05-1920x1080.png · scene-05-640x360.png |
| 6 | 16 | The question | 18 | 8.2 | scene-06-1920x1080.png · scene-06-640x360.png |
| 7 | 4 | The cascade | 55 | 23.0 | scene-07-1920x1080.png · scene-07-640x360.png |
| 8 | 17 | Let it land | 30 | 13.0 | scene-08-1920x1080.png · scene-08-640x360.png |
| 9 | 5 | Run the year | 43 | 18.2 | scene-09-1920x1080.png · scene-09-640x360.png |
| 10 | 6 | A dollar with a date | 67 | 27.8 | scene-10-1920x1080.png · scene-10-640x360.png |
| 11 | 18 | Underneath it | 49 | 20.6 | scene-11-1920x1080.png · scene-11-640x360.png |
| 12 | 9 | Stress test | 27 | 11.8 | scene-12-1920x1080.png · scene-12-640x360.png |
| 13 | 8 | The rules survive | 28 | 12.2 | scene-13-1920x1080.png · scene-13-640x360.png |
| 14 | 11 | Zoom out | 42 | 17.8 | scene-14-1920x1080.png · scene-14-640x360.png |
| 15 | 10 | New York | 26 | 11.4 | scene-15-1920x1080.png · scene-15-640x360.png |
| 16 | 19 | Beneath it | 23 | 10.2 | scene-16-1920x1080.png · scene-16-640x360.png |
| 17 | 12 | Close | 9 | 4.6 | scene-17-1920x1080.png · scene-17-640x360.png |

## Recorded narration

Place a duration map in `app/public/narration/narration.json` before building:

```json
{"durations":{"1":6.42,"2":15.8,"17":7.25}}
```

Keys are **scene numbers**, values are seconds. Partial maps override only the
completed recordings. The app reads the optional file alongside the event load;
404, invalid JSON, invalid durations or a two-second fetch timeout retain the
provisional cut. No narration file or audio has been fabricated.

The override recomputes cumulative scene boundaries, camera and payment cue
times, overlay reveals, the director's total, and capture offsets together.
`COIN_BEATS`, `COMPOSABLE_BEATS`, and `SCENE_TEXT_BEATS` use the provisional
narration clock and scale with each recorded duration.

## Straight-line narration versus the baked run

Scene 7 follows Apple → Samsung Display → Corning → Great Lakes Silica →
Pacific Freight. The current baked run branches and sends $60M and $20M on the
last two edges. The director uses those existing firms, locations, event identities
and shared maturity, with an explicit **presentation-only** $100M on every hop.
Its ledger, floating amounts and counters agree on the narrated straight-line
scenario. Indexed events and their amounts are never modified.

Scene 8 defaults to $100M committed, $400M settled and four companies.
`CASCADE_FIGURES.branched` retains the requested $450M/eight-company alternative.
Year playback, free exploration and the Arc evidence panel keep their own actual
values. Scene 12 selects the busiest real day of extensions, transfers,
withdrawals and sells; no stress events are inserted. Scene 13 quotes the verified
10,000-operation/zero-violation stress result and 12,028 registered invoices.

## Captures and rehearsal

```sh
pnpm --dir app check:browser --static --scenes
pnpm --dir app check:browser --static --legibility
```

The first command captures every scene at 1920×1080 and 640×360.
Legibility mode captures 640×360 and 426×240. The full
`check:browser --static --real-data` suite also includes all scene captures.
Each manifest records scene ID, capture offset, viewport, actual scene clock and
layout audit. The harness owns a manual clock: RAF ticks cannot advance the film
during loading, screenshots or between browser evaluations. Each offset is
strictly inside its scene's half-open interval.

Use the manifests from a successful run; old captures do not verify this cut.
