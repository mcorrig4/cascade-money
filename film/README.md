# Cascade film (Remotion)

CascadeFilm is defined in `src/Root.tsx`; its 17-scene schedule and duration
logic live in `src/compositions/schedule.ts` and `src/compositions/narration.ts`.

## Incremental drafts

Full renders are slow and this box doesn't render video at all (rendering
happens on dev-mac). To iterate on a handful of scenes without re-rendering
the whole film:

1. **`pnpm --dir film scene-frames`** — prints each scene's current frame
   range (`from`/`to`/`frames`/`seconds`) plus the film total, at 30fps. It
   imports the real `schedule.ts`/`narration.ts` functions, so the ranges
   always match what a full `npx remotion render` would produce — including
   picking up `public/narration/narration.json` once real VO lands.

2. **`film/scripts/render-scenes.sh <scene-num> [scene-num...]`** (dev-mac
   only) — renders just those scenes at 1/3 scale (640x360) into
   `film/out/parts/scene-NN.mp4`, using the frame ranges from step 1 and
   `--props='{"reviewLabels":true}'` (scene-number chip burned in). Each part
   is re-encoded to a stable draft profile (H.264/yuv420p/tv-range/30fps,
   AAC 128k, +faststart) so parts always concat cleanly.

   Render every scene instead with:
   ```
   film/scripts/render-scenes.sh --full
   ```

3. **`film/scripts/splice-draft.sh <tag>`** (dev-mac only) — concatenates
   `out/parts/scene-01.mp4` .. `scene-17.mp4` (all 17 must exist) into
   `out/cascade-draft-360p-<tag>.mp4`. Tries a stream-copy concat first (no
   re-encode, since the parts already share one profile); falls back to a
   full re-encode automatically if anything doesn't match.

Typical loop after changing scene 7 and scene 12:

```
film/scripts/render-scenes.sh 7 12
film/scripts/splice-draft.sh r8
```
