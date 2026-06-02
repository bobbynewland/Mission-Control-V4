// AI Skills Studio — Storyboard Composition Builder
// Reads a storyboard.json (beat list with images, captions, animations)
// and generates composition.html with all the GSAP animations per beat.
//
// Usage: node scripts/build-from-storyboard.mjs <lesson-dir>
// Reads: <lesson-dir>/storyboard.json, voiceover.mp3
// Writes: <lesson-dir>/build/composition.html

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { argv, exit } from 'node:process';
import { join } from 'node:path';

const lessonDir = argv[2];
if (!lessonDir) {
  console.error('Usage: node scripts/build-from-storyboard.mjs <lesson-dir>');
  exit(1);
}

const storyboardPath = join(lessonDir, 'storyboard.json');
const voiceoverPath = join(lessonDir, 'voiceover.mp3');
const buildDir = join(lessonDir, 'build');
const outPath = join(buildDir, 'composition.html');

if (!existsSync(storyboardPath)) {
  console.error(`Missing: ${storyboardPath}`);
  exit(1);
}
if (!existsSync(voiceoverPath)) {
  console.error(`Missing: ${voiceoverPath}`);
  exit(1);
}

const storyboard = JSON.parse(readFileSync(storyboardPath, 'utf-8'));
console.log(`Storyboard: "${storyboard.title}" (${storyboard.beats.length} beats)`);

// Get voiceover duration
const totalDur = parseFloat(
  execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceoverPath}"`
  ).toString().trim()
);
console.log(`Voiceover duration: ${totalDur}s`);

// Normalize beats: compute start/end from duration if not specified
let cursor = 0;
for (const beat of storyboard.beats) {
  if (beat.start === undefined) beat.start = cursor;
  if (beat.end === undefined) beat.end = beat.start + (beat.duration || 0);
  cursor = beat.end;
}

// Split each beat's text into caption groups
const captionGroups = [];
for (const beat of storyboard.beats) {
  const wordsPerGroup = beat.captionWordsPerGroup || 3;
  const words = beat.text.split(/\s+/).filter(w => w.length > 0);
  // Estimate word timings within the beat
  const beatDur = beat.end - beat.start;
  const wChars = words.map(w => w.replace(/[^a-zA-Z0-9]/g, '').length + 1);
  const totalChars = wChars.reduce((a, b) => a + b, 0);
  const charTime = beatDur / totalChars;

  let wc = 0;
  const wordTimings = words.map(w => {
    const start = beat.start + wc;
    const end = start + wChars[words.indexOf(w)] * charTime;
    wc = end - beat.start;
    return { word: w.replace(/[.,!?;:]$/, ''), start, end };
  });

  for (let i = 0; i < wordTimings.length; i += wordsPerGroup) {
    const g = wordTimings.slice(i, i + wordsPerGroup);
    captionGroups.push({
      beatId: beat.id,
      words: g,
      start: g[0].start,
      end: g[g.length - 1].end
    });
  }
}

console.log(`Generated ${captionGroups.length} caption groups across ${storyboard.beats.length} beats`);

