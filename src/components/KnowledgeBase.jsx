import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  ChevronRight,
  X,
  ExternalLink,
  Search,
  Link,
  FileText,
  Book,
  Lightbulb,
  Target,
  Star,
  Copy,
  Check,
  Cloud
} from 'lucide-react';
import { db } from '../lib/firebase';

const KnowledgeBase = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ 
    title: '', 
    type: 'link', 
    url: '', 
    content: '', 
    tags: '',
    category: 'general'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const CATEGORIES = [
    { id: 'general', label: 'General', icon: Brain },
    { id: 'context', label: 'Context', icon: Book },
    { id: 'reference', label: 'Reference', icon: FileText },
    { id: 'tips', label: 'Tips & Tricks', icon: Lightbulb },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'favorites', label: 'Favorites', icon: Star },
  ];

  // Default knowledge base items
  const DEFAULT_ITEMS = [
    {
      id: 'kb-1',
      title: 'AI Skills Studio Mission',
      type: 'notes',
      category: 'context',
      content: 'All-in-one platform for entrepreneurs to launch businesses with AI. "Entrepreneurship first, tech second." Target: $1M+ MRR.',
      tags: 'mission,vision,business',
      createdAt: new Date().toISOString()
    },
    {
      id: 'kb-2',
      title: 'Bobby - Key Contact',
      type: 'notes',
      category: 'context',
      content: 'Owner/Creator. EST, Atlanta. Vibe: Cinematic Business - Luxury + Raw Hip-Hop. Work → Trust → Take initiative. Be direct, quality > quantity.',
      tags: 'contact,bobby,owner',
      createdAt: new Date().toISOString()
    },
    {
      id: 'kb-3',
      title: 'Mission Control V3',
      type: 'link',
      category: 'reference',
      url: 'https://mission-control-v3-pearl.vercel.app',
      content: 'Main dashboard for operations. Tabs: Today, Tasks, Calendar, Content, Clients, Notes, Drive, Agents.',
      tags: 'tool,dashboard,operations',
      createdAt: new Date().toISOString()
    },
    {
      id: 'kb-4',
      title: 'Model Priority List',
      type: 'notes',
      category: 'reference',
      content: '1. Gemini 3.0 Pro (Antigravity) 2. Claude Opus 4.5 3. MiniMax 2.5 4. Kimi K2.5 Swarm. Always use in this order.',
      tags: 'models,ai,优先级',
      createdAt: new Date().toISOString()
    }
  ];

  // Load from Firebase
  useEffect(() => {
    const unsubscribe = db.knowledge.subscribe((data) => {
      if (data) {
        const parsed = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        if (parsed.length === 0) {
          setItems(DEFAULT_ITEMS);
          db.knowledge.set(DEFAULT_ITEMS);
        } else {
          setItems(parsed);
        }
      } else {
        setItems(DEFAULT_ITEMS);
        db.knowledge.set(DEFAULT_ITEMS);
      }
    });
    return () => unsubscribe();
  }, []);

  // Save to Firebase when items change
  useEffect(() => {
    if (items.length > 0) {
      db.knowledge.set(items);
    }
  }, [items]);

  const getFilteredItems = () => {
    let filtered = items;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(i => 
        i.title.toLowerCase().includes(q) || 
        (i.content || '').toLowerCase().includes(q) ||
        (i.tags || '').toLowerCase().includes(q)
      );
    }
    
    if (filterCategory) {
      filtered = filtered.filter(i => i.category === filterCategory);
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const addItem = () => {
    if (!newItem.title.trim()) return;
    const item = {
      id: 'kb-' + Date.now(),
      ...newItem,
      createdAt: new Date().toISOString()
    };
    setItems([item, ...items]);
    setNewItem({ title: '', type: 'link', url: '', content: '', tags: '', category: 'general' });
    setShowAddItem(false);
  };

  const updateItem = () => {
    if (!editingItem || !editingItem.title.trim()) return;
    setItems(items.map(i => i.id === editingItem.id ? editingItem : i));
    setEditingItem(null);
  };

  const deleteItem = (id) => {
    if (!confirm('Delete this knowledge item?')) return;
    setItems(items.filter(i => i.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'link': return <ExternalLink size={16} />;
      case 'notes': return <FileText size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getCategoryInfo = (catId) => {
    return CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold/90">
              Context & Reference
            </p>
            <h1 className="text-2xl font-black">Knowledge Base</h1>
          </div>
          <button
            onClick={() => setShowAddItem(true)}
            className="w-12 h-12 bg-gold rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={24} className="text-black" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              !filterCategory ? 'bg-gold text-black' : 'bg-white/10 text-white/60'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(cat => {
            const CatIcon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(filterCategory === cat.id ? '' : cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  filterCategory === cat.id ? 'bg-gold text-black' : 'bg-white/10 text-white/60'
                }`}
              >
                <CatIcon size={12} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {getFilteredItems().length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/20">
            <Brain size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">No knowledge items</p>
            <p className="text-xs text-white/30 mt-1">Tap + to add context or reference</p>
          </div>
        ) : (
          getFilteredItems().map(item => {
            const categoryInfo = getCategoryInfo(item.category);
            const CategoryIcon = categoryInfo.icon;
            const isExpanded = selectedItem?.id === item.id;
            
            return (
              <motion.div
                key={item.id}
                layout
                className={`p-4 bg-white/5 rounded-2xl border border-white/10 ${
                  isExpanded ? 'border-gold/30' : ''
                }`}
                onClick={() => setSelectedItem(isExpanded ? null : item)}
              >
                <div className="flex items-start gap-3">
                  {/* Type Icon */}
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 flex-shrink-0">
                    {getTypeIcon(item.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-white truncate">{item.title}</p>
                    </div>
                    
                    {/* Category & Tags */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-gold/20 text-gold rounded">
                        <CategoryIcon size={10} />
                        {categoryInfo.label}
                      </span>
                      {item.tags && item.tags.split(',').slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-white/10 rounded text-white/50">
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                    
                    {/* Preview */}
                    {!isExpanded && item.content && (
                      <p className="text-xs text-white/40 mt-2 line-clamp-2">{item.content}</p>
                    )}
                  </div>
                  
                  {/* Expand Icon */}
                  <ChevronRight 
                    size={20} 
                    className={`text-white/30 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 mt-4 border-t border-white/10">
                        {/* URL if link */}
                        {item.type === 'link' && item.url && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold uppercase text-white/40 mb-1">Link</p>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-gold hover:underline text-sm"
                            >
                              {item.url}
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        )}
                        
                        {/* Content/Notes */}
                        {item.content && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold uppercase text-white/40 mb-1">Notes</p>
                            <p className="text-sm text-white/70 whitespace-pre-wrap">{item.content}</p>
                          </div>
                        )}
                        
                        {/* All Tags */}
                        {item.tags && (
                          <div className="flex gap-1 flex-wrap mb-4">
                            {item.tags.split(',').map(tag => (
                              <span key={tag} className="text-[10px] px-2 py-1 bg-white/10 rounded text-white/50">
                                #{tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap">
                          {item.url && (
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(item.url, item.id); }}
                              className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-xs font-bold text-white/60"
                            >
                              {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                              {copiedId === item.id ? 'Copied' : 'Copy Link'}
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                            className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-xs font-bold text-white/60"
                          >
                            <Edit3 size={12} />
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
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
            );
          })
        )}
      </div>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowAddItem(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">Add Knowledge</h2>
                <button onClick={() => setShowAddItem(false)} className="p-2">
                  <X size={20} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Title</label>
                  <input
                    type="text"
                    value={newItem.title}
                    onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                    placeholder="e.g., Bobby's Preferences"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => {
                      const CatIcon = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setNewItem({...newItem, category: cat.id})}
                          className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                            newItem.category === cat.id 
                              ? 'bg-gold text-black' 
                              : 'bg-white/10 text-white/60'
                          }`}
                        >
                          <CatIcon size={16} />
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
                        onClick={() => setNewItem({...newItem, type: type.id})}
                        className={`p-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                          newItem.type === type.id 
                            ? 'bg-gold text-black' 
                            : 'bg-white/10 text-white/60'
                        }`}
                      >
                        <type.icon size={16} />
                        <span className="text-sm font-bold">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {newItem.type === 'link' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">URL</label>
                    <input
                      type="url"
                      value={newItem.url}
                      onChange={(e) => setNewItem({...newItem, url: e.target.value})}
                      placeholder="https://..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Notes / Content</label>
                  <textarea
                    value={newItem.content}
                    onChange={(e) => setNewItem({...newItem, content: e.target.value})}
                    placeholder="Context, details, reference info..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={newItem.tags}
                    onChange={(e) => setNewItem({...newItem, tags: e.target.value})}
                    placeholder="important, reference, client-x"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50"
                  />
                </div>
              </div>

              <button
                onClick={addItem}
                className="w-full mt-6 py-3 bg-gold text-black font-black uppercase tracking-widest rounded-xl"
              >
                Add to Knowledge Base
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Item Modal */}
      <AnimatePresence>
        {editingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setEditingItem(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">Edit Knowledge</h2>
                <button onClick={() => setEditingItem(null)} className="p-2">
                  <X size={20} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Title</label>
                  <input
                    type="text"
                    value={editingItem.title}
                    onChange={(e) => setEditingItem({...editingItem, title: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => {
                      const CatIcon = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setEditingItem({...editingItem, category: cat.id})}
                          className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                            editingItem.category === cat.id 
                              ? 'bg-gold text-black' 
                              : 'bg-white/10 text-white/60'
                          }`}
                        >
                          <CatIcon size={16} />
                          <span className="text-[10px] font-bold">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {editingItem.type === 'link' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">URL</label>
                    <input
                      type="url"
                      value={editingItem.url || ''}
                      onChange={(e) => setEditingItem({...editingItem, url: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Notes</label>
                  <textarea
                    value={editingItem.content || ''}
                    onChange={(e) => setEditingItem({...editingItem, content: e.target.value})}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Tags</label>
                  <input
                    type="text"
                    value={editingItem.tags || ''}
                    onChange={(e) => setEditingItem({...editingItem, tags: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50"
                  />
                </div>
              </div>

              <button
                onClick={updateItem}
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

export default KnowledgeBase;
