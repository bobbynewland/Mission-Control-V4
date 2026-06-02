// AI Skills Studio — Storyboard Composition Builder (stop-motion mode)
// Same as build-from-storyboard.mjs but with stop-motion styling:
//   - Animations snap to 12fps instead of smooth
//   - Subtle position jitter on every keyframe (clay-on-arms feel)
//   - No smooth easing (step easing everywhere)
//   - Optional paper texture overlay
//   - Frame-by-frame caption appearance (no slide-in)
//
// Usage: node scripts/build-from-storyboard-stopmotion.mjs <lesson-dir>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { argv, exit } from 'node:process';
import { join } from 'node:path';

const lessonDir = argv[2];
if (!lessonDir) {
  console.error('Usage: node scripts/build-from-storyboard-stopmotion.mjs <lesson-dir>');
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
console.log(`Storyboard: "${storyboard.title}" (${storyboard.beats.length} beats) [STOP-MOTION]`);

const totalDur = parseFloat(
  execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceoverPath}"`
  ).toString().trim()
);
console.log(`Voiceover duration: ${totalDur}s`);

let cursor = 0;
for (const beat of storyboard.beats) {
  if (beat.start === undefined) beat.start = cursor;
  if (beat.end === undefined) beat.end = beat.start + (beat.duration || 0);
  cursor = beat.end;
}

// Caption groups (frame-by-frame, not smooth)
const captionGroups = [];
for (const beat of storyboard.beats) {
  const wordsPerGroup = beat.captionWordsPerGroup || 3;
  const words = beat.text.split(/\s+/).filter(w => w.length > 0);
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

console.log(`Generated ${captionGroups.length} caption groups`);

// Stop-motion animation configs (snap easing, position jitter)
const animConfigs = {
  'zoom-in': {
    from: { scale: 0.85, opacity: 0, x: 0, y: 0, rotation: 0 },
    to: { scale: 1, opacity: 1, duration: 0.6, ease: 'steps(8)' }
  },
  'zoom-out-slow': {
    from: { scale: 1.1, opacity: 0 },
    to: { scale: 1, opacity: 1, duration: 1.0, ease: 'steps(10)' }
  },
  'fade-in-slow': {
    from: { opacity: 0 },
    to: { opacity: 1, duration: 0.8, ease: 'steps(6)' }
  },
  'slide-in-from-right': {
    from: { x: 200, opacity: 0 },
    to: { x: 0, opacity: 1, duration: 0.7, ease: 'steps(8)' }
  },
  'slide-in-from-left': {
    from: { x: -200, opacity: 0 },
    to: { x: 0, opacity: 1, duration: 0.7, ease: 'steps(8)' }
  },
  'scale-in': {
    from: { scale: 0.5, opacity: 0 },
    to: { scale: 1, opacity: 1, duration: 0.6, ease: 'steps(6)' }
  },
  'pan-left-to-right': {
    from: { x: -100, opacity: 0 },
    to: { x: 0, opacity: 1, duration: 1.0, ease: 'steps(10)' }
  }
};

const brand = storyboard.brand;
const render = storyboard.render || { width: 1920, height: 1080, fps: 30 };
const isStopMotion = true; // this builder is stop-motion only
const jitter = storyboard.style?.stopMotion?.jitter ?? 3; // px of position wobble
const frameRate = storyboard.style?.stopMotion?.frameRate ?? 12; // 12fps = classic stop-motion
const paperTexture = storyboard.style?.stopMotion?.paperTexture ?? true;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${storyboard.title} [stop-motion]</title>
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

    /* === Stop-motion scene images === */
    .scene {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      will-change: transform, opacity;
      transform-origin: center center;
    }
    .scene img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .scene.active {
      opacity: 1;
    }

    /* === Paper texture overlay (very subtle) === */
    ${paperTexture ? `
    #paper {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 99;
      opacity: 0.08;
      mix-blend-mode: multiply;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>");
    }
    ` : ''}

    /* === Vignette (helps with stop-motion feel) === */
    .vignette {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(ellipse at center,
        transparent 50%,
        rgba(0, 0, 0, 0.15) 100%);
      z-index: 50;
    }

    /* === Captions (frame-by-frame, no slide) === */
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
      font-size: 60px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.02em;
      padding: 0 6px;
      margin: 0 2px;
      text-shadow: 0 4px 0 rgba(0, 0, 0, 0.95), 0 2px 0 rgba(0, 0, 0, 0.95);
      /* hard, comic-book edges, no anti-aliased smooth feel */
      -webkit-font-smoothing: none;
      font-smooth: never;
    }
    .word.emphasis {
      color: ${brand.gold};
      /* slight tilt for hand-cut feel */
      transform: rotate(-1.5deg);
      display: inline-block;
    }

    /* === Watermark === */
    #watermark {
      position: absolute;
      top: 36px;
      left: 36px;
      font-size: 14px;
      font-weight: 700;
      color: #FFFFFF;
      opacity: 0.85;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      z-index: 101;
      text-shadow: 0 2px 0 rgba(0, 0, 0, 0.9);
    }
  </style>
