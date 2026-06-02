# AI Skills Studio — Lesson Video Pipeline (v3)

Two rendering paths, one orchestrator. Generate explainer videos from a script + voiceover in under 60 seconds.

## What's new in v3

- **Hyperframes-style pipeline**: HTML + GSAP rendered to MP4 (no React, no Remotion)
- **Animated motion graphics**: sphere with rotating rings, icon cluster, kinetic captions — all in code
- **Two renderers, one command**: local (Playwright, free) or cloud (hyperframes.app API, fast)
- **Simpler inputs**: just `script.txt` + `voiceover.mp3` + `style.json`

## Quick start

### 1. Set up a lesson folder

```bash
mkdir -p ~/Videos/lessons/lesson-01
```

### 2. Drop in 3 files

```
lesson-01/
├── script.txt      # the dialog (one paragraph, plain text)
├── voiceover.mp3   # the TTS voiceover
└── style.json      # brand colors + animation settings
```

Example `style.json`:
```json
{
  "title": "What is an AI Employee?",
  "background": "#F5F1E8",
  "colors": {
    "background": "#F5F1E8",
    "text": "#1a1a1a",
    "gold": "#E8B96B",
    "sage": "#7A9B7E"
  },
  "captions": {
    "wordsPerGroup": 3
  }
}
```

### 3. Run the orchestrator

**Local render (free, ~60s):**
```bash
./scripts/make-lesson.sh ~/Videos/lessons/lesson-01
```

**Cloud render (paid, ~3 min):**
```bash
export HYPERFRAMES_API_KEY=hf_...
./scripts/make-lesson.sh ~/Videos/lessons/lesson-01 --cloud
```

### 4. Get the output

```
lesson-01/
├── build/
│   ├── composition.html   # the rendered HTML (for debugging)
│   └── composition.mp4    # rendered MP4
└── lesson-final.mp4       # final, ready to publish
```

## How it works

### Stage 1: Build composition
`build-composition.mjs` reads the script + voiceover, generates word-level timings (heuristic), and produces an HTML file with embedded GSAP animations:
- Animated sphere with 3 rotating rings
- Icon cluster (📱💬📄📊⏰✉️) fades in
- 3-word kinetic caption groups pop in/out with timing synced to voiceover
- Brand watermark

### Stage 2: Render to MP4

**Local path (`render-local.mjs`):**
- Launches headless Chrome via Playwright
- Loads the composition HTML
- Auto-plays the embedded audio
- Records the page for the duration of the audio
- Converts WebM → MP4 with ffmpeg
- Composites the voiceover

**Cloud path (`render-cloud.mjs`):**
- Submits the HTML to hyperframes.app API
- Polls for completion (~3 min)
- Downloads the MP4

## Why two renderers?

| | Local | Cloud |
|---|---|---|
| Cost | Free | Pay per render |
| Speed | ~60s/lesson | ~3 min/lesson |
| Quality | Excellent | Excellent (server-side, no headless Chrome quirks) |
| Use when | Iteration, testing, <10 videos | Scale, 50+ videos |

For the **MVP target of 40 videos (20 courses + 20 skill drops)**, local is fine. ~40 minutes of total render time across all videos. Cloud is for when you want to scale to 100s.

## Customizing the animation

Edit `hyperframes-studio/scripts/build-composition.mjs`. The HTML template is a single string, all the GSAP timeline is at the bottom. Common tweaks:

**Change the sphere colors:**
```javascript
background: radial-gradient(circle at 30% 30%,
  ${style.colors?.gold || '#E8B96B'} 0%,
  ...);
```

**Add more visuals (chart, particles, etc.):**
Add a `<div class="visual">` block, add the CSS, add a `gsap.to()` call in the timeline.

**Change caption pace:**
```json
{ "captions": { "wordsPerGroup": 2 } }
```

**Different animation style per lesson:**
Create multiple style.json files:
- `style-explainer.json` — clean sphere + icons
- `style-data.json` — animated charts instead of sphere
- `style-storytelling.json` — character animations

## Roadmap

- [ ] **v3.1**: Whisper-based word-level timing (replace heuristic)
- [ ] **v3.2**: Real b-roll integration (embed Flow videos as `<video>` elements)
- [ ] **v3.3**: Multiple animation styles (data viz, storytelling, etc.)
- [ ] **v3.4**: Sub-agent: `make-course.sh` that produces a full 7-lesson course from one topic
- [ ] **v3.5**: HeyGen avatar integration for instructor-led courses

## Requirements

- `ffmpeg` 8.x
- `node` 18+
- `npm`
- `playwright` (auto-installed in `hyperframes-studio/`)

For cloud:
- `HYPERFRAMES_API_KEY` env var

## Cost math (40 videos)

| | Local | Cloud |
|---|---|---|
| Per video | Free | ~$0.50-2.00 |
| 40 videos | $0 | ~$20-80 |
| Time | ~40 min | ~2 hours |
| Best for | MVP, testing | Scale, polish |

## What's in the older v1/v2?

The v1/v2 pipeline (FFmpeg + Remotion captions) is still in the repo at:
- `scripts/lesson-edit.sh` — original v1/v2 pipeline
- `caption-studio/` — Remotion captions (kept as a backup option)

v3 is the **recommended path** going forward.
