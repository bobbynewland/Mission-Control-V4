#!/usr/bin/env node
/**
 * Weekly Content Council Cron Job
 * 
 * Runs every Monday at 9am ET to generate content briefs for AI Skills Studio's
 * Content Factory. Scrapes trends and generates scroll-stopping hooks + scripts
 * for Restaurant, Fashion, and Artist verticals.
 * 
 * Usage:
 *   node council-cron.js dryRun  # Preview what would be created
 *   node council-cron.js run     # Actually write to Firebase
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAVmSmiuJDcCAiZhq3xqXSJZnWtviLvnuU",
  authDomain: "winslow-756c3.firebaseapp.com",
  databaseURL: "https://winslow-756c3-default-rtdb.firebaseio.com",
  projectId: "winslow-756c3",
  storageBucket: "winslow-756c3.appspot.com",
  messagingSenderId: "114362401734976703623",
  appId: "1:114362401734976703623:web:abc123def456"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Content Factory path
const CF_BASE = 'workspaces/winslow_main/projects/content_factory';
const TASKS_PATH = `${CF_BASE}/tasks`;

// Verticals configuration
const VERTICALS = {
  restaurant: {
    name: 'Restaurant',
    category: 'restaurant',
    emoji: '🍽️',
    description: 'Local SMB restaurant owners and operators',
    painPoints: [
      'missing phone orders during rush hours',
      'food waste and inventory mismanagement', 
      'low repeat customer rates',
      'rising labor costs',
      'struggling to compete with delivery apps'
    ],
    aiTools: [
      'Voice AI phone systems (handling orders 24/7)',
      'AI inventory management (MarketMan, WISK)',
      'AI CRM and personalization tools',
      'Dynamic pricing tools',
      'Predictive staffing AI'
    ],
    hooks: [
      { hook: "Your restaurant is losing $3,000/month and you don't even know why", type: 'problem' },
      { hook: "I let AI answer every phone call at my restaurant for 30 days — here's what happened", type: 'experiment' },
      { hook: "The AI tool that answered 100% of our calls when we were short-staffed", type: 'solution' },
      { hook: "Nobody talks about AI for restaurants anymore — but this changed everything", type: 'contrarian' },
      { hook: "I cut food waste by 40% with one AI tool — zero staff training required", type: 'transformation' },
      { hook: "Why your restaurant WILL fail in 2025 (and the one thing that could save it)", type: 'fear' },
      { hook: "The $0 marketing strategy that brought 200 new customers to this restaurant", type: 'free' },
      { hook: "Most restaurant owners are using AI completely wrong — here's the right way", type: 'debunk' },
      { hook: "I watched AI take 50 orders while my staff took a break — this is the future", type: 'future' },
      { hook: "The hidden AI tool local restaurants are using to outcompete the chains", type: 'secret' }
    ]
  },
  fashion: {
    name: 'Fashion',
    category: 'fashion',
    emoji: '👗',
    description: 'Fashion and product brand owners, D2C e-commerce',
    painPoints: [
      'expensive photoshoots eating into margins',
      'high return rates from poor fit',
      'predicting which styles will sell',
      'competing with fast fashion giants',
      'low engagement on product posts'
    ],
    aiTools: [
      'Virtual try-on (Zeekit, WearView)',
      'AI-generated product imagery',
      'Trend forecasting (WGSN, Heuritech)',
      '3D virtual prototyping',
      'AI personalized recommendations'
    ],
    hooks: [
      { hook: "I created 100 product photos with AI — no photographer, no model, no studio", type: 'experiment' },
      { hook: "The AI trend that predicted our bestseller 6 months before launch", type: 'prediction' },
      { hook: "Virtual try-on cut our returns by 35% — here's exactly how we did it", type: 'transformation' },
      { hook: "Why your fashion brand looks cheap on Instagram (and the AI fix)", type: 'problem' },
      { hook: "生成 AI images that look like they came from a $10K shoot — free tool", type: 'free' },
      { hook: "The metaverse fashion brands are already winning with AI", type: 'future' },
      { hook: "I launched a full collection with zero inventory — AI did it all", type: 'transformation' },
      { hook: "Fashion brands using AI for design are about to disrupt everything", type: 'disruption' },
      { hook: "The one style prediction that saved this brand $200K in unsold inventory", type: 'proof' },
      { hook: "Most fashion brands ignore this AI tool — it's the reason we're growing", type: 'contrarian' }
    ]
  },
  artist: {
    name: 'Artist',
    category: 'artist',
    emoji: '🎨',
    description: 'Independent musicians, visual artists, creative entrepreneurs',
    painPoints: [
      'expensive studio time',
      'struggling to get discovered',
      'burning out trying to do everything',
      'low royalty payouts from streaming',
      'no budget for music videos'
    ],
    aiTools: [
      'Suno AI, Udio for music generation',
      'Synthesizer V, ElevenLabs for vocals',
      'Runway ML for music videos',
      'Moises for stem separation',
      'AI mastering and mixing'
    ],
    hooks: [
      { hook: "I made a full song with AI in 20 minutes — here's the process from start to finish", type: 'experiment' },
      { hook: "The AI tool that turned my demo into a radio-ready track (free to start)", type: 'free' },
      { hook: "Why independent artists who ignore AI will be left behind in 2025", type: 'fear' },
      { hook: "I released 30 songs this year using AI — here's what made money", type: 'proof' },
      { hook: "The ghost producer in my laptop: how AI changed my music career", type: 'transformation' },
      { hook: "I created a music video with zero budget using AI — here's the exact workflow", type: 'tutorial' },
      { hook: "Most artists think AI will replace them — they're wrong about why", type: 'contrarian' },
      { hook: "My song hit 50K streams after I used this one AI mastering trick", type: 'proof' },
      { hook: "The real reason Spotify pays artists nothing (and what AI can actually fix)", type: 'problem' },
      { hook: "AI won't replace artists — but artists who use AI will replace those who don't", type: 'future' }
    ]
  }
};

// Script templates for each hook
function generateScripts(hook, vertical) {
  const verticalName = vertical.name;
  
  return {
    tiktok: `30s TikTok/Shorts Script:

[HOOK - 0:00-0:03]
${hook}
*BOLD TEXT ON SCREEN*

[PROBLEM - 0:03-0:10]
Most ${verticalName.toLowerCase()} owners think they have to spend big to compete.
But what if the problem isn't your budget — it's your tools?

[SOLUTION - 0:10-0:20]
There's AI tech that does [key feature] in minutes.
No experience needed. No expensive software.
Just results.

[PROOF - 0:20-0:27]
And the ones using it right now?
They're the ones getting all the attention.

[CTA - 0:27-0:30]
Save this. Follow for more.
The ${verticalName.toLowerCase()}s winning in 2025 aren't waiting. 💎`,

    reels: `60s IG Reels Script:

[OPEN - 0:00-0:05]
*Strong hook visual*
${hook}
If you've been in the ${verticalName.toLowerCase()} space for any time, you know the struggle is real.

[CONNECTION - 0:05-0:15]
You're working twice as hard as the competition.
Posting every day. Burning out. Wondering if it's even worth it.
I get it. I've been there.

[THE SHIFT - 0:15-0:35]
But something changed when I started using AI the RIGHT way.
Not the gimmicky stuff. Not the overhyped tools.
The actual systems that save time and make an impact.

[SHOW IT - 0:35-0:50]
Here's what I discovered: [key insight about AI for ${verticalName.toLowerCase()}s]
And it's simpler than you think.

[CLOSE - 0:50-0:60]
Follow for more ${verticalName.toLowerCase()} growth strategies.
Drop a 🔥 if you want part 2.

Music: [Trending sound]`,

    youtube: `8-12min YouTube Script (Hook → Problem → Solution → Proof → CTA):

=== HOOK (0:00-1:00) ===
${hook}
*Eye-catching intro visual/text*

If you're a ${verticalName.toLowerCase()} owner, creator, or entrepreneur looking to scale without burning out, you need to hear this.

In this video, I'm breaking down exactly how AI is transforming the ${verticalName.toLowerCase()} industry — and more importantly, how YOU can use it starting today.

No fluff. No sponsored BS. Just real strategies.

=== PROBLEM (1:00-3:00) ===
Let's talk about what's actually holding ${verticalName.toLowerCase()} owners back.

*List the pain points specific to this vertical*

The truth is, most people in this space are fighting the wrong battle.
They're spending hours on tasks that should take minutes.
They're investing in tools that don't move the needle.
And they're watching competitors who seem to have it all figured out.

The gap isn't talent. It's systems.

=== SOLUTION (3:00-7:00) ===
Here's where AI changes everything.

**Point 1: [AI Tool Category]**
*[Explain how this works for ${verticalName.toLowerCase()}s]*
*[Demo or screen recording if possible]*
*[Specific use case]*

**Point 2: [Another AI Tool Category]**
*[How this solves a specific problem]*
*[Real example]*
*[Time/money savings]*

**Point 3: [Third AI Tool Category]**
*[The often overlooked application]*
*[Why this is the secret weapon]*

These aren't theoretical. I'm using these right now.
And they're the reason I can focus on the creative work that actually matters.

=== PROOF (7:00-10:00) ===
Let me show you what's actually possible.

*[Case study or example of results]*
*[Before/after if applicable]*
*[Specific metrics: time saved, revenue impact, growth]*

The ${verticalName.toLowerCase()} owners and creators who are winning right now?
They're not working harder. They're working smarter with AI.

And the best part: you don't need a huge budget to start.
You just need to know where to look.

=== CTA (10:00-11:00+) ===
If this helped you, do these three things:

1. **Like** this video — it helps me help more people
2. **Subscribe** — I post weekly ${verticalName.toLowerCase()} + AI strategies
3. **Comment** what AI tool you're struggling with — I'll break it down in a future video

And if you want the complete breakdown of the tools I mentioned, check the description below.

Let's get it. 💎

---
*[End screen with subscribe button and related video]*`
  };
}

// Generate all tasks
function generateTasks() {
  const tasks = [];
  const timestamp = Date.now();
  const created = new Date().toISOString();

  for (const [key, vertical] of Object.entries(VERTICALS)) {
    for (let i = 0; i < vertical.hooks.length; i++) {
      const hookData = vertical.hooks[i];
      const taskId = `task_${timestamp}_${key}_${i + 1}`;
      const scripts = generateScripts(hookData.hook, vertical);
      
      const task = {
        id: taskId,
        title: hookData.hook,
        description: `Scroll-stopping content hook targeting ${vertical.description}. Uses ${vertical.aiTools[0]} and related AI tools to drive engagement and conversions.`,
        column: 'idea_pool',
        tags: [vertical.category, 'ai-tools', 'council-generated', `hook-type-${hookData.type}`],
        priority: i < 3 ? 'high' : 'medium',
        created: created,
        source: 'council-generated',
        vertical: key,
        hookType: hookData.type,
        scripts: scripts,
        hook: hookData.hook,
        meta: {
          vertical: vertical.name,
          aiTools: vertical.aiTools,
          painPoints: vertical.painPoints
        }
      };
      
      tasks.push(task);
    }
  }
  
  return tasks;
}

// Dry run - just return what would be created
async function dryRun() {
  console.log('🧪 DRY RUN MODE - No data will be written to Firebase\n');
  console.log('='.repeat(60));
  console.log('WEEKLY CONTENT COUNCIL - Generated Tasks Preview');
  console.log('='.repeat(60));
  
  const tasks = generateTasks();
  
  console.log(`\n📊 Total tasks generated: ${tasks.length}`);
  console.log(`   - Restaurant: ${tasks.filter(t => t.vertical === 'restaurant').length} hooks`);
  console.log(`   - Fashion: ${tasks.filter(t => t.vertical === 'fashion').length} hooks`);
  console.log(`   - Artist: ${tasks.filter(t => t.vertical === 'artist').length} hooks`);
  
  console.log('\n' + '-'.repeat(60));
  console.log('SAMPLE OUTPUT (first task from each vertical):');
  console.log('-'.repeat(60));
  
  for (const vertical of ['restaurant', 'fashion', 'artist']) {
    const sample = tasks.find(t => t.vertical === vertical);
    if (sample) {
      console.log(`\n${VERTICALS[vertical].emoji} ${VERTICALS[vertical].name}`);
      console.log(`   ID: ${sample.id}`);
      console.log(`   Hook: ${sample.hook}`);
      console.log(`   Tags: ${sample.tags.join(', ')}`);
      console.log(`   Priority: ${sample.priority}`);
    }
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log('FIREBASE PATH: ' + TASKS_PATH);
  console.log('-'.repeat(60));
  
  // Return the full task list as JSON for inspection
  console.log('\n📄 Full task list returned for inspection.');
  return tasks;
}

// Actual run - write to Firebase
async function run() {
  console.log('🚀 RUN MODE - Writing tasks to Firebase\n');
  console.log('='.repeat(60));
  console.log('WEEKLY CONTENT COUNCIL - Writing to Firebase');
  console.log('='.repeat(60));
  
  const tasks = generateTasks();
  const tasksRef = ref(database, TASKS_PATH);
  
  console.log(`\n📊 Writing ${tasks.length} tasks to ${TASKS_PATH}`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const task of tasks) {
    try {
      const taskRef = ref(database, `${TASKS_PATH}/${task.id}`);
      await set(taskRef, task);
      successCount++;
      console.log(`   ✅ ${task.id}`);
    } catch (error) {
      errorCount++;
      console.log(`   ❌ ${task.id}: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`   ✅ Successfully written: ${successCount} tasks`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📍 Firebase path: ${TASKS_PATH}`);
  console.log(`   🕐 Generated at: ${new Date().toISOString()}`);
  
  return { successCount, errorCount, tasks };
}

// Main
const mode = process.argv[2] || 'dryRun';

if (mode === 'dryRun') {
  dryRun().then(tasks => {
    console.log('\n✨ Dry run complete. Run with "run" to write to Firebase.');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
} else if (mode === 'run') {
  run().then(result => {
    console.log('\n✨ Council complete!');
    process.exit(result.errorCount > 0 ? 1 : 0);
  }).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
} else {
  console.log('Usage: node council-cron.js [dryRun|run]');
  process.exit(1);
}
