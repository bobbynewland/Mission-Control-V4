// Cloud renderer using Hyperframes.app API
// Submits the composition HTML, polls for the MP4 result
//
// Usage: node scripts/render-cloud.mjs <lesson-dir>
// Requires: HYPERFRAMES_API_KEY env var

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { argv, exit } from 'node:process';

const lessonDir = argv[2];
if (!lessonDir) {
  console.error('Usage: node scripts/render-cloud.mjs <lesson-dir>');
  exit(1);
}

const apiKey = process.env.HYPERFRAMES_API_KEY;
if (!apiKey) {
  console.error('HYPERFRAMES_API_KEY not set in environment');
  console.error('Get one at https://hyperframes.app/ → Settings → API');
  console.error('Then: export HYPERFRAMES_API_KEY=hf_...');
  exit(1);
}

const compositionPath = join(lessonDir, 'build', 'composition.html');
const outPath = join(lessonDir, 'build', 'composition.mp4');

if (!existsSync(compositionPath)) {
  console.error(`Missing: ${compositionPath}. Run build-composition.mjs first.`);
  exit(1);
}

const html = readFileSync(compositionPath, 'utf-8');

console.log('Submitting to Hyperframes.app...');
console.log(`Composition: ${(html.length / 1024).toFixed(1)} KB`);

const submitResponse = await fetch('https://hyperframes.app/api/v1/render', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    html,
    width: 1920,
    height: 1080,
    fps: 30,
    format: 'mp4',
    // Optional: pass voiceover URL to embed audio
    audio: {
      type: 'file',
      // Hyperframes might expect a URL — if so, upload the voiceover separately
    }
  })
});

if (!submitResponse.ok) {
  const err = await submitResponse.text();
  console.error(`Submit failed: ${submitResponse.status} ${err}`);
  exit(1);
}

const { jobId, status } = await submitResponse.json();
console.log(`Job submitted: ${jobId} (status: ${status})`);

// Poll for completion
let pollCount = 0;
const maxPolls = 120; // 10 minutes
while (pollCount < maxPolls) {
  await new Promise(r => setTimeout(r, 5000)); // poll every 5s
  pollCount++;

  const statusResponse = await fetch(`https://hyperframes.app/api/v1/render/${jobId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!statusResponse.ok) {
    console.error(`Status check failed: ${statusResponse.status}`);
    continue;
  }

  const job = await statusResponse.json();
  console.log(`  [${pollCount * 5}s] status: ${job.status}`);

  if (job.status === 'completed' && job.url) {
    // Download the result
    const videoResponse = await fetch(job.url);
    const buffer = Buffer.from(await videoResponse.arrayBuffer());
    writeFileSync(outPath, buffer);
    console.log(`✓ Wrote ${outPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
    exit(0);
  } else if (job.status === 'failed') {
    console.error(`Render failed: ${job.error || 'unknown error'}`);
    exit(1);
  }
}

console.error(`Timed out after ${maxPolls * 5}s`);
exit(1);
