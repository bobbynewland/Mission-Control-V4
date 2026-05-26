# Memory Embeddings (Mission Control v3)

This adds semantic search over:
- `/root/.openclaw/workspace/MEMORY.md`
- `/root/.openclaw/workspace/memory/*.md`

## Env vars

Optional (safe defaults exist):

- `MEMORY_ROOT` (default: `/root/.openclaw/workspace`)
- `MEMORY_CHUNK_SIZE` (default: `1200` chars)
- `MEMORY_CHUNK_OVERLAP` (default: `200` chars)
- `MEMORY_EMBEDDING_PROVIDER` (`openai` or `mock`; default auto)
- `MEMORY_EMBEDDING_MODEL` (default: `text-embedding-3-small`)
- `OPENAI_API_KEY` (if set, OpenAI embeddings are used)
- `MEMORY_ALLOW_EMBEDDING_FALLBACK` (default allows fallback to mock)

## Commands

From `mission-control-v3`:

```bash
npm run memory:index
```

Runs idempotent indexing/upsert into local sqlite:

- `mission-control-v3/data/memory-vectors.sqlite`

Smoke test:

```bash
npm run memory:smoke
```

## API

Endpoint: `POST /api/memory-search`

Request JSON:

```json
{
  "q": "minimax strategy",
  "topK": 8,
  "source": "memory/2026-02",
  "date": "2026-02-16",
  "sync": false
}
```

- `q` (required unless `sync` only)
- `topK` optional
- `source` optional path filter
- `date` optional exact inferred date filter
- `sync` optional: run reindex before search

Response includes:
- `results[]` with `snippet`, `score`, `source`, `citation`, full `text`
- embedding provider used

## UI

Open **Memory** tab in Mission Control UI.
- Search box = “Ask Memory” semantic query
- Optional source/date filters
- “Sync + Search” reindexes then searches
- Expand a result row to view full chunk context
