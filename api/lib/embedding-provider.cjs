const crypto = require('node:crypto');

function normalize(vec) {
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / mag);
}

function mockEmbedding(text, dims = 256) {
  const vec = new Array(dims).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const token of tokens) {
    const hash = crypto.createHash('sha256').update(token).digest();
    for (let i = 0; i < 8; i++) {
      const idx = hash.readUInt16BE(i * 2) % dims;
      const sign = hash[i + 16] % 2 === 0 ? 1 : -1;
      vec[idx] += sign * ((hash[i] / 255) + 0.1);
    }
  }
  return normalize(vec);
}

async function openAIEmbedding(text, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || process.env.MEMORY_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const textBody = await response.text();
    throw new Error(`OpenAI embedding failed: ${response.status} ${textBody}`);
  }

  const payload = await response.json();
  return payload?.data?.[0]?.embedding;
}

async function embedText(text) {
  const provider = (process.env.MEMORY_EMBEDDING_PROVIDER || '').toLowerCase();

  if (provider === 'mock') {
    return { vector: mockEmbedding(text), provider: 'mock' };
  }

  if (process.env.OPENAI_API_KEY && (provider === '' || provider === 'openai')) {
    try {
      const vector = await openAIEmbedding(text);
      return { vector, provider: 'openai' };
    } catch (error) {
      if (process.env.MEMORY_ALLOW_EMBEDDING_FALLBACK === 'false') {
        throw error;
      }
      return { vector: mockEmbedding(text), provider: 'mock-fallback' };
    }
  }

  return { vector: mockEmbedding(text), provider: 'mock' };
}

module.exports = {
  embedText,
  mockEmbedding,
};
