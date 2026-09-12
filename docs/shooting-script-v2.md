# Cascade hackathon film — shooting script v2 (v2.1: full v5 coverage)

Supersedes `shooting-script-v1.md`. Sources (read in full before this doc): `script-v5-listening.md`
(locked spoken lines, verbatim below, unchanged from v1), `storyboard-v2.md` — specifically its two
newest sections, **"Ending addendum"** (Liam 2026-09-12 10:30–10:40 ET, msgs 21132/21140, already
folded into v1's ending and carried unchanged here) and **"Opening choreography"** (Liam 2026-09-12
11:38 ET, msg 21208, the product owner's opening, which is law and replaces v1's scenes 1–2
outright) — plus `storyboard-v1.md`/`story-script-v2.md` for verified figures and overlay text.
App ground truth: `~/code/cascade/app/src/director/shots.ts` (the real `SHOTS` array and
`playShot()` camera calls) and `ShotOverlays.tsx` (the real overlay markup). Visual reference:
`~/claudes-world/tmp/cascade-film/preview/contact-sheet.png`.

This is a screen-recorded documentary, not a Remotion motion-graphics build. There is no
`timing.ts`/`TRANSITION` preset system — camera language below is globe.gl/three.js terms, extended
per the product owner's 2026-09-12 11:38 direction: **the camera engine is being built out with six
new primitives** (eased moves via cubic and custom-bezier curves, an orbit primitive, spline paths,
snap-center-and-pull-out, an accelerated day/night time-lapse blur, and a white flash with fade).
Every CAMERA block below names one of these primitives explicitly with concrete parameters — nothing
below invents a seventh.

What changed vs v1, in one line each: the opening (scenes 1–2) is rebuilt entirely around the
product owner's choreography (orbit → spline swoop → snap-and-pull-out → time-lapse rewind → white
flash → title card); v5's "Rewind" section, which v1 silently dropped, is restored as its own scene
because the choreography's step 4 ("let's go one year back") is that exact line; the first-half
heading plan (the catch → the question → the first payment → the cascade → the year) is rewritten as
one continuous westward rotation of the globe, closing very close to a full 360° turn by the time the
year-montage sweep finishes; the coin/dollar-with-a-date beat is now followed by two more restored
sections — "The treasury decision" and "Extend it." (the latter re-activating the app's dormant
yield-curve shot) — before the vault-under-pressure beat; everything from the vault beat through the
ending is carried forward from v1 unchanged (the ending addendum was already built into v1).

**v2.1 change (this pass):** closes the coverage gap v2's own changelog flagged and left open. Every
section of `script-v5-listening.md` now appears exactly once in the shot list — see §4's coverage
check.

Runtime target: 3:45–4:00 (unchanged from v1). Delivered plan below: **3:56** (v2 delivered 3:45; the
two restored sections add 11s, still comfortably inside the target range).

---

## 0. Camera bible

### 0.1 The always-moving rule (non-negotiable, product owner 2026-09-12), extended for v2
The globe (or, during the opening, the store/Earth composite) is never static. At every moment there
is at least one of: an orbit, a spline move, an eased pan/tilt/zoom, a time-lapse blur, or an idle
drift. No jump cuts anywhere. One continuous take from the Apple Park orbit at the open through the
wordmark card at the close; every scene boundary is a camera move, never an edit — see §0.7's
continuity table. v2 adds exactly two more **sanctioned camera-is-moot exceptions** to the two v1
already had (the white line-card and the wordmark card): scene 3's white-flash climax (the "rewind"
beat blows out to white before fading back in — camera state is irrelevant for the ~0.4s the frame is
fully white, exactly as it already is for the ending's white cards) and nothing else — the fade back
in from scene 3 to scene 4 resumes idle drift immediately, it does not sit dead. v2.1 adds no new
exception: scenes 11–12 (the treasury decision and "Extend it.") both keep the globe moving —
idle drift in scene 11, an eased pull-out in scene 12 — per the coordinator's explicit instruction
that the globe keeps rotating under those overlays.

### 0.2 Camera primitive vocabulary v2 — the six new primitives, named exactly, never invented beyond this list
The app's prior only degrees of freedom were `lat`, `lng`, `altitude` and a transition `duration` via
`engine.fly(lat, lng, altitude, duration, site?)`. The engine is being extended with:

1. **EASED MOVE — cubic** (existing, unchanged): `fly(lat, lng, altitude, duration)` with the
   standing cubic-in/out ease. Still the default for establishing moves and pushes/pulls.
