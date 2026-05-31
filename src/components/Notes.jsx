import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Search,
  Plus,
  Trash2,
  Star,
  ArrowLeft,
  Lightbulb,
  Newspaper,
  Bold,
  Italic,
  List,
  Heading1,
  Heading2,
  Quote,
  CheckSquare,
  Strikethrough,
  Link,
  X
} from 'lucide-react';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { confirmAction } from '../lib/dialogs';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'note', label: 'Notes', icon: FileText },
  { id: 'idea', label: 'Ideas', icon: Lightbulb },
  { id: 'briefing', label: 'Briefings', icon: Newspaper },
];

const FORMAT_TOOLS = [
  { id: 'bold', icon: Bold, prefix: '**', suffix: '**', title: 'Bold' },
  { id: 'italic', icon: Italic, prefix: '_', suffix: '_', title: 'Italic' },
  { id: 'strikethrough', icon: Strikethrough, prefix: '~~', suffix: '~~', title: 'Strikethrough' },
  { id: 'h1', icon: Heading1, prefix: '# ', suffix: '', title: 'Heading 1' },
  { id: 'h2', icon: Heading2, prefix: '## ', suffix: '', title: 'Heading 2' },
  { id: 'bullet', icon: List, prefix: '- ', suffix: '', title: 'Bullet List' },
  { id: 'check', icon: CheckSquare, prefix: '- [ ] ', suffix: '', title: 'Checkbox' },
  { id: 'quote', icon: Quote, prefix: '> ', suffix: '', title: 'Quote' },
];

