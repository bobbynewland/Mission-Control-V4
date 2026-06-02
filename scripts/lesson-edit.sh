#!/bin/bash
# =============================================================================
# AI Skills Studio — Lesson Video Editor
# =============================================================================
# Stitches a lesson from individual segment videos, layers voiceover,
# adds background music, and outputs a final 1080p mp4.
#
# Usage:
#   ./scripts/lesson-edit.sh <lesson-dir>
#
# Example:
#   ./scripts/lesson-edit.sh ~/Videos/lessons/lesson-01
#
# Required files in <lesson-dir>:
#   lesson.json          - config (segments, voice, music, effects)
#   segments/*.mp4       - video segments from Flow / Veo
#   voiceover.mp3        - the TTS voiceover
#   music.mp3 (optional) - background music
#
# Output:
#   <lesson-dir>/output/lesson-final.mp4
# =============================================================================

set -euo pipefail

# ---------- Args ----------
LESSON_DIR="${1:-}"
if [[ -z "$LESSON_DIR" ]]; then
  echo "Usage: $0 <lesson-dir>"
  echo "Example: $0 ~/Videos/lessons/lesson-01"
  exit 1
fi

if [[ ! -d "$LESSON_DIR" ]]; then
  echo "Error: $LESSON_DIR is not a directory"
  exit 1
fi

CONFIG="$LESSON_DIR/lesson.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "Error: $CONFIG not found"
  exit 1
fi

# ---------- Read config ----------
SEGMENTS_DIR="$LESSON_DIR/segments"
VOICEOVER="$LESSON_DIR/voiceover.mp3"
MUSIC="${LESSON_DIR:-}/music.mp3"
OUTPUT_DIR="$LESSON_DIR/output"
OUTPUT="$OUTPUT_DIR/lesson-final.mp4"

CROSSFADE=$(jq -r '.crossfade // 0.3' "$CONFIG")
MUSIC_VOLUME=$(jq -r '.musicVolume // 0.10' "$CONFIG")
VOICEOVER_VOLUME=$(jq -r '.voiceoverVolume // 1.0' "$CONFIG")
RESOLUTION=$(jq -r '.resolution // "1920x1080"' "$CONFIG")
FPS=$(jq -r '.fps // 30' "$CONFIG")

mkdir -p "$OUTPUT_DIR"

echo "============================================================"
echo "AI Skills Studio — Lesson Editor"
echo "============================================================"
echo "Lesson dir:  $LESSON_DIR"
echo "Output:      $OUTPUT"
echo "Crossfade:   ${CROSSFADE}s"
echo "Resolution:  $RESOLUTION @ ${FPS}fps"
echo "============================================================"

# ---------- Verify inputs ----------
if [[ ! -d "$SEGMENTS_DIR" ]]; then
  echo "Error: $SEGMENTS_DIR not found"
  exit 1
fi

# Count segment files
SEGMENT_COUNT=$(find "$SEGMENTS_DIR" -maxdepth 1 -name "*.mp4" -o -name "*.mov" | wc -l | tr -d ' ')
if [[ "$SEGMENT_COUNT" -eq 0 ]]; then
  echo "Error: no video segments found in $SEGMENTS_DIR"
  exit 1
fi
echo "Found $SEGMENT_COUNT video segments"

if [[ ! -f "$VOICEOVER" ]]; then
  echo "Warning: $VOICEOVER not found — will skip voiceover layer"
  HAS_VOICEOVER=false
else
  HAS_VOICEOVER=true
fi

# ---------- Step 1: Concatenate segments with crossfade ----------
echo ""
echo "[1/5] Concatenating segments with crossfade..."

