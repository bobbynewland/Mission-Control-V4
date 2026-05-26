import fs from 'fs';
import path from 'path';

function bytesToHuman(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)}${units[i]}`;
}

function safeDirSizeBytes(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      try {
        const stat = fs.statSync(full);
        total += stat.size || 0;
      } catch {
        // ignore unreadable entry
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  try {
    const hosted = Boolean(process.env.VERCEL);
    if (hosted) {
      return res.status(200).json({
        ok: true,
        degraded: true,
        error: 'Host disk telemetry unavailable in hosted mode.',
        disk: {
          filesystem: 'host',
          total: 'N/A',
          used: 'N/A',
          available: 'N/A',
          usePercent: 'N/A',
          mount: '/',
          warning: false,
        },
        topDirs: [],
        thresholds: {
          warningPct: 85,
          criticalPct: 92,
        },
      });
    }

    const candidates = [
      '/root/.openclaw/workspace',
      '/root/.openclaw/backups',
      '/tmp',
      '/var/task',
    ];

    // Primary disk info via statfs when available.
    let disk = null;
    let degraded = false;

    try {
      if (typeof fs.statfsSync === 'function') {
        const stat = fs.statfsSync('/');
        const totalBytes = Number(stat.blocks) * Number(stat.bsize);
        const availBytes = Number(stat.bavail) * Number(stat.bsize);
        const usedBytes = Math.max(0, totalBytes - availBytes);
        const pct = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : null;

        disk = {
          filesystem: 'local',
          total: bytesToHuman(totalBytes),
          used: bytesToHuman(usedBytes),
          available: bytesToHuman(availBytes),
          usePercent: pct !== null ? `${pct}%` : 'N/A',
          mount: '/',
          warning: pct !== null ? pct >= 85 : false,
        };
      }
    } catch {
      degraded = true;
    }

    if (!disk) {
      degraded = true;
      disk = {
        filesystem: 'local',
        total: 'N/A',
        used: 'N/A',
        available: 'N/A',
        usePercent: 'N/A',
        mount: '/',
        warning: false,
      };
    }

    const topDirs = candidates
      .map((p) => ({ path: p, bytes: safeDirSizeBytes(p) }))
      .filter((x) => x.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8)
      .map((x) => ({ path: x.path, size: bytesToHuman(x.bytes) }));

    if (topDirs.length === 0) degraded = true;

    return res.status(200).json({
      ok: true,
      degraded,
      disk,
      topDirs,
      thresholds: {
        warningPct: 85,
        criticalPct: 92,
      },
    });
  } catch {
    return res.status(200).json({
      ok: true,
      degraded: true,
      disk: {
        filesystem: 'local',
        total: 'N/A',
        used: 'N/A',
        available: 'N/A',
        usePercent: 'N/A',
        mount: '/',
        warning: false,
      },
      topDirs: [],
      thresholds: {
        warningPct: 85,
        criticalPct: 92,
      },
    });
  }
}
