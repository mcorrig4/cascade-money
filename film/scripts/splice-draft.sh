#!/usr/bin/env bash
# splice-draft.sh — concat out/parts/scene-01.mp4 .. scene-17.mp4 into a
# single draft: out/cascade-draft-360p-<tag>.mp4. MEANT TO RUN ON DEV-MAC,
# alongside render-scenes.sh — never on the do-box.
#
# Usage:
#   film/scripts/splice-draft.sh <tag>          # e.g. "r7"
#
# Requires all 17 out/parts/scene-NN.mp4 to exist (run render-scenes.sh
# --full first, or render the missing ones individually). Tries a
# stream-copy concat first (no quality loss, fast); if the parts don't share
# identical codec/profile/resolution/fps it falls back to a full re-encode
# with the same draft profile render-scenes.sh uses, so the output is
# guaranteed playable either way.
set -euo pipefail

FILM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FILM_DIR"

TAG="${1:?usage: $0 <tag>}"
PARTS_DIR="$FILM_DIR/out/parts"
OUT_FILE="$FILM_DIR/out/cascade-draft-360p-${TAG}.mp4"
CONCAT_LIST="$(mktemp)"
trap 'rm -f "$CONCAT_LIST"' EXIT

for num in $(seq -w 1 17); do
  part="$PARTS_DIR/scene-${num}.mp4"
  if [[ ! -f "$part" ]]; then
    echo "missing $part — render it first (render-scenes.sh $((10#$num)) or --full)" >&2
    exit 1
  fi
  echo "file '$part'" >> "$CONCAT_LIST"
done

echo "Attempting stream-copy concat..." >&2
if ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -c copy -movflags +faststart "$OUT_FILE" 2>/tmp/splice-draft-copy.log; then
  echo "-> $OUT_FILE (stream copy, no re-encode)" >&2
  exit 0
fi

echo "Stream copy failed (mismatched params) — falling back to re-encode:" >&2
tail -n 20 /tmp/splice-draft-copy.log >&2 || true

ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" \
  -c:v libx264 -crf 26 -pix_fmt yuv420p -color_range tv -r 30 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  "$OUT_FILE"

echo "-> $OUT_FILE (re-encoded)" >&2
