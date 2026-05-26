import fs from 'fs';
import path from 'path';

const QUEUE_PATH = '/root/.openclaw/workspace/mission-control-v3/data/router-queue.json';
const LOCK_PATH = `${QUEUE_PATH}.lock`;
const LOCK_TIMEOUT_MS = Number(process.env.MODEL_ROUTER_QUEUE_LOCK_TIMEOUT_MS || 10000);
const STALE_LOCK_MS = Number(process.env.MODEL_ROUTER_QUEUE_STALE_LOCK_MS || 30000);

function ensureQueueDir() {
  const dir = path.dirname(QUEUE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readQueue() {
  ensureQueueDir();
  if (!fs.existsSync(QUEUE_PATH)) return [];
  try {
    const raw = fs.readFileSync(QUEUE_PATH, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  ensureQueueDir();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(items || [], null, 2));
}

async function withQueueLock(fn) {
  ensureQueueDir();
  const start = Date.now();
  let lockFd = null;

  while (!lockFd && Date.now() - start < LOCK_TIMEOUT_MS) {
    try {
      lockFd = fs.openSync(LOCK_PATH, 'wx');
      fs.writeFileSync(lockFd, `${process.pid} ${new Date().toISOString()}\n`);
      break;
    } catch {
      try {
        const stat = fs.statSync(LOCK_PATH);
        if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
          fs.unlinkSync(LOCK_PATH);
          continue;
        }
      } catch {
        // lock may have been released between checks
      }
      await sleep(50);
    }
  }

  if (!lockFd) throw new Error('Queue lock timeout');

  try {
    return await fn();
  } finally {
    try {
      fs.closeSync(lockFd);
    } catch {
      // noop
    }
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {
      // noop
    }
  }
}

function normalizeQueuedTask(task = {}) {
  return {
    requestId: task.requestId,
    lane: task.lane,
    task: task.task,
    metadata: task.metadata || {},
    queuedAt: task.queuedAt || new Date().toISOString(),
    status: task.status || 'queued',
    attempts: Array.isArray(task.attempts) ? task.attempts : [],
    retryCount: Number(task.retryCount || 0),
    lastRetryAt: task.lastRetryAt || null,
    succeededAt: task.succeededAt || null,
    failedAt: task.failedAt || null,
    lastError: task.lastError || null,
  };
}

function summarizeQueue(items = []) {
  const summary = {
    total: items.length,
    queued: 0,
    retrying: 0,
    succeeded: 0,
    failed: 0,
  };

  for (const item of items) {
    if (item.status === 'succeeded') summary.succeeded += 1;
    else if (item.status === 'failed') summary.failed += 1;
    else if (item.status === 'retrying') summary.retrying += 1;
    else summary.queued += 1;
  }

  return summary;
}

export {
  QUEUE_PATH,
  readQueue,
  writeQueue,
  withQueueLock,
  normalizeQueuedTask,
  summarizeQueue,
};
