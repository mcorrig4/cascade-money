#!/usr/bin/env bash
# splice-draft.sh — concat scene parts into a single output. MEANT TO RUN ON
# DEV-MAC, alongside render-scenes.sh — never on the do-box.
#
# Draft mode (default):
#   film/scripts/splice-draft.sh <tag>          # e.g. "r7"
# Concats out/parts/scene-01.mp4 .. scene-12.mp4 into
# out/cascade-draft-360p-<tag>.mp4. Requires all 12 out/parts/scene-NN.mp4
# (scene-11-delete pass, 2026-09-13; scene 11/New York cut) to exist (run
# render-scenes.sh --full first, or render the missing ones individually).
#
# W6 chimera incident: every part requires a matching .provenance.json sidecar.
# --allow-mixed explicitly overrides provenance refusals, adds -MIXED to output
# names, and retains all differences/unknown stamps in adjacent manifests.
# Dirty renders warn; matching stamps cannot distinguish different dirty states.
#
# Final mode:
#   film/scripts/splice-draft.sh --final
# Concats out/parts-final/scene-01.mp4 .. scene-12.mp4 (render with
# `render-scenes.sh --final --full` first) into out/cascade-final-1080p.mp4,
# then derives a 720p copy (video re-encoded to 1280x720 crf 22, audio
# stream-copied) as out/cascade-final-720p.mp4. Prints an ffprobe summary
# (dimensions, duration, pix_fmt, color_range) for both outputs and fails
# loudly if either duration exceeds 240.0s (the 4:00 cap).
#
# Draft filters trim audio to frame duration; final normalizes audio in
# temporary parts before stream-copy concat; final master video is never re-encoded.
export PATH="/opt/homebrew/bin:$PATH"
set -euo pipefail

FILM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FILM_DIR"

echo "Checking cues are not stale against the installed narration..." >&2
node "$FILM_DIR/scripts/check-cues.mjs" >&2

MODE="draft"
TAG=""
ALLOW_MIXED=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --final) MODE="final" ;;
    --allow-mixed) ALLOW_MIXED=true ;;
    --*) echo "unknown option: $1" >&2; exit 1 ;;
    *)
      if [[ -n "$TAG" || ! "$1" =~ ^[A-Za-z0-9._-]+$ ]]; then echo "invalid or duplicate draft tag: $1" >&2; exit 1; fi
      TAG="$1" ;;
  esac
  shift
done
if [[ "$MODE" == "draft" && -z "$TAG" ]] || [[ "$MODE" == "final" && -n "$TAG" ]]; then
  echo "usage: $0 [--allow-mixed] <tag> | --final [--allow-mixed]" >&2
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

TEMP_DIR="$(mktemp -d)"
CONCAT_LIST="$TEMP_DIR/concat.txt"
trap 'rm -rf "$TEMP_DIR"' EXIT

# W6 chimera incident: inspect every original part before even normalizing audio.
PROVENANCE_REPORT="$TEMP_DIR/provenance.json"
PROVENANCE_STATE="$(node "$FILM_DIR/scripts/render-provenance.mjs" check "$PARTS_DIR" "$MODE" "$ALLOW_MIXED" "$PROVENANCE_REPORT")"
if [[ "$PROVENANCE_STATE" == "mixed" ]]; then
  OUT_FILE="${OUT_FILE%.mp4}-MIXED.mp4"
  if [[ "$MODE" == "final" ]]; then OUT_720P="${OUT_720P%.mp4}-MIXED.mp4"; fi
fi
publish_manifest() {
  if ! node "$FILM_DIR/scripts/render-provenance.mjs" manifest "$PROVENANCE_REPORT" "$1"; then
    # W6: an output whose inputs changed mid-splice must not survive under a consistent-looking name.
    rm -f "$1" "${1%.mp4}.provenance.json"
    return 1
  fi
}
# W6: failed replacement must not inherit a previous output's manifest.
rm -f "${OUT_FILE%.mp4}.provenance.json"

