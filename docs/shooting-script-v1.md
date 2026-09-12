# Cascade hackathon film — shooting script v1

Sources (read in full before this doc): `script-v5-listening.md` (locked spoken lines, verbatim
below), `storyboard-v2.md` and `storyboard-v1.md` (prior shot lists, superseded on camera grammar
by the product owner's 2026-09-12 direction below but still the source for verified figures and
overlay text), `story-script-v2.md` (build spec), `film-lane-status.md` (what's already built:
overlay cards, scratch narration, edit manifest — all built against the OLD hard-cut grammar and
now needs re-cutting against this doc). App ground truth: `~/code/cascade/app/src/director/shots.ts`
(the real `SHOTS` array and `playShot()` camera calls) and `ShotOverlays.tsx` (the real overlay
markup). Visual reference: `~/claudes-world/tmp/cascade-film/preview/contact-sheet.png`.

This is a screen-recorded documentary, not a Remotion motion-graphics build. There is no
`timing.ts`/`TRANSITION` preset system here — camera language below is globe.gl/three.js terms the
app actually exposes. **The app's only real camera degrees of freedom are `lat`, `lng`, `altitude`
(Earth radii) and a transition `duration` (ms), via `engine.fly(lat, lng, altitude, duration,
site?)`.** There is no independently addressable "tilt" or "heading" parameter in the code — the
camera always looks straight down at the globe's center from the given lat/lng/altitude, so
"heading" in this doc means *which lat/lng the camera is centered over* (that's what determines
which hemisphere faces camera) and "tilt" means *altitude relative to the ground* (low altitude
over a point reads as an oblique/aerial angle at the edges of frame; high altitude reads as a flat
top-down globe view). Anywhere below that calls for a genuine tilt/roll axis beyond what `fly()`
gives, it's flagged as a new engine capability, not invented as if it already exists.

Runtime target: 3:45–4:00 (spoken narration ~3:11 + ending ~34–49s). Delivered plan below: **3:45**.

---

## 0. Camera bible

### 0.1 The always-moving rule (non-negotiable, product owner 2026-09-12)
The globe is never static. At every moment there is at least one of: a slow rotation (idle drift),
a pan (lat/lng change), a tilt-equivalent (altitude change), or a zoom. **No jump cuts anywhere in
the film.** One continuous take from Apple Park at the open through the ending; every scene
boundary in this doc is a camera move (a `fly()` call with a new lat/lng/altitude/duration), never
an edit. This reverses storyboard-v1/v2's hard-cut grammar (shots 1→2, 7→8, 8→9, 9→10→11, 11→12
were all specified as hard cuts there) — every one of those boundaries is rewritten below as a
continuous move. Where the current code holds the camera dead still during a shot (shot 5's `fly()`
with `duration=0` then 15s of no further camera calls; shots 7/8/9/11/12's single `fly()` then
hold), an **idle drift** must be added so the globe keeps turning under the whole shot. See §0.5.

### 0.2 Heading plan per beat (which hemisphere faces camera, and why)
The product owner's plan — Cupertino → Taiwan → Korea → Kentucky/Corning → back to Manhattan — maps
onto the corrected supply chain (`storyboard-v2.md`: Apple → Samsung Display (Asan, South Korea) →
Corning (Kentucky) → silica supplier → freight carrier; TSMC never touches Corning and only
appears in shot 5's processor-chain annotation flicker over Taiwan). Plan, in order of appearance:

| Beat | Real-world anchor | lat, lng (approx.) | Why the camera is there |
|---|---|---|---|
| Scenes 1–2 | Cupertino, Apple Park | 37.3349, -122.009 | The event that starts the clock |
| Scene 3 | Cupertino → Asan, South Korea | 37.33→36.80, -122.0→127.06 | First arc fires here (Samsung Display) |
| Scene 4 | Asan → Kentucky (Corning) → onward | 36.80→~37.8, 127.06→~-84.85 | Cascade hops west across the Pacific then to the US East |
| Scene 5 | Global sweep, pausing over Taiwan (TSMC), Korea, Kentucky in turn | drift ~121°E → ~127°E → ~-85°E over the 15s | Named-node flicker for the processor/display/battery chains |
| Scene 6 | Settles near the Pacific/US split (Cupertino-adjacent, since the vault is conceptual, not geographic) then drifts toward Fremont/Osaka as the Tesla proof chain fires in the background | ~37, -122 drifting to ~34, -118 → ~34.6, 135.5 | Keeps the arc network alive and geographically legible behind the coin |
| Scenes 7–9 | Wide Pacific hold, drifting east across the US toward the Atlantic | ~30, -145 drifting to ~30, -80 | Sets up the Manhattan arrival in scene 10 |
| Scene 10 | Pacific-wide → Fifth Avenue, Manhattan → wide Earth | Fifth Ave 40.7638, -73.9730 | The reframe's physical anchor, then pulls out to the derivatives figure |
| Scene 11 | Stays at/near Fifth Avenue, tighter altitude | 40.7638, -73.9730, lower altitude | Composable-diagram beat, staged as if still inside the store |
| Scene 12 (Close) | Fifth Avenue, descending altitude | 40.7638, -73.9730 | VO plays as the camera begins its descent — no cut into the ending |
| Scenes 13–16 (ending) | Down through the cube, spiral stair, underground hall, to white | 40.7638, -73.9730, altitude → 0 | The descent addendum |

The globe never revisits a hemisphere it has already "spent" without a narrative reason — the one
deliberate exception is scene 6→7–9's return toward the Atlantic, which is required to arrive back
at Manhattan for the reframe, and reads as a single continuous eastward drift, not a snap-back.

### 0.3 Easing convention
Every `fly()` call already takes a `duration` in ms; per the app's `PlaybackState.camera` shape
there is no separate easing field, so treat the built-in globe.gl `pointOfView()` transition (cubic
in/out) as the standing ease for every move in this doc — **confirm with the app engineer that the
component consuming `state.camera` actually passes an ease into globe.gl's `pointOfView()` and
isn't doing a linear tween**, since `engine.ts` itself stores no ease field. Two move classes:
- **Establishing moves** (scene-opening arrivals): 2800–6000ms, cubic in/out, matches existing
  values in `shots.ts` (`fly(..., 2800)`, `fly(..., 3500)`, `fly(..., 6000)`).
- **Idle drift** (the always-moving fill during holds): continuous, not a discrete `fly()` call —
  see §0.5, a new small-amplitude, constant-rate nudge, not a spring.
Never invent a bounce, overshoot, or elastic curve — this app has none of that vocabulary; the only
two motion qualities available are "eased move to a new point" and "continuous slow drift."

### 0.4 Legibility rule (360p / 240p)
- All on-screen numerals and chart labels must hold a minimum apparent size of **~5% of frame
  height** at 1920×1080 capture — that is what still reads at 360p and mostly holds at 240p per the
  product owner's ask. The yield curve (shot 7) and the derivatives figure (shot 10) are the two
  worst offenders on the contact sheet — see scene notes below for concrete size/margin fixes.
- Reduce empty margin on card layouts (contact sheet shows the coin, curve, and laws cards centered
  in a wide dark field with a lot of unused space at 1920×1080) without breaking the app's own
  clean/dark aesthetic — tighten the card's own internal padding, don't add new chrome.
- Line weight on the yield curve's grid and curve lines must be thick enough to survive
  down-sampling — thin 1px SVG strokes disappear at 240p; target 2–3px effective stroke.

### 0.5 New engine capability this script requires (flag for the app engineer, not solved here)
`engine.ts` has no idle-rotation mechanism — camera only moves on an explicit `fly()` call, and
several shots currently call `fly()` once then hold for the rest of the shot's duration (shot 5:
one `fly()` at t=0 then static for 15s; shots 7/9/11/12: one `fly()` then held). To satisfy the
always-moving rule, `tick()` needs a small addition: when no `fly()` is scheduled and `shotRunning`
is true, apply a slow constant lng drift (e.g. `lng += 0.4°/tick-second`) to the current camera
state so the globe keeps turning under static overlay cards. This is a genuinely new capability,
named here explicitly so it isn't confused with an existing spring/easing system.

