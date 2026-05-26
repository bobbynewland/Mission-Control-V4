import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, RotateCcw, Plus, X, Search, Filter, Calendar, Clock,
  Lightbulb, Sparkles, Target, Layers3, ChevronRight, ChevronDown,
  Edit3, Trash2, Copy, Check, ExternalLink, GripVertical, Archive,
  Video, Image, Youtube, Instagram, Twitter, Linkedin, Facebook,
  MessageSquareText, Send, Megaphone, BarChart3, TrendingUp,
  RefreshCw, Zap, Radio, BookOpen, FileText, Settings, Eye,
  CheckCircle2, Circle, AlertCircle
} from 'lucide-react';
import { db, ref, onValue, update, push, set, remove } from '../lib/firebase';

// ============================================================================
// CONSTANTS
// ============================================================================

const PIPELINE_STAGES = [
  { id: 'idea_pool', label: 'Idea Pool', accent: 'border-violet-500/30' },
  { id: 'briefed', label: 'Briefed', accent: 'border-blue-500/30' },
  { id: 'in_production', label: 'In Production', accent: 'border-amber-500/30' },
  { id: 'scheduled', label: 'Scheduled', accent: 'border-cyan-500/30' },
  { id: 'ready_publish', label: 'Ready', accent: 'border-green-500/30' },
  { id: 'published', label: 'Published', accent: 'border-emerald-500/30' },
  { id: 'performance', label: 'Performance', accent: 'border-rose-500/30' },
  { id: 'archived', label: 'Archived', accent: 'border-white/20' },
];

const CHANNELS = {
  instagram: { icon: Instagram, color: 'bg-pink-500', label: 'IG', textColor: 'text-pink-500' },
  twitter: { icon: Twitter, color: 'bg-sky-400', label: 'X', textColor: 'text-sky-400' },
  youtube: { icon: Youtube, color: 'bg-red-500', label: 'YT', textColor: 'text-red-500' },
  linkedin: { icon: Linkedin, color: 'bg-blue-700', label: 'LI', textColor: 'text-blue-700' },
  discord: { icon: MessageSquareText, color: 'bg-indigo-500', label: 'DC', textColor: 'text-indigo-500' },
};

