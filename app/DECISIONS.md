# Cascade globe implementation decisions

## Scope at this checkpoint

Build order steps 1–4 only: loader/index, globe layers, controls, director shots 1–5.
Shots 6–12, architecture exports, close-card links, and final static release checks
remain for the next checkpoint. No commits are made by the agent.

## Dependencies and verification status

Node 24.13.1 and pnpm 10.29.3 are present. All direct package versions are exact
in package.json. globe.gl 2.46.2 is the selected candidate; Three.js 0.183.2 is
also enforced with a pnpm override to avoid competing Three.js instances.

**The candidate has not yet passed the browser opacity/geometry check.** The
current shell cannot resolve or connect to the npm registry. globe.gl and three
are absent from the available pnpm cache and local installations. The normal
pnpm store is read-only in this session. No lockfile can be generated until the
dependencies can be resolved; no dependency contents or lock entries are faked.

The check in scripts/check-browser.mjs compares actual geometry UUIDs before
and after alpha updates and verifies the RGBA vertex attribute. If 2.46.2 fails,
test adjacent published releases, pin the nearest passing version, and record
the selected version and browser output here. Do not call the version verified
based on source inspection alone.

## Data and time

- events.ndjson is copied byte-for-byte from the root during prepare:data. The
  simulator is never invoked or overwritten by the app.
- A worker streams UTF-8 chunks and indexes events by day and authoritative seq.
- Both schema 1 and 2 are accepted. V2 summary aliases in adapters.ts are
  provisional until the core publishes the exact wire contract. Only explicit
  cents fields are accepted, and summaries must reconcile with operations.
- New fields enrich firm locations, invoice detail, dates and story markers.
  Missing v2 events are not synthesized. V1 activity stays entirely on day 0.
- JSON.parse reviver source context preserves unsafe integer tokens as bigint.
  Browsers without lossless token access reject unsafe values instead of
  rounding them. Calendar labels use UTC date-only arithmetic to avoid host TZ
  drift; no wall-clock event times appear in the UI.
- Settled = successful Issue + Pay. Committed = cumulative Issue deposits.
  Transfer, registration and rejected operations do not inflate those counters.
- 1x = one day/second. The year setting advances 365 day buckets in 15 seconds.
  React updates at about 30 Hz; globe/HTML transforms update independently.

## Presentation and globe

- The five v1 firms use an explicit location lookup. Clearview Glass has a
  presentation location in Cleveland; v2 coordinates supersede the lookup.
- Local earth.svg contains authored, simplified continent contours. It is
  presentation artwork, not a geospatial boundary dataset. No external tiles,
  geocoding, font service, CDN, or satellite asset is required at runtime.
- Apple Park uses an authored SVG ring on a tessellated, curved surface patch
  registered at 37.3349 N, 122.009 W. The close camera has a suitably small near
  plane; points/labels hide at campus scale. Imagery can replace the same decal.
- Static points are merged. Named labels are prioritized by activity and anchor
  role, filtered for horizon/viewport visibility and screen-space collisions.
- At most 200 live arcs, including retiring arcs. Admission begins retiring old
  arcs at 160 and evicts oldest at 200. Each day change and scrub clears the pool.
- RGBA fade updates use stable arc objects and endpoints. The shader/geometry
  behavior must be checked on the installed release before recording.
- Amounts use a pooled HTML layer, screen projection, camera/sphere occlusion,
  overlap filtering, 100 ms fade-in and 30 px/second upward drift. Scripted
  annotations have priority and also remain in the virtualized daily ledger.
- Camera flights interpolate geographic coordinates with smoothstep and use
  pointOfView(..., 0) each frame. The app owns flight time so pause and shot
  cancellation do not finish an old library tween or jump forward on resume.
- Counters and story hops always come from the stream. The v1 proof shows the
  first two settlements; its remaining two payments bring the cascade to 4x.
  The script's $56 billion figure is a shot-2 narrative card, never a metric.

## Director and ports

Shift+D opens the director, Space pauses, Escape exits a shot, R toggles recording.
Shots 1–5 can be started independently. ?shot=1 through ?shot=5 are recording
entry points; ?inspect=1 exposes browser-only diagnostics without surface labels.
Tesla selection activates when its firms exist. V1 does not invent a Tesla run.

app/.world/ports.yml declares cascade-dev-web. The dev/preview launcher uses
port-for, initializing the app-local allocation when needed. Port registration
requires access to the host registry; this restricted session cannot modify it.

## Checks

`pnpm test` covers streaming, UTF-8 boundaries, exact integers, unsupported data,
summary reconciliation, accounting, backward seeks, the 15-second year at multiple
frame rates, shot endpoints/cancellation, and cap/fade behavior. Synthetic records
are confined to tests; public/events.ndjson remains the unchanged root sample.

The requested `pnpm --dir app build` was attempted: prepare:data succeeds with
10 events; the build stops because project dependencies (including tsc) cannot
be installed in this session. A supplemental check with cached TypeScript and
React declarations finds only missing globe.gl/three modules, not other source
type errors. Full typechecking and rendering remain unverified.
