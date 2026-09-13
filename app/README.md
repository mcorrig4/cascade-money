# Cascade globe

React, TypeScript, Vite and globe.gl. All twelve director shots are implemented.
The app loads one baked NDJSON run; all assets and workers ship in `dist/`.

## Open in a browser

Dependencies are already installed. From the repository root:

```sh
pnpm --dir app build
pnpm --dir app preview
```

Open the **Local URL printed by Vite** in Chrome. For editing, use
`pnpm --dir app dev` instead of preview. These launchers use `port-for` and the
`cascade-dev-web` declaration in `app/.world/ports.yml`; the first launch registers
the allocation. Run outside the restricted agent sandbox, where the host port
registry is writable. Do not run dev and preview simultaneously on that allocation.

No package installation, database, backend, API key or external asset service is
needed. `pnpm --dir app test` runs the unit tests.

## Static release

`build` copies the repository's `events.ndjson` byte-for-byte into `public/`, checks
TypeScript, then emits `app/dist/`. Publish the **contents** of `dist/` to a static
HTTP host. Relative asset URLs support a root or directory mount; directory URLs
must end with `/`. Serve `.js` as JavaScript and `.ndjson` as data. Use HTTP, not
`file://`, because the loader uses fetch and a worker. No SPA rewrite is required.

The supplied root fixture currently has ten events and the legacy five firms,
now enriched with v2 fields. It cannot show a full year of activity, Tesla,
discount trades or maturity stress. Rebuild after the core lane selects the full
run for `events.ndjson`. Do not manufacture additional events for recording.

Optional build-time settings in `app/.env.local`:

```dotenv
VITE_PUBLIC_APP_URL=https://your-host.example/cascade/
VITE_TEAM=Your team names
```

Without settings, the close card uses the current app URL and “Cascade team”.
Repository and verified Arc testnet contract links are in `ShotOverlays.tsx`.
The architecture image ships as `public/architecture.svg` and is downloadable
from shot 11. It depicts the verified USDC custody path and a separate discount
window; it does not claim that an undeployed yield adapter is live.

## Recording rehearsal

1. Set the Chrome **content viewport to 1920×1080**, zoom 100%, hardware acceleration
   enabled. Hide browser chrome in the capture and disable OS notifications.
   Wait for both Earth textures to finish loading before the first take.
2. Press **Shift+D** to open the director. All shots 1–12 can restart independently;
   append `?shot=6` (or any shot number) for a direct entry point. Select Apple or
   Tesla only when the corresponding events exist.
3. Select a shot, then press **R** to hide the director and cursor. **Shift+D** alone
   closes the director without entering recording mode. **Space** pauses/resumes;
   **Escape** cancels the shot and recording mode. Do not leave the tab while recording.
4. Check shot 1's Apple Park ring, shot 3's Cupertino-to-Asan flight, shot 4's
   invoice counters, and shot 10's Fifth Avenue glass cube before its Earth pullback.
   Legacy payments retain their actual counterparties; the new display chain
   activates when the core supplies Samsung Display and its downstream invoices.
5. Rehearse **shot 5**, or the **1 YEAR / 15 SEC** preset: September 9, 2025 through
   September 8, 2026 in exactly fifteen seconds. 1× means one simulated day/second;
   10× and 50× scale that rate. Check that the final day and counters hold.
6. Check every overlay at recording size. Shot 6 slides its date over the added
   interval; its numeric yield needs published index cutoffs. Shot 7 leaves
   unsupported tenors empty. Shot 9 reports actual checkpoint checks, including
   failures; no “zero violations” badge is invented for an absent stress run.
7. Capture at **30 fps** initially; aim for **60 fps** on a laptop GPU. Globe rendering
   uses requestAnimationFrame, UI playback updates around 30 Hz, arcs are capped
   at 200, and bloom renders at half resolution. These are targets, not measured
   GPU results. Use Chrome's frame statistics during the year run and watch for
   sustained frames above 33 ms (30 fps) or 16.7 ms (60 fps). Inspect the dense full
   run, label collisions, horizon clipping, amount readability and the terminator.
8. Finish on shot 12. Check app, repository and contract links and the NASA credit.
   The script's only supply-chain caption appears in shot 5.

## Browser checks and screenshots

