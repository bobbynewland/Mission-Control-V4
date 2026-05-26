/**
 * Schedule Auto-populate Script
 * Reads idea_pool tasks from Content Factory, maps them to publishing slots,
 * and writes scheduled tasks back to Firebase.
 * 
 * Usage:
 *   node scripts/schedule-autopopulate.js          # dry run (preview only)
 *   node scripts/schedule-autopopulate.js --run     # actually write to Firebase
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update } from 'firebase/database';

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

const CF_PATH = 'workspaces/winslow_main/projects/content_factory';

// ─────────────────────────────────────────────────────────────────────────────
// Publishing Slot Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All available publishing slots for a week, indexed by platform.
 * Each slot: { day, time, label, isPrime (higher priority tasks get these) }
 */
function buildSlotCalendar(startDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const slots = [];

  const addDays = (d) => {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().split('T')[0];
  };

  // ── YouTube Long-form (Tue/Thu 2-4pm) ──────────────────────────────────
  // Only on Tue(1) and Thu(3)
  [1, 3].forEach((dayOffset) => {
    slots.push({
      id: `youtube_long_${dayOffset}`,
      platform: 'youtube',
      type: 'long',
      dayOffset,
      day: addDays(dayOffset),
      time: '14:00',
      label: `YouTube Long #${Math.floor(dayOffset / 2) + 1}`,
      duration: '2-4pm',
      isPrime: true,
      maxPerWeek: 2,
    });
  });

  // ── YouTube Shorts (daily 11am-1pm) ────────────────────────────────────
  for (let d = 0; d < 7; d++) {
    slots.push({
      id: `yt_short_${d}`,
      platform: 'youtube',
      type: 'short',
      dayOffset: d,
      day: addDays(d),
      time: '11:00',
      label: 'YouTube Shorts',
      duration: '11am-1pm',
      isPrime: false,
      maxPerWeek: 7,
    });
  }

  // ── TikTok (1x/day: 7-9am) ─────────────────────────────────────────────────
  for (let d = 0; d < 7; d++) {
    slots.push({
      id: `tiktok_${d}`,
      platform: 'tiktok',
      type: 'short',
      dayOffset: d,
      day: addDays(d),
      time: '07:00',
      label: 'TikTok',
      duration: '7-9am',
      isPrime: true,
      maxPerWeek: 7,
    });
  }

  // ── Instagram Reels (daily 11am, 2pm, 7pm) ────────────────────────────────
  const igTimes = ['11:00', '14:00', '19:00'];
  for (let d = 0; d < 7; d++) {
    igTimes.forEach((time, ti) => {
      slots.push({
        id: `ig_reel_${d}_${ti}`,
        platform: 'instagram',
        type: 'short',
        dayOffset: d,
        day: addDays(d),
        time,
        label: 'IG Reel',
        duration: time < '12' ? '11am' : time < '17' ? '2pm' : '7pm',
        isPrime: ti === 2, // 7pm is prime
        maxPerWeek: 7,
      });
    });
  }

  // ── Facebook Reels (daily 1-3pm) ─────────────────────────────────────────
  for (let d = 0; d < 7; d++) {
    slots.push({
      id: `fb_reel_${d}`,
      platform: 'facebook',
      type: 'short',
      dayOffset: d,
      day: addDays(d),
      time: '13:00',
      label: 'FB Reel',
      duration: '1-3pm',
      isPrime: false,
      maxPerWeek: 7,
    });
  }

  // ── IG Stories (2x/day: 9am, 5pm) ────────────────────────────────────────
  const storyTimes = ['09:00', '17:00'];
  for (let d = 0; d < 7; d++) {
    storyTimes.forEach((time, ti) => {
      slots.push({
        id: `ig_story_${d}_${ti}`,
        platform: 'instagram',
        type: 'story',
        dayOffset: d,
        day: addDays(d),
        time,
        label: 'IG Story',
        duration: ti === 0 ? '9am' : '5pm',
        isPrime: false,
        maxPerWeek: 14,
      });
    });
  }

  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot Matching
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if a task matches a slot based on its tags. */
function taskMatchesSlot(task, slot) {
  const tags = (task.tags || []).map((t) => t.toLowerCase());

  // Long-form YouTube only on Tue/Thu with explicit youtube + long/casestudy/feature
  const isLongForm =
    tags.includes('youtube') &&
    (tags.includes('long') || tags.includes('casestudy') || tags.includes('feature'));

  // Explicit platform tags
  const hasYoutube = tags.includes('youtube');
  const hasTiktok = tags.includes('tiktok');
  const hasInstagram = tags.includes('instagram');
  const hasFacebook = tags.includes('facebook') || tags.includes('fb');

  // Council-generated / vertical-tagged tasks → multi-platform short-form
  const verticals = ['artist', 'fashion', 'restaurant'];
  const hasVertical = verticals.some((v) => tags.includes(v));
  const isCouncilGen = tags.includes('council-generated');
  const isHookType = tags.some((t) => t.startsWith('hook-type-'));

  // Generic short-form content (tutorial, poc, bts)
  const isGenericShortForm =
    tags.includes('tutorial') ||
    tags.includes('poc') ||
    tags.includes('bts');

  // ── YouTube Long: explicit youtube + long/casestudy/feature, only Tue(1)/Thu(3) ─
  if (slot.platform === 'youtube' && slot.type === 'long') {
    if (!isLongForm) return false;
    if (slot.dayOffset !== 1 && slot.dayOffset !== 3) return false;
    return true;
  }

  // ── YouTube Shorts: youtube tag ONLY (no generic - use IG Reels for generic) ─
  if (slot.platform === 'youtube' && slot.type === 'short') {
    return hasYoutube && !isLongForm;
  }

  // ── TikTok: ONLY explicit tiktok-tagged tasks that don't have other platform tags ─
  if (slot.platform === 'tiktok') {
    // Prefer other platforms if task also has them; TikTok for TikTok-only or multi-platform
    if (hasTiktok && !hasInstagram && !hasYoutube && !hasFacebook) return true;
    if (hasTiktok && (hasInstagram || hasYoutube || hasFacebook)) return false; // prefer other platforms
    return false;
  }

  // ── Instagram Reels: instagram tag OR council-gen/vertical ────────────────
  if (slot.platform === 'instagram' && slot.type === 'reel') {
    if (hasInstagram) return true;
    if (isCouncilGen || hasVertical) return true;
    return false;
  }

  // ── IG Stories: instagram tag OR bts/generic content ─────────────────────
  if (slot.platform === 'instagram' && slot.type === 'story') {
    if (hasInstagram) return true;
    if (tags.includes('bts') || tags.includes('behind-the-scenes')) return true;
    if (isGenericShortForm) return true;
    return false;
  }

  // ── Facebook: facebook tag OR council-gen/vertical ────────────────────────
  if (slot.platform === 'facebook') {
    if (hasFacebook) return true;
    if (isCouncilGen || hasVertical) return true;
    return false;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority Sorting
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Scheduler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the weekly schedule. Does NOT write to Firebase.
 * Returns { scheduledTasks: [{taskId, slot}], unscheduledTasks: [task], slots }
 */
function scheduleTasks(tasks, weekStart) {
  const slots = buildSlotCalendar(weekStart);
  const scheduledTasks = [];
  const unscheduledTasks = [];

  // Track how many tasks are already scheduled per platform this week
  const slotFilled = new Set();

  // Sort idea_pool tasks by priority
  const sortedTasks = sortByPriority(tasks);

  for (const task of sortedTasks) {
    // Find the best available slot for this task
    let assigned = false;

    for (const slot of slots) {
      if (slotFilled.has(slot.id)) continue;
      if (!taskMatchesSlot(task, slot)) continue;

      // Assign this slot
      slotFilled.add(slot.id);

      scheduledTasks.push({
        taskId: task.id,
        task,
        slot,
      });

      assigned = true;
      break;
    }

    if (!assigned) {
      unscheduledTasks.push(task);
    }
  }

  return { scheduledTasks, unscheduledTasks, slots };
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase I/O
// ─────────────────────────────────────────────────────────────────────────────

async function getIdeaPoolTasks() {
  const snap = await get(ref(database, `${CF_PATH}/tasks`));
  const all = snap.val() || {};
  return Object.entries(all)
    .filter(([, t]) => t.column === 'idea_pool')
    .map(([id, t]) => ({ ...t, id }));
}

async function writeScheduledTasks(scheduledTasks) {
  const updates = {};

  for (const { taskId, slot } of scheduledTasks) {
    const scheduledDate = `${slot.day}T${slot.time}:00`;
    updates[`${CF_PATH}/tasks/${taskId}/column`] = 'scheduled';
    updates[`${CF_PATH}/tasks/${taskId}/scheduledDate`] = scheduledDate;
    updates[`${CF_PATH}/tasks/${taskId}/scheduledSlot`] = {
      platform: slot.platform,
      type: slot.type,
      time: slot.time,
      duration: slot.duration,
      label: slot.label,
      dayOffset: slot.dayOffset,
    };
    updates[`${CF_PATH}/tasks/${taskId}/scheduledAt`] = new Date().toISOString();
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }

  return Object.keys(updates).length / 5; // 5 fields per task
}

// ─────────────────────────────────────────────────────────────────────────────
// Get next Monday
// ─────────────────────────────────────────────────────────────────────────────

function getNextMonday(fromDate = new Date()) {
  const d = new Date(fromDate);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Entry Point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = !process.argv.includes('--run');

  console.log('\n📅 Content Factory — Schedule Auto-Populate');
  console.log('═'.repeat(50));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no writes)' : '✅ LIVE RUN'}`);

  const weekStart = getNextMonday();
  weekStart.setDate(weekStart.getDate() + 7); // Schedule for the WEEK AFTER NEXT
  console.log(`Target week: ${weekStart.toISOString().split('T')[0]} (Mon)\n`);

  // Load idea_pool tasks
  const tasks = await getIdeaPoolTasks();
  console.log(`📥 Found ${tasks.length} tasks in idea_pool\n`);

  if (tasks.length === 0) {
    console.log('Nothing to schedule. Exiting.');
    return;
  }

  // Print task inventory
  console.log('Tasks in idea_pool:');
  tasks.forEach((t) => {
    console.log(`  [${t.priority || 'normal'}] ${t.title}`);
    console.log(`          tags: ${(t.tags || []).join(', ')}`);
  });
  console.log('');

  // Run scheduler
  const { scheduledTasks, unscheduledTasks, slots } = scheduleTasks(tasks, weekStart);

  // Print the schedule
  console.log('\n📆 Proposed Weekly Schedule:');
  console.log('─'.repeat(50));

  const byDay = {};
  for (const { task, slot } of scheduledTasks) {
    if (!byDay[slot.day]) byDay[slot.day] = [];
    byDay[slot.day].push({ task, slot });
  }

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([day, items]) => {
      const dow = new Date(day).getDay();
      console.log(`\n${DAYS[dow]} ${day}:`);
      items
        .sort((a, b) => a.slot.time.localeCompare(b.slot.time))
        .forEach(({ task, slot }) => {
          const platformIcon =
            slot.platform === 'youtube'
              ? '▶️'
              : slot.platform === 'tiktok'
              ? '🌀'
              : slot.platform === 'instagram'
              ? '📸'
              : '👥';
          console.log(
            `  ${slot.time} ${platformIcon} ${slot.label} (${slot.duration}) → "${task.title}"`
          );
        });
    });

  console.log(`\n✅ Would schedule: ${scheduledTasks.length} tasks`);
  console.log(`❌ Unscheduled: ${unscheduledTasks.length} tasks`);
  if (unscheduledTasks.length > 0) {
    console.log('\nUnscheduled tasks (no matching slots):');
    unscheduledTasks.forEach((t) => console.log(`  - ${t.title}`));
  }

  if (dryRun) {
    console.log('\n⚠️  Dry run — no changes written. Run with --run to execute.');
  } else {
    console.log('\n🚀 Writing to Firebase...');
    const count = await writeScheduledTasks(scheduledTasks);
    console.log(`✅ Scheduled ${count} tasks in Firebase.`);
    console.log('   All tasks moved from idea_pool → scheduled column.');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