</head>
<body>
  <div id="stage">
    <div id="watermark">${brand.watermark || 'AI Skills Studio'}</div>

    ${storyboard.beats.map(beat => `
      <div class="scene" data-beat="${beat.id}">
        <img src="file://${join(lessonDir, beat.image)}" alt="${beat.scene}">
      </div>
    `).join('\n')}

    <div class="vignette"></div>
    ${paperTexture ? '<div id="paper"></div>' : ''}

    <div id="captions">
      ${captionGroups.map((g, gi) => `
        <div class="caption-group" data-caption="${gi}">
          ${g.words.map(w => `
            <span class="word${beatHasWord(g.beatId, w.word, storyboard) ? ' emphasis' : ''}">${w.word}</span>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <audio id="vo" src="file://${voiceoverPath}" preload="auto"></audio>
  </div>

  <script>
    const totalDur = ${totalDur};
    const beats = ${JSON.stringify(storyboard.beats)};
    const captionGroups = ${JSON.stringify(captionGroups)};
    const frameRate = ${frameRate};
    const jitter = ${jitter};

    // === Master timeline (stop-motion style) ===
    const tl = gsap.timeline({ paused: true });

    // === Scene transitions with stop-motion frame-stepping ===
    beats.forEach((beat, i) => {
      const sceneEl = document.querySelector('[data-beat="' + beat.id + '"]');
      const animType = beat.animation || 'fade-in-slow';
      const config = ${JSON.stringify(animConfigs)}[animType] || ${JSON.stringify(animConfigs)}['fade-in-slow'];

      // Initial state
      gsap.set(sceneEl, { opacity: 0, ...config.from });

      // Animate in with step easing
      tl.to(sceneEl, {
        ...config.to,
        duration: config.to.duration
      }, beat.start);

      // === Stop-motion jitter loop ===
      // Apply a tiny position wobble every frame (1/frameRate seconds)
      // This is the "clay on arms" effect
      const jitterDur = beat.end - beat.start - 0.4;
      if (jitterDur > 0.5) {
        const jitterStepCount = Math.floor(jitterDur * frameRate);
        for (let j = 0; j < jitterStepCount; j++) {
          const t = beat.start + 0.4 + (j / frameRate);
          if (t < beat.end - 0.4) {
            tl.to(sceneEl, {
              x: (Math.random() - 0.5) * jitter * 2,
              y: (Math.random() - 0.5) * jitter * 2,
              rotation: (Math.random() - 0.5) * 0.4,
              duration: 1 / frameRate,
              ease: 'steps(1)'
            }, t);
          }
        }
      }

      // Animate out
      if (i < beats.length - 1) {
        tl.to(sceneEl, {
          opacity: 0,
          duration: 0.2,
          ease: 'steps(2)'
        }, beat.end - 0.2);
      }
    });

    // === Captions (frame-by-frame, no smooth) ===
    const captionTl = gsap.timeline({ paused: true });
    captionGroups.forEach((g, i) => {
      const el = document.querySelector('[data-caption="' + i + '"]');
      // Pop in
      captionTl.to(el, { opacity: 1, duration: 0.05, ease: 'steps(1)' }, g.start);
      // Pop out
      captionTl.to(el, { opacity: 0, duration: 0.05, ease: 'steps(1)' }, g.end);
    });

    // === Audio sync ===
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

function beatHasWord(beatId, word, storyboard) {
  const beat = storyboard.beats.find(b => b.id === beatId);
  if (!beat || !beat.emphasis) return false;
  return beat.emphasis.some(w => w.toLowerCase() === word.toLowerCase());
}

mkdirSync(buildDir, { recursive: true });
writeFileSync(outPath, html);
console.log(`✓ Wrote ${outPath}`);
console.log(`  Size: ${(html.length / 1024).toFixed(1)} KB`);
console.log(`  Style: stop-motion @ ${frameRate}fps, jitter ${jitter}px`);
console.log(`  Paper texture: ${paperTexture}`);