After building, run outside the restricted sandbox:

```sh
pnpm --dir app check:browser --static
```

This uses installed Chrome and Playwright route interception to serve `dist/`
at the production root **without a listening server**. If discovery needs help:

```sh
CHROME_PATH=/usr/bin/google-chrome pnpm --dir app check:browser --static
```

Alternatively pass the preview URL: `pnpm --dir app check:browser <preview-url>`.
The check verifies actual arc vertex alpha and stable geometry UUIDs, shader
errors, the year endpoint, all overlays, director controls and close links.
It writes `app/artifacts/browser-check.json`, `globe-1920x1080.png`,
`apple-park-1920x1080.png`, `fifth-avenue-1920x1080.png`, and shot 6–12 screenshots.
SwiftShader checks functionality; it does not certify laptop-GPU frame rates.

The agent's attempt was blocked inside Chrome by `setsockopt: Operation not
permitted` (SIGTRAP), so no screenshots or browser-pass claim are included.

## Earth imagery

**Earth imagery: NASA**

Bundled Blue Marble (`earth-blue-marble-5400.jpg`) supplies the day surface;
Black Marble (`earth-night-3km.jpg`) supplies night lights, blended only onto
the dark side by the surface-normal/sun-direction dot product. No cloud layer
is added. A thin Fresnel atmosphere, sparse dim stars and selective arc bloom
complete the globe. Apple Park's ring remains a bundled stylized SVG decal.

## Phone and Telegram preview

At phone widths the ledger opens with **Transactions** above the stacked timeline
and counters. Hold the Cascade logo for **650 ms** to open the director; moving
your finger cancels the hold. A short tap still goes home. The director can also
exit recording mode on a phone. Its sheet and the ledger scroll internally;
the page itself never scrolls.

Drag the globe with one finger; pinch with two to zoom and rotate. Desktop wheel
and trackpad zoom remain available. Gestures take over from a scripted camera
flight. Altitude limits are 0.00001–4 globe radii above the surface, covering both
Apple Park and the whole Earth. Canvas touch listeners prevent browser defaults,
with touch-action and overscroll containment on the full-viewport surface.

When Telegram exposes `window.Telegram.WebApp`, startup calls ready, expand and
(disabling vertical swipes where supported). Safe-area changes update layout;
Cascade retains its dark colors. The [Telegram API](https://core.telegram.org/bots/webapps)
provides safe areas separately from theme colors. Ordinary in-app browser tabs
may expose no Mini App bridge; CSS/touch protections still apply. Native edge
navigation and pull-to-close need a final check inside the owner's Telegram app.

`pnpm --dir app check:browser --static` now covers 1920×1080 and 390×844, wheel,
pinch and two-axis drag, page scroll containment, the ledger, logo long-press,
and a mocked Telegram bridge. It also raycasts the actual Earth mesh at Cupertino,
Taiwan, Asan, Kentucky and Kolwezi and compares UV coordinates with the NASA atlas.
Additional outputs in `app/artifacts/`:

- `north-america-1920x1080.png` — Cupertino, altitude 1.2.
- `east-asia-1920x1080.png` — 30°N, 120°E, altitude 1.2.
- `globe-390x844.png`, `ledger-390x844.png`, `director-390x844.png`.

Chrome still exits on the agent sandbox's socket restriction; these frames are
written when the check runs outside it. The CPU geometry test passes all five
reference locations. The atlas already has −180° at its left seam; no compensating
rotation or mirror is applied. Named operational sites such as Glencore Kolwezi
also appear when v2 supplies them, without moving a firm's headquarters or payments.

The React shell no longer statically imports the 3D scene. Vite's manual globe
chunk is fetched through a lazy scene boundary, so the initial HTML does not
preload it. NASA Blue Marble first loads at 4096×2048, then upgrades to 5400×2700
after a painted frame and an idle callback. GPUs capped at 4096 retain the fallback.
Night lights use a deferred 4096×2048 derivative of the bundled 13500×6750 NASA
original, avoiding its large decode and GPU upload on phones. Both 4K assets are
geographically unchanged resizes made with the installed ffmpeg; no dependencies
were added. The source originals remain bundled.

## Payment animation and crisp company marks

Payment tubes now grow from payer to payee for the first 32% of their lifetime,
flow until 65%, then collapse into the payee while fading. The shader clips a
stable tube geometry; dashes use 90 km of ground distance and 60 km gaps, measured
along the curve's projection onto Earth. The pattern advances toward the payee.
At high speeds the complete lifecycle lasts at least 320 ms, so it spans several
frames and may finish across forward day boundaries. Scrubs clear the arc pool;
the 200-arc cap still includes retiring arcs.

Amounts and their annotations pop from 0.65× to 1.22×, settle, rise, then grow
slightly as they fade. All motion uses the pausable animation clock. Named firms
now use crisp HTML text beneath inline SVG monograms on dark haze discs. All 23
requested brands have an embedded palette; no Simple Icons package was available
locally, and no network lookup or new dependency was added. Labels are horizon-
and collision-filtered, capped at 32 on desktop and 10 on a phone. Canvas labels
are disabled. Sumco and Wacker are included when the stream supplies them.

Earth, atmosphere and arcs use consistent logarithmic depth. The transparent
atmosphere has a fixed render order and never writes depth; it is excluded from
bloom. Arc shaders also discard Earth-occluded fragments in both the normal and
bloom passes. This addresses the precision problems caused by the close camera's
very small near plane. Visual confirmation on the target GPU is still required.

The sun advances one revolution per 30 simulated days, continuously between UI
clock updates. Its maximum angular speed is the year preset's monthly rate,
with frame catch-up capped to avoid flashes after a stalled frame. Pausing and
director close-ups hold the sun; resuming does not jump to make up held time.
Night lights remain blended only onto the dark side.

Apple Park now has a 2048-pixel SVG with a bright double ring outline, contrasting
roof and green courtyard, and a baked subtle glow. The material preserves those
colors and uses the shared logarithmic depth path. The browser check asserts the
exact shot-1 pose (37.3349, -122.009, altitude 0.00022), waits for the decal, and
saves `apple-park-1920x1080.png`. It also saves grow/collapse frames and checks
clip uniforms, retained geometry and depth settings. Run outside the restricted
sandbox with `pnpm --dir app check:browser --static`; Chrome's socket initialization
continues to be blocked inside it. No new screenshot pass is claimed here.

To regenerate and bake the full year, run `pnpm --dir app bake` from the repository root. This invokes the Apple world for 365 days with seed 1, using `.venv/bin/python3` when present, and replaces root `events.ndjson`; coordinate with any core run already writing that file. Then run `pnpm --dir app build`.

The worker incrementally parses and indexes the stream, then hands off one day at a time, awaiting acknowledgement and releasing that day's references. The page reconstructs payment/story references without cloning the entire index. Scrubbing uses binary search over each day's event positions. Story markers select the proof payments; shot 4 groups generations and staggers sibling arcs by 220 ms, using actual payment amounts.

After baking real data, run `pnpm --dir app check:browser --static --real-data` (set `CHROME_PATH` if necessary). This requires schema 2, payments on every day 1–30, and at least four Apple proof hops within days 0–29; it checks current-day arcs and reports seek timings. The small version-1 fixture cannot pass this strict check. Plain `pnpm --dir app check:browser --static` remains the fixture-compatible visual regression check.

Site models live at `public/models/apple-park.glb` and `public/models/fifth-avenue.glb`. Export real meters with +Y up, +X east and −Z north; retain the site-center origin. Placement uses radius / 6,371,000, with no artistic scale correction. The glTF and Draco loaders are a separate lazy chunk; GLBs and local `public/draco/` decoders are requested only below altitude 0.002 within 0.15° of the corresponding site. Missing or invalid files retain the local fallback for the session. Successful models blend with camera altitude; retreat disposes geometry, materials, textures and instances. Draco workers are disposed after each decode. Return visits reload through the browser's HTTP cache.

Shot 1 uses a 608 m-high oblique campus camera with a gentle six-degree orbit and southwest sun at 32° elevation. Shot 10 approaches the cube from the southeast at 8 m above the site, 35 m from its center, with a two-second hold, with a 3° dusk sun, then returns to the globe. Both use the same sun vector for the Earth texture and directional model lighting, plus soft ambient. Run `pnpm --dir app check:browser --static` outside restricted sandboxes to capture `app/artifacts/shot1-apple-park.png` and `app/artifacts/shot10-cube.png`. The check requires bundled GLBs to decode, accepts fallbacks when files are absent, and checks model release after the pullback.

Model URLs include a SHA-256 content hash computed by Vite at build time, so replacing a GLB invalidates browser/CDN cache keys on the next deployment.

“On-chain” in the top bar and “Verify on Arc” on the close card open the Arc evidence panel. `pnpm --dir app prepare:onchain` generates `src/data/onchain.json` from the deployment manifest, the complete demo manifest referenced by the recorded report, and the contracts README. Build and dev run this automatically. Only public evidence is copied; no actor keys or environment secrets are read. The 16 run-2 receipts follow Apple → Samsung Display → Corning → Silica supplier → Freight carrier at vault [`0x4E7D5b438d38b93b811F7f847613100023d7DafE`](https://testnet.arcscan.app/address/0x4E7D5b438d38b93b811F7f847613100023d7DafE#code). The generator prefers the tracked `src/data/demo-run.json` fixture so clean checkouts reproduce the same evidence.

Opening the panel makes read-only JSON-RPC calls, with a 12-second timeout. It verifies the chain, recovers the two absolute date IDs from the recorded extension calldata, and reads USDC `balanceOf`, vault `totalSupply`, `supplyByDate`, and `uri(id)` for the current UTC day, +1, +30, and +90 at one block. The token section decodes the metadata `name`, shows the UTC rollover countdown, and draws the demo maturity ladder. The backing statement distinguishes the deployed USDC vault from the planned USYC yield reserve and local mock variant. Issue/pay/extend link to run-2 receipts; maturity and withdrawal link to the deployed source revision. All time presentation derives from the chain timestamp and the explicit playback `tMs`. Failure retains recorded balances. The recorded final deficit/principal check is always labeled separately from live balances. The Circle faucet link follows the [Arc connection documentation](https://docs.arc.io/integrate/connect-to-arc). `check:browser --static` exercises the recorded fallback and saves `artifacts/verify-on-arc-1920x1080.png` and `artifacts/verify-on-arc-panel.png`.

Recording controls: the landscape ledger uses a 54-design-pixel live row in the shared 1920×1080 coordinate space, with cursor-synchronous admission. Rewind removes rows as the playhead passes their posting times; film rows have no mount-time animation. Hover a row, focus it, or tap to inspect expanded cards; leave the ledger or choose “Resume log” to return. Dates in the log are source calendar dates and maturity IDs, not invented intraday timestamps.

Narration cues live in `src/director/shots.ts`: `COIN_BEATS` and `COMPOSABLE_BEATS` scale with the duration of each recorded scene. The coin scene advances the actual payment stream throughout its narration. Camera idle motion uses wall-clock time, continues under overlays and while paused, and yields to camera flights and touch/mouse gestures.

Run `pnpm --dir app check:browser --static --legibility` to render the HUD and overlay beats at 1920×1080 and downsample those frames to 640×360 and 426×240 in `app/artifacts/legibility/`, including a font/overflow audit JSON. This mode uses landscape layouts; portrait phone controls retain their bottom sheets. Review these captures before recording; software GL and the smallest output size still warrant a visual check. Public copy now reads “Money with a date.”; the close begins “global supply chains. settled.” above the Cascade Money wordmark.

Scene captions are location-only: Apple Park / Cupertino, California and Apple Store NYC / Fifth Avenue, New York City. `SCENE_TEXT_BEATS` controls the centered “September 9, 2025” flashback, supplier statistics and “Money plus time” reframe, with animated entrances and exits. See `SCENES.md` for current capture paths.

Ledger inspection latches on the persistent scroll area’s pointer entry/movement or touch press. The displayed transactions and day remain fixed during inspection while the globe continues playback; the selected transaction stays visible. Leave the panel with the mouse or select “Resume log” to catch up to the current playback cursor. Keyboard focus also inspects a row. The real-data browser check moves the pointer into the running log, advances across a day boundary, and checks that inspection remains stable.

Stage 12 follows Liam's final narration in 17 scenes. Open Shift+D (or long-press
the logo) and choose **Play full film**. The provisional cut is **4:18.2**:
603 words at 150 wpm plus one second per scene. The director displays scene numbers
01–17; URL `?shot=` and inspector APIs use stable IDs. Previous/Next follows scene
order. Space pauses narration/playback and the scripted camera. Free exploration retains its idle motion.
Escape cancels the film and clears exposure effects.

Optional recorded durations load from `public/narration/narration.json`, using
`{"durations":{"1":6.42,"2":15.8}}` (scene numbers and seconds). Missing scene
entries retain word-count timings. Every cue and capture retimes together.
See [SCENES.md](SCENES.md) for all durations, the straight-line presentation's
relationship to the branched baked run, and capture commands.

`pnpm --dir app check:browser --static --scenes` captures all 17 scenes at
1920×1080 and 640×360 under `app/artifacts/scenes/`; the full browser check
includes this pass. `--legibility` downscales 1920×1080 captures to 640×360 and 426×240 under
`app/artifacts/legibility/`. Manifests are produced only by a successful Chrome
run; old captures are not verification of the new cut. The existing site-camera
descent carries New York into the hall, which remains beneath the payment graph
and the closing exposure ramp.


Stage 16 startup waits for `await window.__cascade.ready()`: both Earth shader maps
(the selected 5400/4K day map and the night map) are decoded, uploaded, and rendered
through a complete frame with the final `#071019` background. No bump or cloud map
is sampled. Full-film and recording controls wait for this gate. Texture failure
rejects readiness and displays a retry message instead of releasing a partial scene.

