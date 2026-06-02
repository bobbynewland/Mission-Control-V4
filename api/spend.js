const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const MINIMAX_IN_RATE = parseFloat(process.env.MINIMAX_IN_RATE || '0.000003');
const MINIMAX_OUT_RATE = parseFloat(process.env.MINIMAX_OUT_RATE || '0.000015');
const MINIMAX_TRACKER_PATH = process.env.MINIMAX_TRACKER_PATH || '/root/.openclaw/workspace/minimax-tracker.py';

const HOME = os.homedir();
const CLAUDE_PROJECTS_DIR = process.env.CLAUDE_PROJECTS_DIR || path.join(HOME, '.claude', 'projects');
const CODEX_DIR = process.env.CODEX_DIR || path.join(HOME, '.codex');

function todayISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function emptyBuckets() {
  return { today: 0, week: 0, month: 0, byDay: {} };
}

function addToBucket(buckets, dateStr, amount) {
  if (!amount || !isFinite(amount)) return;
  const t = todayISO();
  const w = daysAgoISO(6);
  const m = daysAgoISO(29);
  if (dateStr === t) buckets.today += amount;
  if (dateStr >= w) buckets.week += amount;
  if (dateStr >= m) buckets.month += amount;
  buckets.byDay[dateStr] = (buckets.byDay[dateStr] || 0) + amount;
}

function walkJsonl(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsonl(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(full);
    }
  }
  return results;
}

function extractDate(rec) {
  const raw = rec.timestamp || rec.createdAt || rec.created_at || rec.date || rec.ts;
  if (!raw) return null;
  try {
    return new Date(raw).toISOString().slice(0, 10);
  } catch (e) {
    return null;
  }
}

function extractCost(rec) {
  const candidates = [rec.total_cost_usd, rec.totalCostUsd, rec.costUSD, rec.cost_usd, rec.cost];
  for (const c of candidates) {
    if (typeof c === 'number' && isFinite(c)) return c;
  }
  return 0;
}

async function getMinimaxRaw() {
  if (!fs.existsSync(MINIMAX_TRACKER_PATH)) {
    return { unavailable: true, reason: 'minimax-tracker.py not found' };
  }
  return new Promise((resolve) => {
    const proc = spawn('python3', [MINIMAX_TRACKER_PATH, '--json']);
    let output = '';
    let errored = false;
    proc.stdout.on('data', (d) => { output += d; });
    proc.on('error', () => { errored = true; resolve({ unavailable: true, reason: 'tracker spawn failed' }); });
    proc.on('close', () => {
      if (errored) return;
      try {
        resolve(JSON.parse(output || '{}'));
      } catch (e) {
        resolve({ unavailable: true, reason: 'tracker returned invalid JSON' });
      }
    });
  });
}

function aggregateMinimax(raw) {
  if (!raw || raw.unavailable) {
    return { unavailable: true, reason: raw?.reason || 'minimax data unavailable' };
  }
  const tokensIn = Number(raw.tokensIn || 0);
  const tokensOut = Number(raw.tokensOut || 0);
  const cost = tokensIn * MINIMAX_IN_RATE + tokensOut * MINIMAX_OUT_RATE;
  return { today: cost, week: cost, month: cost };
}

function aggregateClaude() {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    return { buckets: null, unavailable: true, reason: 'no claude projects dir' };
  }
  const files = walkJsonl(CLAUDE_PROJECTS_DIR);
  if (files.length === 0) {
    return { buckets: null, unavailable: true, reason: 'no claude session files' };
  }
  const buckets = emptyBuckets();
  let any = false;
  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) {
      continue;
    }
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      let rec;
      try { rec = JSON.parse(line); } catch (e) { continue; }
      const cost = extractCost(rec);
      if (!cost) continue;
      const date = extractDate(rec);
      if (!date) continue;
      any = true;
      addToBucket(buckets, date, cost);
    }
  }
  if (!any) {
    return { buckets: null, unavailable: true, reason: 'no cost fields in claude sessions' };
  }
  return { buckets };
}

