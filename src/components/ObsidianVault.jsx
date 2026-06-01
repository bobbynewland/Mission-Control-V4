import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  FolderOpen,
  Lightbulb,
  Clock,
  RefreshCw,
  Upload,
  ChevronRight,
  BookOpen,
  Zap,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const FOLDER_GROUPS = [
  { id: 'all', label: 'All Notes', icon: BookOpen, color: 'text-blue-400' },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb, color: 'text-yellow-400', path: 'Ideas' },
  { id: 'sops', label: 'SOPs', icon: Zap, color: 'text-purple-400', path: 'SOPs' },
  { id: 'daily', label: 'Daily Logs', icon: Clock, color: 'text-green-400', path: 'daily_log' },
  { id: 'projects', label: 'Projects', icon: FolderOpen, color: 'text-orange-400' },
];

const MAX_SYNC_BATCH_BYTES = 2_750_000;

function getRelativePath(file) {
  return file.webkitRelativePath || file.name;
}

function extractTitle(filePath, content) {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match?.[1]) return h1Match[1].trim();

  return filePath.split('/').pop()?.replace(/\.md$/i, '') || 'Untitled';
}

function extractTags(content) {
  const tags = new Set();
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const yaml = frontmatter?.[1] || '';
  const inlineTags = yaml.match(/^tags:\s*(.+)$/m)?.[1];
  const tagBlock = yaml.match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m)?.[1];

  if (inlineTags) {
    inlineTags
      .replace(/[\[\]'"]/g, '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .forEach((tag) => tags.add(tag.replace(/^#/, '')));
  }

  if (tagBlock) {
    tagBlock
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean)
      .forEach((tag) => tags.add(tag.replace(/^#/, '')));
  }

  for (const match of content.matchAll(/(^|\s)#([a-zA-Z0-9_\-/]+)/g)) {
    tags.add(match[2]);
  }

  return [...tags];
}

async function parseMarkdownFiles(fileList) {
  const markdownFiles = [...fileList].filter((file) => /\.md$/i.test(file.name));
  const notes = [];

  for (const file of markdownFiles) {
    const content = await file.text();
    const filePath = getRelativePath(file);
    const parts = filePath.split('/').filter(Boolean);
    const folder = parts.length > 1 ? parts[0] : '';
    const updated = new Date(file.lastModified || Date.now()).toISOString();

    notes.push({
      id: filePath.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_'),
      title: extractTitle(filePath, content),
      content,
      folder,
      filePath,
      tags: extractTags(content),
      created: updated,
      updated,
    });
  }

  return notes;
}

function batchNotes(notes) {
  const batches = [];
  let current = [];
  let size = 0;

  for (const note of notes) {
    const noteSize = JSON.stringify(note).length;
    if (current.length && size + noteSize > MAX_SYNC_BATCH_BYTES) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(note);
    size += noteSize;
  }

  if (current.length) batches.push(current);
  return batches;
}

const ObsidianVault = () => {
  const [notes, setNotes] = useState({});
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [activeFolder, setActiveFolder] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [readMode, setReadMode] = useState(true);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const fileInputRef = useRef(null);

  // Subscribe to obsidian collection in Firebase
  useEffect(() => {
    const unsubscribe = db.obsidian.subscribeList((data) => {
      setNotes(data || {});
      setLoading(false);
      // Restore last synced time
      const stored = localStorage.getItem('mc_obsidian_last_synced');
      if (stored) setLastSynced(new Date(stored));
    });
    return () => unsubscribe();
  }, []);

  // Filter notes
  useEffect(() => {
    let result = Object.entries(notes);

    // Filter by folder
    if (activeFolder !== 'all') {
      const folder = FOLDER_GROUPS.find(f => f.id === activeFolder);
      if (folder?.path) {
        if (folder.id === 'daily') {
          result = result.filter(([_, n]) => n.filePath?.includes('daily_log'));
        } else {
          result = result.filter(([_, n]) => n.folder === folder.path);
        }
      }
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(([_, n]) =>
        n.title?.toLowerCase().includes(q) ||
        n.content?.toLowerCase().includes(q) ||
        n.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort by updated
    result.sort((a, b) => new Date(b[1].updated || 0) - new Date(a[1].updated || 0));
    setFilteredNotes(result);
  }, [notes, activeFolder, searchQuery]);

  const syncBatch = useCallback(async (batch, allowKeyPrompt = true) => {
    const syncKey = localStorage.getItem('mc_obsidian_sync_key');
    const headers = { 'Content-Type': 'application/json' };
    if (syncKey) headers['x-api-key'] = syncKey;

    const response = await fetch('/api/obsidian-sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ notes: batch }),
    });

    if (response.status === 401 && allowKeyPrompt) {
      const key = window.prompt('Enter the Obsidian sync key from Vercel');
      if (key) {
        localStorage.setItem('mc_obsidian_sync_key', key.trim());
        return syncBatch(batch, false);
      }
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.details || payload.message || payload.error || 'Sync failed');
    }

    return payload;
  }, []);

  const uploadFiles = useCallback(async (fileList) => {
    if (!fileList?.length) return;

    setSyncing(true);
    setSyncError('');
    setSyncMessage('Reading markdown files...');

    try {
      const parsedNotes = await parseMarkdownFiles(fileList);

      if (!parsedNotes.length) {
        setSyncError('No markdown files were selected.');
        return;
      }

      let syncedCount = 0;
      let timestamp = new Date().toISOString();
      const batches = batchNotes(parsedNotes);

      for (let index = 0; index < batches.length; index += 1) {
        setSyncMessage(`Syncing batch ${index + 1} of ${batches.length}...`);
        const result = await syncBatch(batches[index]);
        syncedCount += result.count || batches[index].length;
        timestamp = result.timestamp || timestamp;
      }

      setLastSynced(new Date(timestamp));
      setSyncMessage(`Synced ${syncedCount} notes`);
      localStorage.setItem('mc_obsidian_last_synced', timestamp);
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncError(err.message || 'Sync failed');
      setSyncMessage('');
    } finally {
      setSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [syncBatch]);

  const handleSync = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelection = useCallback((event) => {
    uploadFiles(event.target.files);
  }, [uploadFiles]);

  const getPreview = (content) => {
    if (!content) return '';
    const stripped = content.replace(/[#*>\-\[\]~`_]/g, '').trim();
    return stripped.length > 120 ? stripped.substring(0, 120) + '...' : stripped;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return '';
    }
  };

  const formatRelative = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return format(new Date(dateStr), 'MMM d');
    } catch {
      return '';
    }
  };

  // ─── LIST VIEW ──────────────────────────────────────────────────────────────
  if (!selectedNote) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 bg-zinc-950 border-b border-zinc-800/50 safe-area-pt">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <BookOpen size={20} className="text-emerald-400" />
              </div>
              <div>
                <span className="font-bold text-zinc-100 text-xl">Obsidian</span>
                {lastSynced && (
                  <p className="text-[10px] text-zinc-500">
                    Synced {formatRelative(lastSynced.toISOString())}
                  </p>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,text/markdown,text/plain"
              multiple
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={handleFileSelection}
            />
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-11 h-11 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 rounded-2xl flex items-center justify-center transition-colors active:scale-95"
              title="Upload Obsidian vault files"
            >
              {syncing ? (
                <RefreshCw size={18} className="text-emerald-400 animate-spin" />
              ) : (
                <Upload size={18} className="text-emerald-400" />
              )}
            </button>
          </div>

          {/* Search */}
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/40 transition-colors"
              />
            </div>
          </div>

          {(syncMessage || syncError) && (
            <div className="px-5 pb-3">
              <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                syncError
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
              }`}>
                {syncError ? (
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <RefreshCw size={14} className={`mt-0.5 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
                )}
                <span>{syncError || syncMessage}</span>
              </div>
            </div>
          )}

          {/* Folder Tabs */}
          <div className="px-5 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex gap-2">
              {FOLDER_GROUPS.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
                    activeFolder === folder.id
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800/50 text-zinc-400 border border-transparent hover:text-zinc-200'
                  }`}
                >
                  <folder.icon size={14} className={activeFolder === folder.id ? folder.color : ''} />
                  {folder.label}
                  {folder.id !== 'all' && notes && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeFolder === folder.id ? 'bg-emerald-500/20' : 'bg-zinc-700'
                    }`}>
                      {Object.values(notes).filter(n => {
                        if (folder.id === 'daily') return n.filePath?.includes('daily_log');
                        return n.folder === folder.path;
                      }).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
              <div className="w-8 h-8 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin mb-3" />
              <span className="text-sm">Loading vault...</span>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <BookOpen size={52} className="mx-auto mb-4 opacity-15" />
              <p className="text-base font-medium text-zinc-400">
                {searchQuery ? 'No results found' : 'No notes yet'}
              </p>
              <p className="text-sm text-zinc-600 mt-1">
                {searchQuery ? 'Try a different search' : 'Upload your Obsidian vault markdown files'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleSync}
                  className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold"
                >
                  Upload Vault
                </button>
              )}
            </div>
          ) : (
            <div className="pt-4 space-y-2">
              {filteredNotes.map(([id, note]) => (
                <button
                  key={id}
                  onClick={() => setSelectedNote({ id, ...note })}
                  className="w-full text-left bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 hover:border-zinc-700/80 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-zinc-100 text-sm leading-tight line-clamp-2">
                      {note.title || 'Untitled'}
                    </h3>
                    <ChevronRight size={16} className="text-zinc-600 flex-shrink-0 mt-0.5" />
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                    {getPreview(note.content)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {note.folder && (
                      <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">
                        {note.folder}
                      </span>
                    )}
                    {note.tags?.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 bg-emerald-500/10 rounded-full text-emerald-400">
                        #{tag}
                      </span>
                    ))}
                    <span className="text-[10px] text-zinc-600 ml-auto">
                      {formatRelative(note.updated || note.created)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── NOTE READER ───────────────────────────────────────────────────────────
  const { id, content, title, folder, tags = [], updated, filePath } = selectedNote;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-zinc-950 border-b border-zinc-800/50 safe-area-pt">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <button
            onClick={() => setSelectedNote(null)}
            className="w-10 h-10 bg-zinc-800/60 rounded-xl flex items-center justify-center hover:bg-zinc-700/60 transition-colors"
          >
            <ArrowLeft size={18} className="text-zinc-300" />
          </button>
          <div className="flex items-center gap-2">
            {readMode ? (
              <a
                href={`obsidian://open?vault=Obsidian%20Vault&file=${encodeURIComponent(filePath || title)}`}
                className="w-10 h-10 bg-zinc-800/60 rounded-xl flex items-center justify-center hover:bg-zinc-700/60 transition-colors"
                title="Open in Obsidian"
              >
                <BookOpen size={16} className="text-zinc-400" />
              </a>
            ) : null}
          </div>
        </div>

        {/* Note Meta */}
        <div className="px-5 pb-3">
          <h1 className="font-black text-xl text-zinc-100 leading-tight mb-1">{title || 'Untitled'}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {folder && (
              <span className="text-xs px-2 py-0.5 bg-emerald-500/15 rounded-full text-emerald-400 font-medium">
                {folder}
              </span>
            )}
            {updated && (
              <span className="text-xs text-zinc-500">{formatDate(updated)}</span>
            )}
            {tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-28" style={{ scrollbarWidth: 'none' }}>
        <div className="prose prose-invert prose-sm max-w-none">
          {/* Render markdown as readable text with basic formatting */}
          <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-mono">
            {content || 'No content'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ObsidianVault;
