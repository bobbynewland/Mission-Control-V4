const SUPPORTED_LANES = ['gemini', 'claude', 'minimax', 'kimi'];

const LANE_STRATEGIES = {
  gemini: ['gemini-3.0-pro', 'gemini-3.0-flash', 'gemini-2.0-pro'],
  claude: ['claude-opus-4.5', 'claude-sonnet-4.5'],
  minimax: ['minimax', 'minimax-lightning', 'minimax-oauth'],
  kimi: ['kimi-k2.5', 'kimi-k2.5-swarm'],
};

const LANE_FALLBACK_ORDER = {
  gemini: ['gemini', 'claude', 'minimax', 'kimi'],
  claude: ['claude', 'gemini', 'minimax', 'kimi'],
  minimax: ['minimax', 'gemini', 'claude', 'kimi'],
  kimi: ['kimi', 'gemini', 'claude', 'minimax'],
};

const DEFAULT_UPSTREAM = process.env.MODEL_ROUTER_UPSTREAM_URL || 'http://127.0.0.1:3334/execute';
const REQUEST_TIMEOUT_MS = Number(process.env.MODEL_ROUTER_TIMEOUT_MS || 4000);

function parseBody(req) {
  if (!req || req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return req.body;
}

async function callUpstream(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DEFAULT_UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text || '{}');
    } catch {
      json = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      data: json,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error?.message || 'upstream request failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function dispatchTask({ task, lane, requestId, metadata = {}, source = 'mission-control-v3', queuedRetry = false }) {
  const fallbackOrder = LANE_FALLBACK_ORDER[lane] || [lane];
  const attempts = [];

  for (let idx = 0; idx < fallbackOrder.length; idx += 1) {
    const candidateLane = fallbackOrder[idx];
    const modelStrategy = LANE_STRATEGIES[candidateLane]?.[0] || candidateLane;

    const dispatchPayload = {
      requestId,
      task,
      lane,
      routedLane: candidateLane,
      modelStrategy,
      fallbackIndex: idx,
      fallbackOrder,
      metadata,
      source,
      queuedRetry,
      requestedAt: new Date().toISOString(),
    };

    const result = await callUpstream(dispatchPayload);
    attempts.push({
      lane: candidateLane,
      modelStrategy,
      ok: result.ok,
      status: result.status,
      error: result.error || null,
      attemptedAt: new Date().toISOString(),
    });

    if (result.ok) {
      return {
        ok: true,
        fallbackOrder,
        attempts,
        routedLane: candidateLane,
        modelStrategy,
        fallbackUsed: idx > 0,
        upstream: result.data,
      };
    }
  }

  return {
    ok: false,
    fallbackOrder,
    attempts,
  };
}

export {
  SUPPORTED_LANES,
  LANE_FALLBACK_ORDER,
  DEFAULT_UPSTREAM,
  parseBody,
  dispatchTask,
};
