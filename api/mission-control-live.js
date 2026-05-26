import os from 'os';

function timeAgo(ms) {
  if (!ms) return 'Never';
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function handler(req, res) {
  const hosted = Boolean(process.env.VERCEL);

  // Hosted deployments can't access local OpenClaw CLI/process telemetry.
  if (hosted) {
    return res.status(200).json({
      ok: true,
      degraded: true,
      note: 'Host telemetry is unavailable in hosted mode.',
      stats: {
        totalTasks: 0,
        inProgress: 0,
        completed: 0,
        errors: 0,
        apiHealthPct: 0,
        uptime: `${Math.floor(os.uptime() / 3600)}h`,
      },
      jobs: [],
      agents: [
        {
          id: 1,
          name: 'Host Telemetry',
          role: 'Live Feed',
          status: 'offline',
          lastActive: 'Hosted mode',
          model: 'N/A',
          currentJob: null,
        },
      ],
      apiKeys: {
        minimax: { used: 0, total: 300, label: 'MiniMax 2.5' },
        kimi: { used: 0, total: 10, label: 'Kimi Swarm' },
        glm: { used: 0, total: 10, label: 'GLM Swarm' },
        cron: { used: 0, total: 1, label: 'Cron Jobs' },
      },
      cron: [],
      generatedAt: Date.now(),
      generatedAtText: timeAgo(Date.now()),
    });
  }

  // Self-host fallback (minimal but safe).
  return res.status(200).json({
    ok: true,
    degraded: false,
    stats: {
      totalTasks: 0,
      inProgress: 0,
      completed: 0,
      errors: 0,
      apiHealthPct: 100,
      uptime: `${Math.floor(os.uptime() / 3600)}h`,
    },
    jobs: [],
    agents: [],
    apiKeys: {},
    cron: [],
  });
}
