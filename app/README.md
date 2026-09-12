# Cascade globe

Vite + React + TypeScript, with a baked NDJSON run and globe.gl. This checkpoint
implements the globe, playback controls, ledger/chart/counters, and shots 1–5.

## Run

From the repository root, once package-registry access is available:

```sh
pnpm --dir app install
pnpm --dir app dev
pnpm --dir app test
pnpm --dir app build
pnpm --dir app preview
```

The dev and preview launchers resolve `cascade-dev-web` through `port-for`.
The first launch initializes `app/.world/ports.lock` using its declaration.
The host port registry must be writable. No system packages are required.

The build copies `../events.ndjson` into public/ and emits static files to dist/.
Keep the root stream available at build time. The UI uses a relative Vite base
and loads its worker, textures and event stream locally.

## Recording and checks

- Shift+D: director panel with shots 1–5.
- Space: play/pause. Escape: exit shot and recording mode.
- R: recording mode (cursor and optional header controls hidden).
- `?shot=1` … `?shot=5`: start a shot directly.
- `?inspect=1`: opt-in browser diagnostics, with no visible debug panel.
- Replay button: replay the selected day's actual events.

At 1920×1080, run the headless check against the URL printed by preview:

```sh
pnpm --dir app check:browser <preview-url>
```

It uses installed Chrome, checks real arc geometry retention and shader alpha,
and writes screenshots and results into `app/artifacts/`. SwiftShader provides
a headless functional check; laptop-GPU performance still needs a recording
rehearsal. See DECISIONS.md for current dependency/build blockers.

## Next checkpoint

Step 5: shared dimmed-globe overlay host; dated coin and yield meter; trade-backed
yield curve; conservation card; vault balance sheet and invariant lights;
derivatives zoom-out; architecture diagram with SVG/PNG exports; close card.

Step 6: after overlays, complete the static release validation at root and
subpath, finalize the dependency lockfile, verify links/assets, and rehearse
all twelve shots at 1080p against the completed version 2 run.