# Build the concat list file
CONCAT_LIST="$OUTPUT_DIR/concat-list.txt"
> "$CONCAT_LIST"
for f in "$SEGMENTS_DIR"/*.{mp4,mov}; do
  [[ -f "$f" ]] && echo "file '$f'" >> "$CONCAT_LIST"
done

# First, do a simple concat to get total duration
CONCAT_RAW="$OUTPUT_DIR/01-concat-raw.mp4"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT_LIST" \
  -c copy "$CONCAT_RAW"

# Get total duration of the concat video
TOTAL_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$CONCAT_RAW")
echo "  Total duration: ${TOTAL_DUR}s"

# Now apply crossfade using xfade filter
# Calculate xfade offsets
# For N segments with C-second crossfades, offsets are:
# segment 1 ends at d1 - C
# segment 2 ends at (d1 + d2) - 2C
# etc.
CONCAT_XFADE="$OUTPUT_DIR/02-concat-xfade.mp4"

# Use ffmpeg's concat demuxer to get individual segment durations
# then build the xfade filter chain
SEGMENT_FILES=()
while IFS= read -r f; do
  SEGMENT_FILES+=("$f")
done < <(find "$SEGMENTS_DIR" -maxdepth 1 -name "*.mp4" -o -name "*.mov" | sort)

# Get each segment's duration
declare -a DURS
for f in "${SEGMENT_FILES[@]}"; do
  d=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f")
  DURS+=("$d")
done

# Build xfade filter chain
NUM_SEGS=${#SEGMENT_FILES[@]}
INPUTS=""
for f in "${SEGMENT_FILES[@]}"; do
  INPUTS="$INPUTS -i $f"
done

FILTER=""
for ((i=0; i<NUM_SEGS-1; i++)); do
  if [[ $i -eq 0 ]]; then
    FILTER="[0:v][1:v]xfade=transition=fade:duration=$CROSSFADE:offset=$(echo "${DURS[0]} - $CROSSFADE" | bc -l)[v01];"
  else
    PREV=$(printf "v%02d" $i)
    CURR=$(printf "v%02d" $((i+1)))
    OFFSET=$(echo "0" | bc -l)
    for ((j=0; j<=i; j++)); do
      OFFSET=$(echo "$OFFSET + ${DURS[$j]}" | bc -l)
    done
    OFFSET=$(echo "$OFFSET - ($((i+1)) * $CROSSFADE)" | bc -l)
    FILTER="${FILTER}[${PREV}][$((i+1)):v]xfade=transition=fade:duration=$CROSSFADE:offset=$OFFSET[${CURR}];"
  fi
done

LAST=$(printf "v%02d" $((NUM_SEGS-1)))
FILTER="${FILTER}[${LAST}]format=yuv420p[outv]"

eval ffmpeg -y -loglevel error $INPUTS \
  -filter_complex "\"$FILTER\"" \
  -map "[outv]" \
  -r $FPS -s $RESOLUTION \
  "$CONCAT_XFADE"

echo "  ✓ Crossfade applied"

# ---------- Step 2: Layer voiceover ----------
echo ""
echo "[2/5] Layering voiceover..."

if $HAS_VOICEOVER; then
  WITH_VO="$OUTPUT_DIR/03-with-voiceover.mp4"

  # If video is longer than voiceover, extend voiceover; if shorter, loop or pad with silence
  VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$CONCAT_XFADE")
  VO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VOICEOVER")

  if (( $(echo "$VIDEO_DUR > $VO_DUR" | bc -l) )); then
    # Video longer than VO — pad with silence at the end of audio
    PAD=$(echo "$VIDEO_DUR - $VO_DUR" | bc -l)
    ffmpeg -y -loglevel error \
      -i "$CONCAT_XFADE" \
      -i "$VOICEOVER" \
      -filter_complex "[1:a]apad=whole_dur=$VIDEO_DUR,volume=$VOICEOVER_VOLUME[vo]; [vo]atrim=duration=$VIDEO_DUR[voa]" \
      -map 0:v -map "[voa]" \
      -c:v copy -c:a aac -b:a 192k \
      "$WITH_VO"
  else
    # VO longer than video — trim VO
    ffmpeg -y -loglevel error \
      -i "$CONCAT_XFADE" \
      -i "$VOICEOVER" \
      -filter_complex "[1:a]volume=$VOICEOVER_VOLUME,atrim=duration=$VIDEO_DUR[voa]" \
      -map 0:v -map "[voa]" \
      -c:v copy -c:a aac -b:a 192k \
      "$WITH_VO"
  fi
  echo "  ✓ Voiceover layered (video: ${VIDEO_DUR}s, vo: ${VO_DUR}s)"
else
  WITH_VO="$CONCAT_XFADE"
  echo "  ⚠ No voiceover — skipping"
fi

# ---------- Step 3: Add background music ----------
echo ""
echo "[3/5] Adding background music..."

WITH_MUSIC="$OUTPUT_DIR/04-with-music.mp4"
if [[ -f "$MUSIC" ]]; then
  # Loop music if shorter than video, trim if longer
  VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$WITH_VO")

  ffmpeg -y -loglevel error \
    -i "$WITH_VO" \
    -stream_loop -1 -i "$MUSIC" \
    -filter_complex "[1:a]volume=$MUSIC_VOLUME,atrim=duration=$VIDEO_DUR[bg]; [0:a][bg]amix=inputs=2:duration=first:dropout_transition=0[aout]" \
    -map 0:v -map "[aout]" \
    -c:v copy -c:a aac -b:a 192k \
    "$WITH_MUSIC"
  echo "  ✓ Music added at ${MUSIC_VOLUME} volume"
else
  WITH_MUSIC="$WITH_VO"
  echo "  ⚠ No music.mp3 — skipping"
fi

# ---------- Step 4: Color grade (subtle unification) ----------
echo ""
echo "[4/5] Applying color grade..."

GRADED="$OUTPUT_DIR/05-graded.mp4"
SAT=$(jq -r '.colorGrade.saturation // 1.03' "$CONFIG")
CONTRAST=$(jq -r '.colorGrade.contrast // 1.02' "$CONFIG")
BRIGHTNESS=$(jq -r '.colorGrade.brightness // 0.01' "$CONFIG")
WARMTH=$(jq -r '.colorGrade.warmth // 0.04' "$CONFIG")

ffmpeg -y -loglevel error \
  -i "$WITH_MUSIC" \
  -vf "colorbalance=rs=$WARMTH:gs=0.02:bs=-0.02,eq=saturation=$SATURATION:contrast=$CONTRAST:brightness=$BRIGHTNESS" \
  -c:a copy \
  "$GRADED"
echo "  ✓ Color graded (warmth: $WARMTH, sat: $SAT)"

# ---------- Step 5: Final export ----------
echo ""
echo "[5/5] Final export..."

cp "$GRADED" "$OUTPUT"

# Cleanup intermediate files (keep them if KEEP_INTERMEDIATES is set)
if [[ "${KEEP_INTERMEDIATES:-}" != "1" ]]; then
  rm -f "$CONCAT_RAW" "$CONCAT_XFADE" "$WITH_VO" "$WITH_MUSIC" "$GRADED"
fi

# Print summary
FINAL_SIZE=$(du -h "$OUTPUT" | cut -f1)
FINAL_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT")

echo ""
echo "============================================================"
echo "✓ Lesson video complete"
echo "============================================================"
echo "Output:    $OUTPUT"
echo "Size:      $FINAL_SIZE"
echo "Duration:  ${FINAL_DUR}s"
echo "============================================================"
