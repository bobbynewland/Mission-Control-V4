import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FileText, Search, Plus, Trash2, Star, ArrowLeft, Lightbulb, Newspaper,
  Bold, Italic, List, Heading1, Heading2, Quote, CheckSquare, Strikethrough,
  Link, X, Brain, Book, Target, ExternalLink, Edit3, Copy, Check,
  ChevronRight, BookOpen, Settings, FolderOpen
} from 'lucide-react';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// CONSTANTS
// ============================================================================

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'note', label: 'Notes', icon: FileText },
  { id: 'idea', label: 'Ideas', icon: Lightbulb },
  { id: 'briefing', label: 'Briefings', icon: Newspaper },
  { id: 'kb', label: 'Knowledge', icon: Brain },
];

const KB_CATEGORIES = [
  { id: 'general', label: 'General', icon: Brain },
  { id: 'context', label: 'Context', icon: Book },
  { id: 'reference', label: 'Reference', icon: FileText },
  { id: 'tips', label: 'Tips', icon: Lightbulb },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'favorites', label: 'Favorites', icon: Star },
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const KnowledgeHub = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [notes, setNotes] = useState({});
  const [kbItems, setKbItems] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [selectedKbId, setSelectedKbId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showKbForm, setShowKbForm] = useState(false);
  const [editingKb, setEditingKb] = useState(null);
  const [showToolbar, setShowToolbar] = useState(true);
  const [localContent, setLocalContent] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
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

  // Subscribe to knowledge base
  useEffect(() => {
    const unsubscribe = db.knowledge.subscribe((data) => {
      if (data) {
        const parsed = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        setKbItems(parsed);
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle note selection
  const selectNote = (id) => {
    setSelectedNoteId(id);
    setSelectedKbId(null);
    if (id && notes[id]) {
      setLocalContent(notes[id].content || '');
      setLocalTitle(notes[id].title || '');
      setLastSaved(notes[id].updated ? new Date(notes[id].updated) : null);
    }
  };

  // Handle KB item selection
  const selectKb = (id) => {
    setSelectedKbId(id);
    setSelectedNoteId(null);
  };

  // Auto-save with debounce
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

  // Debounced save
  useEffect(() => {
    if (!selectedNoteId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const note = notes[selectedNoteId];
      if (!note) return;
      if (localContent !== note.content || localTitle !== note.title) {
        saveNote(selectedNoteId, localTitle, localContent);
      }
    }, 800);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [localContent, localTitle, selectedNoteId, notes, saveNote]);

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
    if (window.confirm('Delete this note?')) {
      if (selectedNoteId === id) setSelectedNoteId(null);
      await db.notes.removeNote(id);
    }
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
      const matchesTab = activeTab === 'all' || activeTab === 'kb' || note.type === activeTab;
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

  // Filter KB items by search
  const filteredKb = useMemo(() => {
    if (activeTab !== 'all' && activeTab !== 'kb') return [];
    const q = searchQuery.toLowerCase();
    return kbItems
      .filter(item => {
        const matchesSearch = !q ||
          item.title?.toLowerCase().includes(q) ||
          (item.content || '').toLowerCase().includes(q) ||
          (item.tags || '').toLowerCase().includes(q);
        return matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [kbItems, searchQuery, activeTab]);

  // Combined items for "all" view
  const allItems = useMemo(() => {
    const noteItems = filteredNotes.map(([id, note]) => ({ id, ...note, _type: 'note' }));
    const kbItemsFiltered = filteredKb.map(item => ({ ...item, _type: 'kb' }));
    return [...noteItems, ...kbItemsFiltered].sort((a, b) => 
      new Date(b.updated || b.createdAt) - new Date(a.updated || a.createdAt)
    );
  }, [filteredNotes, filteredKb]);

  // Get selected item
  const selectedNote = selectedNoteId ? notes[selectedNoteId] : null;
  const selectedKb = selectedKbId ? kbItems.find(kb => kb.id === selectedKbId) : null;
  const selectedItem = selectedNote || selectedKb;

  // Get type icon
  const getTypeIcon = (type) => {
    if (type === 'idea') return <Lightbulb size={12} className="text-yellow-400" />;
    if (type === 'briefing') return <Newspaper size={12} className="text-blue-400" />;
    if (type === 'kb') return <Brain size={12} className="text-purple-400" />;
    return <FileText size={12} className="text-zinc-400" />;
  };

  // Go back to list
  const goBack = () => {
    setSelectedNoteId(null);
    setSelectedKbId(null);
  };

  // =============== LIST VIEW ===============
  const ListView = () => (
    <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <div className="bg-zinc-950 border-b border-zinc-800/50 safe-area-pt">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Brain size={20} className="text-amber-500" />
            </div>
            <span className="font-bold text-zinc-100 text-xl">Knowledge Hub</span>
          </div>
          <button
            onClick={() => setShowKbForm(true)}
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
              placeholder="Search notes and knowledge..."
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
                ? Object.keys(notes).length + kbItems.length
                : tab.id === 'kb'
                ? kbItems.length
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

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <div className="w-8 h-8 border-2 border-zinc-800 border-t-amber-500 rounded-full animate-spin mb-3" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <Brain size={52} className="mx-auto mb-4 opacity-15" />
            <p className="text-base font-medium text-zinc-400">
              {searchQuery ? 'No results' : 'Nothing here yet'}
            </p>
            <p className="text-sm text-zinc-600 mt-1">
              {searchQuery ? 'Try a different search' : 'Tap + to create'}
            </p>
          </div>
        ) : (
          <div className="pt-4 space-y-3">
            {allItems.map((item) => (
              <button
                key={item.id}
                onClick={() => item._type === 'kb' ? selectKb(item.id) : selectNote(item.id)}
                className={`w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98] ${
                  item.starred
                    ? 'bg-amber-500/8 border border-amber-500/25'
                    : 'bg-zinc-900/60 border border-zinc-800/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {getTypeIcon(item._type || item.type)}
                      {item.starred && (
                        <Star size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />
                      )}
                      <h3 className="text-base font-semibold text-zinc-100 truncate">
                        {item.title || 'Untitled'}
                      </h3>
                      {item._type === 'kb' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-black uppercase">
                          KB
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">
                      {getPreview(item.content)}
                    </p>
                    <div className="flex items-center gap-3 mt-2.5 text-xs text-zinc-600">
                      <span>{formatTime(item.updated || item.createdAt)}</span>
                      {item.category && item._type === 'kb' && (
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px]">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-600 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // =============== NOTE EDITOR VIEW ===============
  const NoteEditorView = () => (
    <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Editor Header */}
      <div className="bg-zinc-950 border-b border-zinc-800/50 safe-area-pt">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
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
                className={selectedNote?.starred ? 'text-amber-500 fill-amber-500' : 'text-zinc-500'}
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

  // =============== KB ITEM VIEW ===============
  const KbItemView = () => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
        <div className="bg-zinc-950 border-b border-zinc-800/50 safe-area-pt">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                className="w-11 h-11 flex items-center justify-center -ml-2 text-zinc-400 active:scale-95 transition-all"
              >
                <ArrowLeft size={22} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setEditingKb(selectedKb); setShowKbForm(true); }}
                className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-amber-500 active:scale-95 transition-all"
              >
                <Edit3 size={18} />
              </button>
              {selectedKb?.url && (
                <button
                  onClick={() => copyToClipboard(selectedKb.url)}
                  className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-amber-500 active:scale-95 transition-all"
                >
                  {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
          <h1 className="text-2xl font-black text-zinc-100 mb-4">{selectedKb?.title}</h1>
          
          {selectedKb?.category && (
            <div className="flex items-center gap-2 mb-6">
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold uppercase">
                {selectedKb.category}
              </span>
            </div>
          )}
          
          {selectedKb?.url && (
            <a
              href={selectedKb.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 mb-6 text-amber-500 hover:border-amber-500/30 transition-colors"
            >
              <ExternalLink size={16} />
              <span className="text-sm truncate">{selectedKb.url}</span>
            </a>
          )}
          
          {selectedKb?.content && (
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{selectedKb.content}</p>
            </div>
          )}
          
          {selectedKb?.tags && (
            <div className="flex flex-wrap gap-2 mt-8">
              {selectedKb.tags.split(',').map(tag => (
                <span key={tag} className="px-3 py-1 rounded-full bg-white/10 text-zinc-400 text-xs">
                  #{tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // =============== KB FORM MODAL ===============
  const KbFormModal = ({ item, onClose }) => {
    const [formData, setFormData] = useState({
      title: item?.title || '',
      type: item?.type || 'notes',
      url: item?.url || '',
      content: item?.content || '',
      tags: item?.tags || '',
      category: item?.category || 'general'
    });

    const handleSubmit = async () => {
      if (!formData.title.trim()) return;
      
      if (item) {
        // Update existing
        setKbItems(kbItems.map(kb => kb.id === item.id ? { ...kb, ...formData } : kb));
        await db.knowledge.update(item.id, formData);
      } else {
        // Create new
        const newItem = {
          id: 'kb-' + Date.now(),
          ...formData,
          createdAt: new Date().toISOString()
        };
        setKbItems([newItem, ...kbItems]);
        await db.knowledge.push(newItem);
      }
      
      setShowKbForm(false);
      setEditingKb(null);
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black">{item ? 'Edit' : 'Add'} Knowledge</h2>
            <button onClick={onClose} className="p-2">
              <X size={20} className="text-white/40" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Knowledge title"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {KB_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                        formData.category === cat.id
                          ? 'bg-amber-500 text-black'
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="text-[10px] font-bold">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'link', label: 'Link', icon: ExternalLink },
                  { id: 'notes', label: 'Notes', icon: FileText }
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setFormData({ ...formData, type: type.id })}
                    className={`p-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                      formData.type === type.id
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    <type.icon size={16} />
                    <span className="text-sm font-bold">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {formData.type === 'link' && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Notes</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Context, details..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Tags</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="important, reference, client-x"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full mt-6 py-3 bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl"
          >
            {item ? 'Save Changes' : 'Add to Knowledge'}
          </button>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        {selectedKbId ? (
          <motion.div key="kb-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <KbItemView />
          </motion.div>
        ) : selectedNoteId ? (
          <motion.div key="note-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NoteEditorView />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ListView />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showKbForm && (
          <KbFormModal
            item={editingKb}
            onClose={() => { setShowKbForm(false); setEditingKb(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default KnowledgeHub;
