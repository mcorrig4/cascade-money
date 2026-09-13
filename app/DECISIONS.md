# Cascade app decisions

## Completed scope and dependencies

Steps 1–6 are implemented, including all twelve shots and the static build.
No commits or installations were made in this continuation. Dependencies and the
externally supplied lockfile remain unchanged: globe.gl 2.46.2, Three.js 0.183.2,
React 19.2.4, Vite 7.3.6, TypeScript 5.9.3. Node 24.13.1 and pnpm 10.29.3 are present.

The installed release passes TypeScript and the production build. Source inspection
shows RGBA vertex attributes and geometry rebuilds only when arc geometry inputs
change. **Runtime opacity/geometry validation remains unverified**: installed
Chrome 151 exits in this sandbox with a forbidden socket operation (SIGTRAP).
Run `pnpm --dir app check:browser --static` outside it. No evidence currently
justifies changing the pinned release. If the runtime check fails, test adjacent
releases outside the sandbox and record the nearest passing pin here.

## Data contracts and metrics

The worker incrementally parses NDJSON, retains exact integer cents as bigint,
and indexes immutable event references by day and sequence. V1 uses the five-firm
presentation lookup; v2 coordinates always take precedence. Sites, line items,
annotations, ISO dates, story markers and the published nested v2 day summaries
are adapted without modifying the stream. Daily and cumulative commitments are
separate and every summary reconciles against operations. Transfers and rejected
operations cannot increase settled or committed counters.

Root `events.ndjson` is copied without edits. The current ten-event fixture now
has schema 2 enrichment but retains the legacy five-firm proof. That fallback
continues to display its actual payments. Shot 3's camera goes to Asan; once
Samsung Display is present, the proof follows Apple → Samsung Display → Corning
→ silica → freight using the stream's invoice payments and coordinates. Shots
3–4 focus their counters on that chain; the year shows aggregate totals.

Story markers associate with the preceding same-day payment using camera_accounts
(the core emits the marker after settlement). Curve points use face-weighted
executed sell prices at exact remaining tenors 7/30/60/90/180, through the selected
sequence; missing tenors stay empty. No interpolated trades are created.

The dated coin is a narrative diagram (day 30→90 absent an extension). Its numeric
yield comes only from an actual extension's inclusive interval and the published
index difference. Missing cutoffs show a dash. Claimable yield is a subset of
accrued yield, not another liability. Hard-check true means passing; breach true
means active. Vault states carry forward across days without importing future data.

## Rendering and presentation

NASA day/night textures replace the authored continent SVG. A custom globe
shader blends night lights using the sun dot product and a soft terminator. A
fixed presentation sun longitude and seasonal declination are deterministic by
day, independent of the host clock. There is no added cloud layer. A thin Fresnel
shell, 320 dim stars and half-resolution selective bloom through globe.gl's
composer add depth. Only arcs enter the bloom pass; the Earth masks occluded
arcs. Idle rotation starts after six seconds without interaction and stops for
shots/playback/recording, except the scripted derivatives pullback.

Apple Park is a curved surface SVG decal. Fifth Avenue is a geographically
registered 12 m glass cube and plaza, with a close camera followed by the shot-10
zoom-out. Campus scale hides labels, points, atmosphere and bloom. Globe layers
use at most 200 arcs, with retirement starting at 160, capped HTML amounts,
horizon/collision filtering, merged points and stable arc geometry inputs.
Color updates pause with playback. The app owns geographic camera interpolation
via pointOfView so pausing and cancelling shots also stops camera motion.

The architecture SVG shows the verified USDC vault path and external discount
window. No unverified deployed USYC integration is represented. The close card
links to the current app origin/base by default, the project repository, and the
verified Arc testnet contract. Team names and public app URL are build settings.
The NASA credit appears in the close card and README.

## Validation and release limits

