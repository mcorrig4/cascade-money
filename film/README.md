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

## Final-quality render

Once a cut is locked, render at final quality instead of the fast draft
profile:

1. **`film/scripts/render-scenes.sh --final <scene-num> [scene-num...]`**
   (or `--profile final`, and `--full` for all 17 scenes) — renders at
   native scale (no `--scale`), with `reviewLabels` OFF (no scene-number
   chip burned in), into `film/out/parts-final/scene-NN.mp4`. Re-encode
   profile: H.264 `-preset slow -crf 18 -pix_fmt yuv420p -color_range tv
   -r 30`, AAC `192k`, `+faststart`.

   ```
   film/scripts/render-scenes.sh --final --full
   ```

2. **`film/scripts/splice-draft.sh --final`** — concatenates
   `out/parts-final/scene-01.mp4` .. `scene-17.mp4` (all 17 must exist)
   into `out/cascade-final-1080p.mp4` (stream-copy concat first, falling
   back to a full re-encode at the same final profile if the parts don't
   match), then derives a 720p copy (`-vf scale=1280:720 -crf 22`, audio
   stream-copied) as `out/cascade-final-720p.mp4`.

   It prints an ffprobe summary (dimensions, duration, pix_fmt,
   color_range) for both outputs and **fails loudly if either duration
   exceeds 240.0s (the 4:00 cap)**.

Both `render-scenes.sh` and `splice-draft.sh` `export PATH` to include
`/opt/homebrew/bin` at the top, since dev-mac's non-login ssh shells don't
have it on `PATH` by default and ffmpeg/ffprobe live there.
