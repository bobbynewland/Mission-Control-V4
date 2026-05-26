const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { embedText } = require('./embedding-provider.cjs');

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'memory-vectors.sqlite');
const MAX_CHUNK_CHARS = Number(process.env.MEMORY_CHUNK_SIZE || 1200);
const CHUNK_OVERLAP = Number(process.env.MEMORY_CHUNK_OVERLAP || 200);

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getMemoryRoot() {
  return process.env.MEMORY_ROOT || '/root/.openclaw/workspace';
}

function listMemoryFiles(root) {
  const files = [];
  const mainMemory = path.join(root, 'MEMORY.md');
  if (fs.existsSync(mainMemory)) files.push(mainMemory);

  const memoryDir = path.join(root, 'memory');
  if (fs.existsSync(memoryDir)) {
    for (const entry of fs.readdirSync(memoryDir)) {
      if (entry.endsWith('.md')) files.push(path.join(memoryDir, entry));
    }
  }

  return files.sort();
}

function inferDate(sourcePath, content) {
  const fileDate = path.basename(sourcePath).match(/(\d{4}-\d{2}-\d{2})/);
  if (fileDate) return fileDate[1];

  const headingDate = content.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (headingDate) return headingDate[1];

  return null;
}

function chunkText(content, sourcePath) {
  const lines = content.split('\n');
  const chunks = [];
  let cursor = 0;
  let chunkIndex = 0;

  while (cursor < lines.length) {
    let end = cursor;
    let size = 0;

    while (end < lines.length && size < MAX_CHUNK_CHARS) {
      size += lines[end].length + 1;
      end += 1;
    }

    if (end <= cursor) break;

    const startLine = cursor + 1;
    const endLine = end;
    const text = lines.slice(cursor, end).join('\n').trim();

    if (text) {
      chunks.push({
        chunkIndex,
        sourcePath,
        startLine,
        endLine,
        text,
      });
      chunkIndex += 1;
    }

    if (end >= lines.length) break;

    // Overlap by approximate chars converted to lines for context continuity.
    let overlapChars = 0;
    let back = end - 1;
    while (back > cursor && overlapChars < CHUNK_OVERLAP) {
      overlapChars += lines[back].length + 1;
      back -= 1;
    }
    cursor = Math.max(cursor + 1, back + 1);
  }

  return chunks;
}

function computeChunkId(chunk) {
  const stable = `${chunk.sourcePath}:${chunk.chunkIndex}:${chunk.startLine}:${chunk.endLine}`;
  return crypto.createHash('sha256').update(stable).digest('hex');
}

function openDb(dbPath = DEFAULT_DB_PATH) {
  ensureDirFor(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_chunks (
      chunk_id TEXT PRIMARY KEY,
      source_path TEXT NOT NULL,
      inferred_date TEXT,
      chunk_index INTEGER NOT NULL,
      line_start INTEGER NOT NULL,
      line_end INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      embedding_provider TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memory_source ON memory_chunks(source_path);
    CREATE INDEX IF NOT EXISTS idx_memory_date ON memory_chunks(inferred_date);
  `);
  return db;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  return dot / denom;
}

function snippetFor(text, q, maxLen = 240) {
  if (!q) return text.slice(0, maxLen);
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + q.length + 140);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

async function indexMemory({ dbPath = DEFAULT_DB_PATH } = {}) {
  const root = getMemoryRoot();
  const files = listMemoryFiles(root);
  const db = openDb(dbPath);

  const upsert = db.prepare(`
    INSERT INTO memory_chunks (
      chunk_id, source_path, inferred_date, chunk_index, line_start, line_end,
      text, embedding_json, embedding_provider, content_hash, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chunk_id) DO UPDATE SET
      source_path = excluded.source_path,
      inferred_date = excluded.inferred_date,
      chunk_index = excluded.chunk_index,
      line_start = excluded.line_start,
      line_end = excluded.line_end,
      text = excluded.text,
      embedding_json = excluded.embedding_json,
      embedding_provider = excluded.embedding_provider,
      content_hash = excluded.content_hash,
      updated_at = excluded.updated_at
  `);

  let total = 0;
  let embeddedWith = 'mock';
  const seen = new Set();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const inferredDate = inferDate(filePath, content);
    const chunks = chunkText(content, path.relative(root, filePath));

    for (const chunk of chunks) {
      const chunkId = computeChunkId(chunk);
      const contentHash = crypto.createHash('sha256').update(chunk.text).digest('hex');
      const now = new Date().toISOString();
      const existing = db
        .prepare('SELECT content_hash FROM memory_chunks WHERE chunk_id = ?')
        .get(chunkId);

      seen.add(chunkId);

      if (existing && existing.content_hash === contentHash) {
        total += 1;
        continue;
      }

      const { vector, provider } = await embedText(chunk.text);
      embeddedWith = provider;

      upsert.run(
        chunkId,
        chunk.sourcePath,
        inferredDate,
        chunk.chunkIndex,
        chunk.startLine,
        chunk.endLine,
        chunk.text,
        JSON.stringify(vector),
        provider,
        contentHash,
        now,
      );
      total += 1;
    }
  }

  // Remove chunks no longer present.
  if (seen.size > 0) {
    const placeholders = [...seen].map(() => '?').join(',');
    db.prepare(`DELETE FROM memory_chunks WHERE chunk_id NOT IN (${placeholders})`).run(...seen);
  }

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM memory_chunks').get();
  db.close();

  return {
    filesIndexed: files.length,
    chunksProcessed: total,
    chunksStored: countRow?.count || 0,
    embeddingProvider: embeddedWith,
    dbPath,
  };
}

function searchMemory({ q, topK = 8, source, date, dbPath = DEFAULT_DB_PATH }) {
  const db = openDb(dbPath);

  return (async () => {
    const { vector: queryVec, provider } = await embedText(q);
    let sql = 'SELECT * FROM memory_chunks WHERE 1=1';
    const params = [];

    if (source) {
      sql += ' AND source_path LIKE ?';
      params.push(`%${source}%`);
    }
    if (date) {
      sql += ' AND inferred_date = ?';
      params.push(date);
    }

    const rows = db.prepare(sql).all(...params);

    const scored = rows
      .map((row) => {
        const vec = JSON.parse(row.embedding_json);
        const score = cosineSimilarity(queryVec, vec);
        return {
          id: row.chunk_id,
          score,
          source: row.source_path,
          date: row.inferred_date,
          chunkIndex: row.chunk_index,
          lineStart: row.line_start,
          lineEnd: row.line_end,
          snippet: snippetFor(row.text, q),
          text: row.text,
          citation: `${row.source_path}:${row.line_start}-${row.line_end}`,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(topK) || 8);

    db.close();

    return {
      queryEmbeddingProvider: provider,
      totalCandidates: rows.length,
      results: scored,
    };
  })();
}

module.exports = {
  indexMemory,
  searchMemory,
  openDb,
};