Unit tests cover both schemas, exact money, streaming, daily/cumulative summaries,
proof counters, Asan, inclusive yield intervals, future-trade exclusion, invariant
semantics, independent overlays, cancellation and pause, 15-second playback at
20/30/60/144 fps, and the arc cap/fade. Build emits relative URLs and local assets.
The large globe chunk produces Vite's standard 500 kB advisory; it is required
for the full-page 3D scene and has not been hidden by increasing the threshold.

Dev/preview use the port-for skill and app/.world/ports.yml. The agent sandbox
cannot write the host port registry. Browser checks support intercepted static
hosting to avoid a server dependency, but Chrome still needs an unrestricted
launch environment. GPU performance, label placement and visual acceptance
require the README rehearsal on a real laptop. No runtime screenshot is claimed.

A read-only adapter check also consumed 198,166 events, 2,004 firms and 315 daily
summaries from the concurrently generated `artifacts/apple-365.ndjson`, with no
summary reconciliation errors. The file was still growing; this was a partial
snapshot check, not validation of a completed year or its browser memory budget.
The baked root fixture was not replaced.

## Phone, geographic alignment and initial loading

This checkpoint adds captured rotate/pinch gestures, explicit zoom limits, a fixed
non-scrolling viewport, safe-area-only Telegram integration, a phone ledger sheet,
stacked timeline/counters and a cancellable logo long-press director shortcut.
User interaction cancels a scripted flight instead of leaving OrbitControls locked.
No Telegram SDK, analytics or theme palette is loaded. Feature detection supports
ordinary browser tabs as well as Mini Apps; host-native navigation still needs
real-device acceptance.

The NASA atlas was visually inspected and the installed three-globe rotation
checked: its −π/2 Y rotation maps the -180° atlas seam correctly. CPU raycasts pass
for all five requested sites. Browser diagnostics raycast the real scene and save
North America/East Asia frames; the sandbox continues to block Chrome's socket
initialization, so these are not reported as rendered. Named secondary sites use
v2 coordinates without altering the event index or firm's payment endpoints.

The existing manual globe chunk now sits behind React.lazy/Suspense. The initial
HTML has no globe preload. Day imagery loads at 4K after the shell paint, then
upgrades after another paint/idle period if maxTextureSize permits 5400. Night
imagery is a deferred 4K derivative: the original is 13500×6750, too expensive to
upload routinely on a phone. Old fallback textures and pending callbacks are
released on upgrade/unmount. No dependency or lockfile changes.

## Directional arc lifecycle and depth repair

Globe.gl still creates and owns each tube geometry. A per-tube ShaderMaterial
provides independent clipStart/clipEnd, alpha and kilometre phase uniforms. The
installed library's reversed relDistance attribute is converted to payer=0,
payee=1. Ground distances are calculated once from normalized tube-ring centers,
so dash spacing is physical ground distance, independent of route length and
arc elevation. Only uniforms change during animation; material/geometry identity
is retained. Lifetimes are 1.8 s normally, 3.5 s for proof shots, minimum 320 ms
at high speed. Forward day boundaries no longer prematurely destroy animations;
explicit seeks reset them. The pool remains capped at 200, including retirees.

The tiny near plane needed by the Apple Park and Fifth Avenue cameras made
conventional depth imprecise at globe scale. Logarithmic depth is now explicit
on the renderer and included in Earth, atmosphere and arc shaders. Arc fragments
also perform analytic sphere occlusion, including in the bloom pass. The planet
writes depth, the transparent atmosphere/arcs do not, and their render ordering
is explicit. Atmosphere/park are excluded from selective bloom. These changes
address identified causes; GPU flicker/depth acceptance is not claimed without
an outside-sandbox browser run.

Sun motion follows fractional simulation time, 360 degrees per 30 days, with
smooth catch-up bounded by the maximum preset rate and a 50 ms frame budget.
Close-up holds and backward seeks reset pending catch-up rather than flashing
through skipped time. No fixed -150-degree sun remains except its starting phase.

All 23 requested companies use embedded SVG monograms and brand-color tables;
Simple Icons was absent from installed modules and local pnpm store indexes.
HTML labels replace canvas label textures and preserve display-resolution text.
Apple Park's brighter 2048 SVG and non-tonemapped decal use the exact existing
shot-1 camera. The first-paint lazy boundary, progressive textures, phone layout,
Telegram initialization and gesture capture remain intact.