# The film is 12 scenes (scene-11-delete pass, 2026-09-13) — concat the
# contiguous surviving scene numbers.
for num in 01 02 03 04 05 06 07 08 09 10 11 12; do
  part="$PARTS_DIR/scene-${num}.mp4"
  if [[ ! -f "$part" ]]; then
    echo "missing $part — render it first ($RENDER_HINT)" >&2
    exit 1
  fi
  if [[ "$MODE" == "final" ]]; then
    # W4 v4 splice incident: mono parts dropped later audio, so every input must share stereo/48 kHz before concat.
    frames=$(ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames -of default=nw=1:nk=1 "$part")
    part_fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=nw=1:nk=1 "$part")
    duration=$(perl -e 'my ($n,$d)=split "/",$ARGV[1]; printf "%.9f",$ARGV[0]*($d||1)/$n' "$frames" "$part_fps")
    # W4 final-padding incident: trim audio to the picture duration before joining parts.
    normalized="$TEMP_DIR/scene-${num}.mp4"
    ffmpeg -hide_banner -loglevel error -y -i "$part" -map 0:v:0 -map 0:a:0 -c:v copy \
      -af "aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=duration=$duration,asetpts=PTS-STARTPTS" \
      -c:a aac -b:a 192k -ar 48000 -ac 2 "$normalized"
    part="$normalized"
  fi
  echo "file '$part'" >> "$CONCAT_LIST"
done

# AAC encoder padding makes stream-copy concat insert a small timestamp gap at
# every scene boundary. For the draft, trim each audio stream to its exact
# video-frame duration and concatenate both streams on a clean 15fps timeline.
if [[ "$MODE" == "draft" ]]; then
  # The film is 12 scenes (scene-11-delete pass, 2026-09-13) — iterate the
  # same contiguous scene numbers as the CONCAT_LIST loop above.
  SURVIVING_SCENES=(01 02 03 04 05 06 07 08 09 10 11 12)
  INPUTS=(); FILTER=""; INDEX=0
  for num in "${SURVIVING_SCENES[@]}"; do
    part="$PARTS_DIR/scene-${num}.mp4"; INPUTS+=("-i" "$part")
    frames=$(ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames -of default=nw=1:nk=1 "$part")
    part_fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=nw=1:nk=1 "$part")
    duration=$(perl -e 'my ($n,$d)=split "/",$ARGV[1]; printf "%.9f",$ARGV[0]*($d||1)/$n' "$frames" "$part_fps")
    # W4 v4 splice incident: normalize each input before concat while retaining frame-exact atrim.
    FILTER+="[$INDEX:v]setpts=PTS-STARTPTS[v$INDEX];[$INDEX:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=duration=$duration,asetpts=PTS-STARTPTS[a$INDEX];"
    INDEX=$((INDEX+1))
  done
  for index in $(seq 0 $((${#SURVIVING_SCENES[@]}-1))); do FILTER+="[v$index][a$index]"; done
  FILTER+="concat=n=${#SURVIVING_SCENES[@]}:v=1:a=1[v][a]"
  ffmpeg -hide_banner -loglevel error -y "${INPUTS[@]}" -filter_complex "$FILTER" -map '[v]' -map '[a]' \
    -r "${SPLICE_FPS:-${part_fps%%/*}}" -c:v libx264 -crf 26 -pix_fmt yuv420p -color_range tv -c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart "$OUT_FILE"
  publish_manifest "$OUT_FILE"
  echo "-> $OUT_FILE (frame-exact filtered concat)" >&2
  exit 0
fi

echo "Attempting stream-copy concat..." >&2
# W4 final-padding incident: preserve the negative AAC priming timestamp instead of shifting picture and audio by one packet.
if ffmpeg -y -copyts -f concat -safe 0 -i "$CONCAT_LIST" -c copy -movflags +faststart "$OUT_FILE" 2>"$TEMP_DIR/copy.log"; then
  publish_manifest "$OUT_FILE"
  echo "-> $OUT_FILE (stream copy, no re-encode)" >&2
else
  echo "Stream copy failed — refusing to re-encode final master video:" >&2
  tail -n 20 "$TEMP_DIR/copy.log" >&2 || true
  exit 1
fi

echo "Deriving 720p copy..." >&2
rm -f "${OUT_720P%.mp4}.provenance.json"
ffmpeg -y -i "$OUT_FILE" \
  -vf scale=1280:720 -crf 22 -pix_fmt yuv420p -color_range tv \
  -c:a copy \
  -movflags +faststart \
  "$OUT_720P"
publish_manifest "$OUT_720P"
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
