import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { format, isAfter, isToday, parseISO, startOfDay } from 'date-fns';
import {
  Plus, X, Image, Calendar, Copy, Share2, Check, Clock, Edit3, Trash2, Filter,
  Lightbulb, Sparkles, Target, Layers3, BadgeCheck, Send, ChevronDown, Youtube,
  Instagram, Twitter, Linkedin, Facebook, Megaphone, MessageSquareText, GripVertical,
  Archive, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';

const PURPOSES = {
  creative_proof: { label: 'Proof', color: 'from-fuchsia-500/20', icon: Sparkles },
  educational: { label: 'Educate', color: 'from-cyan-500/20', icon: Lightbulb },
  promotional: { label: 'Promote', color: 'from-amber-500/20', icon: Megaphone },
  vip_discord: { label: 'VIP', color: 'from-violet-500/20', icon: MessageSquareText },
  youtube: { label: 'YouTube', color: 'from-rose-500/20', icon: Youtube },
};

const PILLARS = [
  { id: 'authority', label: 'Authority' },
  { id: 'bts', label: 'BTS' },
  { id: 'transformation', label: 'Transformation' },
  { id: 'education', label: 'Education' },
];

const AUDIENCES = ['public', 'vip', 'ambassador', 'customers', 'leads'];
const STATUSES = ['idea', 'draft', 'ready', 'scheduled', 'posted'];

const CHANNELS = {
  instagram: { icon: Instagram, color: 'bg-pink-500', label: 'IG' },
  twitter: { icon: Twitter, color: 'bg-sky-400', label: 'X' },
  youtube: { icon: Youtube, color: 'bg-red-500', label: 'YT' },
  linkedin: { icon: Linkedin, color: 'bg-blue-700', label: 'LI' },
  discord: { icon: MessageSquareText, color: 'bg-indigo-500', label: 'DC' },
};

const emptyPost = () => ({
  id: '',
  title: '',
  hook: '',
  caption: '',
  notes: '',
  cta: '',
  imagePreview: null,
  scheduledDate: '',
  scheduledTime: '',
  purpose: 'creative_proof',
  pillar: 'education',
  audience: 'public',
  status: 'idea',
  channels: ['instagram'],
  createdAt: new Date().toISOString(),
});

const normalizePost = (raw) => ({
  ...raw,
  id: raw.id || `${Date.now()}`,
  title: raw.title || 'Untitled',
  status: raw.status || 'idea',
  channels: raw.channels || raw.platforms || ['instagram'],
  createdAt: raw.createdAt || new Date().toISOString(),
});

const ContentCalendar = () => {
  const [posts, setPosts] = useState([]);
  const [view, setView] = useState('ideas'); // 'ideas' or 'production'
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  const [newPost, setNewPost] = useState(emptyPost());

  useEffect(() => {
    const unsubscribe = db.content.subscribe((data) => {
      const rawItems = Array.isArray(data) ? data : (data ? Object.values(data) : []);
      const normalized = rawItems.map(normalizePost);
      
      setPosts(currentPosts => {
        const currentStr = JSON.stringify(currentPosts);
        const newStr = JSON.stringify(normalized);
        if (currentStr === newStr) return currentPosts;
        return normalized;
      });
    });
    return () => unsubscribe();
  }, []);

  const filteredPosts = useMemo(() => {
    let items = posts.filter(p => !p.archived);
    if (view === 'ideas') {
      items = items.filter(p => p.status === 'idea');
    } else {
      items = items.filter(p => p.status !== 'idea');
    }
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(p => p.title.toLowerCase().includes(s) || p.hook.toLowerCase().includes(s));
    }
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [posts, view, search]);

  const savePost = useCallback(() => {
    const post = { ...newPost, id: newPost.id || `${Date.now()}` };
    const updated = editingPost ? posts.map(p => p.id === post.id ? post : p) : [post, ...posts];
    db.content.set(updated);
    setShowForm(false);
    setNewPost(emptyPost());
    setEditingPost(null);
  }, [newPost, posts, editingPost]);

  const handleEdit = useCallback((post) => {
    setEditingPost(post);
    setNewPost(post);
    setShowForm(true);
  }, []);

  const toggleArchive = useCallback((id) => {
    const updated = posts.map(p => p.id === id ? { ...p, archived: !p.archived } : p);
    db.content.set(updated);
  }, [posts]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-gold/30">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic">
                Content <span className="text-[#f5c542]">Ops</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mt-1">Mission Control v3</p>
            </div>
            <button 
              onClick={() => { setEditingPost(null); setNewPost(emptyPost()); setShowForm(true); }}
              className="w-12 h-12 rounded-full bg-[#f5c542] text-black flex items-center justify-center shadow-[0_0_20px_rgba(245,197,66,0.2)] active:scale-90 transition-transform"
            >
              <Plus size={24} strokeWidth={3} />
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => setView('ideas')}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'ideas' ? 'bg-[#f5c542] text-black shadow-lg' : 'text-white/40'}`}
            >
              Ideas
            </button>
            <button 
              onClick={() => setView('production')}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'production' ? 'bg-[#f5c542] text-black shadow-lg' : 'text-white/40'}`}
            >
              Production
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-8 pb-32">
        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input 
              type="text" 
              placeholder="Filter by title or hook..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-[#f5c542]/50 transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
              <Layers3 className="mx-auto text-white/10 mb-4" size={48} />
              <p className="text-white/20 font-bold uppercase tracking-widest text-xs">No items found</p>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <ContentCard 
                key={post.id} 
                post={post} 
                expanded={expandedId === post.id}
                onToggle={() => setExpandedId(expandedId === post.id ? null : post.id)}
                onEdit={() => handleEdit(post)}
                onArchive={() => toggleArchive(post.id)}
              />
            ))
          )}
        </div>
      </main>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-[#0f0f0f] rounded-t-[2.5rem] sm:rounded-[2.5rem] border-t sm:border border-white/10 overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-white/5">
                <h2 className="text-xl font-black uppercase italic tracking-tight">
                  {editingPost ? 'Edit' : 'New'} <span className="text-[#f5c542]">Shot</span>
                </h2>
                <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f5c542] mb-2 block">Core Concept</label>
                  <input 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:border-[#f5c542]/50 outline-none transition-colors font-bold"
                    placeholder="Short Title..."
                    value={newPost.title}
                    onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                  />
                  <textarea 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 mt-3 focus:border-[#f5c542]/50 outline-none transition-colors text-sm min-h-[100px] resize-none"
                    placeholder="The Hook / Opening line..."
                    value={newPost.hook}
                    onChange={(e) => setNewPost({...newPost, hook: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 block">Purpose</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 appearance-none focus:border-[#f5c542]/50 outline-none text-sm"
                      value={newPost.purpose}
                      onChange={(e) => setNewPost({...newPost, purpose: e.target.value})}
                    >
                      {Object.entries(PURPOSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 block">Status</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 appearance-none focus:border-[#f5c542]/50 outline-none text-sm"
                      value={newPost.status}
                      onChange={(e) => setNewPost({...newPost, status: e.target.value})}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>

                <details className="group border border-white/5 rounded-3xl">
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                    <span className="text-xs font-black uppercase tracking-widest text-white/40 group-open:text-[#f5c542]">Advanced Details</span>
                    <ChevronDown size={16} className="text-white/20 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="p-5 pt-0 space-y-5 border-t border-white/5 mt-2">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 block">Caption / Notes</label>
                      <textarea 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 outline-none text-sm min-h-[150px] resize-none"
                        placeholder="Draft the script or caption..."
                        value={newPost.caption}
                        onChange={(e) => setNewPost({...newPost, caption: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 block">CTA</label>
                      <input 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 outline-none text-sm"
                        placeholder="Link in bio, etc..."
                        value={newPost.cta}
                        onChange={(e) => setNewPost({...newPost, cta: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 block">Date</label>
                         <input type="date" className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 outline-none text-sm text-white" value={newPost.scheduledDate} onChange={e => setNewPost({...newPost, scheduledDate: e.target.value})} />
                       </div>
                       <div>
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 block">Time</label>
                         <input type="time" className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 outline-none text-sm text-white" value={newPost.scheduledTime} onChange={e => setNewPost({...newPost, scheduledTime: e.target.value})} />
                       </div>
                    </div>
                  </div>
                </details>
              </div>

              <div className="p-8 border-t border-white/5 bg-white/[0.02]">
                <button 
                  onClick={savePost}
                  className="w-full py-5 bg-[#f5c542] text-black font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-[#f5c542]/20 active:scale-[0.98] transition-all"
                >
                  Confirm Shot
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ContentCard = ({ post, expanded, onToggle, onEdit, onArchive }) => {
  const purpose = PURPOSES[post.purpose] || PURPOSES.creative_proof;
  const statusColors = {
    idea: 'text-violet-400 bg-violet-400/10',
    draft: 'text-blue-400 bg-blue-400/10',
    ready: 'text-green-400 bg-green-400/10',
    scheduled: 'text-amber-400 bg-amber-400/10',
    posted: 'text-white/40 bg-white/5',
  };

  return (
    <motion.div 
      layout
      className={`relative overflow-hidden rounded-[2rem] border transition-all duration-500 ${expanded ? 'border-[#f5c542]/30 bg-white/[0.04]' : 'border-white/5 bg-white/[0.02]'}`}
    >
      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${purpose.color} to-transparent opacity-50`} />
      
      <div className="p-6 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-wrap gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusColors[post.status] || 'bg-white/5'}`}>
              {post.status}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-widest">
              {purpose.label}
            </span>
          </div>
          <div className="flex gap-1">
            {post.channels.map(c => {
               const Meta = CHANNELS[c];
               if (!Meta) return null;
               const Icon = Meta.icon;
               return <div key={c} className={`w-6 h-6 rounded-lg ${Meta.color} flex items-center justify-center text-white scale-75`}><Icon size={12} /></div>
            })}
          </div>
        </div>

        <h3 className="text-lg font-bold leading-tight mb-2 tracking-tight group-hover:text-[#f5c542] transition-colors">
          {post.title}
        </h3>
        
        <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
          {post.hook || post.caption || "No hook defined yet."}
        </p>

        {post.scheduledDate && (
          <div className="mt-4 flex items-center gap-2 text-[#f5c542] text-[10px] font-black uppercase tracking-widest">
            <Clock size={12} />
            {format(parseISO(post.scheduledDate), 'MMM d')} {post.scheduledTime}
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-6 pt-0 space-y-6">
              <div className="grid grid-cols-2 gap-4 pt-6">
                <button 
                  onClick={onEdit}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest transition-colors"
                >
                  <Edit3 size={14} /> Edit
                </button>
                <button 
                   onClick={() => {
                     const text = `${post.hook}\n\n${post.caption}\n\nCTA: ${post.cta}`;
                     navigator.clipboard.writeText(text);
                   }}
                   className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest transition-colors"
                >
                  <Copy size={14} /> Copy
                </button>
              </div>

              {post.caption && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2 block">Caption</label>
                  <div className="bg-black/40 rounded-2xl p-5 text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                    {post.caption}
                  </div>
                </div>
              )}

              {post.cta && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-[#f5c542]/5 border border-[#f5c542]/10">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#f5c542]/60">CTA</div>
                  <div className="text-xs font-bold text-[#f5c542]">{post.cta}</div>
                </div>
              )}

              <div className="flex gap-2">
                <button 
                  onClick={onArchive}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-white/20 hover:text-red-400 transition-colors"
                >
                  Archive Shot
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ContentCalendar;