// Map animation types to GSAP from/to configs
const animConfigs = {
  'zoom-in': { from: { scale: 0.85, opacity: 0 }, to: { scale: 1, opacity: 1, duration: 0.6, ease: 'power2.out' } },
  'zoom-out-slow': { from: { scale: 1.1, opacity: 0 }, to: { scale: 1, opacity: 1, duration: 1.2, ease: 'power2.out' } },
  'fade-in-slow': { from: { opacity: 0 }, to: { opacity: 1, duration: 1.0, ease: 'sine.out' } },
  'slide-in-from-right': { from: { x: 200, opacity: 0 }, to: { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' } },
  'slide-in-from-left': { from: { x: -200, opacity: 0 }, to: { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' } },
  'scale-in': { from: { scale: 0.5, opacity: 0 }, to: { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.4)' } },
  'pan-left-to-right': { from: { x: -100, opacity: 0 }, to: { x: 0, opacity: 1, duration: 1.0, ease: 'sine.inOut' } }
};

const brand = storyboard.brand;
const render = storyboard.render || { width: 1920, height: 1080, fps: 30 };

// Build the HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${storyboard.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${brand.background};
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    #stage {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    /* Scene images layer (one per beat) */
    .scene {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      will-change: transform, opacity;
    }
    .scene img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .scene.active {
      opacity: 1;
    }

    /* Subtle gradient overlay so captions are always readable */
    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg,
        rgba(0, 0, 0, 0) 0%,
        rgba(0, 0, 0, 0) 50%,
        rgba(0, 0, 0, 0.4) 100%);
      pointer-events: none;
    }

    /* Captions */
    #captions {
      position: absolute;
      bottom: 8%;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      max-width: 90%;
      margin: 0 auto;
      padding: 0 40px;
      text-align: center;
      z-index: 100;
    }
    .caption-group {
      position: absolute;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      opacity: 0;
    }
    .word {
      display: inline-block;
      font-size: 64px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: -0.02em;
      padding: 0 6px;
      margin: 0 2px;
      text-shadow: 0 4px 24px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.85);
    }
    .word.emphasis {
      color: ${brand.gold};
      font-weight: 800;
    }

    /* Watermark */
    #watermark {
      position: absolute;
      top: 36px;
      left: 36px;
      font-size: 16px;
      font-weight: 500;
      color: #FFFFFF;
      opacity: 0.7;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      z-index: 50;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    }

    /* Beat label (for debugging) */
    #beat-label {
      position: absolute;
      top: 36px;
      right: 36px;
      font-size: 12px;
      color: #FFFFFF;
      opacity: 0.4;
      z-index: 50;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div id="stage">
    <div id="watermark">${brand.watermark || 'AI Skills Studio'}</div>
    <div id="beat-label"></div>

    <!-- Scene images -->
    ${storyboard.beats.map(beat => `
      <div class="scene" data-beat="${beat.id}">
        <img src="file://${join(lessonDir, beat.image)}" alt="${beat.scene}">
      </div>
    `).join('\n')}

    <div class="overlay"></div>

    <!-- Captions -->
    <div id="captions">
      ${captionGroups.map((g, gi) => `
        <div class="caption-group" data-caption="${gi}">
          ${g.words.map(w => `
            <span class="word${beatHasWord(g.beatId, w.word, storyboard) ? ' emphasis' : ''}">${w.word}</span>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <!-- Voiceover -->
    <audio id="vo" src="file://${voiceoverPath}" preload="auto"></audio>
  </div>

  <script>
    const totalDur = ${totalDur};
    const beats = ${JSON.stringify(storyboard.beats)};
    const captionGroups = ${JSON.stringify(captionGroups)};

    // === Master timeline ===
    const tl = gsap.timeline({ paused: true });

    // Scene transitions
    beats.forEach((beat, i) => {
      const sceneEl = document.querySelector('[data-beat="' + beat.id + '"]');
      const animType = beat.animation || 'fade-in-slow';
      const config = ${JSON.stringify(animConfigs)}[animType] || ${JSON.stringify(animConfigs)}['fade-in-slow'];

      // Initial state
      gsap.set(sceneEl, { opacity: 0, ...config.from });

      // Animate in
      tl.to(sceneEl, { ...config.to, duration: config.to.duration }, beat.start);
      tl.set(sceneEl, { opacity: 1, ...config.to });

      // Animate out (unless it's the last beat)
      if (i < beats.length - 1) {
        tl.to(sceneEl, { opacity: 0, duration: 0.4, ease: 'power2.in' }, beat.end - 0.2);
      }

      // Beat label debug
      tl.call(() => {
        document.getElementById('beat-label').textContent = beat.id;
      }, [], beat.start);
    });

    // Captions
    const captionTl = gsap.timeline({ paused: true });
    captionGroups.forEach((g, i) => {
      const el = document.querySelector('[data-caption="' + i + '"]');
      const dur = (g.end - g.start) * 0.15;
      captionTl.to(el, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, g.start);
      captionTl.to(el, { opacity: 0, y: -15, duration: 0.2, ease: 'power2.in' }, g.end + 0.1);
    });

    // Audio sync
    const audio = document.getElementById('vo');
    audio.addEventListener('play', () => {
      tl.play(0);
      captionTl.play(0);
    });
    audio.addEventListener('ended', () => {
      tl.pause();
      captionTl.pause();
    });

    window.addEventListener('load', () => {
      audio.play().catch(err => {
        console.error('Audio play failed:', err);
        tl.play(0);
        captionTl.play(0);
      });
    });
  </script>
</body>
</html>`;

// Helper: check if a word is in the beat's emphasis list
function beatHasWord(beatId, word, storyboard) {
  const beat = storyboard.beats.find(b => b.id === beatId);
  if (!beat || !beat.emphasis) return false;
  return beat.emphasis.some(w => w.toLowerCase() === word.toLowerCase());
}

mkdirSync(buildDir, { recursive: true });
writeFileSync(outPath, html);
console.log(`✓ Wrote ${outPath}`);
console.log(`  Size: ${(html.length / 1024).toFixed(1)} KB`);
console.log(`  Beats: ${storyboard.beats.length}`);
console.log(`  Captions: ${captionGroups.length}`);
console.log(`  Total duration: ${totalDur}s`);
