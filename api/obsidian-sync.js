/**
 * Obsidian → Firebase sync endpoint
 * POST /api/obsidian-sync
 * Reads local Obsidian vault markdown files, extracts metadata,
 * and writes them to Firebase Realtime Database at workspaces/winslow_main/obsidian
 *
 * Requires OBSIDIAN_VAULT_PATH env var (path to Obsidian vault on the machine running this)
 * or uses default ~/Documents/Obsidian Vault
 *
 * Also accepts POSTed notes directly from external sync tools:
 * Body: { notes: [{ title, content, folder, filePath, tags, created, updated }] }
 */
export const config = {
  runtime: 'nodejs',
};

import fs from 'fs';
import path from 'path';
import { readdir } from 'fs/promises';

const FIREBASE_DB = 'https://winslow-756c3-default-rtdb.firebaseio.com';

// Load service account for Firebase REST API
function getFirebaseToken() {
  try {
    const credPath = path.join(process.env.HERMES_HOME || process.env.HOME, '.hermes/firebase.json');
    if (fs.existsSync(credPath)) {
      return JSON.parse(fs.readFileSync(credPath, 'utf8'));
    }
  } catch {}
  return null;
}

function extractTags(content) {
  const tags = [];
  // Extract #tag patterns
  const tagMatches = content.match(/#[a-zA-Z0-9_\-/]+/g) || [];
  tags.push(...tagMatches.map(t => t.slice(1)));
  // Extract YAML frontmatter tags
  const yamlMatch = content.match(/^tags:\s*\n([\s\S]*?)(?=\n\w|\n$)/m);
  if (yamlMatch) {
    const yamlTags = yamlMatch[1].split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    tags.push(...yamlTags);
  }
  return [...new Set(tags)];
}

function extractMetadata(filePath, content) {
  const stats = fs.statSync(filePath);
  const fileName = path.basename(filePath, '.md');

  let title = fileName;
  let created = stats.birthtime.toISOString();
  let updated = stats.mtime.toISOString();

  // Try to extract title from first H1
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) title = h1Match[1].trim();

  // Try to extract date from YAML frontmatter
  const dateMatch = content.match(/^date:\s*(.+)$/m);
  if (dateMatch) {
    const d = new Date(dateMatch[1]);
    if (!isNaN(d)) updated = d.toISOString();
  }

  // Folder relative to vault root
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH || path.join(process.env.HOME, 'Documents/Obsidian Vault');
  const relativePath = path.relative(vaultPath, filePath);
  const folder = path.dirname(relativePath);
  const folderName = folder === '.' ? '' : folder.split(path.sep)[0];

  return {
    title,
    content,
    folder: folderName,
    filePath: relativePath,
    tags: extractTags(content),
    created,
    updated,
  };
}

async function scanVault(vaultPath) {
  const notes = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        await walk(fullPath);
      } else if (entry.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const meta = extractMetadata(fullPath, content);
          const noteId = Buffer.from(meta.filePath).toString('base64').replace(/\//g, '_');
          notes.push({ id: noteId, ...meta });
        } catch {}
      }
    }
  }

  await walk(vaultPath);
  return notes;
}

async function syncToFirebase(notes) {
  const cred = getFirebaseToken();
  if (!cred) throw new Error('Firebase credentials not found');

  const token = cred.token;
  const timestamp = new Date().toISOString();

  // Build updates object for Firebase patch
  const updates = {};
  for (const note of notes) {
    updates[`workspaces/winslow_main/obsidian/${note.id}`] = {
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

  // Firebase REST API - batch patch
  const patchRes = await fetch(`${FIREBASE_DB}/.json?auth=${token}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!patchRes.ok) {
    const err = await patchRes.text();
    throw new Error(`Firebase write failed: ${err}`);
  }

  return { count: notes.length, timestamp };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.OBSIDIAN_SYNC_KEY;
  if (expectedKey && apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let notes = [];

    // Mode 1: External sync sends pre-processed notes array
    if (req.body?.notes && Array.isArray(req.body.notes)) {
      notes = req.body.notes.map(n => ({
        id: n.id || n.filePath?.replace(/[^a-zA-Z0-9]/g, '_') || `note_${Date.now()}`,
        title: n.title || 'Untitled',
        content: n.content || '',
        folder: n.folder || '',
        filePath: n.filePath || '',
        tags: n.tags || [],
        created: n.created || new Date().toISOString(),
        updated: n.updated || new Date().toISOString(),
      }));
    }

    // Mode 2: Scan local Obsidian vault
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH ||
      path.join(process.env.HOME || '/Users/taloufilms', 'Documents/Obsidian Vault');

    if (!notes.length && fs.existsSync(vaultPath)) {
      console.log('Scanning Obsidian vault at:', vaultPath);
      notes = await scanVault(vaultPath);
    }

    if (!notes.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        message: 'No notes found to sync',
        vaultPath,
      });
    }

    console.log(`Syncing ${notes.length} notes to Firebase...`);
    const result = await syncToFirebase(notes);

    return res.status(200).json({
      success: true,
      count: result.count,
      timestamp: result.timestamp,
      message: `Synced ${result.count} notes to Firebase`,
      vaultPath,
    });
  } catch (error) {
    console.error('Obsidian sync error:', error);
    return res.status(500).json({ error: 'Sync failed', details: error.message });
  }
}