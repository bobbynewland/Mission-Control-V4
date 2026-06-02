#!/bin/bash
# =============================================================================
# AI Skills Studio — make-lesson.sh
# =============================================================================
# One-command lesson production. Takes a script + voiceover, generates
# the HTML composition, renders to MP4, and outputs the final lesson.
#
# Usage:
#   ./scripts/make-lesson.sh <lesson-dir> [--cloud]
#
# Required files in <lesson-dir>:
#   script.txt      - the dialog (one paragraph, plain text)
#   voiceover.mp3   - the TTS voiceover
#   style.json      - brand colors, title, animation settings
#
# Optional:
#   --cloud   Use Hyperframes.app API instead of local rendering
#             (requires HYPERFRAMES_API_KEY env var)
#
# Output:
#   <lesson-dir>/build/composition.html
#   <lesson-dir>/build/composition.mp4
#   <lesson-dir>/lesson-final.mp4
# =============================================================================

set -euo pipefail

LESSON_DIR="${1:-}"
USE_CLOUD=false

# Parse flags
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

# Check for Hyperframes key if cloud requested
if $USE_CLOUD && [[ -z "${HYPERFRAMES_API_KEY:-}" ]]; then
  echo "Error: --cloud requires HYPERFRAMES_API_KEY env var"
  echo "Get one at https://hyperframes.app/ → Settings → API"
  exit 1
fi

echo "============================================================"
echo "AI Skills Studio — make-lesson"
echo "============================================================"
echo "Lesson dir:  $LESSON_DIR"
echo "Renderer:    $($USE_CLOUD && echo "Hyperframes cloud" || echo "Local (Playwright)")"
echo "============================================================"

# Step 1: Build the HTML composition
echo ""
echo "[1/3] Building HTML composition..."
node "$STUDIO_DIR/scripts/build-composition.mjs" "$LESSON_DIR"

# Step 2: Render to MP4
echo ""
echo "[2/3] Rendering to MP4..."
if $USE_CLOUD; then
  node "$STUDIO_DIR/scripts/render-cloud.mjs" "$LESSON_DIR"
else
  node "$STUDIO_DIR/scripts/render-local.mjs" "$LESSON_DIR"
fi

# Step 3: Copy to lesson-final.mp4
echo ""
echo "[3/3] Finalizing..."
cp "$COMPOSITION_MP4" "$LESSON_FINAL"
echo "  ✓ $LESSON_FINAL"

# Get final stats
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
