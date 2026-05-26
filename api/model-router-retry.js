import { dispatchTask, parseBody } from './lib/model-router-core.js';
import {
  withQueueLock,
  readQueue,
  writeQueue,
  normalizeQueuedTask,
  summarizeQueue,
} from './lib/router-queue.js';

const DEFAULT_BATCH_SIZE = Number(process.env.MODEL_ROUTER_RETRY_BATCH_SIZE || 5);
const DEFAULT_MAX_RETRIES = Number(process.env.MODEL_ROUTER_MAX_RETRIES || 8);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const queue = await withQueueLock(async () => readQueue().map((q) => normalizeQueuedTask(q)));
      return res.status(200).json({ ok: true, status: 'ready', summary: summarizeQueue(queue) });
    } catch (error) {
      return res.status(503).json({ ok: false, status: 'error', error: error?.message || 'queue unavailable' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, status: 'error', error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const limit = Math.max(1, Math.min(Number(body?.limit || DEFAULT_BATCH_SIZE), 20));
  const maxRetries = Math.max(1, Math.min(Number(body?.maxRetries || DEFAULT_MAX_RETRIES), 50));

  try {
    const prepared = await withQueueLock(async () => {
      const queue = readQueue().map((q) => normalizeQueuedTask(q));
      const now = new Date().toISOString();
      const toRetry = [];

      for (const item of queue) {
        const eligible = item.status !== 'succeeded' && item.retryCount < maxRetries;
        if (eligible && toRetry.length < limit) {
          item.status = 'retrying';
          item.lastRetryAt = now;
          toRetry.push({ ...item });
        }
      }

      writeQueue(queue);
      return { toRetry, beforeSummary: summarizeQueue(queue) };
    });

    if (prepared.toRetry.length === 0) {
      const queue = await withQueueLock(async () => readQueue().map((q) => normalizeQueuedTask(q)));
      return res.status(200).json({
        ok: true,
        status: 'idle',
        processed: 0,
        results: [],
        summary: summarizeQueue(queue),
      });
    }

    const results = [];

    for (const item of prepared.toRetry) {
      const dispatch = await dispatchTask({
        task: item.task,
        lane: item.lane,
        requestId: item.requestId,
        metadata: {
          ...(item.metadata || {}),
          retriedFromQueue: true,
          previousRetryCount: item.retryCount,
        },
        queuedRetry: true,
      });

      const retryAt = new Date().toISOString();
      const retryResult = {
        requestId: item.requestId,
        ok: dispatch.ok,
        routedLane: dispatch.routedLane || null,
        modelStrategy: dispatch.modelStrategy || null,
        attempts: dispatch.attempts,
      };

      await withQueueLock(async () => {
        const queue = readQueue().map((q) => normalizeQueuedTask(q));
        const idx = queue.findIndex((q) => q.requestId === item.requestId);
        if (idx === -1) return;

        const current = queue[idx];
        current.retryCount += 1;
        current.lastRetryAt = retryAt;
        current.attempts = [...current.attempts, ...dispatch.attempts];

        if (dispatch.ok) {
          current.status = 'succeeded';
          current.succeededAt = retryAt;
          current.lastError = null;
        } else {
          current.status = current.retryCount >= maxRetries ? 'failed' : 'queued';
          current.failedAt = retryAt;
          current.lastError = dispatch.attempts[dispatch.attempts.length - 1]?.error || 'retry failed';
        }

        queue[idx] = current;
        writeQueue(queue);
      });

      results.push(retryResult);
    }

    const queue = await withQueueLock(async () => readQueue().map((q) => normalizeQueuedTask(q)));

    return res.status(200).json({
      ok: true,
      status: 'processed',
      processed: results.length,
      results,
      summary: summarizeQueue(queue),
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      status: 'error',
      error: error?.message || 'retry processing failed',
    });
  }
}
