// Local renderer using Playwright + headless Chrome
// Records the composition.html + audio into a single MP4
//
// Usage: node scripts/render-local.mjs <lesson-dir>

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit } from 'node:process';

const lessonDir = argv[2];
if (!lessonDir) {
  console.error('Usage: node scripts/render-local.mjs <lesson-dir>');
  exit(1);
}

const compositionPath = join(lessonDir, 'build', 'composition.html');
const voiceoverPath = join(lessonDir, 'voiceover.mp3');
const outDir = join(lessonDir, 'build');
const outPath = join(outDir, 'composition.mp4');

if (!existsSync(compositionPath)) {
  console.error(`Missing: ${compositionPath}. Run build-composition.mjs first.`);
  exit(1);
}
if (!existsSync(voiceoverPath)) {
  console.error(`Missing: ${voiceoverPath}`);
  exit(1);
}

// Get voiceover duration
const dur = parseFloat(
  execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceoverPath}"`
  ).toString().trim()
);

console.log(`Composition: ${compositionPath}`);
console.log(`Voiceover: ${voiceoverPath} (${dur}s)`);
console.log(`Output: ${outPath}`);

// Playwright will:
// 1. Launch headless Chrome
// 2. Load the composition HTML
// 3. Record the page as it animates + plays audio
// 4. Save the recording

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-features=AutoplayIgnoreWebAudio'
  ]
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outDir,
    size: { width: 1920, height: 1080 }
  }
});

const page = await context.newPage();

// Get the video file path (Playwright saves it when context closes)
let videoPath = null;
page.on('console', msg => console.log('  [page]', msg.text()));

// Load the composition
console.log('Loading composition...');
await page.goto(`file://${compositionPath}`);

// Wait for audio to load and start
console.log('Waiting for animations + audio...');
await page.waitForTimeout(2000);

// Wait for the audio to finish playing
const waitMs = Math.ceil(dur * 1000) + 2000;
console.log(`Recording for ${waitMs / 1000}s...`);
await page.waitForTimeout(waitMs);

// Close the context — this finalizes the video
console.log('Closing browser...');
await context.close();
await browser.close();

// Find the recorded video
const files = readdirSync(outDir).filter(f => f.endsWith('.webm'));
if (files.length === 0) {
  console.error('No video file produced');
  exit(1);
}
const recordedWebm = join(outDir, files[0]);
console.log(`Recorded: ${recordedWebm} (${(statSync(recordedWebm).size / 1024 / 1024).toFixed(1)} MB)`);

// Convert webm to mp4 with ffmpeg, composite with voiceover
console.log('Converting to MP4 + compositing audio...');
execSync(
  `ffmpeg -y -loglevel error ` +
  `-i "${recordedWebm}" -i "${voiceoverPath}" ` +
  `-c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p ` +
  `-c:a aac -b:a 192k -shortest ` +
  `"${outPath}"`,
  { stdio: 'inherit' }
);

// Cleanup
unlinkSync(recordedWebm);

console.log(`✓ Wrote ${outPath}`);
console.log(`  Size: ${(statSync(outPath).size / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Duration: ${dur}s`);