const Notes = () => {
  const [notes, setNotes] = useState({});
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [localContent, setLocalContent] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [showToolbar, setShowToolbar] = useState(true);
  const saveTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  // Subscribe to notes
  useEffect(() => {
    const unsubscribe = db.notes.subscribeList((data) => {
      setNotes(data || {});
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle note selection
  const selectNote = (id) => {
    setSelectedNoteId(id);
    if (id && notes[id]) {
      setLocalContent(notes[id].content || '');
      setLocalTitle(notes[id].title || '');
      setLastSaved(notes[id].updated ? new Date(notes[id].updated) : null);
    }
  };

  // Auto-save with debounce
  // Note: does NOT depend on `notes` — we pass content/title as args to avoid stale closures
  const saveNote = useCallback(async (id, title, content) => {
    if (!id) return;
    try {
      await db.notes.updateNote(id, {
        title: title || 'Untitled Note',
        content: content || '',
        updated: new Date().toISOString()
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Save error:', err);
    }
  }, []);

  // Debounced save — localContent/localTitle are the source of truth while typing.
  // We intentionally do NOT depend on `notes` here — Firebase syncs would reset the
  // debounce timer and cause jitter/re-render storms on every keystroke.
  useEffect(() => {
    if (!selectedNoteId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const currentContent = localContent;
    const currentTitle = localTitle;
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(selectedNoteId, currentTitle, currentContent);
    }, 800);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localContent, localTitle, selectedNoteId]);

  // Create new note
  const createNewNote = async (type = 'note') => {
    const timestamp = new Date().toISOString();
    const typeLabel = type === 'idea' ? 'Idea' : type === 'briefing' ? 'Briefing' : 'Note';
    const newNote = {
      title: 'New ' + typeLabel,
      content: '',
      type: type,
      tags: [],
      starred: false,
      created: timestamp,
      updated: timestamp
    };
    const result = await db.notes.push(newNote);
    selectNote(result.key);
  };

  // Delete note
  const deleteNote = async (id, e) => {
    e?.stopPropagation();
    const confirmed = await confirmAction('Delete this note?', {
      title: 'Delete Note',
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;
    if (selectedNoteId === id) setSelectedNoteId(null);
    await db.notes.removeNote(id);
  };

  // Toggle star
  const toggleStar = async (e, id) => {
    e?.stopPropagation();
    const note = notes[id];
    if (!note) return;
    await db.notes.updateNote(id, { starred: !note.starred });
  };

  // Insert formatting
  const insertFormat = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newText = before + prefix + selected + suffix + after;
    setLocalContent(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursor = start + prefix.length + selected.length + suffix.length;
      textarea.setSelectionRange(
        selected.length > 0 ? start + prefix.length : newCursor,
        selected.length > 0 ? start + prefix.length + selected.length : newCursor
      );
    }, 0);
  };

  // Filter notes by tab and search
  const filteredNotes = Object.entries(notes)
    .filter(([_, note]) => {
      const matchesTab = activeTab === 'all' || note.type === activeTab;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        note.title?.toLowerCase().includes(q) ||
        note.content?.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => {
      if (a[1].starred !== b[1].starred) return b[1].starred ? 1 : -1;
      return new Date(b[1].updated) - new Date(a[1].updated);
    });

  // Format relative time
  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPreview = (content) => {
    if (!content) return 'No content';
    const stripped = content.replace(/[#*>\-\[\]~_]/g, '').trim();
    return stripped.length > 100 ? stripped.substring(0, 100) + '...' : stripped;
  };

  const getTypeIcon = (type) => {
    if (type === 'idea') return <Lightbulb size={12} className="text-yellow-400" />;
    if (type === 'briefing') return <Newspaper size={12} className="text-blue-400" />;
    return <FileText size={12} className="text-zinc-400" />;
  };

  const note = selectedNoteId ? notes[selectedNoteId] : null;

  // =============== LIST VIEW ===============
  const ListView = () => (
    <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <div className="bg-zinc-950 border-b border-zinc-800/50 safe-area-pt">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-amber-500" />
            </div>
            <span className="font-bold text-zinc-100 text-xl">Notes</span>
          </div>
          <button
            onClick={() => createNewNote(activeTab === 'all' ? 'note' : activeTab)}
            className="w-11 h-11 bg-amber-500 hover:bg-amber-400 rounded-2xl flex items-center justify-center transition-colors active:scale-95"
          >
            <Plus size={24} className="text-black" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2">
            {TABS.map((tab) => {
              const count = tab.id === 'all'
                ? Object.keys(notes).length
                : Object.values(notes).filter(n => n.type === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
                    activeTab === tab.id
                      ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                      : 'bg-zinc-800/50 text-zinc-400 border border-transparent hover:text-zinc-200'
                  }`}
                >
                  {tab.icon && <tab.icon size={14} />}
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id ? 'bg-amber-500/20' : 'bg-zinc-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <style>{`.scroll-hide::-webkit-scrollbar{display:none}.scroll-hide{-ms-overflow-style:none;scrollbar-width:none}`}</style>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <div className="w-8 h-8 border-2 border-zinc-800 border-t-amber-500 rounded-full animate-spin mb-3" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <FileText size={52} className="mx-auto mb-4 opacity-15" />
            <p className="text-base font-medium text-zinc-400">
              {searchQuery ? 'No results' : 'No ' + (activeTab === 'all' ? 'Notes' : activeTab + 's') + ' yet'}
            </p>
            <p className="text-sm text-zinc-600 mt-1">
              {searchQuery ? 'Try a different search' : 'Tap + to create one'}
            </p>
          </div>
        ) : (
          <div className="pt-4 space-y-3">
            {filteredNotes.map(([id, note]) => (
              <button
                key={id}
                onClick={() => selectNote(id)}
                className={`w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98] ${
                  note.starred
                    ? 'bg-amber-500/8 border border-amber-500/25'
                    : 'bg-zinc-900/60 border border-zinc-800/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {getTypeIcon(note.type)}
                      {note.starred && (
                        <Star size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />
                      )}
                      <h3 className="text-base font-semibold text-zinc-100 truncate">
                        {note.title || 'Untitled Note'}
                      </h3>
                    </div>
                    <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">
                      {getPreview(note.content)}
                    </p>
                    <div className="flex items-center gap-3 mt-2.5 text-xs text-zinc-600">
                      <span>{formatTime(note.updated)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // =============== EDITOR VIEW ===============
  const EditorView = () => (
    <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Editor Header */}
      <div className="bg-zinc-950 border-b border-zinc-800/50 safe-area-pt">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedNoteId(null)}
              className="w-11 h-11 flex items-center justify-center -ml-2 text-zinc-400 active:scale-95 transition-all"
            >
              <ArrowLeft size={22} />
            </button>
            {lastSaved && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500/70 rounded-full" />
                <span className="text-xs text-zinc-500">{formatTime(lastSaved)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowToolbar(!showToolbar)}
              className={`w-11 h-11 flex items-center justify-center active:scale-95 transition-all ${
                showToolbar ? 'text-amber-500' : 'text-zinc-500'
              }`}
            >
              <List size={20} />
            </button>
            <button
              onClick={(e) => toggleStar(e, selectedNoteId)}
              className="w-11 h-11 flex items-center justify-center active:scale-95 transition-all"
            >
              <Star
                size={20}
                className={note?.starred ? 'text-amber-500 fill-amber-500' : 'text-zinc-500'}
              />
            </button>
            <button
              onClick={(e) => deleteNote(selectedNoteId, e)}
              className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-red-400 active:scale-95 transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Formatting Toolbar */}
        <AnimatePresence>
          {showToolbar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-zinc-800/50"
            >
              <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {FORMAT_TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => insertFormat(tool.prefix, tool.suffix)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-all active:scale-95 flex-shrink-0"
                    title={tool.title}
                  >
                    <tool.icon size={18} />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {/* Title */}
        <div className="pt-5 pb-1">
          <textarea
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            rows={1}
            className="w-full bg-transparent text-2xl font-bold text-zinc-100 focus:outline-none placeholder:text-zinc-600 resize-none leading-tight"
            placeholder="Title"
            style={{ height: 'auto', minHeight: '36px' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />
        </div>
        {/* Content */}
        <div className="pt-2">
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            className="w-full bg-transparent text-zinc-300 leading-relaxed focus:outline-none placeholder:text-zinc-600 text-base resize-none"
            placeholder="Start typing..."
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full">
      <AnimatePresence mode="sync">
        {!selectedNoteId ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="h-full"
          >
            <ListView />
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="h-full"
          >
            <EditorView />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Notes;