function aggregateCodex() {
  if (!fs.existsSync(CODEX_DIR)) {
    return { buckets: null, unavailable: true, reason: 'no ~/.codex directory' };
  }
  const candidates = [];
  const usageFile = path.join(CODEX_DIR, 'usage');
  if (fs.existsSync(usageFile)) candidates.push(usageFile);
  const sessionsDir = path.join(CODEX_DIR, 'sessions');
  if (fs.existsSync(sessionsDir)) candidates.push(...walkJsonl(sessionsDir));

  if (candidates.length === 0) {
    return { buckets: null, unavailable: true, reason: 'no codex usage data found' };
  }
  const buckets = emptyBuckets();
  let any = false;
  for (const file of candidates) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      let rec;
      try { rec = JSON.parse(line); } catch (e) { continue; }
      const cost = extractCost(rec);
      if (!cost) continue;
      const date = extractDate(rec) || todayISO();
      any = true;
      addToBucket(buckets, date, cost);
    }
  }
  if (!any) {
    return { buckets: null, unavailable: true, reason: 'no cost fields in codex data' };
  }
  return { buckets };
}

function bucketsToProvider(buckets) {
  return { today: buckets.today, week: buckets.week, month: buckets.month };
}

function computeRateLimit(raw) {
  if (!raw || raw.unavailable) return null;
  const limit = Number(raw.limit || 0);
  const remaining = Number(raw.remaining || 0);
  if (!limit) return null;
  const used = Math.max(0, limit - remaining);
  const pct = (used / limit) * 100;
  let color = 'green';
  if (pct >= 85) color = 'red';
  else if (pct >= 70) color = 'yellow';
  return { used, limit, pct, color };
}

function buildByDay(providerBuckets) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const date = daysAgoISO(i);
    let total = 0;
    for (const b of providerBuckets) {
      if (b && b.byDay && b.byDay[date]) total += b.byDay[date];
    }
    out.push({ date, total });
  }
  return out;
}

module.exports = async (req, res) => {
  try {
    const [minimaxRaw, claudeRes, codexRes] = await Promise.all([
      getMinimaxRaw(),
      Promise.resolve(aggregateClaude()),
      Promise.resolve(aggregateCodex()),
    ]);

    const minimaxAgg = aggregateMinimax(minimaxRaw);
    const claudeBuckets = claudeRes.buckets;
    const codexBuckets = codexRes.buckets;

    const byProvider = {
      minimax: minimaxAgg.unavailable
        ? { unavailable: true, reason: minimaxAgg.reason }
        : minimaxAgg,
      claude: claudeBuckets
        ? bucketsToProvider(claudeBuckets)
        : { unavailable: true, reason: claudeRes.reason },
      codex: codexBuckets
        ? bucketsToProvider(codexBuckets)
        : { unavailable: true, reason: codexRes.reason },
      fal: { unavailable: true, reason: 'fal cost tracking not implemented' },
    };

    let totalToday = 0, totalWeek = 0, totalMonth = 0;
    for (const key of Object.keys(byProvider)) {
      const p = byProvider[key];
      if (p && !p.unavailable) {
        totalToday += p.today || 0;
        totalWeek += p.week || 0;
        totalMonth += p.month || 0;
      }
    }

    const byDay = buildByDay([claudeBuckets, codexBuckets].filter(Boolean));
    if (!minimaxAgg.unavailable) {
      const todayStr = todayISO();
      const last = byDay.find((d) => d.date === todayStr);
      if (last) last.total += minimaxAgg.today;
    }

    res.status(200).json({
      ok: true,
      totalToday,
      totalWeek,
      totalMonth,
      byProvider,
      byDay,
      rateLimitBuffer: { minimax: computeRateLimit(minimaxRaw) },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      error: String(err && err.message || err),
      totalToday: 0,
      totalWeek: 0,
      totalMonth: 0,
      byProvider: {
        minimax: { unavailable: true, reason: 'handler error' },
        claude: { unavailable: true, reason: 'handler error' },
        codex: { unavailable: true, reason: 'handler error' },
        fal: { unavailable: true, reason: 'handler error' },
      },
      byDay: [],
      rateLimitBuffer: null,
      generatedAt: new Date().toISOString(),
    });
  }
};