2. **EASED MOVE — custom bezier** (new): `fly(lat, lng, altitude, duration, { ease: 'bezier',
   points: [p0, p1, p2, p3] })` — for asymmetric curves where cubic-in/out isn't the right shape
   (e.g. a move that starts slow and accelerates hard, or vice versa). Used in scene 7 (the
   rotation's chase-and-arrival into Asan) and scene 18 (the cube-to-hall descent).
3. **ORBIT** (new): `orbit(center: {lat, lng}, radius, altitude, angularSpeedDegPerSec, duration)` —
   camera holds a fixed radius and altitude around a surface point and revolves around it at a
   constant angular rate. Used in scene 1 (Apple Park).
4. **SPLINE PATH** (new): `splinePath(keyframes: [{lat, lng, altitude, t}], duration)` — camera
   travels a defined curve through 3+ waypoints, not a straight great-circle interpolation. Used in
   scene 2's swoop through the rainbow arch.
5. **SNAP-CENTER-AND-PULL-OUT** (new): `snapAndPullOut(center: {lat, lng}, snapAltitude,
   pullOutAltitude, pullOutDuration)` — an instantaneous (0ms) re-center dead-over a point at a very
   low altitude, immediately followed by a fast eased pull-out to a much higher altitude. Used in
   scene 2.
6. **TIME-LAPSE BLUR** (new): `timelapse(center: {lat, lng} | 'global', simulatedDays, direction:
   'forward' | 'reverse', playbackDurationMs, { terminatorBlur: true })` — accelerates the day/night
   terminator sweep across the globe while the camera holds its position, reading as a fast blur of
   light/dark bands. Used in scene 3.
7. **WHITE FLASH + FADE** (new): `flashToWhite(durationMs)` then, on the next scene,
   `fadeFromWhite(durationMs)` — an exposure-only transition with no lat/lng/altitude component.
   Used at the end of scene 3 and the start of scene 4; also the mechanism already in use (per v1)
   for the ending's white cards (scenes 19–20), now named as the same primitive rather than a
   bespoke Remotion overlay assumption.
8. **ROTATION SWEEP** (composed, not a new primitive): the westward turn across scenes 5–9 is not
   one new engine call — it is a scripted sequence of EASED MOVEs (cubic, occasionally bezier) through
   named waypoints at a roughly constant westward angular rate, with brief altitude dips ("settles")
   exactly where a payment lands. Named here so an implementer doesn't go looking for a nonexistent
   `rotate()` call — see §0.3 and each scene's CAMERA block for the concrete waypoint list.
9. **IDLE DRIFT** (existing, from v1 §0.5, unchanged): a small constant lng nudge (~0.4°/s) applied
   by `tick()` whenever no `fly()`/primitive is scheduled, so held shots never sit dead. Still a
   required engine addition, not solved by this doc — see §0.6.

Never invent a bounce, overshoot, elastic curve, or independent tilt/heading/roll axis — those remain
outside this app's vocabulary exactly as v1 stated; the nine items above are the complete v2/v2.1
list — v2.1 adds no new primitive, only new uses of #1 and #9 in scenes 11–12.

### 0.3 Heading plan — rebuilt around the westward rotation
The product owner's opening (§1 scenes 1–4) is orbit/spline/snap/time-lapse over Cupertino only —
no heading change in the historical sense, since it never leaves Apple Park until the rewind's
time-lapse, which holds position while time itself rewinds. The heading plan proper starts at scene
5, where the camera begins **one continuous westward rotation** (decreasing longitude) that fires the
display chain as each node comes to center, settles over the eastern US for the cascade's fission
beat, then closes the loop with the year scene's global sweep. After the loop closes, the rotation's
job is done — scenes 10–12 (coin, treasury decision, "Extend it.") sit over the western
Pacific/US split doing their own independent drift, not further rotation travel, before the vault
scene's pull-out east toward Manhattan:

| Scene | Real-world anchor | lat, lng (approx.) | Cumulative westward travel | Why the camera is there |
|---|---|---|---|---|
| 1–2 | Cupertino, Apple Park | 37.3349, -122.009 | 0° (orbit + snap, no heading travel) | The event that starts the clock |
| 3–4 | Cupertino (time-lapse hold, then fade back to the same point) | 37.3349, -122.009 | 0° | Rewinding the clock at the same place it started |
| 5 | Cupertino, pushing in then pulling back out as rotation begins | 37.3349, -122.009 → drifting west | 0° → ~20° | "The catch" — the debt problem, camera starts turning under it |
| 6 | Continuing west over the Pacific | ~37, -150 | ~20° → ~28° | "The question" — the shortest beat, rotation barely advances |
| 7 | Arrives at Asan, South Korea, exactly on "commits" | 36.80, 127.06 | ~28° → ~111° | First arc fires here (Samsung Display) — the rotation's first named stop |
| 8 | Continues west across Asia/Europe/Atlantic to Harrodsburg, Kentucky (Corning) | 127.06 → -84.85 | ~111° → ~323° | Cascade hops fire in sequence; camera settles over the eastern US for the fission beat |
| 9 | Global sweep closing the loop, pausing over Taiwan (TSMC), Korea, then wide Pacific/US | drifts ~121°E → ~127°E → ~34,-118 | ~323° → ~356° (effectively a full turn) | Named-node flicker for the processor/display/battery chains, then arrives almost exactly back where the turn started |
| 10 | Settles near the Pacific/US split, drifting to Fremont/Osaka for the Tesla proof chain | ~37,-122 → ~34.6, 135.5 | (rotation complete; independent drift resumes) | Keeps the arc network alive and geographically legible behind the coin |
| 11 | Holds near Osaka, idle drift only, coin reframes to second-person treasury illustration | ~34.6, 135.5 → ~34.6, 138 | — | The treasury decision plays on the coin view; globe motion is a background fact, not the point |
| 12 | Begins the eastward pull-out as the yield curve deploys | ~34.6, 138 → 30, -145 | — | "Extend it." fires the dormant yield-curve shot; camera move doubles as the vault scene's approach |
| 13 | Pacific-wide hold, continuing the drift east across the US toward the Atlantic | 30, -145 → 25, -80 | — | Sets up the Manhattan arrival |
| 14 | Continues east | 25,-80 → 30,-70 | — | Conservation-laws card, dimmed globe still turning underneath |
| 15 | Fifth Avenue, Manhattan → wide Earth | 40.7638, -73.9730 | — | The reframe's physical anchor, closing the loop back to the film's own "store" |
| 16–17 | Stays at Fifth Avenue, tightening altitude | 40.7638, -73.9730 | — | Composable diagram, then the Close VO |
| 18–20 | Down through the cube, spiral stair, underground hall, to white, to wordmark | 40.7638, -73.9730 → altitude 0 → white | — | The descent addendum, unchanged from v1 |

Two things worth stating plainly: (1) the westward rotation is a rate-varying sequence of eased
moves, not a literal constant-angular-velocity spin — it moves briskly across empty ocean/desert and
settles (altitude dips, angular rate drops toward zero) exactly where a payment fires, per the
product owner's "as each comes to center" instruction; (2) the rotation closes at ~356°, not a
mathematically exact 360°, because the year scene's sweep is doing double duty (closing the loop *and*
visiting Taiwan/Korea for the named-chain annotations) — the ~4° shortfall lands the camera at
34,-118, which is where scene 10 already needed to be for continuity into the coin shot, so the
"almost but not quite 360°" is a feature of matching the loop's end to the next scene's required
start, not a rounding error to fix. Scenes 11–12 are deliberately *not* more rotation — the turn is
already done by scene 9; the coordinator's brief for these two new scenes calls for the globe to keep
moving, not to keep turning the same 360°, so they read as ordinary background drift/pull-out.

### 0.4 Easing convention (unchanged from v1, restated)
Establishing moves: 2800–6000ms, cubic in/out (or custom bezier where named). Idle drift: continuous,
not a discrete call. Never a bounce, overshoot, or elastic curve.

