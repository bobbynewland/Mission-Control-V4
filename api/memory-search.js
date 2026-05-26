const { indexMemory, searchMemory } = require('./lib/memory-indexer.cjs');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { q, query, topK, source, date, sync } = req.body || {};
      const finalQuery = (q || query || '').trim();

      if (sync) {
        const syncResult = await indexMemory();
        if (!finalQuery) {
          return res.status(200).json({ ok: true, sync: syncResult, results: [] });
        }
        const searchResult = await searchMemory({ q: finalQuery, topK, source, date });
        return res.status(200).json({ ok: true, sync: syncResult, ...searchResult });
      }

      if (!finalQuery) {
        return res.status(400).json({ error: 'q (or query) is required' });
      }

      const searchResult = await searchMemory({ q: finalQuery, topK, source, date });
      return res.status(200).json({ ok: true, ...searchResult });
    }

    if (req.method === 'GET') {
      const q = (req.query?.q || '').trim();
      const topK = req.query?.topK;
      const source = req.query?.source;
      const date = req.query?.date;
      const sync = String(req.query?.sync || '').toLowerCase() === 'true';

      if (sync) {
        const syncResult = await indexMemory();
        if (!q) {
          return res.status(200).json({ ok: true, sync: syncResult, results: [] });
        }
        const searchResult = await searchMemory({ q, topK, source, date });
        return res.status(200).json({ ok: true, sync: syncResult, ...searchResult });
      }

      if (!q) return res.status(400).json({ error: 'q is required' });

      const searchResult = await searchMemory({ q, topK, source, date });
      return res.status(200).json({ ok: true, ...searchResult });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Memory search error:', error);
    return res.status(500).json({ error: error.message || 'Memory search failed' });
  }
};
