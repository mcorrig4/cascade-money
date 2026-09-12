#!/usr/bin/env bash
# splice-draft.sh — concat scene parts into a single output. MEANT TO RUN ON
# DEV-MAC, alongside render-scenes.sh — never on the do-box.
#
# Draft mode (default):
#   film/scripts/splice-draft.sh <tag>          # e.g. "r7"
# Concats out/parts/scene-01.mp4 .. scene-17.mp4 into
# out/cascade-draft-360p-<tag>.mp4. Requires all 17 out/parts/scene-NN.mp4 to
# exist (run render-scenes.sh --full first, or render the missing ones
# individually).
#
# Final mode:
#   film/scripts/splice-draft.sh --final
# Concats out/parts-final/scene-01.mp4 .. scene-17.mp4 (render with
# `render-scenes.sh --final --full` first) into out/cascade-final-1080p.mp4,
# then derives a 720p copy (video re-encoded to 1280x720 crf 22, audio
# stream-copied) as out/cascade-final-720p.mp4. Prints an ffprobe summary
# (dimensions, duration, pix_fmt, color_range) for both outputs and fails
# loudly if either duration exceeds 240.0s (the 4:00 cap).
#
# Both modes try a stream-copy concat first (no quality loss, fast); if the
# parts don't share identical codec/profile/resolution/fps it falls back to
# a full re-encode with the matching profile, so the output is guaranteed
# playable either way.
export PATH="/opt/homebrew/bin:$PATH"
set -euo pipefail

FILM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FILM_DIR"

MODE="draft"
TAG=""
if [[ "${1:-}" == "--final" ]]; then
  MODE="final"
elif [[ $# -ge 1 ]]; then
  TAG="$1"
else
  echo "usage: $0 <tag> | --final" >&2
  exit 1
fi

if [[ "$MODE" == "final" ]]; then
  PARTS_DIR="$FILM_DIR/out/parts-final"
  OUT_FILE="$FILM_DIR/out/cascade-final-1080p.mp4"
  OUT_720P="$FILM_DIR/out/cascade-final-720p.mp4"
  RENDER_HINT="render-scenes.sh --final \$SCENE or --final --full"
else
  PARTS_DIR="$FILM_DIR/out/parts"
  OUT_FILE="$FILM_DIR/out/cascade-draft-360p-${TAG}.mp4"
  RENDER_HINT="render-scenes.sh \$SCENE or --full"
fi

CONCAT_LIST="$(mktemp)"
trap 'rm -f "$CONCAT_LIST"' EXIT

for num in $(seq -w 1 17); do
  part="$PARTS_DIR/scene-${num}.mp4"
  if [[ ! -f "$part" ]]; then
    echo "missing $part — render it first ($RENDER_HINT)" >&2
    exit 1
  fi
  echo "file '$part'" >> "$CONCAT_LIST"
done

echo "Attempting stream-copy concat..." >&2
if ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -c copy -movflags +faststart "$OUT_FILE" 2>/tmp/splice-draft-copy.log; then
  echo "-> $OUT_FILE (stream copy, no re-encode)" >&2
else
  echo "Stream copy failed (mismatched params) — falling back to re-encode:" >&2
  tail -n 20 /tmp/splice-draft-copy.log >&2 || true

  if [[ "$MODE" == "final" ]]; then
    ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" \
      -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -color_range tv -r 30 \
      -c:a aac -b:a 192k \
      -movflags +faststart \
      "$OUT_FILE"
  else
    ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" \
      -c:v libx264 -crf 26 -pix_fmt yuv420p -color_range tv -r 30 \
      -c:a aac -b:a 128k \
      -movflags +faststart \
      "$OUT_FILE"
  fi
  echo "-> $OUT_FILE (re-encoded)" >&2
fi

if [[ "$MODE" != "final" ]]; then
  exit 0
fi

echo "Deriving 720p copy..." >&2
ffmpeg -y -i "$OUT_FILE" \
  -vf scale=1280:720 -crf 22 -pix_fmt yuv420p -color_range tv \
  -c:a copy \
  -movflags +faststart \
  "$OUT_720P"
echo "-> $OUT_720P (720p derivative)" >&2

MAX_DURATION="240.0"
FAIL=0

ffprobe_summary() {
  local file="$1"
  local label="$2"
  local width height duration pix_fmt color_range

  width="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$file")"
  height="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$file")"
  duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$file")"
  pix_fmt="$(ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 "$file")"
  color_range="$(ffprobe -v error -select_streams v:0 -show_entries stream=color_range -of csv=p=0 "$file")"

  echo "== $label ($file) ==" >&2
  echo "  dimensions:  ${width}x${height}" >&2
  echo "  duration:    ${duration}s" >&2
  echo "  pix_fmt:     ${pix_fmt}" >&2
  echo "  color_range: ${color_range}" >&2

  if awk -v d="$duration" -v max="$MAX_DURATION" 'BEGIN { exit !(d > max) }'; then
    echo "  !! duration ${duration}s exceeds the ${MAX_DURATION}s (4:00) cap" >&2
    FAIL=1
  fi
}

ffprobe_summary "$OUT_FILE" "1080p final"
ffprobe_summary "$OUT_720P" "720p final"

if [[ "$FAIL" -eq 1 ]]; then
  echo "FAILED: one or more final outputs exceed the 4:00 duration cap." >&2
  exit 1
fi

echo "Done: final outputs within the 4:00 cap." >&2
