#!/bin/bash
# =============================================================================
# AI Skills Studio — Lesson Video Editor v2 (with kinetic captions)
# =============================================================================
# Stitches a lesson, layers voiceover, adds music, renders kinetic captions
# via Remotion, and composites them together.
#
# Usage:
#   ./scripts/lesson-edit.sh <lesson-dir>
#
# Required files in <lesson-dir>:
#   lesson.json              - config
#   segments/*.mp4           - video segments from Flow / Veo
#   voiceover.mp3            - the TTS voiceover
#   voiceover.txt            - the voiceover text (for caption timing)
#   music.mp3 (optional)     - background music
#
# Output:
#   <lesson-dir>/output/lesson-final.mp4      (no captions, base render)
#   <lesson-dir>/output/lesson-with-captions.mp4  (with kinetic captions)
# =============================================================================

set -euo pipefail

LESSON_DIR="${1:-}"
if [[ -z "$LESSON_DIR" ]]; then
  echo "Usage: $0 <lesson-dir>"
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

SEGMENTS_DIR="$LESSON_DIR/segments"
VOICEOVER="$LESSON_DIR/voiceover.mp3"
VOICEOVER_TXT="$LESSON_DIR/voiceover.txt"
MUSIC="$LESSON_DIR/music.mp3"
OUTPUT_DIR="$LESSON_DIR/output"
OUTPUT="$OUTPUT_DIR/lesson-final.mp4"
OUTPUT_CAPTIONS="$OUTPUT_DIR/lesson-with-captions.mp4"

CROSSFADE=$(jq -r '.crossfade // 0.3' "$CONFIG")
MUSIC_VOLUME=$(jq -r '.musicVolume // 0.10' "$CONFIG")
VOICEOVER_VOLUME=$(jq -r '.voiceoverVolume // 1.0' "$CONFIG")
RESOLUTION=$(jq -r '.resolution // "1920x1080"' "$CONFIG")
FPS=$(jq -r '.fps // 30' "$CONFIG")

CAPTION_STUDIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/caption-studio"

mkdir -p "$OUTPUT_DIR"

echo "============================================================"
echo "AI Skills Studio — Lesson Editor v2 (with captions)"
echo "============================================================"
echo "Lesson dir:  $LESSON_DIR"
echo "Captions:    $(jq -r '.captions.enabled // true' "$CONFIG")"
echo "Crossfade:   ${CROSSFADE}s"
echo "Resolution:  $RESOLUTION @ ${FPS}fps"
echo "============================================================"

SEGMENT_COUNT=$(find "$SEGMENTS_DIR" -maxdepth 1 \( -name "*.mp4" -o -name "*.mov" \) | wc -l | tr -d ' ')
if [[ "$SEGMENT_COUNT" -eq 0 ]]; then
  echo "Error: no video segments found in $SEGMENTS_DIR"
  exit 1
fi
echo "Found $SEGMENT_COUNT video segments"

