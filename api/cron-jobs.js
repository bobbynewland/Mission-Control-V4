const { execFile } = require('child_process');

function safeEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  // Prevent stale service token from forcing device token mismatch in CLI calls
  delete env.OPENCLAW_GATEWAY_TOKEN;
  delete env.OPENCLAW_SERVICE_KIND;
  delete env.OPENCLAW_SYSTEMD_UNIT;
  delete env.OPENCLAW_SERVICE_MARKER;
  delete env.OPENCLAW_SERVICE_VERSION;
  return env;
}

module.exports = async (req, res) => {
  return new Promise((resolve) => {
    execFile(
      'openclaw',
      ['cron', 'list', '--json'],
      { timeout: 8000, env: safeEnv() },
      (err, stdout, stderr) => {
        if (err) {
          return resolve(
            res.status(500).json({
              ok: false,
              error: 'cron_list_failed',
              detail: stderr?.toString()?.slice(0, 300) || err.message,
              jobs: []
            })
          );
        }

        try {
          const data = JSON.parse(stdout || '{}');
          return resolve(res.status(200).json({ ok: true, jobs: data.jobs || [] }));
        } catch (parseErr) {
          return resolve(
            res.status(500).json({
              ok: false,
              error: 'cron_list_parse_failed',
              detail: parseErr.message,
              jobs: []
            })
          );
        }
      }
    );
  });
};
