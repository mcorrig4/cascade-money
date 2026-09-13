#!/usr/bin/env bash
# render-scenes.sh — render one or more CascadeFilm scenes to
# out/parts/scene-NN.mp4, at 1/3 scale (640x360), for fast incremental
# drafts. MEANT TO RUN ON DEV-MAC (or wherever GPU/CPU rendering is allowed)
# — never on the do-box, which does not render video.
#
# Usage:
#   film/scripts/render-scenes.sh 3 7 9          # render scenes 3, 7, and 9 (draft)
#   film/scripts/render-scenes.sh --full         # render all 12 surviving scenes (draft; scene 11/New York cut)
#   film/scripts/render-scenes.sh --final 3 7    # render scenes 3, 7 at final quality
#   film/scripts/render-scenes.sh --profile final --full   # final quality, all scenes
#
# Each scene's frame range comes from `node scripts/scene-frames.mjs <fps>`,
# which reuses the composition's own duration logic (schedule.ts /
# narration.ts) — so the ranges rendered here can never drift from what a
# full render would produce for that scene. Cues (cues.ts's narration word
# timestamps) are refreshed first, same reason.
#
# Draft profile (default): out/parts/scene-NN.mp4, 1/3 scale (640x360) AT
# 15fps (product owner decision 2026-09-11 22:59 ET — `--props='{"fps":15}'`
# alongside the scale flag; wall-clock length is unchanged, half the frames
# to render/encode), reviewLabels on (scene-number chip burned in),
# re-encoded to H.264/crf26/yuv420p/tv-range/15fps + AAC 128k, +faststart.
#
# Final profile (--final / --profile final): out/parts-final/scene-NN.mp4,
# native scale (no --scale), 30fps (`--props='{"fps":30}'`), reviewLabels
# OFF, re-encoded to H.264/preset-slow/crf18/yuv420p/tv-range/30fps + AAC
# 192k, +faststart.
export PATH="/opt/homebrew/bin:$PATH"
set -euo pipefail

FILM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FILM_DIR"

MODE="draft"
SOURCE="live"
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
    --source)
      shift
      if [[ "${1:-}" != "live" && "${1:-}" != "captures" ]]; then
        echo "unknown source: ${1:-} (must be 'live' or 'captures')" >&2
        exit 1
      fi
      SOURCE="$1"
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
  PROPS_ARGS=(--props="{\"reviewLabels\":false,\"fps\":30,\"source\":\"$SOURCE\"}")
  RENDER_FPS=30
else
  OUT_DIR="$FILM_DIR/out/parts"
  SCALE_ARGS=(--scale="0.3333333333333333")
  # Draft profile: 360p AND 15fps (product owner decision 2026-09-11 22:59
  # ET) — half the frames to encode for the same wall-clock preview.
  # 2026-09-13 05:53 ET product owner: drafts at 4fps to speed review renders
  # (override with DRAFT_FPS=15 when motion needs checking).
  RENDER_FPS="${DRAFT_FPS:-4}"
  PROPS_ARGS=(--props="{\"reviewLabels\":true,\"fps\":${RENDER_FPS},\"source\":\"$SOURCE\"}")
fi
mkdir -p "$OUT_DIR"

if [[ "${1:-}" == "--full" ]]; then
  # The film is 12 scenes (scene-11-delete pass, 2026-09-13; scene 11/New
  # York cut) — the surviving scene numbers are exactly SCENES[].num in
  # schedule.ts, a contiguous 1..12 run.
  SCENE_NUMS=(1 2 3 4 5 6 7 8 9 10 11 12)