### 0.5 Legibility rule — 360p/240p (unchanged from v1, carried forward)
All on-screen numerals and chart labels hold ≥5% of frame height at 1920×1080. Reduce empty card
margin without adding chrome. Line weight on the yield-curve grid/curve ≥2–3px effective stroke at
240p — this rule now also directly governs scene 12's re-activated yield curve, not just a
hypothetical future shot. Reduce empty card margin without adding chrome, applying equally to scenes
10 and 15 (formerly v1's 8 and 11).

### 0.6 New engine capabilities this script requires (flagged, not solved here)
Two classes: (a) the six named primitives in §0.2, all genuinely new; (b) the idle-drift tick
addition from v1 §0.5, still needed for every held shot from scene 10 onward exactly as before,
including the new scenes 11–12. Neither is invented as if already shipped.

### 0.7 Continuity table — proof against jump cuts (rebuilt for all 20 scenes)
End state of scene N must equal (or be the literal starting point of) scene N+1's opening move.

| Scene | Ends at | Next scene starts at |
|---|---|---|
| 1 → 2 | 37.3349, -122.009, orbit radius/altitude ~0.0003, bearing ~36° around center | 2 opens at the orbit-exit point, immediately enters the spline swoop |
| 2 → 3 | 37.3349, -122.009, altitude 2.5 (post pull-out, whole Earth visible) | 3 opens at the same point/altitude, time-lapse begins holding position |
| 3 → 4 | Full white (flash climax, camera state moot per §0.1) | 4 opens on white, fades back to 37.3349, -122.009, altitude 2.5 — the exact frame scene 3 left |
| 4 → 5 | 37.3349, -122.009, altitude 2.5 (title card held, idle drift only) | 5 opens at the same point, altitude begins easing down to 0.35 as the push-in starts |
| 5 → 6 | ~37, -150 (rotation under way), altitude back up to ~2.2 | 6 opens at the same point, rotation continues at the same rate |
| 6 → 7 | ~37, -157, 2.2 | 7 opens at the same point, rotation accelerates (bezier ease) toward Asan, settling to 0.8 exactly on "commits" |
| 7 → 8 | 36.80, 127.06, 0.8 (Asan) | 8 opens at the same point, immediately resumes westward travel toward Kentucky as cascade beats fire |
| 8 → 9 | ~37.8, -84.85, ~1.6 (last cascade beat, Kentucky) | 9 opens at the same point, altitude rises to 2.35 as the year view pulls wide |
| 9 → 10 | ~34, -118, 2.35 (rotation loop closed to within ~4°) | 10 opens at the same point, altitude drops to 1.65 as the coin appears |
| 10 → 11 | ~34.6, 135.5 (Osaka, end of Tesla proof drift), 1.6 | 11 opens at the same point, idle drift only, coin reframes to the treasury illustration |
| 11 → 12 | ~34.6, 138, 1.6 (idle drift carried through the treasury beat) | 12 opens at the same point, begins the eased pull-out toward 30,-145,2.3 as the yield curve deploys on "Extend it." |
| 12 → 13 | 30, -145, 2.3 (pull-out complete, curve fully drawn) | 13 opens at the same point, continuing the eastward drift already in progress |
| 13 → 14 | 25, -80, 2.3 (idle drift carried through the card) | 14 opens at the same point, no altitude change |
| 14 → 15 | 30, -70, 2.3 | 15 opens with a single eased move to 40.7638, -73.9730, 0.05 (Fifth Avenue arrival) |
| 15 → 16 | 40.7638, -73.9730, 0.05 | 16 opens at the same point, altitude tightens further |
| 16 → 17 | 40.7638, -73.9730, ~0.02 | 17 opens at the same point, altitude continues easing toward 0 |
| 17 → 18 | 40.7638, -73.9730, ~0.008 | 18 opens at the same point, descent begins (bezier ease, fast-then-slow) |
| 18 → 19 | Inside the underground hall, altitude ~0, exposure ramping | 19 opens on the ramp already in progress, resolves to full white |
| 19 → 20 | Full white, wordmark card cue | 20 opens on the same white frame, wordmark fades in |

---

## 1. Scenes

### Scene 1 — Apple Park orbit
- Timecode: 0:00–0:04
- Spoken (v5 "Monday," opening clause): *"After years of rumors, leaked patents and engineering
  documents, the first folding iPhone goes on sale Monday. The iPhone Duo."*
- SCENE: Black, then a slow aerial orbit around Apple Park resolves — ring decal visible, September
  9, 2025. No graph, no UI chrome. This replaces v1's static-aerial-plus-idle-drift open outright:
  per the product owner's choreography step 1, the open is a deliberate orbit, not a held frame with
  a barely-perceptible nudge.
- CAMERA: **ORBIT** — center 37.3349, -122.009, radius ~0.0006 (tight, aerial), altitude ~0.0003,
  angularSpeedDegPerSec ~8, duration 4000ms (covers ~32° of travel around the ring). This is the
  film's first pixel and its first motion in one move — no separate "hold then idle-drift" step is
  needed now that orbit is a real primitive.
- DIRECTOR NOTES: The orbit itself carries the drama the old "resist the push-in" note used to guard
  against — there's no temptation to zoom here because the orbit is already the establishing gesture;
  save the fast pull-out energy for scene 2 so it still reads as the film's first big move, not a
  repeat.
- APP NOTE: New shot, no existing `shots.ts` id — needs the ORBIT primitive built (§0.2 item 3) and a
  new shot entry (working id `0-orbit`) calling it with the params above. `ShotOverlays.tsx` needs no
  change (no overlay text this scene).

### Scene 2 — Rainbow-arch swoop, then snap-and-pull-out to Earth
- Timecode: 0:04–0:13 (9s)
- Spoken (v5 "Monday," remainder): *"As the presenter walks off the stage in Cupertino, a team
  backstage is already deep into next year's iPhone — running a supply chain of about two hundred
  companies and thousands of factories in more than fifty countries, on a hundred ninety-four billion
  dollars a year of product costs."*
- SCENE: Camera exits the orbit and swoops through the campus's rainbow arch (per the product owner's
  step 2), then snaps dead-center over Apple Park at very low altitude and pulls out fast to the
  whole Earth (step 3), where the network reveal (arcs, $194B/year product-cost figure, "~200
  companies/thousands of factories/50+ countries") renders as it's spoken — same content v1's old
  scene 2 carried, now riding a more deliberate two-part camera gesture instead of a single rise.
- CAMERA: Two calls. (1) **SPLINE PATH** — keyframes: t=0 orbit-exit point (37.3349,-122.009,
  altitude 0.0003), t=0.5s arch-apex point (37.3355, -122.0085, altitude 0.0006 — swooping up and
  through), t=1.2s back down dead-center over Apple Park (37.3349, -122.009, altitude 0.00005);
  duration 1200ms. (2) **SNAP-CENTER-AND-PULL-OUT** — center 37.3349, -122.009, snapAltitude 0.00005
  (the spline already leaves the camera there, so this call's "snap" is a formality confirming dead
  center), pullOutAltitude 2.5, pullOutDuration 4300ms — timed so the network is fully visible with
  dashed arcs alive by "fifty countries" and the reveal peaks on "a hundred ninety-four billion
  dollars," the beat's biggest number.
- DIRECTOR NOTES: The arch swoop must read as one continuous gesture into the pull-out, not a
  separate flourish before the "real" move starts — no pause between the spline's landing frame and
  the snap-and-pull-out's first frame.
- APP NOTE: New shot, no existing `shots.ts` id — needs both SPLINE PATH and SNAP-CENTER-AND-PULL-OUT
  primitives (§0.2 items 4–5) and a new shot entry (working id `0-swoop`). The `$194B`/"~200
  companies" overlay text is the same content as v1's old scene 2 overlay — reuse that markup,
  re-timed to this scene's new camera schedule.

### Scene 3 — Rewind
- Timecode: 0:13–0:17 (4s)
- Spoken (v5 "Rewind," restored — v1 dropped this section entirely, see changelog): *"So rewind three
  hundred sixty-five days. The iPhone 17 keynote. That's the day this phone kicked off."*
- SCENE: The day/night terminator sweeps backward across the globe at high speed, reading as a
  flickering light/dark blur, holding position over the Pacific/US view established at scene 2's end.
  On "kicked off," the frame blows out to full white.
- CAMERA: **TIME-LAPSE BLUR** — center 37.3349, -122.009 (camera holds this framing throughout),
  simulatedDays 365, direction `reverse`, playbackDurationMs 2600, terminatorBlur true, altitude held
  at 2.5. Immediately followed by **WHITE FLASH + FADE** — `flashToWhite(400)` triggered on the last
  word ("off"), holding white into scene 4's open.
- DIRECTOR NOTES: This is the film's one deliberate "we are leaving the present moment" gesture — keep
  the time-lapse's terminator blur fast enough to read as travel-through-time, not as a lighting
  glitch; the white flash is the payoff, not an accident.
- APP NOTE: New shot, no existing `shots.ts` id — needs the TIME-LAPSE BLUR and WHITE FLASH + FADE
  primitives (§0.2 items 6–7) and a new shot entry (working id `0-rewind`). No overlay text.

### Scene 4 — September 9, 2025
- Timecode: 0:17–0:20 (3s, silent)
- Spoken: none — per the choreography's own step 5, this beat is picture-and-text only, the "Rewind"
  line has already finished playing over scene 3.
- SCENE: Fade back in from white to the exact frame scene 3 left (Cupertino/Pacific wide view).
  Giant center text "September 9, 2025" renders, then a smaller corner label "Apple Park / Cupertino,
  California." Both hold through the fade-back and clear before scene 5's push-in begins.
- CAMERA: **WHITE FLASH + FADE** (fade-from-white half) — `fadeFromWhite(600)` back to 37.3349,
  -122.009, altitude 2.5. No further camera move; idle drift (§0.2 item 9) resumes immediately so the
  frame is never a dead hold once the fade completes, satisfying §0.1's rule even during a silent,
  text-only beat.
- DIRECTOR NOTES: This is the film's first on-screen date/place caption — keep the typography in the
  same clean, unhurried register the ending's white cards use (per §0.1's continuity ask that the
  last scene feel like a sibling of the first); this is the seed of that sibling relationship, not
  just the ending's problem to solve alone.
