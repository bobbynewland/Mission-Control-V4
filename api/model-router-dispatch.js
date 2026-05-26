import {
  SUPPORTED_LANES,
  LANE_FALLBACK_ORDER,
  DEFAULT_UPSTREAM,
  parseBody,
  dispatchTask,
} from './lib/model-router-core.js';
import {
  withQueueLock,
  readQueue,
  writeQueue,
  normalizeQueuedTask,
} from './lib/router-queue.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      status: 'ready',
      lanes: SUPPORTED_LANES,
      fallbackOrder: LANE_FALLBACK_ORDER,
      upstream: DEFAULT_UPSTREAM,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, status: 'error', error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const task = String(body?.task || '').trim();
  const lane = String(body?.lane || '').trim().toLowerCase();

  if (!task) {
    return res.status(400).json({ ok: false, status: 'error', error: 'task is required' });
  }

  if (!SUPPORTED_LANES.includes(lane)) {
    return res.status(400).json({ ok: false, status: 'error', error: `lane must be one of: ${SUPPORTED_LANES.join(', ')}` });
  }

  const requestId = `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dispatch = await dispatchTask({
    task,
    lane,
    requestId,
    metadata: body?.metadata || {},
  });

  if (dispatch.ok) {
    return res.status(200).json({
      ok: true,
      status: dispatch.fallbackUsed ? 'fallback-used' : 'routed',
      requestId,
      lane,
      routedLane: dispatch.routedLane,
      modelStrategy: dispatch.modelStrategy,
      fallbackUsed: dispatch.fallbackUsed,
      attempts: dispatch.attempts,
      upstream: dispatch.upstream,
    });
  }

  try {
    const queuedTask = normalizeQueuedTask({
      requestId,
      lane,
      task,
      attempts: dispatch.attempts,
      metadata: body?.metadata || {},
      queuedAt: new Date().toISOString(),
      status: 'queued',
      failedAt: new Date().toISOString(),
      lastError: dispatch.attempts[dispatch.attempts.length - 1]?.error || 'upstream unavailable',
    });

    await withQueueLock(async () => {
      const current = readQueue();
      current.push(queuedTask);
      writeQueue(current);
    });

    return res.status(202).json({
      ok: true,
      status: 'queued',
      requestId,
      lane,
      fallbackOrder: dispatch.fallbackOrder,
      attempts: dispatch.attempts,
      message: 'Upstream execution unavailable; task queued for retry.',
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      status: 'error',
      requestId,
      lane,
      attempts: dispatch.attempts,
      error: error?.message || 'Failed to queue task after upstream failures',
    });
  }
}
