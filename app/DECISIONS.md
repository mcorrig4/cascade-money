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