elif [[ $# -eq 0 ]]; then
  echo "usage: $0 [--final|--profile final] <scene-num> [scene-num...] | --full" >&2
  exit 1
else
  SCENE_NUMS=("$@")
fi

echo "Refreshing narration word-timestamp cues..." >&2
node "$FILM_DIR/scripts/cues-from-words.mjs" >&2

echo "Checking cues are not stale against the installed narration..." >&2
node "$FILM_DIR/scripts/check-cues.mjs" >&2

echo "Reading scene frame ranges..." >&2
# node directly, not `pnpm scene-frames -- <fps>` — pnpm's `--dir` flag
# leaves the literal "--" in argv (verified: without --dir it's stripped,
# with it it isn't), which broke fps passthrough.
FRAMES_JSON="$(node "$FILM_DIR/scripts/scene-frames.mjs" "$RENDER_FPS")"

frame_range_for() {
  local scene_num="$1"
  node -e '
    const rows = JSON.parse(process.argv[1]);
    const sc = rows.find((r) => r.scene === Number(process.argv[2]));
    if (!sc) { console.error("unknown scene " + process.argv[2]); process.exit(1); }
    console.log(sc.from + "-" + sc.to);
  ' "$FRAMES_JSON" "$scene_num"
}

TIMING_FILE="$FILM_DIR/../out/${LIVE_TAG:-live-v2}-timing.txt"
mkdir -p "$(dirname "$TIMING_FILE")"
START_ALL=$(perl -MTime::HiRes=time -e 'print time')
: > "$TIMING_FILE"

render_scene() {
  local num="$1"
  local started ended padded range raw_out final_out
  started=$(perl -MTime::HiRes=time -e 'print time')
  padded=$(printf "%02d" "$num")
  range="$(frame_range_for "$num")"
  raw_out="$OUT_DIR/scene-${padded}.raw.mp4"
  final_out="$OUT_DIR/scene-${padded}.mp4"

  echo "== Scene $padded ($MODE): frames $range ==" >&2
  npx remotion render CascadeFilm "$raw_out" \
    --frames="$range" \
    ${SCALE_ARGS[@]+"${SCALE_ARGS[@]}"} \
    ${PROPS_ARGS[@]+"${PROPS_ARGS[@]}"} --concurrency=3

  echo "-- Re-encoding scene $padded to $MODE profile --" >&2
  if [[ "$MODE" == "final" ]]; then
    ffmpeg -y -i "$raw_out" \
      -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -color_range tv -r 30 \
      -c:a aac -b:a 192k \
      -movflags +faststart \
      "$final_out"
  else
    ffmpeg -y -i "$raw_out" \
      -c:v libx264 -crf 26 -pix_fmt yuv420p -color_range tv -r "$RENDER_FPS" \
      -c:a aac -b:a 128k \
      -movflags +faststart \
      "$final_out"
  fi
  rm -f "$raw_out"

  echo "-> $final_out" >&2
  ended=$(perl -MTime::HiRes=time -e 'print time')
  perl -e 'printf "scene_%s_seconds=%.3f\n",$ARGV[0],$ARGV[2]-$ARGV[1]' "$padded" "$started" "$ended" > "$OUT_DIR/scene-${padded}.seconds"
}

for ((i=0;i<${#SCENE_NUMS[@]};i+=2)); do
  render_scene "${SCENE_NUMS[$i]}" & left=$!
  right=""
  if ((i+1<${#SCENE_NUMS[@]})); then render_scene "${SCENE_NUMS[$((i+1))]}" & right=$!; fi
  wait "$left"
  if [[ -n "$right" ]]; then wait "$right"; fi
done

for num in "${SCENE_NUMS[@]}"; do padded=$(printf "%02d" "$num"); cat "$OUT_DIR/scene-${padded}.seconds" >> "$TIMING_FILE"; done
END_ALL=$(perl -MTime::HiRes=time -e 'print time')
perl -e 'printf "render_total_seconds=%.3f\n",$ARGV[1]-$ARGV[0]' "$START_ALL" "$END_ALL" >> "$TIMING_FILE"

echo "Done: ${#SCENE_NUMS[@]} scene(s) rendered ($MODE) to $OUT_DIR" >&2
