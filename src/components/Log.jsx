import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  ChevronRight,
  ChevronDown,
  X,
  Copy,
  ExternalLink,
  Search,
  Clock,
  Calendar,
  Filter,
  Cloud
} from 'lucide-react';
import { db } from '../lib/firebase';
import { confirmAction } from '../lib/dialogs';

const Log = () => {
  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [newEntry, setNewEntry] = useState({ date: new Date().toISOString().split('T')[0], title: '', content: '', tags: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');

  // Default entries
  const DEFAULT_ENTRIES = [
    {
      id: 'entry-1',
      date: '2026-02-17',
      title: 'Content Calendar Setup',
      content: 'Created content calendar for AI Skills Studio with beta launch schedule. Tutorials: Platform Overview, Choosing Subject Photo.',
      tags: 'content,marketing,ai-skills-studio',
      createdAt: new Date().toISOString()
    },
    {
      id: 'entry-2',
      date: '2026-02-17',
      title: 'Mission Control Updates',
      content: 'Added Content tab, fixed mobile scrolling, added expandable card details, fixed edit form population bug.',
      tags: 'development,mission-control',
      createdAt: new Date().toISOString()
    },
    {
      id: 'entry-3',
      date: '2026-02-17',
      title: 'Client Management System',
      content: 'Created ClientManager component for managing client projects. Stores in localStorage with color coding and file attachments.',
      tags: 'development,clients,mission-control',
      createdAt: new Date().toISOString()
    }
  ];

  // Load from Firebase
  useEffect(() => {
    const unsubscribe = db.log.subscribe((data) => {
      if (data) {
        const parsed = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        if (parsed.length === 0) {
          setEntries(DEFAULT_ENTRIES);
          db.log.set(DEFAULT_ENTRIES);
        } else {
          setEntries(parsed);
        }
      } else {
        setEntries(DEFAULT_ENTRIES);
        db.log.set(DEFAULT_ENTRIES);
      }
    });
    return () => unsubscribe();
  }, []);

  // Save to Firebase when entries change
  useEffect(() => {
    if (entries.length > 0) {
      db.log.set(entries);
    }
  }, [entries]);

  // Get all unique tags
  const allTags = [...new Set(entries.flatMap(e => (e.tags || '').split(',').filter(t => t.trim())))];

  const getFilteredEntries = () => {
    let filtered = entries;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.content.toLowerCase().includes(q)
      );
    }
    
    if (filterTag) {
      filtered = filtered.filter(e => 
        (e.tags || '').split(',').map(t => t.trim()).includes(filterTag)
      );
    }
    
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Group by date
  const groupedEntries = getFilteredEntries().reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});

  const addEntry = () => {
    if (!newEntry.title.trim()) return;
    const entry = {
      id: 'entry-' + Date.now(),
      ...newEntry,
      createdAt: new Date().toISOString()
    };
    setEntries([entry, ...entries]);
    setNewEntry({ date: new Date().toISOString().split('T')[0], title: '', content: '', tags: '' });
    setShowAddEntry(false);
  };

  const updateEntry = () => {
    if (!editingEntry || !editingEntry.title.trim()) return;
    setEntries(entries.map(e => e.id === editingEntry.id ? editingEntry : e));
    setEditingEntry(null);
  };

  const deleteEntry = async (id) => {
    const confirmed = await confirmAction('Delete this log entry?', {
      title: 'Delete Log Entry',
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;
    setEntries(entries.filter(e => e.id !== id));
    if (selectedEntry?.id === id) setSelectedEntry(null);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold/90">
              Daily Record
            </p>
            <h1 className="text-2xl font-black">Log</h1>
          </div>
          <button
            onClick={() => setShowAddEntry(true)}
            className="w-12 h-12 bg-gold rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={24} className="text-black" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
            />
          </div>
          
          {allTags.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setFilterTag('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  !filterTag ? 'bg-gold text-black' : 'bg-white/10 text-white/60'
                }`}
              >
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    filterTag === tag ? 'bg-gold text-black' : 'bg-white/10 text-white/60'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {Object.keys(groupedEntries).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/20">
            <BookOpen size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">No entries yet</p>
            <p className="text-xs text-white/30 mt-1">Tap + to add your first log</p>
          </div>
        ) : (
          Object.entries(groupedEntries).map(([date, dateEntries]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-gold" />
                <p className="text-sm font-bold text-gold">{formatDate(date)}</p>
              </div>
              
              {/* Entries for this date */}
              <div className="space-y-2">
                {dateEntries.map(entry => (
                  <motion.div
                    key={entry.id}
                    layout
                    className={`p-4 bg-white/5 rounded-2xl border border-white/10 ${
                      selectedEntry?.id === entry.id ? 'border-gold/30' : ''
                    }`}
                    onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white">{entry.title}</p>
                        <p className="text-xs text-white/40 mt-1 line-clamp-2">{entry.content}</p>
                        {entry.tags && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {entry.tags.split(',').map(tag => (
                              <span key={tag} className="text-[10px] px-2 py-0.5 bg-white/10 rounded text-white/50">
                                #{tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-white/30 flex-shrink-0 mt-1" />
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {selectedEntry?.id === entry.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 mt-4 border-t border-white/10">
                            <p className="text-sm text-white/70 whitespace-pre-wrap mb-4">{entry.content}</p>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingEntry(entry); }}
                                className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-xs font-bold text-white/60"
                              >
                                <Edit3 size={12} />
                                Edit
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
                                className="flex items-center gap-2 px-3 py-2 bg-red-500/10 rounded-lg text-xs font-bold text-red-400"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {showAddEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowAddEntry(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">Add Log Entry</h2>
                <button onClick={() => setShowAddEntry(false)} className="p-2">
                  <X size={20} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Date</label>
                  <input
                    type="date"
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Title</label>
                  <input
                    type="text"
                    value={newEntry.title}
                    onChange={(e) => setNewEntry({...newEntry, title: e.target.value})}
                    placeholder="What did we do?"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Details</label>
                  <textarea
                    value={newEntry.content}
                    onChange={(e) => setNewEntry({...newEntry, content: e.target.value})}
                    placeholder="Describe what happened..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={newEntry.tags}
                    onChange={(e) => setNewEntry({...newEntry, tags: e.target.value})}
                    placeholder="marketing, content, client-x"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50"
                  />
                </div>
              </div>

              <button
                onClick={addEntry}
                className="w-full mt-6 py-3 bg-gold text-black font-black uppercase tracking-widest rounded-xl"
              >
                Add Entry
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Entry Modal */}
      <AnimatePresence>
        {editingEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setEditingEntry(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">Edit Entry</h2>
                <button onClick={() => setEditingEntry(null)} className="p-2">
                  <X size={20} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Date</label>
                  <input
                    type="date"
                    value={editingEntry.date}
                    onChange={(e) => setEditingEntry({...editingEntry, date: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Title</label>
                  <input
                    type="text"
                    value={editingEntry.title}
                    onChange={(e) => setEditingEntry({...editingEntry, title: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Details</label>
                  <textarea
                    value={editingEntry.content}
                    onChange={(e) => setEditingEntry({...editingEntry, content: e.target.value})}
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Tags</label>
                  <input
                    type="text"
                    value={editingEntry.tags || ''}
                    onChange={(e) => setEditingEntry({...editingEntry, tags: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50"
                  />
                </div>
              </div>

              <button
                onClick={updateEntry}
                className="w-full mt-6 py-3 bg-gold text-black font-black uppercase tracking-widest rounded-xl"
              >
                Save Changes
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Log;
