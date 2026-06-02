// POST /api/voice-chat
// Body: { text: string, voice: string, history?: Array<{role, content}> }
// Returns: { ok, text, audioBase64?, audioMimeType?, ttsError? }

const SYSTEM_PROMPT =
  "You are Hermes, a voice assistant for Mission Control. Be concise (1-3 sentences per response). Respond naturally as if speaking.";

const MINIMAX_TTS_URL = 'https://api.minimax.io/v1/text-to-speech';

const readBody = (req) =>
  new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });

// TODO Phase 2: replace with real MiniMax chat completion using history.
const generateReply = (text /*, history */) => {
  const cleaned = (text || '').trim();
  if (!cleaned) return "I didn't catch that. Could you try again?";
  return `I heard you say: ${cleaned}. This is a test response from the voice agent.`;
};

const synthesizeMiniMaxTTS = async (text, voice) => {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.MINIMAX_KEY;
  if (!apiKey) {
    return { ok: false, error: 'MINIMAX_API_KEY is not set' };
  }
  const payload = {
    model: 'speech-2.6-hd',
    text,
    voice_setting: { voice_id: voice || 'alpha', speed: 1, vol: 1, pitch: 0 },
    audio_setting: { format: 'mp3', sample_rate: 32000 },
  };
  try {
    const r = await fetch(MINIMAX_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return { ok: false, error: `MiniMax TTS ${r.status}: ${errText.slice(0, 200)}` };
    }
    const ctype = r.headers.get('content-type') || '';
    if (ctype.includes('application/json')) {
      const json = await r.json();
      const b64 =
        json?.data?.audio ||
        json?.audio ||
        json?.audio_base64 ||
        json?.data?.audio_base64;
      if (b64) return { ok: true, audioBase64: b64, mimeType: 'audio/mp3' };
      // Some endpoints return hex-encoded audio
      const hex = json?.data?.audio_hex || json?.audio_hex;
      if (hex) {
        const bytes = Buffer.from(hex, 'hex');
        return { ok: true, audioBase64: bytes.toString('base64'), mimeType: 'audio/mp3' };
      }
      return { ok: false, error: 'MiniMax returned JSON without recognized audio field' };
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return { ok: true, audioBase64: buf.toString('base64'), mimeType: 'audio/mp3' };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }

  const text = (body?.text || '').toString().trim();
  const voice = (body?.voice || 'alpha').toString();
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!text) {
    return res.status(400).json({ ok: false, error: 'Missing "text"' });
  }

  const reply = generateReply(text, [{ role: 'system', content: SYSTEM_PROMPT }, ...history]);
  const tts = await synthesizeMiniMaxTTS(reply, voice);

  if (tts.ok) {
    return res.status(200).json({
      ok: true,
      text: reply,
      audioBase64: tts.audioBase64,
      audioMimeType: tts.mimeType,
    });
  }

  return res.status(200).json({
    ok: true,
    text: reply,
    ttsError: tts.error,
  });
};
