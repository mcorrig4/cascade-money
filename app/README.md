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
under a directory mount **without a listening server**. If discovery needs help:

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
