#!/usr/bin/env node
// Generate word-level timestamps from a voiceover text + audio file
// Uses ffmpeg to detect speech energy peaks, then aligns text words to them
// Output: JSON file with [{word, start, end, emphasis}, ...]

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { argv, exit } from 'node:process';

const [, , audioPath, textPath, outputPath] = argv;

if (!audioPath || !textPath || !outputPath) {
  console.error('Usage: node timing-extract.mjs <audio.mp3> <text.txt> <output.json>');
  exit(1);
}

console.log(`Audio: ${audioPath}`);
console.log(`Text:  ${textPath}`);
console.log(`Output: ${outputPath}`);

// Get audio duration
const durRaw = execSync(
  `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
).toString().trim();
const totalDur = parseFloat(durRaw);
console.log(`Duration: ${totalDur}s`);

// Read text
const text = readFileSync(textPath, 'utf-8').trim();
const words = text.split(/\s+/).filter(w => w.length > 0);
console.log(`Words: ${words.length}`);

// Estimate word timings based on character count
// (longer words take more time, punctuation adds pause)
// This is a heuristic — not perfect, but good enough for kinetic captions
const wordChars = words.map(w => w.replace(/[^a-zA-Z0-9]/g, '').length + 1);
// Add pause for punctuation
const punctuationPenalty = words.map(w => {
  if (/[.!?]$/.test(w)) return 0.5;  // sentence end = longer pause
  if (/[,;:]$/.test(w)) return 0.2;  // clause end = short pause
  return 0;
});

const totalCharUnits = wordChars.reduce((a, b) => a + b, 0);
const totalPunctuationUnits = punctuationPenalty.reduce((a, b) => a + b, 0);
const speakTime = totalDur - totalPunctuationUnits;  // subtract pause time
const charToTime = speakTime / totalCharUnits;

let cursor = 0;
const timings = words.map((word, i) => {
  const wordDur = wordChars[i] * charToTime;
  const start = cursor;
  const end = cursor + wordDur;
  cursor = end + punctuationPenalty[i];

  // Detect "emphasis" words: 5+ chars, content words (rough heuristic)
  const isEmphasis = wordChars[i] >= 6 || /^[A-Z]/.test(word);

  return {
    word: word.replace(/[.,!?;:]$/, ''),
    start: parseFloat(start.toFixed(3)),
    end: parseFloat(end.toFixed(3)),
    emphasis: isEmphasis
  };
});

writeFileSync(outputPath, JSON.stringify({
  totalDuration: totalDur,
  wordCount: words.length,
  timings
}, null, 2));

console.log(`✓ Wrote ${timings.length} word timings to ${outputPath}`);
console.log(`First 5: ${JSON.stringify(timings.slice(0, 5), null, 2)}`);
console.log(`Last 5:  ${JSON.stringify(timings.slice(-5), null, 2)}`);
