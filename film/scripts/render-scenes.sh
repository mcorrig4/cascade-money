#!/usr/bin/env bash
# render-scenes.sh — render one or more CascadeFilm scenes to
# out/parts/scene-NN.mp4, at 1/3 scale (640x360), for fast incremental
# drafts. MEANT TO RUN ON DEV-MAC (or wherever GPU/CPU rendering is allowed)
# — never on the do-box, which does not render video.
#
# Usage:
#   film/scripts/render-scenes.sh 3 7 12       # render scenes 3, 7, and 12
#   film/scripts/render-scenes.sh --full        # render all 17 scenes
#
# Each scene's frame range comes from `pnpm --dir film scene-frames`, which
# reuses the composition's own duration logic (schedule.ts / narration.ts) —
# so the ranges rendered here can never drift from what a full render would
# produce for that scene.
#
# Output: out/parts/scene-NN.mp4, re-encoded to a stable draft profile
# (H.264/yuv420p/tv-range/30fps + AAC, +faststart) so splice-draft.sh can
# concat them without a lossy re-encode when everything matches.
set -euo pipefail

FILM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FILM_DIR"

OUT_DIR="$FILM_DIR/out/parts"
mkdir -p "$OUT_DIR"

SCALE="0.3333333333333333"

if [[ "${1:-}" == "--full" ]]; then
  SCENE_NUMS=($(seq 1 17))
elif [[ $# -eq 0 ]]; then
  echo "usage: $0 <scene-num> [scene-num...] | --full" >&2
  exit 1
else
  SCENE_NUMS=("$@")
fi

echo "Reading scene frame ranges..." >&2
FRAMES_JSON="$(pnpm --dir "$FILM_DIR" --silent scene-frames)"

frame_range_for() {
  local scene_num="$1"
  node -e '
    const rows = JSON.parse(process.argv[1]);
    const sc = rows.find((r) => r.scene === Number(process.argv[2]));
    if (!sc) { console.error("unknown scene " + process.argv[2]); process.exit(1); }
    console.log(sc.from + "-" + sc.to);
  ' "$FRAMES_JSON" "$scene_num"
}

for num in "${SCENE_NUMS[@]}"; do
  padded=$(printf "%02d" "$num")
  range="$(frame_range_for "$num")"
  raw_out="$OUT_DIR/scene-${padded}.raw.mp4"
  final_out="$OUT_DIR/scene-${padded}.mp4"

  echo "== Scene $padded: frames $range ==" >&2
  npx remotion render CascadeFilm "$raw_out" \
    --frames="$range" \
    --scale="$SCALE" \
    --props='{"reviewLabels":true}'

  echo "-- Re-encoding scene $padded to draft profile --" >&2
  ffmpeg -y -i "$raw_out" \
    -c:v libx264 -crf 26 -pix_fmt yuv420p -color_range tv -r 30 \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    "$final_out"
  rm -f "$raw_out"

  echo "-> $final_out" >&2
done

echo "Done: ${#SCENE_NUMS[@]} scene(s) rendered to $OUT_DIR" >&2
