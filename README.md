# AI Skills Studio — Lesson Video Editor

A complete video production pipeline for educational explainer videos. Takes individual video segments (from Flow, Veo, Omni) + voiceover + optional music and produces a final polished lesson video, with optional kinetic captions.

## Quick start

### 1. Set up your lesson folder

```bash
mkdir -p ~/Videos/lessons/lesson-01/segments
cp templates/lesson.json ~/Videos/lessons/lesson-01/
```

### 2. Drop in your files

```
lesson-01/
├── lesson.json              # config (copy from templates/)
├── segments/
│   ├── s1-hook.mp4
│   ├── s2-big-idea.mp4
│   └── ... (more segments)
├── voiceover.mp3            # the TTS voiceover
├── voiceover.txt            # the voiceover text (for caption timing)
└── music.mp3                # background music (optional)
```

### 3. Run the editor

```bash
./scripts/lesson-edit.sh ~/Videos/lessons/lesson-01
```

### 4. Get the outputs

```
lesson-01/output/lesson-final.mp4           # base render, no captions
lesson-01/output/lesson-with-captions.mp4   # with kinetic captions (Remotion)
```

## What the script does (6 steps)

1. **Concatenates** all segments with configurable crossfade (default 0.3s)
2. **Layers the voiceover** over the video (pads with silence or trims to match)
3. **Adds background music** at low volume (looped/trimmed to video length)
4. **Applies a unified color grade** (warmth, saturation, contrast, brightness)
5. **Exports** the base render to `lesson-final.mp4`
6. **(Optional) Renders kinetic captions** via Remotion and composites on top → `lesson-with-captions.mp4`

## Kinetic captions (v2)

The caption step uses Remotion to render word-by-word kinetic typography:

- **2 words per group**, centered in the lower-middle of the frame
- **Pop-in/out animation** per word (spring-based, smooth)
- **Emphasis color** (gold) for content words (5+ chars, capitalized)
- **White text** for the rest
- **Brand watermark** in the top-left corner
- **Transparent background** so it composites cleanly on the base video

**Caption timing** is estimated from:
- Total voiceover audio duration
- Per-word character count
- Punctuation pauses (sentence ends = 0.5s pause, clause ends = 0.2s)

This is a heuristic — not perfect, but close. For precise word-level timing, integrate Whisper or another STT tool.

### Customizing the captions

Edit `caption-studio/src/CaptionVideo.jsx`:
- `fontSize` — change 72 to your preferred size
- `wordsPerGroup` — change 2 to 1 (single words) or 3 (phrases)
- `COLORS.emphasis` — the gold accent color
- Position: change `bottom: 100` to move the captions up or down

## Configurable in lesson.json

```json
{
  "crossfade": 0.3,
  "resolution": "1920x1080",
  "fps": 30,
  "voiceoverVolume": 1.0,
  "musicVolume": 0.10,
  "colorGrade": {
    "saturation": 1.03,
    "contrast": 1.02,
    "brightness": 0.01,
    "warmth": 0.04
  },
  "captions": {
    "enabled": true,
    "engine": "remotion",
    "wordsPerGroup": 2,
    "emphasisColor": "#E8B96B",
    "textColor": "#FFFFFF",
    "watermark": "AI Skills Studio"
  }
}
```

To disable captions, set `"captions": { "enabled": false }`.

## First-time setup

The caption studio is a separate Node project. First run:

```bash
cd caption-studio
npm install
```

This installs Remotion + React. After that, the lesson editor can call it.

## Advanced options

### Keep intermediate files (for debugging)

```bash
KEEP_INTERMEDIATES=1 ./scripts/lesson-edit.sh ~/Videos/lessons/lesson-01
```

Intermediate files saved to `output/`:
- `01-concat-raw.mp4` — segments joined, no crossfade
- `02-concat-xfade.mp4` — with crossfades
- `03-with-voiceover.mp4` — voiceover layered
- `04-with-music.mp4` — music added
- `05-graded.mp4` — color graded

## Requirements

- `ffmpeg` 4.0+ (8.x recommended for hardware acceleration)
- `ffprobe` (comes with ffmpeg)
- `jq` (for JSON parsing)
- `bc` (for shell math)
- `node` 18+ (for Remotion caption rendering)
- `npm` (for installing Remotion)

Install on macOS:
```bash
brew install ffmpeg jq bc node
```

## Roadmap

- **v3**: Replace heuristic timing with Whisper-based word-level timestamps
- **v4**: Add Hyperframes-style motion graphics (b-roll punch-zooms, accent shapes)
- **v5**: Web UI for drag-and-drop segment ordering
- **v6**: Auto-generate on-screen text overlays matching the voiceover

## Troubleshooting

**"ffmpeg: command not found"** — `brew install ffmpeg`

**"Cannot find module 'remotion'"** — run `cd caption-studio && npm install`

**Captions out of sync with voice** — the heuristic timing is approximate. For better sync, use a real STT tool (Whisper, Deepgram) to generate `voiceover.txt` with word-level timestamps.

**Caption position blocks the 3D objects** — edit `caption-studio/src/CaptionVideo.jsx`, change `bottom: 100` to a smaller value (e.g., `bottom: 60`).

**Output is huge** — change `crf: 22` to `crf: 26` in the FFmpeg command line in the script for smaller files (lower quality).
