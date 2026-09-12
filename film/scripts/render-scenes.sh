#!/usr/bin/env bash
# render-scenes.sh — render one or more CascadeFilm scenes to
# out/parts/scene-NN.mp4, at 1/3 scale (640x360), for fast incremental
# drafts. MEANT TO RUN ON DEV-MAC (or wherever GPU/CPU rendering is allowed)
# — never on the do-box, which does not render video.
#
# Usage:
#   film/scripts/render-scenes.sh 3 7 12        # render scenes 3, 7, and 12 (draft)
#   film/scripts/render-scenes.sh --full         # render all 17 scenes (draft)
#   film/scripts/render-scenes.sh --final 3 7    # render scenes 3, 7 at final quality
#   film/scripts/render-scenes.sh --profile final --full   # final quality, all scenes
#
# Each scene's frame range comes from `pnpm --dir film scene-frames`, which
# reuses the composition's own duration logic (schedule.ts / narration.ts) —
# so the ranges rendered here can never drift from what a full render would
# produce for that scene.
#
# Draft profile (default): out/parts/scene-NN.mp4, 1/3 scale (640x360),
# reviewLabels on (scene-number chip burned in), re-encoded to
# H.264/crf26/yuv420p/tv-range/30fps + AAC 128k, +faststart.
#
# Final profile (--final / --profile final): out/parts-final/scene-NN.mp4,
# native scale (no --scale), reviewLabels OFF, re-encoded to
# H.264/preset-slow/crf18/yuv420p/tv-range/30fps + AAC 192k, +faststart.
export PATH="/opt/homebrew/bin:$PATH"
set -euo pipefail

FILM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FILM_DIR"

MODE="draft"
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --final)
      MODE="final"
      shift
      ;;
    --profile)
      shift
      if [[ "${1:-}" != "final" ]]; then
        echo "unknown profile: ${1:-} (only 'final' is supported)" >&2
        exit 1
      fi
      MODE="final"
      shift
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done
set -- "${POSITIONAL[@]}"

if [[ "$MODE" == "final" ]]; then
  OUT_DIR="$FILM_DIR/out/parts-final"
  SCALE_ARGS=()
  PROPS_ARGS=(--props='{"reviewLabels":false}')
else
  OUT_DIR="$FILM_DIR/out/parts"
  SCALE_ARGS=(--scale="0.3333333333333333")
  PROPS_ARGS=(--props='{"reviewLabels":true}')
fi
mkdir -p "$OUT_DIR"

if [[ "${1:-}" == "--full" ]]; then
  SCENE_NUMS=($(seq 1 17))
elif [[ $# -eq 0 ]]; then
  echo "usage: $0 [--final|--profile final] <scene-num> [scene-num...] | --full" >&2
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

  echo "== Scene $padded ($MODE): frames $range ==" >&2
  npx remotion render CascadeFilm "$raw_out" \
    --frames="$range" \
    "${SCALE_ARGS[@]}" \
    "${PROPS_ARGS[@]}"

  echo "-- Re-encoding scene $padded to $MODE profile --" >&2
  if [[ "$MODE" == "final" ]]; then
    ffmpeg -y -i "$raw_out" \
      -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -color_range tv -r 30 \
      -c:a aac -b:a 192k \
      -movflags +faststart \
      "$final_out"
  else
    ffmpeg -y -i "$raw_out" \
      -c:v libx264 -crf 26 -pix_fmt yuv420p -color_range tv -r 30 \
      -c:a aac -b:a 128k \
      -movflags +faststart \
      "$final_out"
  fi
  rm -f "$raw_out"

  echo "-> $final_out" >&2
done

echo "Done: ${#SCENE_NUMS[@]} scene(s) rendered ($MODE) to $OUT_DIR" >&2
