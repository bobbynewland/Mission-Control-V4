# AI Skills Studio — Lesson Video Editor

A shell script + config pipeline that takes individual video segments (from Flow, Veo, Omni) and produces a final polished lesson video.

## Quick start

### 1. Set up your lesson folder

```bash
mkdir -p ~/Videos/lessons/lesson-01/segments
cp templates/lesson.json ~/Videos/lessons/lesson-01/
```

### 2. Drop in your files

```
lesson-01/
├── lesson.json          # config (copy from templates/)
├── segments/
│   ├── s1-hook.mp4      # from Flow/Veo (10 sec)
│   ├── s2-big-idea.mp4  # 10 sec
│   ├── s3-what-it-does.mp4  # 12 sec
│   ├── s4-reassurance.mp4   # 8 sec
│   └── s5-win.mp4       # 10 sec
├── voiceover.mp3        # the TTS voiceover
└── music.mp3            # background music (optional, 75+ sec)
```

### 3. Run the editor

```bash
./scripts/lesson-edit.sh ~/Videos/lessons/lesson-01
```

### 4. Get the output

```
lesson-01/output/lesson-final.mp4
```

## What the script does

1. **Concatenates** all segments with crossfade transitions (0.3s default)
2. **Layers the voiceover** over the video (pads with silence or trims to match)
3. **Adds background music** at low volume (looped/trimmed to video length)
4. **Applies a unified color grade** (warmth, saturation, contrast, brightness)
5. **Exports** to `output/lesson-final.mp4`

## Configurable in lesson.json

```json
{
  "crossfade": 0.3,              // seconds between segments
  "resolution": "1920x1080",     // output size
  "fps": 30,                     // output framerate
  "voiceoverVolume": 1.0,        // 0.0 to 2.0
  "musicVolume": 0.10,           // 0.0 to 1.0 (0.10 = subtle background)
  "colorGrade": {
    "saturation": 1.03,          // 0.0 (gray) to 2.0 (vivid)
    "contrast": 1.02,            // 0.5 (flat) to 2.0 (harsh)
    "brightness": 0.01,          // -1.0 (black) to 1.0 (white)
    "warmth": 0.04               // -1.0 (cold blue) to 1.0 (hot red)
  }
}
```

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

### Render at 4K

```json
{
  "resolution": "3840x2160",
  "fps": 30
}
```

### Use a different music volume

```json
{
  "musicVolume": 0.15
}
```

## Adding more segments

Just add the file to `segments/` and update `lesson.json`:

```json
"segments": [
  { "id": "s1-hook", "file": "segments/s1-hook.mp4", "duration": 10, ... },
  { "id": "s2-big-idea", "file": "segments/s2-big-idea.mp4", "duration": 10, ... },
  // new segment here:
  { "id": "s2b-extra", "file": "segments/s2b-extra.mp4", "duration": 5, ... },
  { "id": "s3-what-it-does", "file": "segments/s3-what-it-does.mp4", "duration": 12, ... }
]
```

The script auto-detects and processes any mp4/mov in `segments/`.

## Requirements

- `ffmpeg` 4.0+ (8.x recommended for hardware acceleration)
- `ffprobe` (comes with ffmpeg)
- `jq` (for JSON parsing)
- `bc` (for math in the shell)

Install on macOS:
```bash
brew install ffmpeg jq bc
```

## Roadmap

This is the v1 (CLI script). Future versions:

- **v2**: Add Remotion-based title card rendering
- **v3**: Add character consistency pass using Hyperframes API
- **v4**: Web UI for drag-and-drop segment ordering
- **v5**: Auto-generate on-screen text overlays from voiceover transcript

## Troubleshooting

**"command not found"** — install missing dependency with `brew install <pkg>`

**Crossfade timing is off** — adjust the offsets in the script or reduce crossfade duration in lesson.json to 0.1

**Audio is out of sync** — usually means the voiceover and video have different durations. The script handles padding/trimming, but if it's noticeably off, regenerate one of them to match.

**Color grade looks wrong** — tweak the `colorGrade` values in lesson.json. Start with `warmth: 0.0` and increase by 0.02 at a time.
