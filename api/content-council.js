import { execFile } from 'node:child_process';
import path from 'node:path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const mode = req.body?.mode === 'dryRun' ? 'dryRun' : 'run';
  const scriptPath = path.join(process.cwd(), 'scripts', 'council-cron.js');

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [scriptPath, mode],
      { timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) {
          return resolve(res.status(500).json({
            ok: false,
            error: 'content_council_failed',
            detail: stderr?.toString()?.slice(0, 600) || err.message
          }));
        }

        return resolve(res.status(200).json({
          ok: true,
          output: stdout?.toString()?.slice(0, 1200) || ''
        }));
      }
    );
  });
}
