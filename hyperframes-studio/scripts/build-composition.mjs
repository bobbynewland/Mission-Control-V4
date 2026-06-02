// AI Skills Studio — Composition Builder
// Takes a script + voiceover + style config, generates composition.html
// with GSAP animations, embedded audio, and word-level captions.
//
// Usage: node scripts/build-composition.mjs <lesson-dir>
// Reads: <lesson-dir>/script.txt, voiceover.mp3, style.json
// Writes: <lesson-dir>/build/composition.html

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { argv, exit } from 'node:process';
import { join } from 'node:path';

const lessonDir = argv[2];
if (!lessonDir) {
  console.error('Usage: node scripts/build-composition.mjs <lesson-dir>');
  exit(1);
}

const scriptPath = join(lessonDir, 'script.txt');
const voiceoverPath = join(lessonDir, 'voiceover.mp3');
const stylePath = join(lessonDir, 'style.json');
const buildDir = join(lessonDir, 'build');
const outPath = join(buildDir, 'composition.html');

if (!existsSync(scriptPath)) {
  console.error(`Missing: ${scriptPath}`);
  exit(1);
}
if (!existsSync(voiceoverPath)) {
  console.error(`Missing: ${voiceoverPath}`);
  exit(1);
}
if (!existsSync(stylePath)) {
  console.error(`Missing: ${stylePath}`);
  exit(1);
}

const script = readFileSync(scriptPath, 'utf-8').trim();
const style = JSON.parse(readFileSync(stylePath, 'utf-8'));

// Get voiceover duration
const dur = parseFloat(
  execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceoverPath}"`
  ).toString().trim()
);

console.log(`Voiceover duration: ${dur}s`);

// Generate word-level timings (heuristic, same as before)
const words = script.split(/\s+/).filter(w => w.length > 0);
const wordChars = words.map(w => w.replace(/[^a-zA-Z0-9]/g, '').length + 1);
const punctPenalty = words.map(w => {
  if (/[.!?]$/.test(w)) return 0.5;
  if (/[,;:]$/.test(w)) return 0.2;
  return 0;
});
const totalChars = wordChars.reduce((a, b) => a + b, 0);
const totalPunct = punctPenalty.reduce((a, b) => a + b, 0);
const charTime = (dur - totalPunct) / totalChars;

let cursor = 0;
const timings = words.map((word, i) => {
  const start = cursor;
  const end = cursor + wordChars[i] * charTime;
  cursor = end + punctPenalty[i];
  const isEmphasis = wordChars[i] >= 6 || /^[A-Z]/.test(word);
  return {
    word: word.replace(/[.,!?;:]$/, ''),
    start: parseFloat(start.toFixed(3)),
    end: parseFloat(end.toFixed(3)),
    emphasis: isEmphasis
  };
});

// Split into caption groups (3 words per group for Hyperframes — more breathing room)
const wordsPerGroup = style.captions?.wordsPerGroup || 3;
const groups = [];
for (let i = 0; i < timings.length; i += wordsPerGroup) {
  const g = timings.slice(i, i + wordsPerGroup);
  groups.push({
    words: g,
    start: g[0].start,
    end: g[g.length - 1].end
  });
}

console.log(`Generated ${timings.length} word timings, ${groups.length} caption groups`);

// Build the composition HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${style.title || 'AI Skills Studio Lesson'}</title>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${style.background || '#F5F1E8'};
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    #stage {
      position: relative;
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* === Visual elements === */
    .visual {
      position: absolute;
      will-change: transform, opacity;
    }

    .sphere {
      width: 320px;
      height: 320px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%,
        ${style.colors?.gold || '#E8B96B'} 0%,
        ${style.colors?.gold || '#E8B96B'}cc 40%,
        ${style.colors?.sage || '#7A9B7E'}99 100%);
      box-shadow: 0 30px 80px rgba(232, 185, 107, 0.3),
                  inset 0 -20px 40px rgba(0, 0, 0, 0.1);
    }

    .sphere-rings {
      position: absolute;
      width: 480px;
      height: 480px;
      border: 2px solid ${style.colors?.gold || '#E8B96B'}66;
      border-radius: 50%;
      opacity: 0;
    }
    .sphere-rings.r2 {
      width: 640px;
      height: 640px;
      border-color: ${style.colors?.sage || '#7A9B7E'}55;
    }
    .sphere-rings.r3 {
      width: 800px;
      height: 800px;
      border-color: ${style.colors?.gold || '#E8B96B'}33;
    }

    .icon-cluster {
      position: absolute;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 40px;
      opacity: 0;
    }
    .icon-cluster .icon {
      width: 100px;
      height: 100px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      color: ${style.colors?.sage || '#7A9B7E'};
    }

    /* === Captions === */
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
      color: ${style.colors?.text || '#1a1a1a'};
      letter-spacing: -0.02em;
      padding: 0 6px;
      margin: 0 2px;
    }
    .word.emphasis {
      color: ${style.colors?.gold || '#E8B96B'};
      font-weight: 800;
    }

    /* === Watermark === */
    #watermark {
      position: absolute;
      top: 36px;
      left: 36px;
      font-size: 16px;
      font-weight: 500;
      color: ${style.colors?.text || '#1a1a1a'};
      opacity: 0.5;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      z-index: 50;
    }
  </style>