- APP NOTE: New shot, no existing `shots.ts` id — needs the fade-from-white half of the WHITE FLASH +
  FADE primitive plus two new overlay text elements in `ShotOverlays.tsx` (working id `0-titlecard`):
  a large center date string and a smaller corner place label, both app-native typeset elements, not
  a separate Remotion composite (keep this in the same DOM/overlay system as the rest of the film's
  cards).

### Scene 5 — The catch, rotation begins
- Timecode: 0:20–0:32 (12s)
- Spoken (v5 "The catch," unchanged): *"And here's the catch. Apple pays its suppliers about a
  hundred and fifteen days after they ship. Right now, fifty-six billion dollars is committed to
  suppliers and not yet paid — purchase obligations, not invoices. Not because anything went wrong —
  those are just the terms. And every supplier down the chain is waiting on the one above it. That's
  how every phone, every car, every laptop gets built — nothing settled until it ships."*
- SCENE: Camera pushes in to California/state scale as the line opens ("over a year ago everything
  was being planned" is the product owner's own gloss on this beat's feel, per the choreography's
  step 6 — the actual spoken content is v5's unchanged "the catch" paragraph), then pulls back out
  to a wide globe view while beginning the westward rotation that will carry through scene 9. The
  $56B counter renders here (unchanged from v1's re-sequencing rationale — this figure belongs to
  "the catch," not the earlier network-reveal beat).
- CAMERA: Two-part. (1) **EASED MOVE — cubic**, 37.3349,-122.009,2.5 → 37.3349,-122.009,0.35 over
  4000ms (the state-scale push-in). (2) **EASED MOVE — cubic**, resuming altitude 0.35 → 2.2 over the
  remaining 8000ms while lng decreases at a constant ~2.5°/s (the rotation's opening, slow leg) —
  concretely a short sequence of `fly()` calls at ~1s intervals stepping lng from -122 toward -142,
  each a cubic ease into the next, reading as one continuous westward turn rather than discrete hops.
- DIRECTOR NOTES: The push-in must not read as a detour from the rotation — frame it as the rotation's
  wind-up: the camera dips toward the ground once, over Cupertino, before the turn proper begins, and
  never dips again until it settles at Asan (scene 7).
- APP NOTE: `shots.ts`'s id-3 payload (per v1's own pass-3 note) still needs the same split v1
  flagged — the $56B counter and this push-in/rotation-start belong here, not to the network-reveal
  shot. New: the rotation's opening leg (a scripted sequence of `fly()` calls at constant lng rate)
  has no existing analog in `shots.ts` at all — flag as new scope alongside the counter split.

### Scene 6 — The question
- Timecode: 0:32–0:35 (3s)
- Spoken (v5 "The question," unchanged): *"So what if that future payment could move today, as a
  dated dollar?"*
- SCENE: Rotation continues at the same rate, no altitude change, Apple's node beginning to glow
  brighter as if primed — the pause before the proof, exactly as v1 framed it, now explicitly part of
  the westward turn rather than an isolated push.
- CAMERA: **EASED MOVE — cubic**, continuing the same ~2.5°/s westward step sequence from scene 5,
  altitude held at 2.2, lng advancing from ~-142 to ~-157 over the 3s.
- DIRECTOR NOTES: Shortest beat in the film — the rotation should barely seem to have moved, on
  purpose; do not let the camera do anything showy.
- APP NOTE: No existing `shots.ts` id maps to this line — needs a new minimal shot entry
  (camera-only, no overlay change) continuing the rotation sequence started in scene 5.

### Scene 7 — The first payment (the proof)
- Timecode: 0:35–0:43 (8s)
- Spoken (v5 "The first payment," unchanged): *"Watch. Apple commits a hundred million dollars for
  the folding OLED panels. Samsung Display gets paid — day one. That same afternoon, Samsung Display
  pays Corning for the ultra-thin cover glass. Same dollars — one dollar, one date, paid at face."*
- SCENE: Apple's node lights, first arc fires Cupertino → Asan on "commits" (match cut, §2). Samsung
  Display's node fills instantly; its outbound arc to Corning fires on "that same afternoon." Two live
  counters climb to $200M/$100M. This is the rotation's first named stop — the display chain fires
  "as it comes to center," per the choreography's own framing.
- CAMERA: **EASED MOVE — custom bezier**, from ~37,-157,2.2 to 36.80,127.06,0.8 over 8000ms, points
  chosen so the camera accelerates hard through the empty mid-Pacific and decelerates sharply into
  Asan, landing exactly on "commits" — this is the scene where the bezier primitive earns its keep
  over plain cubic, since a symmetric ease would either arrive early and sit, or arrive late and miss
  the match cut.
- DIRECTOR NOTES: Tightest sync point in the film (unchanged from v1) — the arc must fire exactly on
  "commits." Record 2–3 narration takes and re-cut the bezier's arrival frame to the best take, not
  the other way around.
- APP NOTE: `shots.ts` id 3's existing arc-fire logic is reusable, but the approach camera move needs
  to become a custom-bezier `fly()` rather than the current single cubic call — this is the first
  scene that actually requires primitive #2 (custom bezier) rather than just naming it in the
  vocabulary section.

### Scene 8 — The cascade
- Timecode: 0:43–0:53 (10s)
- Spoken (v5 "The cascade," unchanged): *"Corning pays its silica supplier. The silica supplier pays
  a freight carrier. Same dollars, next hop, same day. A hundred million committed just paid four
  hundred million dollars of invoices — settled, before it ever became cash. Four hops, one
  commitment, no bank in the middle. Nobody borrowed. Nobody waited."*
- SCENE: Two more hops fire in sequence — Corning → silica supplier, then → freight carrier — while
  the rotation continues west across Asia, the Middle East, Europe and the Atlantic, settling over
  Harrodsburg, Kentucky (Corning) for what the product owner's choreography calls the **fission
  beat**: the two hops firing in quick, branching succession reads as a small chain reaction once the
  camera has settled directly over it, rather than as two isolated arc-fires. Counters climb to
  $400M/$100M.
- CAMERA: Camera follows the cascade beat-by-beat using the existing centroid-based `fly()` logic
  (unchanged math from v1/`cascadeBeats()`), but the moves between beats are now framed explicitly as
  the rotation's long westward leg (Asan 127.06° → Kentucky -84.85°, ~212° of travel across the 10s)
  rather than independent per-hop jumps — same calls, same altitude-widening formula
  (`Math.min(2.6, Math.max(1.25 + i * 0.15, span / 45))`), reframed as one continuous turn. Ends
  settled at ~37.8,-84.85,~1.6 for the fission beat.
- DIRECTOR NOTES: Do not let the "fission" framing tempt a burst/flash effect at Kentucky — the
  reaction is conveyed by the two hops' proximity in time and space now that the camera is finally
  holding still-ish over them, not by a new visual effect outside this doc's primitive list.
- APP NOTE: `shots.ts` id 4's cascade-beat logic is reusable as-is; only change is removing the
  trailing `hold()` in favor of a continued idle drift toward the year view's opening position, same
  as v1 already specified.

### Scene 9 — The year (global sweep, closing the loop)
- Timecode: 0:53–1:08 (15s)
- Spoken (v5 "The year," unchanged): *"Now run the whole year. Ten thousand invoices across one
  illustrative global supply chain. Names you know, flying past — Samsung, Corning, Sony, Panasonic,
  Exxon, Shell. And one number that matters: how many dollars of invoices a single committed dollar
  settles before it matures."*
- SCENE: The 1-year/15-second preset runs, named-node annotations flicker (display, processor,
  battery, assembly/connector, feedstock chains, unchanged from v1). This scene both delivers the
  named-chain flicker and closes the westward rotation's loop — by its end the camera sits at ~34,
  -118, roughly the same longitude the rotation started from at Cupertino, completing (within ~4°) a
  full 360° turn.
- CAMERA: Three-waypoint **EASED MOVE — cubic** sequence, unchanged in structure from v1: (1) 0–5s
  Kentucky (-84.85) → Taiwan (24.8,121.0), altitude 2.35, 5000ms, timed to the TSMC/Sumco/Wacker
  flicker; (2) 5–10s Taiwan → Korea (36.80,127.06), 5000ms, Panasonic/cathode-supplier flicker; (3)
  10–15s Korea → wide Pacific/US (34,-118), 5000ms, counters finishing their climb. This sweep is not
  a strict continuation of the rotation's great-circle path (it detours to Taiwan and Korea for the
  named annotations) — it is the loop-closing "global sweep" the choreography calls for, landing back
  near the turn's starting longitude rather than continuing indefinitely west.