Legacy accounting tests now use a frozen v1 test fixture instead of depending on
the parallel core lane's changing root sample (which now has the display chain).
Synthetic legacy fixture data stays under tests; the app still bakes the root
stream byte-for-byte. Unit checks cover clip direction, fixed ground distances,
amount bursts, stable shader geometry, sun rate/holds, all monogram entries, and
existing accounting/playback/mobile behavior. Browser checks have been extended
but remain blocked by Chrome's forbidden socket operation in this sandbox.

## Stage 11 — shooting script v2.1

The 20 scenes follow the shooting script's explicit timecodes (236 seconds). Stable
numeric shot IDs remain distinct from film scene numbers; scenes 1/2 retain IDs
1/2, new opening beats use 13–16, treasury uses 17, and descent/line use 19/20.
Existing proof/cascade/year/coin/curve/vault/laws/reframe/composable IDs remain intact.
The last wordmark retains the old close-card ID 12; the spoken Close is ID 18.

Two source conflicts are resolved explicitly. Scene 15's camera block ends at wide
Earth but its continuity table requires the store: its final 3.2 seconds return
continuously toward the store. The close uses the current v5 "Money with a date."
wording rather than the retired phrase quoted in the shooting script. The title
and location label move to scene 4, the first caption permitted by the opening.

The Apple Park orbit uses globe-relative radii converted to meters. For the arch,
the other lane's existing appleParkShotCamera supplies calibrated entry/exit
points to the spline: the shooting script's rough .0006/.00005 altitudes would
otherwise pass kilometres/hundreds of metres above the physical arch. No edits
were made to site-math.ts, site-scene.ts, tiles-policy.ts or GLBs. The current
store camera remains supplied by siteCamera; interior descent is deliberately a
subsurfaceInteriorCameraHook, with an above-ground approach and exposure fallback.

The documents contain no timestamped narration take. Coin clause cues are editable
at 0/6/12/18/24/31/38/44/49 seconds; diagram boxes at 0/1.5/3/4.5/6.5. They follow
clause order and the specified 53s/8s durations, without claiming audio alignment
that has not been measured. Unsupported curve tenors still have no invented price.
The background Tesla cues replay only actual events from the baked stream.

Rewind adds shutter-integrated day/night lighting, afterimage trails and a small
scene blur. The normal month-scale sun policy is unchanged outside that explicit
rewind. White transitions use renderer exposure plus a full-frame white overlay;
black bookends are separate overlays. All camera primitives are driven by exact
cue-boundary advancement, and camera moves start at the preceding live/sample pose.

## Stage 12 — narration v6

The 17-scene, 603-word narration supersedes the 20-scene v2.1 shooting table.
Provisional timings are word counts × 0.4 seconds + 1 second per scene (258.2
seconds total). The optional narration duration map retimes all cues and captures,
rather than changing only scene-end timers. Capture clock isolation is retained.

The baked proof currently branches at Corning ($60M to silica, $20M from silica
to freight). The product owner explicitly requested the straight-line narration:
$100M per hop, $400M settled, four companies. This is implemented as director
presentation metadata on the existing connected events, not mutations or
additional events in the index. The free explorer and year keep the actual
stream values. The requested $450M/eight-company alternative is an exported
constant. See SCENES.md for the mapping and optional narration JSON contract.


## Production UI and tiles — September 13, 2026

> 2026-09-13 00:41 EDT: Film shows the full app UI; recording mode keeps the HUD; hud:false is never used for film frames; the film wraps the app in a real browser window.

> 2026-09-13 00:54 EDT: tiles served on cascade.vellum.network too (key referrer-restricted to the domain + localhost); local-only gate retired.

The Earth readiness gate covers its day/night maps and a complete frame only. Site tiles refine over the GLB view and never block this gate or playback. The main globe renderer already enabled logarithmic depth before Stage 16; its setting is unchanged.