</head>
<body>
  <div id="stage">
    <div id="watermark">AI Skills Studio</div>

    <!-- Visual layer (animated by GSAP) -->
    <div class="visual" id="visual-layer">
      <div class="sphere-rings r3" id="r3"></div>
      <div class="sphere-rings r2" id="r2"></div>
      <div class="sphere-rings" id="r1"></div>
      <div class="sphere" id="sphere"></div>
      <div class="icon-cluster" id="icons">
        <div class="icon">📱</div>
        <div class="icon">💬</div>
        <div class="icon">📄</div>
        <div class="icon">📊</div>
        <div class="icon">⏰</div>
        <div class="icon">✉️</div>
      </div>
    </div>

    <!-- Caption layer -->
    <div id="captions">
      ${groups.map((g, gi) => `
        <div class="caption-group" data-group="${gi}">
          ${g.words.map(w => `
            <span class="word${w.emphasis ? ' emphasis' : ''}">${w.word}</span>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <!-- Voiceover -->
    <audio id="vo" src="file://${voiceoverPath}" preload="auto"></audio>
  </div>

  <script>
    const totalDur = ${dur};
    const groups = ${JSON.stringify(groups)};

    // === Visual timeline (5 acts, ~equal parts) ===
    const actDur = totalDur / 5;

    // Act 1: Hook — sticky note + icons cluster fades in
    // Act 2: Big idea — sphere opens, character at desk
    // Act 3: What it does — command panel orbit
    // Act 4: Reassurance — figure relaxing
    // Act 5: Win — figures with orbiting wins

    const tl = gsap.timeline({ paused: true });

    // Initial state — everything hidden
    gsap.set(['#sphere', '#r1', '#r2', '#r3', '#icons'], { opacity: 0, scale: 0.8 });
    gsap.set('.caption-group', { opacity: 0, y: 30 });

    // Act 1: Icons cluster appears
    tl.to('#icons', { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, 0.2)
      .to('#icons', { y: '+=20', duration: 4, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.7);

    // Act 2: Icons fade, sphere + rings appear
    tl.to('#icons', { opacity: 0, scale: 0.7, duration: 0.4, ease: 'power2.in' }, actDur)
      .to(['#sphere', '#r1', '#r2', '#r3'], { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.4)' }, actDur + 0.2)
      .to('#r1', { rotation: 360, duration: 8, ease: 'none', repeat: 2 }, actDur + 0.4)
      .to('#r2', { rotation: -360, duration: 10, ease: 'none', repeat: 2 }, actDur + 0.4)
      .to('#r3', { rotation: 360, duration: 12, ease: 'none', repeat: 1 }, actDur + 0.4);

    // Act 3-5: subtle floating + rotation
    tl.to('#sphere', { y: '+=15', duration: actDur, ease: 'sine.inOut', yoyo: true, repeat: 4 }, actDur + 0.8);

    // === Caption timeline ===
    const captionTl = gsap.timeline({ paused: true });
    groups.forEach((g, i) => {
      const startAt = g.start;
      const endAt = g.end + 0.2;
      const el = document.querySelector('[data-group="' + i + '"]');
      captionTl.to(el, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }, startAt);
      captionTl.to(el, { opacity: 0, y: -20, duration: 0.2, ease: 'power2.in' }, endAt);
    });

    // === Sync everything with audio ===
    const audio = document.getElementById('vo');
    audio.addEventListener('play', () => {
      tl.play(0);
      captionTl.play(0);
    });
    audio.addEventListener('ended', () => {
      tl.pause();
      captionTl.pause();
    });

    // Auto-play on load (works in headless mode)
    window.addEventListener('load', () => {
      audio.play().catch(err => {
        console.error('Audio play failed:', err);
        // Fallback: just animate even without audio
        tl.play(0);
        captionTl.play(0);
      });
    });
  </script>
</body>
</html>`;

mkdirSync(buildDir, { recursive: true });
writeFileSync(outPath, html);
console.log(`✓ Wrote ${outPath}`);
console.log(`  Size: ${(html.length / 1024).toFixed(1)} KB`);
console.log(`  Acts: 5, Caption groups: ${groups.length}`);