### 0.6 Continuity table — proof against jump cuts
End state of scene N must equal (or be the literal starting point of) scene N+1's opening move.

| Scene | Ends at (lat, lng, altitude) | Next scene starts at |
|---|---|---|
| 1 → 2 | 37.3349, -122.009, 0.0000955 (Apple Park low) | 2 opens at the same point, altitude begins rising to 2.15 |
| 2 → 3 | 37.3349, -122.009, 2.15 | 3 opens at the same point, altitude drops to 0.8 as the first arc fires |
| 3 → 4 | 36.80, 127.06, 0.8 (Asan) | 4 opens at the same point, immediately drifts toward Kentucky as cascade beats fire |
| 4 → 5 | ~37.8, -84.85, ~1.6 (last cascade beat, Kentucky/onward) | 5 opens at the same point, altitude rises to 2.35 as the year view pulls wide |
| 5 → 6 | drift ends near ~34, -118 (US West, mid-Pacific-facing), 2.35 | 6 opens at the same point, altitude drops to 1.65 as the coin appears |
| 6 → 7 | ~34.6, 135.5 (Osaka, end of Tesla proof drift), 1.6 | 7 opens with a continuous pull-out through 2.3 centered back toward 30, -145 (a single eased move, not a cut — see scene 7 notes) |
| 7 → 8 | 30, -100 (drifted east under the curve's 27s), 2.3 | 8 opens at the same point, no altitude change — card fades in over the still-visible dimmed globe |
| 8 → 9 | 30, -90, 2.3 (idle drift carried through the card) | 9 opens at the same point, altitude eases to 2.3 (already there) |
| 9 → 10 | 25, -80, 2.3 (idle drift continues toward the Atlantic) | 10 opens with a single eased move from 25,-80,2.3 to 40.7638,-73.9730,0.05 (Fifth Ave arrival) |
| 10 → 11 | 40.7638, -73.9730, 0.05 (post wide-pullback-and-return, see scene 10 notes) | 11 opens at the same point, altitude tightens further for the composable diagram |
| 11 → 12 | 40.7638, -73.9730, ~0.02 | 12 opens at the same point, altitude continues easing toward 0 as VO plays |
| 12 → 13 | 40.7638, -73.9730, ~0.005 (inside the cube) | 13 opens at the same point, continues descending through the stair helix |
| 13 → 14 | inside the underground hall, altitude effectively 0, exposure beginning to ramp | 14 opens on the ramp already in progress |
| 14 → 15 | full white | 15 opens on white, wordmark fades in (no camera move needed — camera state is irrelevant once exposure is fully blown out) |
| 15 → 16 | white, wordmark held | 16 opens on the same frame, product line fades in under it |

---

## 1. Scenes

### Scene 1 — Apple Park aerial
- Timecode: 0:00–0:03
- Spoken (v5, "Monday," first sentence only carries into scene 2 — see note): *"After years of
  rumors, leaked patents and engineering documents, the first folding iPhone goes on sale Monday."*
  (This sentence spans scenes 1–2; scene 1 covers only its opening clause on screen, through
  roughly "...folding iPhone goes on sale" before "Monday" lands at the top of scene 2's pull-back —
  do not cut the sentence itself, only the picture moves under it.)
- SCENE: Black, then Apple Park aerial resolves. Ring decal visible, September 9, 2025. No graph,
  no UI chrome yet. Globe heading: centered on Cupertino, camera already at low "apple-park" site
  altitude. Start: 37.3349, -122.009, altitude 608/6,371,000 (≈0.0000955, matches the app's `APPLE`
  constant). End: same point, still at ground-level altitude — the rise begins in scene 2, not here.
- CAMERA: Hold on the low aerial with a barely-perceptible slow orbital drift (§0.5 idle drift,
  ~0.1°/s) so frame 1 is never a dead-still still frame — this is the film's very first pixel and
  the always-moving rule starts here, not at scene 2.
- DIRECTOR NOTES: Resist the temptation to add a push-in for drama — the product owner wants a slow
  drift, not a zoom, at the open; save the zoom energy for scene 2's pull-back so that move reads as
  the first big gesture of the film, not a repeat of scene 1's motion.
- APP NOTE: `shots.ts` id 1 currently calls `engine.fly(APPLE.lat, APPLE.lng, APPLE.altitude, 0,
  'apple-park')` then `hold()` — a true static hold for 3s. Change: keep the `fly()` call, but per
  §0.5 add the idle-drift tick during this shot's `hold()` window instead of leaving the camera
  frozen.

### Scene 2 — Pull back to the globe
- Timecode: 0:03–0:11 (8s, per `shots.ts` id 2)
- Spoken: *"...goes on sale Monday. As the presenter walks off the stage in Cupertino, a team
  backstage is already deep into next year's iPhone — running a supply chain of about two hundred
  companies and thousands of factories in more than fifty countries, on a hundred ninety-four
  billion dollars a year of product costs."*
- SCENE: Camera rises from ground level to the full network view over Cupertino; the $194B/year
  product-cost figure and the "~200 companies / thousands of factories / 50+ countries" facts
  render as they're spoken (this replaces the old $56B-counter framing from storyboard-v1/v2, which
  belonged to an earlier narration draft — v5's numbers here are the 194B product-cost figure and
  the "50+ countries" fact, not $56B; the $56B invoice figure moves to scene 3's "The catch," per
  v5's actual sequencing — see scene 3). Start: 37.3349, -122.009, altitude 0.0000955. End: same
  lat/lng, altitude 2.15.
- CAMERA: A single continuous rise, duration ~7500ms across the scene, eased (cubic in/out per
  §0.3), timed so the network is fully visible with dashed arcs alive by "fifty countries."
- DIRECTOR NOTES: This is the film's first big reveal (ground → planet). Do not let it complete
  early and sit — tie the altitude curve to the sentence so the reveal peaks on "a hundred
  ninety-four billion dollars," the beat's biggest number.
- APP NOTE: `shots.ts` id 2 currently does: `fly(APPLE, 0, 'apple-park')` immediately, then at
  `after(0.3)` → `fly(APPLE.lat, APPLE.lng, 2.15, 3000)`, `after(1.2)` → `showDebt: true`,
  `after(2.5)` → `playRange(0, 4.999, 5.5)`. Two changes: (1) stretch the altitude-rise `fly()`
  duration from 3000ms to match the full ~7.5s of spoken sentence rather than firing early and
  holding for the remaining ~4.5s static; (2) `showDebt` (the $56B card) must NOT render here —
  that figure belongs to scene 3's "The catch" per v5's script order. Move the `showDebt: true` call
  into the id-3 branch, timed to "fifty-six billion dollars."

### Scene 3 — The catch, and the first arc
- Timecode: 0:11–0:23 (12s, `shots.ts` id 3, "The proof")
- Spoken: *"And here's the catch. Apple pays its suppliers about a hundred and fifteen days after
  they ship. Right now, fifty-six billion dollars is committed to suppliers and not yet paid —
  purchase obligations, not invoices. Not because anything went wrong — those are just the terms.
  And every supplier down the chain is waiting on the one above it. That's how every phone, every
  car, every laptop gets built — nothing settled until it ships."*
- SCENE: The $56B figure renders here (moved from scene 2 per above). Globe stays at the wide
  network view through most of this line — the *proof* (Apple's node lighting, the first
  Cupertino→Asan arc) does not fire in scene 3; per v5's script this is still exposition ("the
  catch"), the first real arc-fire is "The first payment" (scene 5 below). Keep this scene's picture
  as the wide network holding the $56B counter, with dashed arcs live in the background (unsettled
  invoices visualized generically, not the named Apple→Samsung chain yet). Start: 37.3349, -122.009,
  altitude 2.15. End: same point, altitude 1.4 (a slow push toward Cupertino, foreshadowing the
  proof beat without landing it yet).
- CAMERA: A slow, continuous push-in from 2.15 to 1.4 over the full 12s, eased — this is a "dynamic
  sweep" per the always-moving rule, not a hold, and gives the $56B counter room to render and be
  read (per storyboard-v2's pacing note: the number needs about a second to sit) without the camera
  itself sitting still.
- DIRECTOR NOTES: Do not fire the Samsung Display arc here — v5 restructured the script so "the
  catch" (the debt problem) and "the first payment" (the proof) are two separate beats; firing the
  arc early collapses the tension the script is building. Hold the proof for scene 5.
- APP NOTE: This is a bigger change than a parameter tweak — `shots.ts`'s id-3 branch currently
  *is* the arc-fire (Cupertino→Asan). Per v5's re-sequencing, the arc-fire needs to move two shots
  later (to a new "first payment" shot). Recommend re-numbering: what `shots.ts` calls id 3 (`The
  proof`) becomes this scene's *next* scene, not this one. New shot needed here: a plain
  wide-network hold-with-push-in and the `showDebt` counter, no arc. Concretely: keep `SHOTS[1]`
  ("The network") extended to also carry this beat's counter-and-push-in, or insert a new id 2.5.
  Flag to the app engineer: the shot list itself needs a beat inserted, this is not just a camera
  parameter change.

### Scene 4 — The question
- Timecode: 0:23–0:26 (3s, new short beat)
- Spoken: *"So what if that future payment could move today, as a dated dollar?"*
- SCENE: Continue the slow push-in from scene 3 (1.4 → 1.1), Apple's node beginning to glow brighter
  as if primed, no arc fired yet — this is the pause before the proof, not the proof itself.
- CAMERA: Continuous push, ~1.1 altitude by scene end, same easing family, no new `fly()` needed
  beyond extending scene 3's move slightly further before scene 5's proof-arc `fly()` takes over.
- DIRECTOR NOTES: This is the shortest beat in the film and the hinge between problem and mechanism.
  Do not let the camera do anything showy — the push should feel like anticipation, not payoff.
- APP NOTE: No existing `shots.ts` id maps to this line at all in the current build (built against
  an older narration without "the question" as its own beat) — needs a new minimal shot entry (no
  overlay change, camera-only) inserted between the debt beat and the proof beat.

### Scene 5 — The first payment (the proof)
- Timecode: 0:26–0:34 (8s)
- Spoken: *"Watch. Apple commits a hundred million dollars for the folding OLED panels. Samsung
  Display gets paid — day one. That same afternoon, Samsung Display pays Corning for the ultra-thin
  cover glass. Same dollars, one dollar, one date, paid at face."*
- SCENE: This is the old `shots.ts` id-3 payload, re-timed: Apple's node lights, first arc fires
  Cupertino → Asan on "commits" (match cut, see §2). Samsung Display's node fills instantly. Its
  outbound arc to Corning (Kentucky) fires on "that same afternoon." Two live counters render:
  Invoices settled / Principal committed, climbing to $200M/$100M. Start: 37.3349, -122.009, 1.1
  (carried from scene 4). End: 36.80, 127.06 (Asan), 0.8.
- CAMERA: Eased move from Cupertino toward Asan, 2800ms, beginning the instant the first arc fires —
  camera chases the money, arriving over Korea as Samsung Display's node fills. This matches the
  product owner's rule directly: "the hemisphere where events fire must be facing the camera when
  they fire" — camera lands on Korea just as the payment lands there.
- DIRECTOR NOTES: This is the film's tightest sync point (per storyboard-v2's own risk list) — the
  arc must fire exactly on "commits," not before or after. Record 2–3 narration takes at slightly
  different paces and re-cut the arc-trigger frame to the best take, per storyboard-v2 §2's existing
  guidance (still valid — this is a narration-timing risk, not a camera-grammar one).
- APP NOTE: `shots.ts` id 3's existing code is close to correct for this scene: `engine.fly(APPLE,
  0.8, 0)` then `playRange(...)`, then `after(0.4)` → `fly(target.lat ?? 36.803, target.lng ?? 127.057,
  0.8, 2800)`. Keep this logic, just re-time it to this scene's new 0:26 start rather than 0:18, and
  confirm (per storyboard-v2's flagged dependency) the corrected Samsung Display/Corning chain data
  is loaded before capture — the fallback coordinates in this code (36.803, 127.057) are Asan,
  South Korea and are correct for the corrected chain.

### Scene 6 — The cascade
- Timecode: 0:34–0:44 (10s)
- Spoken: *"Corning pays its silica supplier. The silica supplier pays a freight carrier. Same
  dollars, next hop, same day. A hundred million committed just paid four hundred million dollars of
  invoices — settled, before it ever became cash. Four hops, one commitment, no bank in the middle.
  Nobody borrowed. Nobody waited."*
- SCENE: Two more hops fire in sequence — Corning → silica supplier, then → freight carrier.
  Floating dollar amounts fade in fast, drift up slowly off each arc. Counters climb to $400M/$100M.
  Start: 36.80, 127.06, 0.8 (Asan, carried from scene 5). End: ~37.8, -84.85 (Kentucky, approximate —
  confirm against the live firm dataset), ~1.6.
- CAMERA: Camera follows the cascade beat-by-beat exactly as `shots.ts`'s existing `cascadeBeats()`
  logic already does — a centroid-based `fly()` per beat, altitude widening slightly each hop
  (`Math.min(2.6, Math.max(1.25 + i * 0.15, span / 45))`) to keep multiple firms in frame as the
  chain fans out. This existing logic already satisfies "dynamic sweeps when showing something" —
  no change needed to the per-beat centroid math, only to when this scene starts (now 0:34, not
  0:30) and to removing the `hold()` at scene end in favor of a continued drift into scene 7.
- DIRECTOR NOTES: Per storyboard-v2's risk note, confirm the proof sequence (scene 5) has fully
  resolved before this scene's next hop fires — if scene 5 runs long, trim scene 5, don't rush this
  one.
- APP NOTE: `shots.ts` id 4's cascade-beat logic is reusable as-is; only change the `hold()` call at
  the end of the `beats.forEach` block — replace with a continued idle drift (§0.5) toward the year
  view's opening position (28, -145) rather than a dead stop, so scene 6→7 is a continuous move.

### Scene 7 — The year (with the dollar-with-a-date narration folded under it — see note)
- Timecode: 0:44–0:59 (15s, `shots.ts` id 5)
- Spoken: *"Now run the whole year. Ten thousand invoices across one illustrative global supply
  chain. Names you know, flying past — Samsung, Corning, Sony, Panasonic, Exxon, Shell. And one
  number that matters: how many dollars of invoices a single committed dollar settles before it
  matures."*
- SCENE: The 1-year/15-second preset runs, September 9 2025 → September 8 2026, named-node
  annotations flicker: display chain (Samsung Display, Corning), processor chain (TSMC, Sumco,
  Wacker — geographically this is the Taiwan beat), battery chain (Panasonic, Korean cathode
  supplier, Glencore), Foxconn assembly/connectors, Exxon/Shell feedstock. Three aggregate counters
  climb continuously. Start: ~37.8, -84.85, 1.6 (carried from scene 6). End: drift lands near 34,
  -118, 2.35.
- CAMERA: This is where the heading plan's Taiwan beat lives. Rather than the current single
  `fly(28, -145, 2.35, 0)` (an instant snap, zero duration, then 15s dead static — exactly the kind
  of static hold the product owner is flagging as a problem sibling to shot 6's), replace with a
  **scripted three-waypoint drift across the 15s**: (1) 0–5s: eased move from Kentucky toward Taiwan
  (24.8, 121.0) at altitude 2.35, timed to the TSMC/Sumco/Wacker annotation flicker; (2) 5–10s:
  continue drifting to Korea (36.80, 127.06) as the Panasonic/cathode-supplier annotations flicker;
  (3) 10–15s: drift to a wide Pacific/US position (34, -118) as the counters finish climbing, setting
  up scene 8's coin.
- DIRECTOR NOTES: Keep the read brisk through the em-dash names (storyboard-v2's existing pacing
  note still applies) so the 15-second preset and VO finish together; the camera waypoints above are
  timed to the named chains, not to the em-dashes themselves — don't let picture chase the VO's
  breath pattern.
- APP NOTE: `shots.ts` id 5: `engine.fly(28, -145, 2.35, 0); engine.update({ speed: 'year', caption:
  true }); engine.playRange(0, 365, 15);`. Change the single zero-duration `fly()` into three
  scheduled `engine.after()` calls issuing `fly()` at t=0 (→ Taiwan, 2.35, 5000ms), t=5 (→ Korea,
  2.35, 5000ms), t=10 (→ 34,-118, 2.35, 5000ms) — same total shot duration (15s), now three
  continuous moves instead of one static hold.

### Scene 8 — A dollar with a date (the 53-second beat — the product owner's flagged problem shot)
- Timecode: 0:59–1:52 (53s, `shots.ts` id 6)
- Spoken (full, unchanged): *"Every Cascade dollar is one dollar, redeemable on a calendar date.
  Same date, same dollar — one dollar, one date, completely interchangeable. An earlier dollar pays
  any later bill at face. No pricing, no negotiation, no credit check. Extend, and the date moves
  forward. You've handed the vault sixty more days of your capital, so you earn the vault's yield for
  exactly those sixty days. Moving the date earlier? That one needs a market."* Followed
  immediately (same shot, no cut) by: *"The vault lives on Arc. It holds USDC and is built to hold
  USYC — Circle's tokenized money market fund — as its yield source."*
- SCENE: This is the scene the product owner called "far too static." Fix: the globe keeps moving
  behind the coin view for the entire 53s (not dimmed-and-frozen); arcs keep firing (the Tesla proof
  chain, already wired in `shots.ts` id 6, fires at t=8/20/32/44 per the existing
  `chain.forEach((e,i) => after(8+i*12, ...))` logic); and the coin view itself animates on **every**
  spoken clause, not only on "Extend it." New per-line coin beats: "redeemable on a calendar date" —
  coin flips to reveal its date face; "same date, same dollar... interchangeable" — a second,
  identical coin fades in beside the first, then both settle; "pays any later bill at face" — coin
  slides toward a faint ghost bill icon and the bill dims/clears; "Extend, and the date moves
  forward" (existing cue) — date-slide day30→day90 with yield-meter fill, cued exactly to "Extend";
  "that one needs a market" — a small, faint curve-axis ghost sketches in at the frame edge,
  foreshadowing scene 9's yield curve (a visual match-cut setup); "The vault lives on Arc" — camera's
  background globe drifts to hover near a stylized "Arc" label/node; "holds USDC... USYC" — a small
  USDC/USYC composition diagram fades in beside the coin (a preview of scene 11's composable
  diagram, reused, not duplicated content — keep it small and secondary here).
- CAMERA: Continuous slow drift for the full 53s, not a lock-off: start 34, -118, 2.35 (carried from
  scene 7), drifting toward 34, -118 → 34.6, 135.5 (Osaka) by scene end, riding the same background
  arc-fire schedule already coded (Fremont/Osaka Tesla hops at t=8/20/32/44). Altitude eases down
  slightly, 2.35 → 1.65 → 1.6, so the background globe visibly breathes rather than sitting at one
  fixed zoom for nearly a minute.
- DIRECTOR NOTES: This is the single highest fatigue-risk shot in the film per every prior
  storyboard's own risk list, now made worse by being nearly a minute long. The fix is not one big
  event at "Extend it" — it's a small picture event on *every* clause boundary, so the eye always has
  something new within ~6–8 seconds. Do not let any single sub-beat run longer than that without a
  new visual event.
- APP NOTE: `ShotOverlays.tsx` shot 6 currently renders one static text block plus the coin/date-
  interval/yield-track, updating continuously via `progress` but with no distinct visual events tied
  to earlier clauses (only the date-slide is cued, via `state.shotElapsed`). Needs: (1) additional
  `engine.after()` calls in `shots.ts` id 6 firing new overlay states keyed to clause timing
  (requires timestamping the narration take once recorded, since these are VO-driven cues, not
  fixed-clock ones — record the final take first, then set these `after()` times against it); (2) a
  second coin element and ghost-bill/curve-ghost/USDC-USYC-diagram assets in `ShotOverlays.tsx`,
  currently absent; (3) replace the single `fly(37, -122, 1.65, 1200)` open with the continuous
  drift described above; (4) remove the `globe-dimmer` full-opacity dim for this shot or reduce its
  opacity — the background network needs to read as visibly alive, not fully obscured.

### Scene 9 — The vault (mechanism)
- Timecode: 1:52–2:07 (15s — this compresses storyboard-v2's separate "vault" and folds it ahead of
  the yield curve since v5's script now states the vault fact ("lives on Arc... USDC... USYC")
  inside scene 8's continuous 53s block, per the spoken-line grouping above; **this scene therefore
  covers v5's "under pressure" beat**, timecode adjusted accordingly)
- Spoken: *"Now put the vault under pressure. This is the part the engineers came for. Maturity day.
  Thousands of holders extending, withdrawing and selling at once. Watch the backing fall."*
- SCENE: Live balance sheet ticks through one maturity date while thousands of holders
  extend/withdraw/sell. Backing dips, recovers; reserve absorbs the dip; invariant lights stay green
  throughout — subject to the standing rule (storyboard-v2, still valid): report the actual
  checkpoint result; do not record "zero violations"-style claims over a failing live run. Start:
  34.6, 135.5 (Osaka, carried from scene 8), 1.6. End: 25, -80, 2.3.
- CAMERA: Eased pull-out and drift east, 34.6/135.5/1.6 → 25/-80/2.3 over the full 15s, continuous —
  this both satisfies the always-moving rule and begins the eastward journey back toward Manhattan
  that the heading plan calls for.
- DIRECTOR NOTES: Per storyboard-v2's existing pacing note, the picture (balance-sheet dip/recovery)
  carries this shot; don't let the camera drift upstage the data — keep the move slow enough that the
  balance-sheet card remains the clear foreground subject.
- APP NOTE: `shots.ts` id 9 currently: `engine.fly(25, -145, 2.3)` then plays the maturity range.
  Change the single `fly()` into a slow continuous drift across the shot's 15s (25,-145,2.3 →
  25,-80,2.3, ~14000ms duration) rather than an instant snap-and-hold.

### Scene 10 — The rules (conservation laws)
- Timecode: 2:07–2:27 (20s, `shots.ts` id 8)
- Spoken: *"A loss hits the reserve first, then the day's income — never principal. Every dollar of
  vault income has exactly one owner. And no two yield intervals on the same principal ever overlap.
  Ten thousand operations. Zero violations."*
- SCENE: Per `ShotOverlays.tsx`'s actual current copy ("Nothing disappears. Nothing is counted
  twice." / 01 PRINCIPAL / 02 YIELD / 03 LOSS), each law appears sequentially timed to its own
  clause, matching v5's spoken order (loss → yield → principal-adjacent ownership → overlap). Per
  the standing rule (still valid), the "ten thousand operations / zero violations" line reports the
  actual live checkpoint result. Start: 25, -80, 2.3 (carried from scene 9). End: 30, -70, 2.3.
- CAMERA: Continuous slow drift, 25/-80/2.3 → 30/-70/2.3 over the full 20s — per §0.1, the card sits
  over the dimmed-but-visible globe (per `ShotOverlays.tsx`'s existing `globe-dimmer` div, which is
  already present for shot 8 and does not remove the globe from the DOM, only dims it), so the
  camera move continues underneath the card rather than the card fully replacing the scene.
- DIRECTOR NOTES: storyboard-v2 described this shot as "no globe visible" — that text predates a
  look at the actual `ShotOverlays.tsx` code, which dims but does not hide the globe (`.globe-dimmer`
  is an overlay div, not a scene swap). Correct the belief: keep the drift going, dimmed, underneath.
- APP NOTE: `shots.ts` id 8 currently has no explicit `fly()` call at all (falls through to the
  default `else` branch: `engine.fly(30, -145, 2.3); hold();`). Replace `hold()` with a continued
  drift, and move the default `fly()`'s target from 30,-145 to 25,-80 to match this scene's
  continuity with scene 9's end point.

### Scene 11 — The reframe
- Timecode: 2:27–2:42 (15s, `shots.ts` id 10)
- Spoken: *"Now zoom all the way out. Eight hundred forty-six trillion dollars of derivatives. Every
  one of those contracts is a contract about money and time. Cascade makes time a property of money.
  So every one of them becomes a composition of dated dollars."*
- SCENE: Camera flies to the Fifth Avenue Apple Store glass cube (where the Duo goes on sale
  Monday — the film's closing loop back to scene 1), then pulls back to the whole Earth. The $846T
  derivatives figure card appears on "eight hundred forty-six trillion" — **enlarge this card** per
  the legibility rule: on the contact sheet, "$846 trillion" sits center-frame in a large dark field
  with a lot of unused margin at 1920×1080; tighten the card's internal padding and increase the
  numeral's point size so it holds up at 240p. The closing clause ("becomes a composition of dated
  dollars") is the cue for scene 12's composable diagram — do not let the "composition of dated
  dollars" line finish before the camera has begun moving toward the tighter composable-diagram
  framing; picture should already be easing in that direction as the clause lands. Start: 30, -70,
  2.3 (carried from scene 10). End: 40.7638, -73.9730, 0.05 (Fifth Avenue arrival, low altitude).
- CAMERA: Two-part eased move: (1) 30,-70,2.3 → 40.7638,-73.9730,0.05 over ~5800ms (matches
  `shots.ts`'s existing `after(0.3)` → `fly(..., 8/6_371_000, 3500, 'fifth-avenue')` timing, adjusted
  slightly longer to cover more of the scene); (2) `after(5.8)` → pull back to 30,-65,2.6 over 6000ms
  as the derivatives card renders and the "composition of dated dollars" clause plays.
- DIRECTOR NOTES: This is the steepest register change in the film (vault mechanics → macro framing
  → diagram) — per the no-jump-cut rule this must now read as one continuous camera arc rather than
  storyboard-v2's old "hard cut, let the cut mark the register change." The register change now has
  to be carried by pacing and the card's own visual weight, not an edit.
- APP NOTE: `shots.ts` id 10 already does almost exactly this two-part move (`update({stage:
  'cube'})`, fly to cube, then `after(5.8)` update to `stage: 'wide'` and fly to 30,-65,2.6). Keep
  this logic; only change is removing the trailing `hold()` in favor of a continued drift into scene
  12, and lengthening the initial cube-arrival `fly()` duration from 3500ms to ~5800ms.

### Scene 12 — Architecture / the composable diagram (extended, no longer silent)
- Timecode: 2:42–2:50 (8s — extended from the app's current 5s to fit the sequenced reveal; this 3s
  needs to be reclaimed from scene 11's pacing slack, not from the spoken-narration runtime, since
  scene 12 itself now carries the tail clause of scene 11's line, see below)
- Spoken: none newly added — the tail of scene 11's clause ("becomes a composition of dated
  dollars") plays over this scene's opening ~2s as the diagram assembles, satisfying the product
  owner's ask that "the composable slide reveals one item at a time in sync with the spoken lines"
  without adding or changing any v5 wording. After that, per v5/story-script-v2, this beat is
  silent for its remainder.
- SCENE: The architecture/composable diagram (per the app's current `ShotOverlays.tsx` shot-11
  copy, "One vault. Composable time.") reveals its boxes one at a time instead of as a single flat
  image: USDC → Cascade vault → Dated dollars, then Yield entitlements and Discount window branching
  off, each appearing in sequence timed to the tail of scene 11's clause and the following ~5s of
  silence (roughly one box per second). Start: 40.7638, -73.9730, 0.05 (carried from scene 11). End:
  40.7638, -73.9730, ~0.02 (a slow tighten).
- CAMERA: Slow continuous push-in, no discrete cut, altitude 0.05 → 0.02 over the full 8s.
- DIRECTOR NOTES: Keep the reveal to the diagram's five labeled boxes only — do not invent
  additional composable-time concepts beyond what `architecture.svg`/`ShotOverlays.tsx` already
  names (USDC, Cascade vault, Dated dollars, Yield entitlements, Discount window).
- APP NOTE: This requires converting the current single `<img src=".../architecture.svg">` in
  `ShotOverlays.tsx` shot 11 into either (a) an inline SVG with the five boxes as separately
  targetable elements revealed via CSS opacity keyed to `state.shotElapsed`, or (b) five small
  overlay DOM elements laid out to match the existing diagram positions, revealed in sequence. This
  is a real app change, not a camera parameter — flag to the app engineer. Also extend `SHOTS[10]`
  (`id: 11`) `seconds` from 5 to 8 in `shots.ts`.

### Scene 13 — Close
- Timecode: 2:50–2:56 (6s)
- Spoken (Stage 10 copy update): *"Cascade. Dated dollars on Arc. Money with a date."*
- SCENE: The Stage 10 close sequence reads “global supply chains. settled.” above the
  Cascade Money wordmark, followed by “Money with a date.” This supersedes the earlier
  distinction between the spoken tagline and the end-card tagline.
  Keep the composable diagram from scene 12 in frame, now fully assembled and static-but-drifting,
  as the VO plays over it — no new visual, this is a held beat before the descent begins. Start:
  40.7638, -73.9730, 0.02 (carried from scene 12). End: 40.7638, -73.9730, ~0.008.
- CAMERA: Continue the slow push-in from scene 12, now visibly beginning to feel like a descent
  toward store level — this is the setup for scene 14's literal descent, so the motion should not
  reset or pause here.
- DIRECTOR NOTES: Do not add a links/logo card here (storyboard-v1/v2's old shot 12 close card with
  app/repo/Arc-explorer links) — per the ending addendum those links belong later or not at all in
  this cut; this scene is VO-only over the continuing push-in.
- APP NOTE: New shot needed — nothing in current `shots.ts`/`ShotOverlays.tsx` maps to this beat as
  a standalone camera state; treat as a continuation of scene 12's push-in with the diagram held
  static in frame, no new overlay markup.

### Scene 14 — The descent
- Timecode: 2:56–3:10 (14s)
- Spoken: *"Down, into the vault beneath the store."* (spoken in the first ~3s; remaining ~11s
  silent under the descent, per the ending addendum's own framing — bed music, no VO)
- SCENE: Camera descends through the Fifth Avenue glass cube and spirals down a glass stair helix
  into an underground hall (model: glass cylinder + stair helix + floor + warm light; no human
  figure, per the addendum). The last floating "+$" arc/amount at the store is the phone sale
  itself — a final, small callback to scene 1's product. Start: 40.7638, -73.9730, ~0.008. End:
  40.7638, -73.9730, altitude effectively 0 (inside the hall).
- CAMERA: One continuous eased descent, ~13000ms, altitude curve front-loaded (faster drop through
  the cube in the first ~4s, matching "Down, into the vault" being spoken) then slowing into the
  spiral for the remaining ~9–10s so the helix geometry reads clearly rather than blurring past.
- DIRECTOR NOTES: This is a new 3D model, not the globe — confirm with the app engineer whether this
  lives inside the same three.js scene graph as the globe (continuing the "one continuous take"
  requirement) or is a separate composited element; if separate, the cut between them must still be
  disguised as a camera move (e.g., a whip-past-the-glass moment) rather than a hard edit, or the
  no-jump-cut rule breaks here specifically. Flag this as the single highest technical-risk beat in
  the ending.
- APP NOTE: No existing `shots.ts` id covers this at all — this is wholly new: a store-interior/
  underground-hall 3D model and a new shot id (or a dedicated post-shot-12 sequence) with its own
  camera path, not expressible via the current `fly(lat, lng, altitude)` globe-surface API since
  it's sub-surface, interior geometry. Needs new engine support, named here explicitly as new scope.

### Scene 15 — The line
- Timecode: 3:10–3:18 (8s)
- Spoken (locked per Decisions): *"Global supply chains. Settled."*
- SCENE: Exposure ramps to white. Clean lowercase text, Apple register, on white. Fades out at
  scene end.
- CAMERA: No lat/lng/altitude move — camera state is moot once exposure is fully blown to white; the
  "motion" here is the exposure ramp itself (a value from ~0 to fully-white over the first ~3s, held
  white for ~3s while the line is legible, then the text fades over the last ~2s). This is the one
  moment in the film where the always-moving rule is satisfied by an exposure move rather than a
  camera move — flag this explicitly as the sanctioned exception, not a silent violation.
- DIRECTOR NOTES: Per the legibility rule, this text must be unmistakably legible at 240p — lowercase
  Apple-register type, high contrast (near-black on white), generous but not excessive size.
- APP NOTE: New composited overlay, not an app camera shot — a full-white exposure card with fade
  in/out, built as a Remotion overlay (per `film-lane-status.md`'s existing pattern of building
  overlay cards in `~/code/video-lab/src/compositions/cascade-overlay-cards/`) or an in-app white
  full-bleed div. Either is fine; keep it consistent with the existing overlay-card build path.

### Scene 16 — Cascade Money / the tag
- Timecode: 3:18–3:30 (6s wordmark) + 3:30–3:36 (6s tag) — treated as two beats on one white field
- Spoken (locked per Decisions): *"Cascade Money."* then *"Money with a date."*
- SCENE: Wordmark fades in on white — "Cascade Money" with the app's icon + typography (per Liam's
  "perfect for Cascade" note in the addendum). Product line fades in underneath: "money with a
  date." Holds, then fades to black — end of film.
- CAMERA: Same sanctioned exception as scene 15 — no camera move, the wordmark's own fade-in is the
  motion.
- DIRECTOR NOTES: This is the last frame of the film and must feel like a sibling of scene 1's
  clean, specific, unhurried opening (product owner's continuity ask) — same restraint, same lack of
  hype language, same quiet confidence.
- APP NOTE: New composited overlay, same build path as scene 15's white card — wordmark asset plus
  product line, fade in/hold/fade out, then hard black (this final black is the one place in the
  film where nothing further follows, so it is not a "cut" in the no-jump-cut sense — there is no
  scene 17 to disguise a transition into).

---

## 2. Match cuts, named explicitly

- **Scene 5, "commits"**: the Cupertino→Asan arc fires on the word "commits," camera's eased move
  toward Asan begins in the same frame — narration names the action, picture executes it, camera
  arrives with it. (Carried forward from storyboard-v2's original match-cut, re-timed to v5's
  wording — "committed" became "commits" in the keyword pass; confirm the exact verb form against
  the final recorded take, not the page text, since live cadence may land the emphasis slightly
  differently.)
- **Scene 8→9 continuity**: scene 8's "market" clause (last line before the vault/USDC/USYC tail)
  seeds a faint curve-axis ghost at frame edge; nothing in scene 9 or 11 currently pays that off
  visually since the yield curve itself was folded out of this cut per v5's restructured script (v5
  has no standalone "yield curve" spoken beat — the "reframe" and "rules" beats absorbed the
  mechanism language). Flag: if a later pass reintroduces a yield-curve shot, this ghost element is
  its natural match-cut seed; if not, cut the ghost element from scene 8's list above rather than
  leaving an unresolved visual promise.
- **Scene 11→12, diagram assembly**: the diagram's final box (Discount window) finishes appearing
  exactly as scene 11's camera settles at 40.7638,-73.9730,0.02 — box completion and camera
  settlement land in the same frame, not staggered.
- **Scene 13→14, the "+$" callback**: the last floating dollar amount at store level (the phone sale
  itself) fades exactly as the camera passes through the cube's glass into the descent — a visual
  bookend to scene 1's Apple Park aerial, both being "the sale" from two vantage points (from orbit,
  then from inside the store).

---

## 3. Three-pass changelog

**Pass 1 (first full draft).** Built the scene list against `shots.ts`'s real 12-shot structure and
timings, mapped v5's spoken lines onto it, and discovered the mapping doesn't line up 1:1: v5's
narration is restructured relative to the shot list every other storyboard was built against (the
$56B figure moves from "the network" beat to "the catch"; the arc-fire proof beat is now two beats
later than in `shots.ts`'s id-3; there's a new short "the question" beat with no existing shot; the
yield-curve mechanism language is folded into "the rules"/"the reframe" beats rather than being its
own shot). First draft treated every `shots.ts` id as a fixed container and tried to force v5's
lines into it, which produced beats where narration and picture were fighting each other (e.g. the
$56B counter rendering a full narration-beat early).

**Pass 2 (checked against the rules and the contact sheet).** Re-read the product owner's five
rules against the draft and found three violations: (1) storyboard-v2/v1's hard-cut grammar was
still baked into several transition descriptions (shot 7→8, 8→9, 9→10→11) — rewrote every scene
boundary as a continuous `fly()`-based move and added the §0.6 continuity table to prove no jump
cuts remain; (2) scene 8 (the 53-second dollar-with-a-date beat) still only had one animation event
("Extend it") carried over from the old storyboards — added per-clause visual events across the
full 53s per the product owner's explicit complaint; (3) against the contact sheet, the yield-curve
and derivatives-figure cards showed a lot of unused dark margin around small type — added the §0.4
legibility rule with concrete fixes (padding, stroke weight, minimum apparent size) rather than a
vague "make it bigger" note.

**Pass 3 (re-checked, fixed the shot-list/narration mismatch honestly rather than papering over
it).** Went back through `shots.ts` and `story-script-v2.md` a second time and confirmed the
mismatch found in pass 1 is real, not a misreading — v5's spoken-line order genuinely does not match
the app's current 12-shot numbering. Rather than silently renumbering the app's shots in this doc
(which would mislead an implementer into thinking `shots.ts` already matches), each scene above now
carries an explicit APP NOTE stating whether it maps cleanly onto an existing shot id, needs an
existing id's timing/camera changed, or needs a wholly new shot inserted (scenes 4, 13, 14, 15, 16
are new; scene 3 requires splitting `shots.ts` id 3's payload across two scenes). Also caught and
fixed: the camera bible's original draft implied the app has a "tilt" parameter because the product
owner's brief asked for one — corrected against the actual `engine.fly(lat, lng, altitude, duration,
site?)` signature and reworded the whole camera vocabulary section to state plainly that tilt/heading
are not independent controls in this codebase, rather than inventing them.
