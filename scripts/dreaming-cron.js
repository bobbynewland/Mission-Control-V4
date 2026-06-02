#!/usr/bin/env node
/**
 * Dreaming Cron — overnight brief generator.
 *
 * Reads the last 24h of activity from local disk + Firebase, synthesizes
 * a Yesterday/Today/Suggestions brief via template, and writes it to
 * workspaces/winslow_main/dailyPromptDrop/{date}.
 *
 * Usage:
 *   node scripts/dreaming-cron.js --dryRun
 *   node scripts/dreaming-cron.js --date=2026-06-02
 *   node scripts/dreaming-cron.js
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyAVmSmiuJDcCAiZhq3xqXSJZnWtviLvnuU',
  authDomain: 'winslow-756c3.firebaseapp.com',
  databaseURL: 'https://winslow-756c3-default-rtdb.firebaseio.com',
  projectId: 'winslow-756c3',
  storageBucket: 'winslow-756c3.appspot.com',
  messagingSenderId: '114362401734976703623',
  appId: '1:114362401734976703623:web:abc123def456'
};

const WORKSPACE = 'workspaces/winslow_main';
const HOME = os.homedir();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dryRun') || argv.includes('--dry-run');
const dateArg = argv.find((a) => a.startsWith('--date='));
const TARGET_DATE = dateArg ? dateArg.split('=')[1] : new Date().toISOString().slice(0, 10);

function safeRead(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (e) {
    return null;
  }
}

function readLast24hSessions() {
  const sessionsRoot = path.join(HOME, '.claude', 'projects');
  if (!fs.existsSync(sessionsRoot)) return { items: [], note: 'No Claude session data found' };

  const cutoff = Date.now() - ONE_DAY_MS;
  const items = [];

  let projectDirs = [];
  try {
    projectDirs = fs.readdirSync(sessionsRoot).map((d) => path.join(sessionsRoot, d));
  } catch (e) {
    return { items: [], note: 'No Claude session data found' };
  }

  for (const dir of projectDirs) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    } catch (e) {
      continue;
    }
    for (const file of entries) {
      const fp = path.join(dir, file);
      const stat = safeStat(fp);
      if (!stat || stat.mtimeMs < cutoff) continue;
      items.push({
        file: path.basename(fp),
        project: path.basename(dir),
        mtime: stat.mtimeMs,
        sizeKb: Math.round(stat.size / 1024)
      });
    }
  }

  items.sort((a, b) => b.mtime - a.mtime);
  return { items, note: items.length ? null : 'No sessions in last 24h' };
}

function readHermesMemory() {
  const memDir = path.join(HOME, '.hermes', 'memory');
  if (!fs.existsSync(memDir)) return { items: [], note: 'No Hermes memory found' };
  const items = [];
  try {
    for (const f of fs.readdirSync(memDir)) {
      if (!f.endsWith('.json')) continue;
      const stat = safeStat(path.join(memDir, f));
      items.push({ name: f, mtime: stat ? stat.mtimeMs : 0 });
    }
  } catch (e) {
    return { items: [], note: 'No Hermes memory found' };
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return { items, note: items.length ? null : 'Hermes memory empty' };
}

function readClaudeMemory() {
  const fp = path.join(HOME, '.claude', 'CLAUDE.md');
  const content = safeRead(fp);
  if (!content) return { content: null, note: 'No global CLAUDE.md found' };
  return { content: content.slice(0, 2000), note: null };
}

function readObsidianDailyLog() {
  const candidates = [
    path.join(HOME, 'Documents', 'Obsidian Vault', 'daily_log.md'),
    path.join(HOME, 'Documents', 'Obsidian Vault', 'Daily Log.md'),
    path.join(HOME, 'Obsidian Vault', 'daily_log.md')
  ];
  for (const fp of candidates) {
    const content = safeRead(fp);
    if (content) return { content: content.slice(0, 4000), path: fp, note: null };
  }
  return { content: null, note: 'No Obsidian daily log found' };
}

async function fetchFirebaseNode(database, pathStr) {
  try {
    const snap = await get(ref(database, pathStr));
    if (!snap.exists()) return null;
    return snap.val();
  } catch (e) {
    return null;
  }
}

function objToList(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj.filter(Boolean);
  return Object.entries(obj).map(([id, v]) => ({ id, ...(v || {}) }));
}

function pickActiveTasks(tasks) {
  return objToList(tasks)
    .filter((t) => t && t.column && t.column !== 'done' && t.column !== 'archived')
    .sort((a, b) => {
      const pw = { high: 3, medium: 2, low: 1 };
      const pa = pw[a.priority] || 0;
      const pb = pw[b.priority] || 0;
      if (pb !== pa) return pb - pa;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

function pickActiveGoals(projects) {
  return objToList(projects)
    .filter((p) => p && (p.status === 'active' || p.status === 'in_progress' || !p.status))
    .slice(0, 10);
}

function generateSuggestions(sources) {
  const out = [];
  const activeTasks = pickActiveTasks(sources.tasks);
  const highPriority = activeTasks.filter((t) => t.priority === 'high');
  const overdue = activeTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now()
  );

  if (overdue.length > 0) {
    out.push(`Clear ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'} first — they're blocking momentum.`);
  }
  if (highPriority.length >= 3) {
    out.push(`You have ${highPriority.length} high-priority tasks open. Pick the top 1 and ship it before noon.`);
  }
  if ((sources.sessions.items || []).length === 0) {
    out.push('No coding sessions in 24h. Start with a 25-min focused block to build momentum.');
  }
  if ((sources.sessions.items || []).length > 10) {
    out.push('Heavy session activity yesterday. Take a 30-min walk before deep work today.');
  }
  const activeGoals = pickActiveGoals(sources.goals);
  if (activeGoals.length > 0) {
    out.push(`Active goal: "${activeGoals[0].name || activeGoals[0].title || activeGoals[0].id}" — what's the smallest next step?`);
  }
  if (out.length === 0) {
    out.push('Inbox zero, no overdue items. Use today to ship one ambitious thing.');
  }
  return out.slice(0, 4);
}

function buildYesterday(sources) {
  const lines = [];
  const sess = sources.sessions.items || [];
  if (sess.length > 0) {
    const byProject = {};
    for (const s of sess) byProject[s.project] = (byProject[s.project] || 0) + 1;
    const top = Object.entries(byProject)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    for (const [proj, count] of top) {
      lines.push(`- ${count} session${count === 1 ? '' : 's'} in \`${proj}\``);
    }
  } else if (sources.sessions.note) {
    lines.push(`- ${sources.sessions.note}`);
  }
  const mem = sources.memories.items || [];
  if (mem.length > 0) {
    lines.push(`- ${mem.length} memory file${mem.length === 1 ? '' : 's'} touched (latest: ${mem[0].name})`);
  } else if (sources.memories.note) {
    lines.push(`- ${sources.memories.note}`);
  }
  if (sources.dailyLog.content) {
    const firstLine = sources.dailyLog.content.split('\n').find((l) => l.trim()) || '';
    lines.push(`- Daily log: ${firstLine.slice(0, 120)}`);
  }
  if (lines.length === 0) lines.push('- No activity recorded.');
  return lines.join('\n');
}

function buildToday(sources) {
  const lines = [];
  const tasks = pickActiveTasks(sources.tasks).slice(0, 3);
  if (tasks.length > 0) {
    for (const t of tasks) {
      const tag = t.priority ? ` [${t.priority}]` : '';
      lines.push(`- ${t.title || t.id}${tag}`);
    }
  } else {
    lines.push('- No active tasks in Kanban.');
  }
  const goals = pickActiveGoals(sources.goals).slice(0, 2);
  for (const g of goals) {
    lines.push(`- Goal: ${g.name || g.title || g.id}`);
  }
  return lines.join('\n');
}

function buildSuggestions(sources) {
  return generateSuggestions(sources).map((s) => `- ${s}`).join('\n');
}

async function gatherSources(database) {
  const sessions = readLast24hSessions();
  const memories = readHermesMemory();
  const claudeMemory = readClaudeMemory();
  const dailyLog = readObsidianDailyLog();
  const tasks = database ? await fetchFirebaseNode(database, `${WORKSPACE}/tasks`) : null;
  const goals = database ? await fetchFirebaseNode(database, `${WORKSPACE}/projects`) : null;
  return { sessions, memories, claudeMemory, dailyLog, tasks, goals };
}

function buildBrief(sources, date) {
  const yesterday = buildYesterday(sources);
  const today = buildToday(sources);
  const suggestions = buildSuggestions(sources);

  const markdown = [
    `# Morning Brief — ${date}`,
    '',
    '## Yesterday',
    yesterday,
    '',
    '## Today',
    today,
    '',
    '## Suggestions',
    suggestions
  ].join('\n');

  return {
    date,
    brief: markdown,
    sections: { yesterday, today, suggestions },
    generatedAt: new Date().toISOString(),
    source: 'dreaming-cron',
    stats: {
      sessions: (sources.sessions.items || []).length,
      memories: (sources.memories.items || []).length,
      tasks: pickActiveTasks(sources.tasks).length,
      goals: pickActiveGoals(sources.goals).length,
      hasDailyLog: !!sources.dailyLog.content,
      hasClaudeMemory: !!sources.claudeMemory.content
    }
  };
}

async function main() {
  let app = null;
  let database = null;
  if (!DRY_RUN) {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
  } else {
    try {
      app = initializeApp(firebaseConfig);
      database = getDatabase(app);
    } catch (e) {
      database = null;
    }
  }

  console.log(`${DRY_RUN ? '🧪 DRY RUN' : '🚀 RUN'} — Dreaming brief for ${TARGET_DATE}`);
  console.log('='.repeat(60));

  const sources = await gatherSources(database);
  const payload = buildBrief(sources, TARGET_DATE);

  console.log(payload.brief);
  console.log('-'.repeat(60));
  console.log('Stats:', JSON.stringify(payload.stats));

  if (DRY_RUN) {
    console.log('\n✨ Dry run complete. No data written.');
    process.exit(0);
  }

  const target = `${WORKSPACE}/dailyPromptDrop/${TARGET_DATE}`;
  try {
    await set(ref(database, target), payload);
    console.log(`\n✅ Wrote brief to ${target}`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Failed to write brief: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Fatal:', err && err.stack ? err.stack : err);
  process.exit(1);
});
