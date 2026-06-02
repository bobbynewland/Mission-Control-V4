import { execFile } from 'node:child_process';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function readBrief(date) {
  const apps = getApps();
  const app = apps.length ? apps[0] : initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const snap = await get(ref(database, `${WORKSPACE}/dailyPromptDrop/${date}`));
  if (!snap.exists()) return null;
  return snap.val();
}

function runCron() {
  const scriptPath = path.join(process.cwd(), 'scripts', 'dreaming-cron.js');
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [scriptPath],
      { timeout: 45000 },
      (err, stdout, stderr) => {
        if (err) {
          return resolve({
            ok: false,
            error: 'dreaming_cron_failed',
            detail: (stderr && stderr.toString().slice(0, 600)) || err.message
          });
        }
        return resolve({ ok: true, output: (stdout || '').toString().slice(0, 1200) });
      }
    );
  });
}

export default async function handler(req, res) {
  try {
    const date = (req.query && req.query.date) || todayKey();

    if (req.method === 'GET') {
      const brief = await readBrief(date);
      return res.status(200).json({ ok: true, date, brief });
    }

    if (req.method === 'POST') {
      const force = req.body && req.body.force === true;
      if (force) {
        const result = await runCron();
        if (!result.ok) {
          return res.status(500).json({ ok: false, error: result.error, detail: result.detail });
        }
        const brief = await readBrief(date);
        return res.status(200).json({ ok: true, date, brief, output: result.output });
      }
      const brief = await readBrief(date);
      return res.status(200).json({ ok: true, date, brief });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'internal_error', detail: err.message });
  }
}

export const config = { runtime: 'nodejs' };