Scene 3 rewinds exactly 2,000 ms, with backward date/time, reverse payment trails,
and ledger rows un-posting; its default date card starts at 2,250 ms after the flash.
All added visual motion is sampled from explicit playback time. Site camera floors
are local tangent planes: 12 m above exterior ground, including Apple Park's lifted
3.2 m floor. The Apple Park low pass is reframed to 29 m above its site origin.
The modeled Fifth Avenue hall keeps its descent with 1.5 m eye clearance above
its -6.45 m floor; only that loaded interior opens the base globe surface.

`window.__cascade.cue(name, value?, atMs?)` reveals at the current scene time, or
at an exact scene-relative millisecond timestamp supplied as the third argument.
Preload overrides after `playScene(id)` to suppress their authored default times;
starting another shot resets the cue overrides. Example:

```js
await window.__cascade.ready();
window.__cascade.playScene(13);
window.__cascade.cue('date-card', undefined, 5000);
window.__cascade.cue('company', 'Samsung Display');
```

Cue names are exported by `src/director/cues.ts`: `date-card`, `stat-suppliers`,
`stat-factories`, `stat-countries`, `stat-cost`, `system-recreated`, `payment-layer`,
`rows-in`, `dates-line`, `question-card`, `committed-counter`, `settled-counter`,
`companies-counter`, `tagline`, `coin`, `coin-date`, `coin-fungibility`, `coin-claim`,
`coin-extend`, `coin-yield`, `coin-return`, `backing-card`, `kicker`, `op-extensions`,
`op-transfers`, `op-redemptions`, `op-sales`, `law-ownership`, `law-yield`,
`word-loans`, `word-forwards`, `word-bonds`, `word-derivatives`, `money-plus-time`,
`final-line`, `promises`, `before-cash`, `close-line`, `wordmark`, and `company`.
The `company` value names a mapped firm with an official local logo. Narration
schedules Apple, Samsung Display, and Corning; explicit Foxconn/TSMC support remains.

After building, `node app/scripts/check-stage16.mjs` produces `app/artifacts/stage16-*.png`
proof frames, a 40-frame orbit burst, and 360p/240p downscales. Inspect all frames;
the burst's contact sheet alone cannot certify absence of flicker. This script and
all three standard browser modes require a host where Chrome can launch.

### Production site navigation

The Apple Park, Fifth Avenue, and Globe HUD buttons use three-second camera flights. Manual zoom shares the authored paths’ local ground clearance. The production build enables Google tiles and reads the ignored `.env.local` browser key. Tile readiness never blocks Earth readiness or playback; missing credentials and failed tile requests preserve the GLB-on-globe view. Google attribution remains visible over tile scenes. `pnpm build:no-tiles` builds and verifies an explicitly tile-free bundle.
