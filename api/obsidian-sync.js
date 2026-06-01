/**
 * Obsidian -> Firebase sync endpoint
 * POST /api/obsidian-sync
 *
 * Vercel cannot read a user's local Obsidian vault, so the app parses selected
 * markdown files in the browser and sends normalized notes here for persistence.
 */
export const config = {
  runtime: 'nodejs',
};

const FIREBASE_DB = 'https://winslow-756c3-default-rtdb.firebaseio.com';
const OBSIDIAN_PATH = 'workspaces/winslow_main/obsidian';

function firebaseAuthQuery() {
  const token =
    process.env.FIREBASE_DATABASE_AUTH_TOKEN ||
    process.env.FIREBASE_REST_TOKEN ||
    process.env.FIREBASE_AUTH_TOKEN;

  return token ? `?auth=${encodeURIComponent(token)}` : '';
}

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  return [...new Set(
    tags
      .filter((tag) => typeof tag === 'string')
      .map((tag) => tag.replace(/^#/, '').trim())
      .filter(Boolean)
  )];
}

function safeDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function safeNoteId(note, index) {
  const source = cleanString(note.id) || cleanString(note.filePath) || `note_${index}`;
  const id = source.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 180);
  return id || `note_${index}`;
}

function normalizeNote(note, index) {
  const filePath = cleanString(note.filePath);
  const fallbackTitle = filePath.split('/').pop()?.replace(/\.md$/i, '') || 'Untitled';

  return {
    id: safeNoteId(note, index),
    title: cleanString(note.title, fallbackTitle) || fallbackTitle,
    content: typeof note.content === 'string' ? note.content : '',
    folder: cleanString(note.folder),
    filePath,
    tags: normalizeTags(note.tags),
    created: safeDate(note.created),
    updated: safeDate(note.updated),
  };
}

async function syncToFirebase(notes) {
  const timestamp = new Date().toISOString();
  const updates = {};

  for (const note of notes) {
    updates[`${OBSIDIAN_PATH}/${note.id}`] = {
      title: note.title,
      content: note.content,
      folder: note.folder,
      filePath: note.filePath,
      tags: note.tags,
      created: note.created,
      updated: note.updated,
      syncedAt: timestamp,
    };
  }

  const patchRes = await fetch(`${FIREBASE_DB}/.json${firebaseAuthQuery()}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!patchRes.ok) {
    const errorText = await patchRes.text();
    throw new Error(`Firebase write failed (${patchRes.status}): ${errorText}`);
  }

  return { count: notes.length, timestamp };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  const expectedKey = process.env.OBSIDIAN_SYNC_KEY;
  if (expectedKey && req.headers['x-api-key'] !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const incomingNotes = Array.isArray(req.body?.notes) ? req.body.notes : [];

    if (!incomingNotes.length) {
      return res.status(400).json({
        success: false,
        error: 'No notes provided',
        message: 'Vercel cannot scan your local Obsidian vault. Select your vault files in the Obsidian tab or POST { notes } to this endpoint.',
      });
    }

    const notes = incomingNotes
      .map((note, index) => normalizeNote(note || {}, index))
      .filter((note) => note.content || note.title !== 'Untitled' || note.filePath);

    if (!notes.length) {
      return res.status(400).json({
        success: false,
        error: 'No valid notes provided',
      });
    }

    const result = await syncToFirebase(notes);

    return res.status(200).json({
      success: true,
      count: result.count,
      timestamp: result.timestamp,
      message: `Synced ${result.count} notes to Firebase`,
    });
  } catch (error) {
    console.error('Obsidian sync error:', error);
    return res.status(500).json({ error: 'Sync failed', details: error.message });
  }
}
