#!/bin/bash
# =============================================================================
# AI Skills Studio — make-lesson.sh (storyboard-aware)
# =============================================================================
# Builds the composition from a storyboard.json if present, otherwise
# falls back to the auto-generated template.
#
# Usage:
#   ./scripts/make-lesson.sh <lesson-dir> [--cloud]
#
# With storyboard (recommended for production):
#   <lesson-dir>/storyboard.json    ← per-beat visual plan
#   <lesson-dir>/voiceover.mp3
#   <lesson-dir>/images/*.png       ← one per beat
#
# Without storyboard (auto-generated):
#   <lesson-dir>/script.txt
#   <lesson-dir>/voiceover.mp3
#   <lesson-dir>/style.json
# =============================================================================

set -euo pipefail

LESSON_DIR="${1:-}"
USE_CLOUD=false

shift || true
while [[ $# -gt 0 ]]; do
  case $1 in
    --cloud) USE_CLOUD=true; shift ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "$LESSON_DIR" ]]; then
  echo "Usage: $0 <lesson-dir> [--cloud]"
  exit 1
fi

if [[ ! -d "$LESSON_DIR" ]]; then
  echo "Error: $LESSON_DIR is not a directory"
  exit 1
fi

STUDIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/hyperframes-studio"
BUILD_DIR="$LESSON_DIR/build"
COMPOSITION="$BUILD_DIR/composition.html"
COMPOSITION_MP4="$BUILD_DIR/composition.mp4"
LESSON_FINAL="$LESSON_DIR/lesson-final.mp4"

if $USE_CLOUD && [[ -z "${HYPERFRAMES_API_KEY:-}" ]]; then
  echo "Error: --cloud requires HYPERFRAMES_API_KEY env var"
  exit 1
fi

echo "============================================================"
echo "AI Skills Studio — make-lesson"
echo "============================================================"
echo "Lesson dir:  $LESSON_DIR"
echo "Renderer:    $($USE_CLOUD && echo "Hyperframes cloud" || echo "Local (Playwright)")"
echo "Mode:        $([[ -f "$LESSON_DIR/storyboard.json" ]] && echo "Storyboard" || echo "Auto-generated")"
echo "============================================================"

# Step 1: Build the HTML composition
echo ""
echo "[1/3] Building HTML composition..."
if [[ -f "$LESSON_DIR/storyboard.json" ]]; then
  echo "  Using storyboard.json"
  node "$STUDIO_DIR/scripts/build-from-storyboard.mjs" "$LESSON_DIR"
else
  echo "  Using auto-generated template (no storyboard.json)"
  node "$STUDIO_DIR/scripts/build-composition.mjs" "$LESSON_DIR"
fi

# Step 2: Render
echo ""
echo "[2/3] Rendering to MP4..."
if $USE_CLOUD; then
  node "$STUDIO_DIR/scripts/render-cloud.mjs" "$LESSON_DIR"
else
  node "$STUDIO_DIR/scripts/render-local.mjs" "$LESSON_DIR"
fi

# Step 3: Finalize
echo ""
echo "[3/3] Finalizing..."
cp "$COMPOSITION_MP4" "$LESSON_FINAL"

FINAL_SIZE=$(du -h "$LESSON_FINAL" | cut -f1)
FINAL_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$LESSON_FINAL")

echo ""
echo "============================================================"
echo "✓ Lesson complete"
echo "============================================================"
echo "Output:    $LESSON_FINAL"
echo "Size:      $FINAL_SIZE"
echo "Duration:  ${FINAL_DUR}s"
echo "============================================================"