# ---------- Step 1: Concatenate ----------
echo ""
echo "[1/6] Concatenating segments with crossfade..."
CONCAT_LIST="$OUTPUT_DIR/concat-list.txt"
> "$CONCAT_LIST"
for f in "$SEGMENTS_DIR"/*.{mp4,mov}; do
  [[ -f "$f" ]] && echo "file '$f'" >> "$CONCAT_LIST"
done

CONCAT_RAW="$OUTPUT_DIR/01-concat-raw.mp4"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$CONCAT_RAW"
TOTAL_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$CONCAT_RAW")
echo "  Total duration: ${TOTAL_DUR}s"

CONCAT_XFADE="$OUTPUT_DIR/02-concat-xfade.mp4"
SEGMENT_FILES=()
while IFS= read -r f; do SEGMENT_FILES+=("$f"); done < <(find "$SEGMENTS_DIR" -maxdepth 1 \( -name "*.mp4" -o -name "*.mov" \) | sort)

declare -a DURS
for f in "${SEGMENT_FILES[@]}"; do
  d=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f")
  DURS+=("$d")
done

NUM_SEGS=${#SEGMENT_FILES[@]}
INPUTS=""
for f in "${SEGMENT_FILES[@]}"; do INPUTS="$INPUTS -i $f"; done

FILTER=""
for ((i=0; i<NUM_SEGS-1; i++)); do
  if [[ $i -eq 0 ]]; then
    FILTER="[0:v][1:v]xfade=transition=fade:duration=$CROSSFADE:offset=$(echo "${DURS[0]} - $CROSSFADE" | bc -l)[v01];"
  else
    PREV=$(printf "v%02d" $i)
    CURR=$(printf "v%02d" $((i+1)))
    OFFSET=0
    for ((j=0; j<=i; j++)); do OFFSET=$(echo "$OFFSET + ${DURS[$j]}" | bc -l); done
    OFFSET=$(echo "$OFFSET - ($((i+1)) * $CROSSFADE)" | bc -l)
    FILTER="${FILTER}[${PREV}][$((i+1)):v]xfade=transition=fade:duration=$CROSSFADE:offset=$OFFSET[${CURR}];"
  fi
done

LAST=$(printf "v%02d" $((NUM_SEGS-1)))
FILTER="${FILTER}[${LAST}]format=yuv420p[outv]"

eval ffmpeg -y -loglevel error $INPUTS -filter_complex "\"$FILTER\"" -map "[outv]" -r $FPS -s $RESOLUTION "$CONCAT_XFADE"
echo "  ✓ Crossfade applied"

# ---------- Step 2: Voiceover ----------
echo ""
echo "[2/6] Layering voiceover..."
WITH_VO="$OUTPUT_DIR/03-with-voiceover.mp4"
if [[ -f "$VOICEOVER" ]]; then
  VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$CONCAT_XFADE")
  VO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VOICEOVER")
  if (( $(echo "$VIDEO_DUR > $VO_DUR" | bc -l) )); then
    ffmpeg -y -loglevel error -i "$CONCAT_XFADE" -i "$VOICEOVER" \
      -filter_complex "[1:a]apad=whole_dur=$VIDEO_DUR,volume=$VOICEOVER_VOLUME,atrim=duration=$VIDEO_DUR[voa]" \
      -map 0:v -map "[voa]" -c:v copy -c:a aac -b:a 192k "$WITH_VO"
  else
    ffmpeg -y -loglevel error -i "$CONCAT_XFADE" -i "$VOICEOVER" \
      -filter_complex "[1:a]volume=$VOICEOVER_VOLUME,atrim=duration=$VIDEO_DUR[voa]" \
      -map 0:v -map "[voa]" -c:v copy -c:a aac -b:a 192k "$WITH_VO"
  fi
  echo "  ✓ Voiceover layered"
else
  WITH_VO="$CONCAT_XFADE"
  echo "  ⚠ No voiceover — skipping"
fi

# ---------- Step 3: Music ----------
echo ""
echo "[3/6] Adding background music..."
WITH_MUSIC="$OUTPUT_DIR/04-with-music.mp4"
if [[ -f "$MUSIC" ]]; then
  VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$WITH_VO")
  ffmpeg -y -loglevel error -i "$WITH_VO" -stream_loop -1 -i "$MUSIC" \
    -filter_complex "[1:a]volume=$MUSIC_VOLUME,atrim=duration=$VIDEO_DUR[bg]; [0:a][bg]amix=inputs=2:duration=first:dropout_transition=0[aout]" \
    -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k "$WITH_MUSIC"
  echo "  ✓ Music added at ${MUSIC_VOLUME} volume"
else
  WITH_MUSIC="$WITH_VO"
  echo "  ⚠ No music — skipping"
fi

# ---------- Step 4: Color grade ----------
echo ""
echo "[4/6] Applying color grade..."
GRADED="$OUTPUT_DIR/05-graded.mp4"
SAT=$(jq -r '.colorGrade.saturation // 1.03' "$CONFIG")
CONTRAST=$(jq -r '.colorGrade.contrast // 1.02' "$CONFIG")
BRIGHTNESS=$(jq -r '.colorGrade.brightness // 0.01' "$CONFIG")
WARMTH=$(jq -r '.colorGrade.warmth // 0.04' "$CONFIG")
ffmpeg -y -loglevel error -i "$WITH_MUSIC" \
  -vf "colorbalance=rs=$WARMTH:gs=0.02:bs=-0.02,eq=saturation=$SAT:contrast=$CONTRAST:brightness=$BRIGHTNESS" \
  -c:a copy "$GRADED"
echo "  ✓ Color graded"

# ---------- Step 5: Final base export ----------
echo ""
echo "[5/6] Final base export..."
cp "$GRADED" "$OUTPUT"
BASE_SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "  ✓ Base render: $OUTPUT ($BASE_SIZE)"

# ---------- Step 6: Kinetic captions (Remotion) ----------
CAPTIONS_ENABLED=$(jq -r '.captions.enabled // true' "$CONFIG")
if [[ "$CAPTIONS_ENABLED" == "true" ]]; then
  echo ""
  echo "[6/6] Rendering kinetic captions via Remotion..."

  if [[ ! -d "$CAPTION_STUDIO_DIR" ]]; then
    echo "  ⚠ Caption studio not found at $CAPTION_STUDIO_DIR — skipping captions"
    echo "  (Run: cd caption-studio && npm install)"
  elif [[ ! -f "$VOICEOVER_TXT" ]]; then
    echo "  ⚠ $VOICEOVER_TXT not found — cannot generate timings — skipping captions"
  else
    # Generate timings
    TIMINGS_JSON="$CAPTION_STUDIO_DIR/scripts/timings.json"
    node "$CAPTION_STUDIO_DIR/scripts/timing-extract.mjs" \
      "$VOICEOVER" "$VOICEOVER_TXT" "$TIMINGS_JSON" 2>&1 | tail -3

    # Render caption layer
    CAPTION_MP4="$CAPTION_STUDIO_DIR/out/caption-layer.mp4"
    cd "$CAPTION_STUDIO_DIR"
    mkdir -p out
    npx remotion render src/index.jsx CaptionVideo out/caption-layer.mp4 2>&1 | tail -3
    cd - > /dev/null

    if [[ ! -f "$CAPTION_MP4" ]]; then
      echo "  ⚠ Caption render failed — skipping compositing"
    else
      # Composite captions over base video
      ffmpeg -y -loglevel error \
        -i "$OUTPUT" -i "$CAPTION_MP4" \
        -filter_complex "[0:v][1:v]overlay=eof_action=pass[vout]" \
        -map "[vout]" -map 0:a \
        -c:v libx264 -preset medium -crf 22 -c:a copy \
        "$OUTPUT_CAPTIONS"
      CAPTION_SIZE=$(du -h "$OUTPUT_CAPTIONS" | cut -f1)
      echo "  ✓ Captions composited: $OUTPUT_CAPTIONS ($CAPTION_SIZE)"
    fi
  fi
else
  echo ""
  echo "[6/6] Captions disabled (set captions.enabled=true in lesson.json to enable)"
fi

# ---------- Cleanup ----------
if [[ "${KEEP_INTERMEDIATES:-}" != "1" ]]; then
  rm -f "$CONCAT_RAW" "$CONCAT_XFADE" "$WITH_VO" "$WITH_MUSIC" "$GRADED"
fi

echo ""
echo "============================================================"
echo "✓ Lesson video complete (v2)"
echo "============================================================"
echo "Base (no captions):  $OUTPUT ($BASE_SIZE)"
[[ -f "$OUTPUT_CAPTIONS" ]] && echo "With captions:       $OUTPUT_CAPTIONS"
FINAL_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT")
echo "Duration:            ${FINAL_DUR}s"
echo "============================================================"