- DIRECTOR NOTES: Keep the read brisk through the em-dash names, unchanged from v1 — the camera
  waypoints are timed to the named chains, not the VO's breath pattern.
- APP NOTE: `shots.ts` id 5, unchanged from v1's fix: replace the single zero-duration `fly()` with
  three scheduled `engine.after()` calls at t=0/5/10 as above.

### Scene 10 — A dollar with a date (the 53-second beat)
- Timecode: 1:08–2:01 (53s, `shots.ts` id 6) — unchanged from v1's scene 8 in every particular except
  the timecode shift; see v1 for full per-clause coin-beat detail (redeemable-date flip, second coin,
  bill-slide, date-slide/yield-meter on "Extend," curve-axis ghost, Arc label drift, USDC/USYC mini
  diagram), carried forward verbatim.
- Spoken (v5 "A dollar with a date" + "The vault," unchanged, same shot per v1's grouping): *"Every
  Cascade dollar is one dollar, redeemable on a calendar date. Same date, same dollar — one dollar,
  one date, completely interchangeable. An earlier dollar pays any later bill at face. No pricing, no
  negotiation, no credit check. Extend, and the date moves forward. You've handed the vault sixty more
  days of your capital, so you earn the vault's yield for exactly those sixty days. Moving the date
  earlier? That one needs a market."* Then, same shot: *"The vault lives on Arc. It holds USDC and is
  built to hold USYC — Circle's tokenized money market fund — as its yield source."*
- CAMERA: Continuous slow drift for the full 53s: start 34,-118,2.35 (carried from scene 9), drifting
  to 34.6,135.5 (Osaka) by scene end, riding the Tesla-proof arc-fire schedule at t=8/20/32/44,
  altitude easing 2.35 → 1.65 → 1.6 (all identical to v1 scene 8's fix).
- DIRECTOR NOTES / APP NOTE: identical to v1 scene 8 — no v2/v2.1 changes to this scene beyond
  timecode. Note for the implementer: this scene's "that one needs a market" clause plants the
  curve-axis ghost element that scene 12 now actually pays off (v1 and v2 both left this as an
  unresolved promise — see §2).

### Scene 11 — The treasury decision (v2.1: restored)
- Timecode: 2:01–2:07 (6s)
- Spoken (v5 "The treasury decision," restored — v2 flagged this section as unplaced; closed here per
  the coordinator's placement): *"Now you're the treasurer. Your money arrives in thirty days. Your
  supplier will accept ninety. So who gets those sixty days of yield?"*
- SCENE: The coin view carries straight over from scene 10, reframing into second person — per the
  coordinator's framing, this is the Extend mechanic staged on the coin view. Per-clause coin states:
  a thirty-day dollar appears on "arrives in thirty days"; a ninety-day bill appears beside it,
  separated by a visible gap, on "accept ninety"; the gap itself highlights on "so who gets those
  sixty days of yield" — the same per-clause animation discipline scene 10 already uses, extended
  with three new states rather than a new visual language.
- CAMERA: **IDLE DRIFT** (§0.2 item 9) only, per the coordinator's instruction that the globe keeps
  rotating under the overlays — altitude held at 1.6, lng drifting from 135.5 toward ~138 over the 6s
  at the standing ~0.4°/s idle rate. No establishing move; the coin illustration carries the beat.
- DIRECTOR NOTES: Do not let the idle drift exceed its standing rate — this scene's whole job is to
  keep the picture from going static while the coin does the work; a faster drift would compete with
  the two-date illustration for attention.
- APP NOTE: Extends the existing coin-view overlay machinery in `ShotOverlays.tsx` (the same
  per-clause pattern shot 6/scene 10 already uses for its redeemable-date flip, second-coin, and
  bill-slide beats) with three new states keyed to this scene's own `engine.after()` timings. New
  shot id needed (working id `6b-treasury`) since this is a distinct v5 narration block, not an
  extension of shot 6's existing 53s payload.

### Scene 12 — Extend it. (the yield curve) (v2.1: restored)
- Timecode: 2:07–2:12 (5s)
- Spoken (v5 "Extend it.," restored — v2 flagged this section as unplaced; closed here per the
  coordinator's placement): *"Extend it."*
- SCENE: On the line's first word, scene 11's coin gap collapses — the yield-illustration's fill bar
  becomes the yield curve's y-axis (the match cut that pays off the curve-axis ghost element planted
  in scene 10's "that one needs a market" clause, which v1 and v2 both left as an open promise — see
  §2). The yield curve then draws live over the remaining ~4s: axes appear, then the curve's five
  tenor points (7/30/60/90/180 days, per storyboard-v2 §1 shot 7's existing spec) sketch in sequence,
  silent after the two-word line finishes.
- CAMERA: **EASED MOVE — cubic**, 34.6,138,1.6 → 30,-145,2.3 over 5000ms — the globe keeps moving per
  the coordinator's instruction as the yield-curve overlay deploys; this move also does double duty as
  the first leg of the pull-out scene 13 (the vault) needs, so scene 13 opens already at the wide
  altitude it requires.
- DIRECTOR NOTES: The fill-bar-to-axis match cut must land at the same screen position and orientation
  the curve's y-axis begins at — storyboard-v2's original shot 6→7 match-cut note applies verbatim.
  Do not let the simultaneous camera move upstage the cut; the cut is the point, the camera move is
  connective tissue into scene 13, not competing content.
- APP NOTE: This re-activates **`shots.ts` id 7**, the dormant yield-curve shot flagged in v1/v2 as
  unused because v5's script (as read at the time) had no standalone yield-curve narration — with
  "Extend it." now placed here, id 7 fires on that two-word cue instead of storyboard-v2's original,
  longer "Once dated dollars trade, Cascade publishes the price of commercial time..." narration
  (that longer line is not in v5 and stays cut). Keep id 7's existing five-point draw-on logic and its
  "leave unsupported tenors empty" rule (storyboard-v2 §1 shot 7) unchanged; only the trigger cue and
  the preceding camera state change.

### Scene 13 — The vault under pressure
- Timecode: 2:12–2:27 (15s) — identical content to v1 scene 9/v2 scene 11; camera start point updated
  because scenes 11–12 now cover the first leg of this scene's pull-out.
- Spoken (v5 "Under pressure," unchanged): *"Now put the vault under pressure. This is the part the
  engineers came for. Maturity day. Thousands of holders extending, withdrawing and selling at once.
  Watch the backing fall."*
- CAMERA: Eased drift east, continuing from scene 12's arrival point: 30,-145,2.3 → 25,-80,2.3 over
  15s. (v1/v2 had this scene do the whole pull-out from Osaka; v2.1 moves that first leg into scene
  12, so this scene now covers only the remaining eastward drift — same destination, shorter
  approach.)
- DIRECTOR NOTES: unchanged from v1/v2 — the balance-sheet dip/recovery carries this shot; don't let
  the camera drift upstage the data.
- APP NOTE: `shots.ts` id 9's `fly()` start value updates from (25,-145,2.3) to (30,-145,2.3) to match
  scene 12's new arrival point; everything else (the 15s drift to 25,-80,2.3) unchanged from v1/v2.

### Scene 14 — The rules (conservation laws)
- Timecode: 2:27–2:47 (20s) — identical to v1 scene 10/v2 scene 12, timecode shifted.
- Spoken (v5 "The rules," unchanged): *"A loss hits the reserve first, then the day's income — never
  principal. Every dollar of vault income has exactly one owner. And no two yield intervals on the
  same principal ever overlap. Ten thousand operations. Zero violations."* (Subject to the standing
  rule: report the actual live checkpoint result.)
- CAMERA: Continuous slow drift, 25,-80,2.3 → 30,-70,2.3 over 20s, dimmed-but-visible globe, unchanged
  from v1/v2.
- DIRECTOR NOTES / APP NOTE: unchanged from v1/v2.

### Scene 15 — The reframe
- Timecode: 2:47–3:02 (15s) — identical to v1 scene 11/v2 scene 13, timecode shifted.
- Spoken (v5 "The reframe," unchanged): *"Now zoom all the way out. Eight hundred forty-six trillion
  dollars of derivatives. Every one of those contracts is a contract about money and time. Cascade
  makes time a property of money. So every one of them becomes a composition of dated dollars."*
- CAMERA: Two-part eased move to Fifth Avenue then pull-back, unchanged from v1/v2: 30,-70,2.3 →
  40.7638,-73.9730,0.05 over ~5800ms, then pull back to 30,-65,2.6 over 6000ms.
- DIRECTOR NOTES / APP NOTE: unchanged from v1/v2, including the legibility fix for the $846T card.

### Scene 16 — The composable diagram
- Timecode: 3:02–3:10 (8s) — identical to v1 scene 12/v2 scene 14, timecode shifted.
- Spoken: none newly added — tail of scene 15's clause plays over the diagram's assembly.
- CAMERA: Slow continuous push-in, altitude 0.05 → 0.02, unchanged from v1/v2.
- DIRECTOR NOTES / APP NOTE: unchanged from v1/v2.

### Scene 17 — Close
- Timecode: 3:10–3:16 (6s) — identical to v1 scene 13/v2 scene 15, timecode shifted.
- Spoken (v5 "Close," unchanged): *"Cascade. Dated dollars on Arc. Money that pays bills before it
  becomes cash — settled."*
- CAMERA: Continued push-in from scene 16, beginning to feel like a descent, unchanged from v1/v2.
- DIRECTOR NOTES / APP NOTE: unchanged from v1/v2.

### Scene 18 — The descent
- Timecode: 3:16–3:30 (14s) — identical to v1 scene 14/v2 scene 16, timecode shifted, camera primitive
  named explicitly per §0.2.
- Spoken (v5 "The descent," unchanged): *"Down, into the vault beneath the store."*
- SCENE: Camera descends through the Fifth Avenue glass cube and spirals down a glass stair helix into
  an underground hall, unchanged from v1's model description.
- CAMERA: **EASED MOVE — custom bezier**, ~13000ms, front-loaded fast (through the cube glass, first
  ~4s) then slowing sharply into the spiral for the remaining ~9–10s so the helix geometry reads
  clearly.
- DIRECTOR NOTES / APP NOTE: unchanged from v1/v2, including the flagged highest-technical-risk note
  about whether this lives in the same scene graph as the globe.

### Scene 19 — The line
- Timecode: 3:30–3:38 (8s) — identical to v1 scene 15/v2 scene 17, timecode shifted, exposure ramp
  named as the WHITE FLASH + FADE primitive per §0.2.
- Spoken (v5 "The line," locked per Decisions): *"Global supply chains. Settled."*
- CAMERA: **WHITE FLASH + FADE** — `flashToWhite` ramping over the first ~3s, held white ~3s while the
  line is legible, text fades over the last ~2s. Sanctioned camera-is-moot exception per §0.1.
- DIRECTOR NOTES / APP NOTE: unchanged from v1/v2.

### Scene 20 — Cascade Money / the tag
- Timecode: 3:38–3:56 (18s: 6s wordmark, 6s tag, 6s held-then-fade-black) — identical to v1 scene
  16/v2 scene 18 in content, timecode adjusted to land the film at 3:56.
- Spoken (v5 "Cascade Money" + "The tag," locked per Decisions): *"Cascade Money."* then *"Money with
  a date."*
- SCENE: Wordmark fades in on white, product line fades in underneath, holds, fades to black. Must
  read as a sibling of scene 1's clean, specific, unhurried open — v2 already strengthened this via
  scene 4's title card; v2.1 makes no further change here.
- DIRECTOR NOTES / APP NOTE: unchanged from v1/v2.

---

## 2. Match cuts, named explicitly

- **Scene 2, spline-into-pull-out**: the rainbow-arch spline's final keyframe (dead-center over Apple
  Park, altitude 0.00005) is the exact starting point of the snap-and-pull-out call — no gap, no
  re-approach.
- **Scene 3→4, the white flash**: the flash's last white frame and the fade-back's first white frame
  are the same exposure value; the fade-back resolves to the identical lat/lng/altitude scene 3 held
  before flashing, so the "cut" through white is provably continuous, not a disguised scene change.
- **Scene 7, "commits"**: unchanged from v1 — the Cupertino→Asan arc fires on "commits," now riding
  the custom-bezier approach move rather than a plain cubic one, landing in the same frame.
- **Scene 8's fission beat**: the Corning→silica and silica→freight arcs fire close enough in time and
  screen position, with the camera already settled over Kentucky, that the second hop reads as a
  direct continuation of the first rather than a new event — this is the "reaction" the fission
  framing describes, achieved entirely through timing and camera settle, not a new visual primitive.
- **Scene 9→10 loop-closure**: the year sweep's final position (~34,-118) and scene 10's opening
  position are the same point — the westward rotation and the coin scene's own continuity both land
  on this one frame simultaneously, which is why the ~4° shortfall from a mathematically exact 360°
  (see §0.3) is treated as a feature, not an error to correct.
- **Scene 11→12, "Extend it." resolving scene 10's ghost (v2.1, new)**: scene 10's "that one needs a
  market" clause plants a faint curve-axis ghost at frame edge; scene 11's coin-gap illustration
  carries it forward; scene 12's fill-bar-becomes-y-axis cut is its payoff — this closes the exact
  loose thread v1's §2 and v2's §2 both flagged as unresolved ("if a later pass reintroduces a
  yield-curve shot, this ghost element is its natural match-cut seed"). It is now reintroduced, and
  the seed is now paid off.
- **Scene 16→17, diagram assembly**: the diagram's final box (Discount window) finishes appearing
  exactly as scene 16's camera settles at 40.7638,-73.9730,0.02 — box completion and camera settlement
  land in the same frame. (Corrects a stale cross-reference in v2's first draft, which cited this cut
  under v1's old scene numbers 11→12 without updating them — see the v2.1 changelog.)
- **Scene 17→18, the "+$" callback**: the last floating dollar amount at store level (the phone sale
  itself) fades exactly as the camera passes through the cube's glass into the descent — a visual
  bookend to scene 1's Apple Park orbit. (Same correction as above — this was mislabeled 13→14 in
  v2's first draft.)

---

## 3. Coverage check — every v5 section, once, by scene number

| v5 section | Scene(s) |
|---|---|
| Monday | 1–2 |
| Rewind | 3 |
| The catch | 5 |
| The question | 6 |
| The first payment | 7 |
| The cascade | 8 |
| The year | 9 |
| A dollar with a date | 10 |
| The vault | 10 (same shot as "A dollar with a date," per v1's grouping) |
| The treasury decision | 11 |
| Extend it | 12 |
| Under pressure | 13 |
| The rules | 14 |
| The reframe | 15 |
| Close | 17 |
| The descent | 18 |
| The line | 19 |
| Cascade Money | 20 |
| The tag | 20 (same white field as "Cascade Money") |

All 19 spoken sections in `script-v5-listening.md` are accounted for exactly once above.

---

## 4. Changelog

### v1 → v2 (two-pass)

**Pass 1 (built the opening and the rotation against the product owner's two new sections).** Read
storyboard-v2.md's "Opening choreography" and "Ending addendum" in full. Confirmed the ending
addendum was already fully incorporated into v1 — no v2 work needed on the ending beyond
re-confirming it against the rules in pass 2. Built the new opening (orbit → spline swoop →
snap-and-pull-out → time-lapse rewind → white flash → title card) as four new scenes, and rebuilt the
first-half heading plan as one continuous westward rotation carrying the display-chain fires
(Cupertino → Asan → Harrodsburg) and settling into the year scene's loop-closing global sweep. In
doing this, re-read `script-v5-listening.md` in full and found v1 had **silently dropped the "Rewind"
section** — restored as scene 3. Also noted but did **not** fix within that pass's scope: v5
additionally contains a "The treasury decision" section and an "Extend it." section that neither v1
nor the v2 draft placed anywhere — flagged honestly as an open gap rather than papered over.

**Pass 2 (checked against the six standing rules).** Re-read every scene against: never static, no
cuts, hemisphere-facing-camera, 360p legibility, composable-reveal-per-line, ending-per-addendum.
Found and fixed three issues: (1) the title-card scene had no camera direction at all — fixed with
explicit idle-drift resumption; (2) the cascade scene's rotation was wrongly described as
constant-rate across its full travel — reworded to credit the existing per-beat centroid `fly()`
logic with the necessary slow-down at Kentucky; (3) confirmed the ending addendum's requirements
clause-by-clause against v1's carried-forward ending — no further changes needed there.

### v2 → v2.1 (coverage gap closed)

Placed "The treasury decision" and "Extend it." as two new scenes (11–12), between the coin/
dollar-with-a-date beat (scene 10) and the vault-under-pressure beat (now scene 13), per the
coordinator's explicit sequencing instruction — this places them out of `script-v5-listening.md`'s
own textual order (there they precede "A dollar with a date"), a deliberate directing choice, not an
oversight: the treasurer's question and its "Extend it." answer land more naturally as a second look
at the coin mechanic just established, and "Extend it." now has a real visual payoff (the dormant
yield-curve shot) to fire into. Scene 11 stages the treasury decision on the coin view with three new
per-clause states (thirty-day dollar / ninety-day bill / gap-highlight), globe on idle drift only, per
the coordinator's instruction that the globe keeps rotating under the overlays. Scene 12 re-activates
`shots.ts` id 7 (the yield-curve shot, dormant since v1 because v5's script, as read at the time, had
no standalone yield-curve narration) on the "Extend it." cue, resolving the curve-axis ghost element
scene 10 plants and both v1's and v2's own changelogs flagged as an unresolved promise — see the new
match-cut entry in §2. Renumbered every downstream scene (old 11→13 through old 18→20) and rebuilt
§0.3's heading-plan table, §0.7's continuity table, and every affected scene's timecode and camera
start point (scene 13's vault pull-out now starts from scene 12's arrival point, 30,-145,2.3, rather
than redoing the full pull-out itself). While rebuilding the continuity table, also found and fixed a
pre-existing bug in v2's §2 (match cuts): two entries ("diagram assembly" and the "+$" callback") had
been carried over citing v1's old scene numbers (11→12, 13→14) without updating them to v2's own
renumbered scenes — corrected to 16→17 and 17→18 respectively, now that this pass required touching
every scene number anyway. Added §3 (the coverage check table) and this changelog section, replacing
v2's standalone §3. Total runtime moves from 3:45 to **3:56** (11s added: 6s for the treasury decision
plus 5s for "Extend it."), still inside the 3:45–4:00 target range.