const TABS = [
  { id: 'pipeline', label: 'Pipeline', icon: Layers3 },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'research', label: 'Research', icon: Lightbulb },
  { id: 'scripts', label: 'Scripts', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const PRIORITIES = [
  { id: 'high', label: 'High', color: 'text-red-400', bg: 'bg-red-500/20' },
  { id: 'medium', label: 'Medium', color: 'text-gold', bg: 'bg-gold/20' },
  { id: 'low', label: 'Low', color: 'text-blue-400', bg: 'bg-blue-500/20' },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const timeAgo = (date) => {
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
  return formatDate(date);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ContentFactory = () => {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [contentItems, setContentItems] = useState([]);
  const [researchData, setResearchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [runningCouncil, setRunningCouncil] = useState(false);
  const [councilLastRun, setCouncilLastRun] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartPos = useRef(null);

  // Subscribe to content from Firebase
  useEffect(() => {
    const unsubscribe = db.content.subscribe((data) => {
      if (data) {
        const items = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        setContentItems(items);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter content by search
  const filteredContent = useMemo(() => {
    if (!searchQuery) return contentItems;
    const q = searchQuery.toLowerCase();
    return contentItems.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.hook || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q)
    );
  }, [contentItems, searchQuery]);

  // Group items by pipeline stage
  const groupedByStage = useMemo(() => {
    const groups = {};
    PIPELINE_STAGES.forEach(stage => { groups[stage.id] = []; });
    filteredContent.forEach(item => {
      const stage = item.column || 'idea_pool';
      if (groups[stage]) {
        groups[stage].push(item);
      } else {
        groups['idea_pool'].push(item);
      }
    });
    return groups;
  }, [filteredContent]);

  // Run Council Now
  const runCouncilNow = async () => {
    setRunningCouncil(true);
    try {
      const { exec } = require('child_process');
      exec('node /root/.openclaw/workspace/mission-control-v3/scripts/council-cron.js run', (error, stdout, stderr) => {
        if (error) {
          console.error('Council run error:', error);
        }
        console.log('Council output:', stdout);
        setCouncilLastRun(new Date().toISOString());
        setRunningCouncil(false);
      });
    } catch (err) {
      console.error('Council run failed:', err);
      setRunningCouncil(false);
    }
  };

  // Save content item
  const saveItem = useCallback(async (itemData) => {
    if (editingItem) {
      await db.content.update(editingItem.id, {
        ...itemData,
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.content.push({
        ...itemData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        column: itemData.column || 'idea_pool'
      });
    }
    setShowForm(false);
    setEditingItem(null);
  }, [editingItem]);

  // Delete item
  const deleteItem = useCallback(async (itemId) => {
    if (!confirm('Delete this content?')) return;
    await db.content.remove(itemId);
  }, []);

  // Archive item
  const archiveItem = useCallback(async (itemId) => {
    if (!confirm('Archive this content?')) return;
    await db.content.update(itemId, {
      column: 'archived',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }, []);

  // Drag handlers with 25px touch threshold
  const handleDragStart = (e, item) => {
    // Touch threshold: only start drag if touch moved >25px from start
    if (e.type === 'touchstart') {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return;
    }
    if (touchStartPos.current) {
      const dx = Math.abs(e.clientX - touchStartPos.current.x);
      const dy = Math.abs(e.clientY - touchStartPos.current.y);
      if (dx < 25 && dy < 25) {
        touchStartPos.current = null;
        return; // too small, treat as tap/scroll
      }
    }
    touchStartPos.current = null;
    setDraggedItem(item);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTouchMove = (e) => {
    if (!touchStartPos.current || !draggedItem) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    // If moved >25px in any direction, drag is now active - CSS will handle visual
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setIsDragging(false);
    if (draggedItem && draggedItem.column !== targetStage) {
      await db.content.update(draggedItem.id, {
        column: targetStage,
        updatedAt: new Date().toISOString()
      });
    }
    setDraggedItem(null);
  };

  const openNewForm = () => {
    setEditingItem(null);
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0">
        <div className="px-4 md:px-6 pt-3 pb-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.28em] text-white/40">Content Factory</h2>
              <p className="text-[10px] uppercase tracking-wider text-white/35 mt-0.5">
                {contentItems.length} shots
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={runCouncilNow}
                disabled={runningCouncil}
                className="flex items-center gap-2 px-4 py-2 bg-gold/20 border border-gold/30 rounded-xl text-gold text-xs font-bold uppercase tracking-widest hover:bg-gold/30 transition-colors disabled:opacity-50"
              >
                {runningCouncil ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Zap size={14} />
                )}
                Run Council
              </button>
              <button
                onClick={openNewForm}
                className="w-10 h-10 rounded-full bg-gold text-black flex items-center justify-center active:scale-90 transition-transform"
              >
                <Plus size={20} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-xl border px-4 py-2.5 text-[11px] uppercase tracking-wider font-black transition-all ${
                    isActive
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 text-white/65 border-white/15 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon size={13} />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'pipeline' && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col min-h-0 flex-1 -mr-4 md:-mr-6"
            >
              {/* Search — sticky at top */}
              <div className="mb-4 pr-4 shrink-0 sticky top-0 z-10 bg-[#0a0a0f] pb-2">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="text"
                    placeholder="Search content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
                  />
                </div>
              </div>

              {/* Pipeline Kanban — scrolls horizontally, search stays fixed */}
              <div className={`flex gap-3 overflow-x-auto pb-4 flex-1 no-scrollbar touch-pan-x ${isDragging ? 'kanban-track-dragging' : ''}`}>
                {PIPELINE_STAGES.map(stage => (
                  <PipelineColumn
                    key={stage.id}
                    stage={stage}
                    items={groupedByStage[stage.id] || []}
                    onEdit={openEditForm}
                    onDelete={deleteItem}
                    onArchive={archiveItem}
                    onExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                    expandedId={expandedId}
                    draggedItem={draggedItem}
                    isDragging={isDragging}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PublishingCalendarView items={contentItems} />
            </motion.div>
          )}

          {activeTab === 'research' && (
            <motion.div
              key="research"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ResearchView
                items={contentItems}
                onRunCouncil={runCouncilNow}
                running={runningCouncil}
              />
            </motion.div>
          )}

          {activeTab === 'scripts' && (
            <motion.div
              key="scripts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ScriptsView />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SettingsView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Content Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ContentFormModal
            item={editingItem}
            onSave={saveItem}
            onClose={() => { setShowForm(false); setEditingItem(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// PIPELINE COLUMN
// ============================================================================

const PipelineColumn = ({ stage, items, onEdit, onDelete, onArchive, onExpand, expandedId, draggedItem, isDragging }) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const itemId = e.dataTransfer.getData('text/plain') || (draggedItem && draggedItem.id);
    if (!itemId) return;
    const item = items.find(i => i.id === itemId);
    if (item && item.column !== stage.id) {
      await db.content.update(itemId, {
        column: stage.id,
        updatedAt: new Date().toISOString()
      });
    }
  };

  return (
    <div
      className={`flex-shrink-0 w-72 flex flex-col min-h-0 h-full overflow-hidden rounded-xl transition-all ${
        dragOver ? 'border-2 border-dashed border-gold/60 bg-gold/5' : 'border border-transparent'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header — sticky above the scrollable content */}
      <div className={`mb-3 pb-2 border-b-2 ${stage.accent} flex items-center justify-between shrink-0 relative z-10`}>
        <h3 className="text-[11px] uppercase tracking-[0.18em] font-black text-white/75">{stage.label}</h3>
        <span className="text-[10px] text-white/35 font-mono">{items.length}</span>
      </div>

      {/* Column Content — fills remaining height with its own scroll, clips at column boundary */}
      <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1 pb-1 overscroll-y-contain">
        {items.length === 0 ? (
          <div className={`py-6 border-2 border-dashed rounded-xl text-center transition-colors ${
            dragOver ? 'border-gold/50 bg-gold/5' : 'border-white/10'
          }`}>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/25">Drop here</span>
          </div>
        ) : (
          items.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item.id)}
              onArchive={() => onArchive(item.id)}
              onExpand={() => onExpand(item.id)}
              expanded={expandedId === item.id}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', item.id);
                e.dataTransfer.effectAllowed = 'move';
                setDraggedItem(item);
                setIsDragging(true);
              }}
              onDragEnd={() => { setIsDragging(false); setDraggedItem(null); }}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CONTENT CARD
// ============================================================================

const ContentCard = ({ item, onEdit, onDelete, onArchive, onExpand, expanded, onDragStart, onDragEnd }) => {
  const channels = item.channels || item.platforms || [];
  const priority = PRIORITIES.find(p => p.id === item.priority) || PRIORITIES[1];

  return (
    <motion.div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="w-full max-w-full min-w-0 touch-manipulation"
    >
      <article
        className={`glass w-full max-w-full min-w-0 overflow-hidden rounded-2xl border transition-all cursor-grab active:cursor-grabbing touch-manipulation ${
          expanded
            ? 'border-gold/40'
            : 'border-white/10 hover:border-gold/50'
        }`}
      >
        <div className="p-3.5" onClick={onExpand}>
          {/* Priority & Channel Badges */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${priority.bg} ${priority.color}`}>
              {priority.label}
            </span>
            {item.hookType && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                {item.hookType}
              </span>
            )}
            {channels.length > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                {channels.slice(0, 3).map(c => {
                  const Meta = CHANNELS[c];
                  if (!Meta) return null;
                  const Icon = Meta.icon;
                  return (
                    <div key={c} className={`w-4 h-4 rounded ${Meta.color} flex items-center justify-center`}>
                      <Icon size={9} className="text-white" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Title */}
          <h4 className="text-[13px] font-bold text-white/90 leading-tight mb-1.5 line-clamp-2 break-words">
            {item.title || item.hook || 'Untitled'}
          </h4>

          {/* Hook */}
          {item.hook && (
            <p className="text-[11px] text-white/45 line-clamp-2 leading-relaxed">
              {item.hook}
            </p>
          )}

          {/* Footer Meta */}
          <footer className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[10px] text-white/40">
            {item.scheduledDate && (
              <span className="flex items-center gap-1 text-gold">
                <Clock size={10} />
                {formatDate(item.scheduledDate)}
              </span>
            )}
            {item.updatedAt && (
              <span className="flex items-center gap-1 ml-auto uppercase">
                <Clock size={10} />
                {timeAgo(item.updatedAt)}
              </span>
            )}
          </footer>
        </div>

        {/* Expanded Actions */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="p-3 pt-2.5 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 text-[11px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/15 transition-colors"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const text = `${item.hook || item.title}\n\n${item.caption || item.description || ''}`;
                      navigator.clipboard.writeText(text);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 text-[11px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/15 transition-colors"
                  >
                    <Copy size={12} /> Copy
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onArchive(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 text-[11px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/15 transition-colors"
                  >
                    <Archive size={12} /> Archive
                  </button>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="w-full py-2 text-[11px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </article>
    </motion.div>
  );
};

// ============================================================================
// CONTENT FORM MODAL
// ============================================================================

const ContentFormModal = ({ item, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    title: item?.title || '',
    hook: item?.hook || '',
    caption: item?.caption || '',
    description: item?.description || '',
    cta: item?.cta || '',
    status: item?.status || 'idea',
    column: item?.column || 'idea_pool',
    priority: item?.priority || 'medium',
    channels: item?.channels || item?.platforms || ['instagram'],
    scheduledDate: item?.scheduledDate || '',
    scheduledTime: item?.scheduledTime || '',
    hookType: item?.hookType || 'experiment',
    tags: item?.tags || [],
    purpose: item?.purpose || 'creative_proof',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="glass relative z-10 w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-[2rem] p-6"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between mb-5">
          <h3 className="text-xl font-black italic uppercase text-white">
            {item ? 'Edit' : 'New'} <span className="text-gold">Shot</span>
          </h3>
          <button onClick={onClose} className="text-white/45 hover:text-white">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title & Hook */}
          <div className="space-y-3">
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Short, punchy title..."
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
            />
            <textarea
              value={formData.hook}
              onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
              placeholder="The Hook - Opening line that stops the scroll..."
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors min-h-[72px] resize-none"
            />
          </div>

          {/* Stage & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Stage</p>
              <div className="relative">
                <select
                  value={formData.column}
                  onChange={(e) => setFormData({ ...formData, column: e.target.value })}
                  className="w-full appearance-none bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50 transition-colors"
                >
                  {PIPELINE_STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Priority</p>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p.id })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                      formData.priority === p.id
                        ? `${p.bg} ${p.color} border border-white/20`
                        : 'bg-white/5 text-white/40 border border-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Channels */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Channels</p>
            <div className="flex gap-2">
              {Object.entries(CHANNELS).map(([key, meta]) => {
                const Icon = meta.icon;
                const isSelected = formData.channels.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      const channels = isSelected
                        ? formData.channels.filter(c => c !== key)
                        : [...formData.channels, key];
                      setFormData({ ...formData, channels });
                    }}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                      isSelected ? meta.color : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <Icon size={16} className={isSelected ? 'text-white' : 'text-white/40'} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Date</p>
              <input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Time</p>
              <input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
          </div>

          {/* Caption */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Caption / Script</p>
            <textarea
              value={formData.caption}
              onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
              placeholder="Full caption, script, or notes..."
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors min-h-[120px] resize-none"
            />
          </div>

          {/* CTA */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">CTA</p>
            <input
              type="text"
              value={formData.cta}
              onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
              placeholder="Link in bio, etc..."
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
            />
          </div>
        </form>

        <div className="flex gap-3 mt-5 pb-safe">
          <button
            onClick={handleSubmit}
            className="flex-1 bg-gold text-black rounded-xl py-3 font-black uppercase text-xs tracking-widest"
          >
            {item ? 'Update Shot' : 'Create Shot'}
          </button>
          <button
            onClick={onClose}
            className="px-5 bg-white/10 rounded-xl py-3 text-xs font-bold uppercase tracking-widest text-white/70"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// PUBLISHING CALENDAR VIEW
// ============================================================================

const PublishingCalendarView = ({ items }) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekDays = useMemo(() => {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeek]);

  const getItemsForDay = (day) => {
    return items.filter(item => {
      if (!item.scheduledDate) return false;
      const itemDate = new Date(item.scheduledDate);
      return itemDate.toDateString() === day.toDateString();
    });
  };

  const prevWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
  };

  return (
    <div className="space-y-5">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevWeek} className="p-2.5 bg-white/5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h2 className="text-base font-black uppercase text-white/80">
          {formatDate(weekDays[0])} – {formatDate(weekDays[6])}
        </h2>
        <button onClick={nextWeek} className="p-2.5 bg-white/5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, idx) => {
          const dayItems = getItemsForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <div
              key={idx}
              className={`rounded-xl border p-3 min-h-[140px] ${
                isToday
                  ? 'border-gold/40 bg-gold/5'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <div className="text-center mb-2.5">
                <p className="text-[9px] text-white/40 uppercase font-bold">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                <p className={`text-lg font-black ${isToday ? 'text-gold' : 'text-white/70'}`}>
                  {day.getDate()}
                </p>
              </div>
              <div className="space-y-1.5">
                {dayItems.slice(0, 3).map(item => (
                  <div key={item.id} className="p-1.5 rounded-lg bg-white/5 text-[10px] text-white/70 truncate">
                    {item.title || item.hook}
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <p className="text-[9px] text-white/35 text-center font-bold">+{dayItems.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// RESEARCH VIEW
// ============================================================================

const ResearchView = ({ items = [], onRunCouncil, running }) => {
  // Compute real stats from live data
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);

  const ideasThisWeek = items.filter(i => {
    if (!i.createdAt) return false;
    return new Date(i.createdAt) >= weekAgo;
  }).length;

  const scheduledCount = items.filter(i =>
    i.scheduledDate &&
    i.column !== 'published' &&
    i.column !== 'performance'
  ).length;

  const publishedCount = items.filter(i =>
    i.column === 'published' || i.column === 'performance'
  ).length;

  return (
    <div className="space-y-6">
      {/* Council Status */}
      <div className="glass rounded-2xl border border-gold/30 p-5">
        <div className="flex flex-row items-center justify-between gap-3 flex-nowrap">
          <div className="min-w-0 flex-shrink-0">
            <h3 className="text-sm font-black uppercase flex items-center gap-2 text-white whitespace-nowrap">
              <Sparkles size={16} className="text-gold shrink-0" />
              Council Brain
            </h3>
            <p className="text-white/50 text-xs mt-0.5 whitespace-nowrap">
              Auto-research powered by the Council
            </p>
          </div>
          <button
            onClick={onRunCouncil}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-2 bg-gold text-black rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-50 whitespace-nowrap shrink-0 flex-shrink-0"
          >
            {running ? <RefreshCw size={12} className="animate-spin shrink-0" /> : <Zap size={12} className="shrink-0" />}
            {running ? 'Running...' : 'Run Council Now'}
          </button>
        </div>
      </div>

      {/* Quick Stats — computed from live contentItems */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl border border-white/10 p-4">
          <p className="text-2xl font-black text-gold">{ideasThisWeek}</p>
          <p className="text-[10px] text-white/40 uppercase mt-1">Ideas This Week</p>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <p className="text-2xl font-black text-green-400">{scheduledCount}</p>
          <p className="text-[10px] text-white/40 uppercase mt-1">Scheduled</p>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <p className="text-2xl font-black text-rose-400">{publishedCount}</p>
          <p className="text-[10px] text-white/40 uppercase mt-1">Published</p>
        </div>
      </div>

      {/* Recent Council Output */}
      <div>
        <h3 className="text-[11px] font-black uppercase text-white/40 mb-3 tracking-wider">Recent Council Ideas</h3>
        <div className="space-y-2.5">
          {[
            { hook: "Your restaurant is losing $3,000/month and you don't even know why", type: 'problem', vertical: 'Restaurant' },
            { hook: "I created 100 product photos with AI — no photographer, no model, no studio", type: 'experiment', vertical: 'Fashion' },
            { hook: "I made a full song with AI in 20 minutes — here's the process from start to finish", type: 'experiment', vertical: 'Artist' },
          ].map((item, idx) => (
            <div key={idx} className="glass rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                  {item.vertical}
                </span>
                <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                  item.type === 'problem' ? 'bg-red-500/20 text-red-400' :
                  item.type === 'experiment' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {item.type}
                </span>
              </div>
              <p className="text-[13px] text-white/80 leading-relaxed">{item.hook}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SCRIPTS VIEW
// ============================================================================

const ScriptsView = () => {
  const [scripts, setScripts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    try {
      const unsubscribe = onValue(ref(db.database || window.db, 'workspaces/winslow_main/projects/content_factory/scripts'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list = Object.entries(data).map(([id, value]) => ({ id, ...value }));
          setScripts(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        }
      });
      return () => unsubscribe();
    } catch (e) {
      // Firebase ref not available in this context
    }
  }, []);

  const filteredScripts = useMemo(() => {
    if (!searchQuery) return scripts;
    const q = searchQuery.toLowerCase();
    return scripts.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.hook || '').toLowerCase().includes(q)
    );
  }, [scripts, searchQuery]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
        <input
          type="text"
          placeholder="Search scripts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
        />
      </div>

      <div className="space-y-3">
        {filteredScripts.length === 0 ? (
          <div className="glass rounded-2xl border border-dashed border-white/10 p-12 text-center">
            <FileText size={40} className="mx-auto mb-3 text-white/15" />
            <p className="font-bold uppercase tracking-widest text-[11px] text-white/30">No scripts yet</p>
            <p className="text-xs text-white/25 mt-2">Scripts from Council will appear here</p>
          </div>
        ) : (
          filteredScripts.map(script => (
            <div key={script.id} className="glass rounded-xl border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-bold text-white/90">{script.title || script.hook || 'Untitled Script'}</h4>
                  {script.vertical && (
                    <span className="text-[9px] text-white/40 uppercase tracking-wider">{script.vertical}</span>
                  )}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(script.tiktok || script.content || '')}
                  className="p-2 bg-white/10 rounded-lg text-white/50 hover:text-white hover:bg-white/15 transition-colors shrink-0"
                >
                  <Copy size={13} />
                </button>
              </div>
              {script.tiktok && (
                <div className="p-3 rounded-xl bg-black/40 text-[11px] text-white/60 whitespace-pre-wrap font-mono max-h-36 overflow-y-auto">
                  {script.tiktok.substring(0, 300)}...
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SETTINGS VIEW
// ============================================================================

const SettingsView = () => {
  const [platforms, setPlatforms] = useState({
    instagram: { connected: true, handle: '@bobbynewland' },
    twitter: { connected: true, handle: '@bobbynewland' },
    youtube: { connected: false, handle: '' },
    linkedin: { connected: false, handle: '' },
    discord: { connected: true, handle: 'AI Skills Studio' },
  });

  const [schedule, setSchedule] = useState({
    monday: true,
    tuesday: true,
    wednesday: false,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });

  return (
    <div className="space-y-5">
      {/* Platform Connections */}
      <div className="glass rounded-2xl border border-white/10 p-5">
        <h3 className="text-sm font-black uppercase text-white/80 mb-4">Platform Connections</h3>
        <div className="space-y-2.5">
          {Object.entries(platforms).map(([key, platform]) => {
            const Meta = CHANNELS[key];
            if (!Meta) return null;
            const Icon = Meta.icon;
            return (
              <div key={key} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${Meta.color} flex items-center justify-center`}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold capitalize text-white/90">{key}</p>
                    {platform.connected && platform.handle && (
                      <p className="text-[10px] text-white/40">{platform.handle}</p>
                    )}
                  </div>
                </div>
                <button className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  platform.connected
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/10 text-white/60 border border-white/10'
                }`}>
                  {platform.connected ? 'Connected' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Publishing Schedule */}
      <div className="glass rounded-2xl border border-white/10 p-5">
        <h3 className="text-sm font-black uppercase text-white/80 mb-4">Publishing Schedule</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {Object.entries(schedule).map(([day, enabled]) => (
            <button
              key={day}
              onClick={() => setSchedule({ ...schedule, [day]: !enabled })}
              className={`p-3 rounded-xl flex items-center justify-between transition-all ${
                enabled ? 'bg-gold/20 border border-gold/30 text-gold' : 'bg-white/5 border border-white/10 text-white/60'
              }`}
            >
              <span className="text-[11px] font-bold uppercase">{day.slice(0, 3)}</span>
              {enabled ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-Research Settings */}
      <div className="glass rounded-2xl border border-white/10 p-5">
        <h3 className="text-sm font-black uppercase text-white/80 mb-4">Auto-Research</h3>
        <div className="space-y-4">
          {[
            { label: 'Performance Analysis', desc: 'Analyze top content after publishing', enabled: true },
            { label: 'Trend Monitoring', desc: 'Track trending topics in your niches', enabled: true },
            { label: 'Hook Suggestions', desc: 'Generate new hooks based on patterns', enabled: false },
          ].map((setting, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold text-white/90">{setting.label}</p>
                <p className="text-[10px] text-white/40">{setting.desc}</p>
              </div>
              <button className={`w-11 h-6 rounded-full p-1 transition-colors ${setting.enabled ? 'bg-gold' : 'bg-white/20'}`}>
                <div className={`w-4 h-4 rounded-full transition-transform ${setting.enabled ? 'bg-black translate-x-5' : 'bg-white/40 translate-x-0'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContentFactory;