import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, Clock, ChevronDown, ChevronRight, 
  Sparkles, Play, X, RefreshCw, FileText, 
  Trash2, Archive, Edit3, Pause, PlayCircle,
  MessageSquare, Send, Calendar
} from 'lucide-react';
import ScriptIdeaWorkflows, { isScriptWorkflow } from './ScriptIdeaWorkflows';
import NicheGallery, { NICHE_THUMBNAILS, ALL_NICHES } from './NicheGallery';

// ─── Firebase Helpers ────────────────────────────────────────────────────────
const FIREBASE_BASE = 'https://winslow-756c3-default-rtdb.firebaseio.com/workspaces/winslow_main';
const headers = { 'Content-Type': 'application/json' };

const api = {
  async get(path) {
    const r = await fetch(`${FIREBASE_BASE}${path}.json`);
    return r.json();
  },
  async patch(path, body) {
    await fetch(`${FIREBASE_BASE}${path}.json`, {
      method: 'PATCH', headers, body: JSON.stringify(body)
    });
  },
  async delete(path) {
    await fetch(`${FIREBASE_BASE}${path}.json`, { method: 'DELETE' });
  },
  async post(path, body) {
    const r = await fetch(`${FIREBASE_BASE}${path}.json`, {
      method: 'POST', headers, body: JSON.stringify(body)
    });
    return r.json();
  }
};

// ─── Workflow Config ────────────────────────────────────────────────────────
const TEMPLATE_STAGES = [
  { id: 'research', label: '🔍 Research', color: 'blue' },
  { id: 'niche_select', label: '🎯 Pick Niches', color: 'purple' },
  { id: 'offer', label: '💡 Offer', color: 'green' },
  { id: 'sample', label: '🖼️ Sample', color: 'orange' },
  { id: 'pack', label: '📦 Pack', color: 'pink' },
  { id: 'upload', label: '🚀 Upload', color: 'gold' },
];

const STAGE_COLORS = {
  research: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  niche_select: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  offer: 'bg-green-500/20 text-green-400 border-green-500/30',
  sample: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  pack: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  upload: 'bg-gold/20 text-gold border-gold/30',
};

// ─── Discord Post Workflow Config ──────────────────────────────────────────
const DISCORD_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_CHANNELS = {
  0: '#vip-announcements',
  1: '#daily-skill-drop',
  2: '#daily-skill-drop',
  3: '#daily-skill-drop',
  4: '#vip-announcements',
  5: '#resource-vault',
  6: '#vip-announcements',
};
const DAY_COUNCILS = {
  0: ['Steve Jobs', 'Grant Cardone', 'Albert Einstein', '50 Cent'],
  1: ['Alex Hormozi', 'Myron Golden', 'Daymond John', 'Steve Jobs'],
  2: ['Albert Einstein', 'Enzo Ferrari', 'Kevin O\'Leary', 'Alex Hormozi'],
  3: ['Myron Golden', 'Kevin O\'Leary', 'Grant Cardone', 'Rick Ross'],
  4: ['50 Cent', 'Jay-Z', 'Daymond John', 'Louis Vuitton'],
  5: ['Daymond John', 'Alex Hormozi', 'Albert Einstein', '50 Cent'],
  6: ['Albert Einstein', 'Steve Jobs', 'Enzo Ferrari', 'Kevin O\'Leary'],
};

// ─── Component ─────────────────────────────────────────────────────────────
const Workflows = () => {
  const [queue, setQueue] = useState([]);
  const [discordWorkflow, setDiscordWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('template'); // 'template' | 'discord'
  const [expandedId, setExpandedId] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [stepModal, setStepModal] = useState(null); // { item, step }
  const [editData, setEditData] = useState({});
  const [showNicheGallery, setShowNicheGallery] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [approvalData] = await Promise.all([
        api.get('/approvalQueue'),
      ]);
      
      if (approvalData) {
        const parsed = Object.entries(approvalData)
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setQueue(parsed);
      }
      
      // Load discord workflow from local config
      try {
        const dw = await fetch('/.discord-workflow.json').then(r => r.json()).catch(() => null);
        if (dw) setDiscordWorkflow(dw);
      } catch {}
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ─── Template Workflow Actions ──────────────────────────────────────────
  const updateWorkflow = async (id, patch) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, ...patch } : item));
    await api.patch(`/approvalQueue/${id}`, patch);
  };

  const deleteWorkflow = async (id) => {
    if (!confirm('Delete this workflow?')) return;
    setQueue(q => q.filter(item => item.id !== id));
    await api.delete(`/approvalQueue/${id}`);
  };

  const archiveWorkflow = async (item) => {
    const patch = { archived: true, archivedAt: new Date().toISOString() };
    await updateWorkflow(item.id, patch);
  };

  const advanceWorkflow = async (item) => {
    // For niche_select: require exactly 2 picks — open modal instead
    if (item.stage === 'niche_select') {
      setStepModal({ item, step: 'niche_select' });
      return;
    }
    
    const idx = TEMPLATE_STAGES.findIndex(s => s.id === item.stage);
    if (idx >= TEMPLATE_STAGES.length - 1) return;
    const nextStage = TEMPLATE_STAGES[idx + 1].id;
    await updateWorkflow(item.id, { stage: nextStage, status: 'running', updatedAt: new Date().toISOString() });
    
    const taskMap = {
      niche_select: 'council.prepare_niche_pick',
      inspiration: 'council.generate_inspiration',
      offer: 'council.generate_offer',
      sample: 'council.generate_samples',
      refine: 'council.refine_samples',
      pack: 'council.build_pack',
      upload: 'council.upload_pack'
    };
    const taskType = (item.stage === 'niche_select') ? 'council.lock_niches' : taskMap[nextStage];
    if (taskType) {
      await api.post('/agent_tasks', {
        type: taskType, approvalQueueId: item.id,
        title: item.title || item.date || 'Workflow',
        stage: nextStage, status: 'queued', createdAt: Date.now()
      });
    }
  };

  const toggleNiche = async (item, nicheId) => {
    const current = item?.niches?.selected || [];
    const isSelected = current.includes(nicheId);
    let next;
    if (isSelected) {
      next = current.filter(id => id !== nicheId);
    } else {
      if (current.length >= 2) return; // hard limit 2
      next = [...current, nicheId];
    }
    const updated = { ...item, niches: { ...(item.niches || {}), selected: next } };
    setQueue(q => q.map(i => i.id === item.id ? updated : i));
    setStepModal(prev => prev ? { ...prev, item: updated } : prev);
    await updateWorkflow(item.id, { niches: updated.niches });
  };

  const lockNiches = async (item) => {
    const picks = item?.niches?.selected || [];
    if (picks.length !== 2) {
      alert('Pick exactly 2 niches to continue');
      return;
    }
    await updateWorkflow(item.id, { status: 'running', updatedAt: new Date().toISOString() });
    await api.post('/agent_tasks', {
      type: 'council.lock_niches', approvalQueueId: item.id,
      title: item.title || item.date || 'Workflow',
      stage: 'niche_select', status: 'queued', createdAt: Date.now()
    });
    setStepModal(null);
  };

  const runWorkflowNow = async (item) => {
    await api.post('/agent_tasks', {
      type: 'council.start_workflow',
      title: item.title || item.date || 'Manual Run',
      status: 'queued', createdAt: Date.now()
    });
    await updateWorkflow(item.id, { status: 'running', updatedAt: new Date().toISOString() });
  };

  // ─── Discord Workflow Actions ────────────────────────────────────────────
  const toggleDiscordWorkflow = async () => {
    if (!discordWorkflow) return;
    const updated = { ...discordWorkflow, enabled: !discordWorkflow.enabled };
    setDiscordWorkflow(updated);
    // Save to local storage for cron to pick up
    const formData = new FormData();
    Object.entries(updated).forEach(([k, v]) => {
      if (typeof v === 'object') formData.append(k, JSON.stringify(v));
      else formData.append(k, String(v));
    });
  };

  const testDiscordPost = async () => {
    try {
      const r = await fetch('https://' + window.location.host + '/api/run-discord-post', { method: 'POST' });
      if (r.ok) alert('Test post sent!');
    } catch {
      // Fallback: trigger via cron run
      await fetch(`https://winslow-756c3-default-rtdb.firebaseio.com/workspaces/winslow_main/agent_tasks.json`, {
        method: 'POST', headers,
        body: JSON.stringify({ type: 'discord.test', status: 'queued', createdAt: Date.now() })
      });
      alert('Test post triggered via cron agent');
    }
  };

  // ─── Render Helpers ─────────────────────────────────────────────────────
  const getStageIdx = (stage) => TEMPLATE_STAGES.findIndex(s => s.id === stage);
  const isArchived = (item) => item?.archived || item?.stage === 'upload';

  const StatusBadge = ({ status }) => {
    if (status === 'running') return (
      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
        <RefreshCw size={10} className="inline animate-spin mr-1" />Running
      </span>
    );
    if (status === 'needs_input' || status === 'needs_review') return (
      <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Needs Input</span>
    );
    if (status === 'done') return (
      <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/40">Done</span>
    );
    return null;
  };

  const ActionButton = ({ icon: Icon, label, onClick, variant = 'default', disabled = false }) => {
    const variants = {
      default: 'bg-white/10 hover:bg-white/20 text-white/70',
      danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30',
      success: 'bg-green-500/20 hover:bg-green-500/30 text-green-400',
      gold: 'bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30',
    };
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`p-2 rounded-lg transition-all ${variants[variant]} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        title={label}
      >
        <Icon size={14} />
      </button>
    );
  };

  // ─── Template Workflow Card ──────────────────────────────────────────────
  const TemplateCard = ({ item }) => {
    const idx = getStageIdx(item.stage);
    const isExpanded = expandedId === item.id;
    const stageColor = STAGE_COLORS[item.stage] || 'bg-white/10 text-white/60';

    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div 
          onClick={() => setExpandedId(isExpanded ? null : item.id)}
          className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs text-white/40 font-medium truncate">
                  {item.title || item.date || 'Workflow'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${stageColor}`}>
                  {TEMPLATE_STAGES[idx]?.label || item.stage}
                </span>
                {item.stage === 'niche_select' ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setStepModal({ item, step: 'niche_select' }); }}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-green-500/40 bg-green-500/20 text-green-400 font-bold animate-pulse"
                  >
                    🎯 Pick 2 Niches — TAP HERE
                  </button>
                ) : (
                  <StatusBadge status={item.status} />
                )}
                {isArchived(item) && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40">
                    <Archive size={10} className="inline mr-1" />Archived
                  </span>
                )}
              </div>
              {item.draftPrompt && (
                <p className="text-white/50 text-xs truncate mt-1">
                  {item.draftPrompt.split('\n')[0]?.substring(0, 60)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2">
              <ActionButton icon={Play} label="Run Now" onClick={(e) => { e.stopPropagation(); runWorkflowNow(item); }} variant="gold" />
              <ActionButton icon={Edit3} label="Edit" onClick={(e) => { e.stopPropagation(); setEditModal(item); }} />
              <ActionButton icon={Archive} label="Archive" onClick={(e) => { e.stopPropagation(); archiveWorkflow(item); }} />
              <ActionButton icon={Trash2} label="Delete" onClick={(e) => { e.stopPropagation(); deleteWorkflow(item.id); }} variant="danger" />
              <ChevronDown size={16} className={`text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="border-t border-white/10 overflow-hidden"
            >
              {/* Stage Progress */}
              <div className="p-4 space-y-1">
                {TEMPLATE_STAGES.map((stage, i) => {
                  const isDone = i < idx;
                  const isCurrent = i === idx;
                  const color = STAGE_COLORS[stage.id] || 'bg-white/10';
                  return (
                    <div
                      key={stage.id}
                      onClick={() => isDone || isCurrent ? advanceWorkflow(item) : null}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer
                        ${isCurrent ? `${color} border` : isDone ? 'bg-green-500/10' : 'bg-white/5 opacity-50'}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                        ${isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-current text-black' : 'bg-white/10 text-white/30'}`}>
                        {isDone ? <Check size={12} /> : i + 1}
                      </div>
                      <span className={`text-sm font-medium ${isDone ? 'text-green-400' : isCurrent ? 'text-white' : 'text-white/40'}`}>
                        {stage.label}
                      </span>
                      {isCurrent && item.status === 'running' && (
                        <RefreshCw size={14} className="animate-spin text-gold ml-auto" />
                      )}
                      {isDone && <Check size={14} className="text-green-400 ml-auto" />}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-white/10 flex gap-2">
                <button
                  onClick={() => advanceWorkflow(item)}
                  className={`flex-1 py-3 font-bold rounded-xl text-sm ${
                    item.stage === 'niche_select'
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-gold text-black hover:opacity-90'
                  }`}
                >
                  {item.stage === 'niche_select' ? '🎯 Pick 2 Niches to Continue' : '✓ Advance to Next Step'}
                </button>
                <button
                  onClick={() => setEditModal(item)}
                  className="px-4 py-3 bg-white/10 text-white/70 rounded-xl text-sm"
                >
                  <Edit3 size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ─── Discord Workflow Panel ──────────────────────────────────────────────
  const DiscordPanel = () => {
    if (!discordWorkflow) return (
      <div className="text-center py-12 text-white/30">
        <Send size={48} className="mx-auto mb-4 opacity-20" />
        <p className="font-bold">Discord Daily Post</p>
        <p className="text-xs mt-1">Workflow not configured</p>
      </div>
    );

    const enabled = discordWorkflow.enabled;
    const today = new Date().getDay();
    const todayCouncil = DAY_COUNCILS[today] || [];

    return (
      <div className="space-y-4">
        {/* Header Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-gold" />
                Discord VIP Daily Post
              </h3>
              <p className="text-white/40 text-xs mt-1">Council Brain — 12 Entrepreneur Personas</p>
            </div>
            <button
              onClick={toggleDiscordWorkflow}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                enabled 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {enabled ? (
                <><Pause size={14} className="inline mr-1" />Paused</>
              ) : (
                <><PlayCircle size={14} className="inline mr-1" />Active</>
              )}
            </button>
          </div>

          {/* Today's Info */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-black/20 rounded-xl p-3 border border-white/10">
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Today</p>
              <p className="text-white font-bold">{DISCORD_DAYS[today]}</p>
              <p className="text-white/50 text-xs">{DAY_CHANNELS[today]}</p>
            </div>
            <div className="bg-black/20 rounded-xl p-3 border border-white/10">
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Schedule</p>
              <p className="text-white font-bold">2 PM UTC</p>
              <p className="text-white/50 text-xs">Mon-Sat</p>
            </div>
          </div>

          {/* Today's Council */}
          <div className="bg-black/20 rounded-xl p-3 border border-white/10">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Today's Council</p>
            <div className="flex flex-wrap gap-2">
              {todayCouncil.map((name, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-gold/20 text-gold rounded-full border border-gold/30">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={testDiscordPost}
              className="flex-1 py-3 bg-gold text-black font-bold rounded-xl text-sm"
            >
              <Send size={14} className="inline mr-2" />Send Test Post
            </button>
            <button
              onClick={toggleDiscordWorkflow}
              className="px-4 py-3 bg-white/10 text-white/70 rounded-xl text-sm"
            >
              {enabled ? <><Pause size={14} className="inline mr-1" />Pause</> : <><PlayCircle size={14} className="inline mr-1" />Resume</>}
            </button>
          </div>
        </div>

        {/* Weekly Schedule */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h4 className="text-white font-bold text-sm">Weekly Schedule</h4>
          </div>
          <div className="divide-y divide-white/5">
            {DISCORD_DAYS.map((day, i) => {
              const council = DAY_COUNCILS[i] || [];
              const isToday = i === today;
              return (
                <div 
                  key={day}
                  className={`p-3 flex items-center gap-3 ${isToday ? 'bg-gold/5' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                    ${isToday ? 'bg-gold text-black' : 'bg-white/10 text-white/40'}`}>
                    {day.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isToday ? 'text-gold' : 'text-white/70'}`}>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i]}
                      </span>
                      <span className="text-white/30 text-xs">{DAY_CHANNELS[i]}</span>
                    </div>
                    <p className="text-white/40 text-xs truncate mt-0.5">
                      {council.join(' • ')}
                    </p>
                  </div>
                  {isToday && <span className="text-[10px] text-gold font-bold">TODAY</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Run History */}
        {discordWorkflow.last_run && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <h4 className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Last Run</h4>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-white/40" />
              <span className="text-white/70 text-sm">
                {new Date(discordWorkflow.last_run).toLocaleString()}
              </span>
              {discordWorkflow.last_status === 'success' ? (
                <Check size={14} className="text-green-400" />
              ) : (
                <X size={14} className="text-red-400" />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Niche Selection Modal ────────────────────────────────────────────────
  const NicheModal = ({ item, onClose }) => {
    const options = item?.niches?.options || [];
    const selected = item?.niches?.selected || [];
    
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-[100]"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[110] bg-[#1a1a1a] rounded-2xl p-6 border border-white/10 max-w-md mx-auto max-h-[80vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🎯 Pick 2 Niches
            </h3>
            <button onClick={onClose} className="text-white/40 hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <p className="text-white/50 text-sm mb-4">
            Select exactly <span className="text-gold font-bold">2 niches</span> to proceed. Tap to select/deselect.
          </p>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            {options.length === 0 && (
              <p className="col-span-2 text-white/30 text-sm italic text-center py-8">No niches available yet. Agent is generating...</p>
            )}
            {options.map((o) => {
              const id = o.id || o.name;
              const isSelected = selected.includes(id);
              const nicheData = NICHE_THUMBNAILS[id] || {};
              return (
                <button
                  key={id}
                  onClick={() => toggleNiche(item, id)}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-gold ring-2 ring-gold/30'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {/* Thumbnail Image */}
                  <div className="aspect-[4/5] relative bg-black/20">
                    <img 
                      src={nicheData.image || '/thumb-fitness.png'} 
                      alt={nicheData.label || o.label || o.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = nicheData.id === 'fitness' ? 'from-blue-600/40 to-purple-600/40' :
                          nicheData.id === 'fashion' ? 'from-amber-600/40 to-rose-600/40' :
                          nicheData.id === 'food-drink' ? 'from-orange-600/40 to-red-600/40' :
                          nicheData.id === 'photography' ? 'from-cyan-600/40 to-blue-600/40' :
                          nicheData.id === 'product' ? 'from-slate-600/40 to-zinc-600/40' :
                          nicheData.id === 'illustration-3d' ? 'from-purple-600/40 to-pink-600/40' :
                          'from-rose-600/40 to-pink-600/40';
                        e.target.parentElement.classList.add(`bg-gradient-to-br`, ...fallback.split(' '));
                      }}
                    />
                    {/* Fallback gradient */}
                    <div className={`absolute inset-0 ${nicheData.id === 'fitness' ? 'bg-gradient-to-br from-blue-600/40 to-purple-600/40' :
                      nicheData.id === 'fashion' ? 'bg-gradient-to-br from-amber-600/40 to-rose-600/40' :
                      nicheData.id === 'food-drink' ? 'bg-gradient-to-br from-orange-600/40 to-red-600/40' :
                      nicheData.id === 'photography' ? 'bg-gradient-to-br from-cyan-600/40 to-blue-600/40' :
                      nicheData.id === 'product' ? 'bg-gradient-to-br from-slate-600/40 to-zinc-600/40' :
                      nicheData.id === 'illustration-3d' ? 'bg-gradient-to-br from-purple-600/40 to-pink-600/40' :
                      'bg-gradient-to-br from-rose-600/40 to-pink-600/40'}`} />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col justify-end p-2">
                      <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">{nicheData.label || o.label || o.name}</p>
                    </div>
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-gold rounded-full flex items-center justify-center">
                        <Check size={10} className="text-black" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="text-center text-white/40 text-xs mb-4">
            Selected: <span className={`font-bold ${selected.length === 2 ? 'text-green-400' : 'text-gold'}`}>{selected.length}</span> / 2
          </div>
          
          <button
            onClick={() => lockNiches(item)}
            disabled={selected.length !== 2}
            className={`w-full py-4 rounded-xl font-bold text-sm transition-all ${
              selected.length === 2
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {selected.length === 2 ? '✓ Confirm & Continue' : 'Select 2 niches to continue'}
          </button>
        </motion.div>
      </>
    );
  };

  // ─── Edit Modal ──────────────────────────────────────────────────────────
  const EditModal = ({ item, onClose }) => {
    const [title, setTitle] = useState(item.title || '');
    const [notes, setNotes] = useState(item.notes || '');

    const handleSave = async () => {
      await updateWorkflow(item.id, { title, notes });
      onClose();
    };

    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-[100]"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[110] bg-[#1a1a1a] rounded-2xl p-6 border border-white/10 max-w-md mx-auto"
        >
          <h3 className="text-lg font-bold text-white mb-4">Edit Workflow</h3>
          <div className="space-y-4">
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white"
                placeholder="Workflow title..."
              />
            </div>
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white resize-none"
                rows={3}
                placeholder="Add notes..."
              />
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <button onClick={onClose} className="flex-1 py-3 bg-white/10 text-white/70 rounded-xl font-bold">
              Cancel
            </button>
            <button onClick={handleSave} className="flex-1 py-3 bg-gold text-black rounded-xl font-bold">
              Save Changes
            </button>
          </div>
        </motion.div>
      </>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  const templateWorkflows = queue.filter(q => !isScriptWorkflow(q) && !isArchived(q));
  const scriptWorkflows = queue.filter(q => isScriptWorkflow(q) && !isArchived(q));
  const archivedWorkflows = queue.filter(q => isArchived(q));

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-gold">Workflows</h1>
          <p className="text-white/40 text-sm">{templateWorkflows.length} active</p>
        </div>
        {activeTab === 'template' && (
          <button
            onClick={() => setShowNicheGallery(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gold/20 border border-gold/30 text-gold rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gold/30 transition-colors"
          >
            <Sparkles size={14} /> Browse Niches
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {[
          { key: 'template', label: 'Templates', icon: Sparkles },
          { key: 'discord', label: 'Discord Post', icon: MessageSquare },
          { key: 'scripts', label: 'Scripts', icon: FileText },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.key ? 'bg-gold text-black' : 'text-white/50 hover:text-white/70'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Template Workflows — Daily Prompt Drops */}
      {activeTab === 'template' && (
        <>
          {templateWorkflows.length === 0 && (
            <div className="text-center py-12 text-white/30">
              <Sparkles size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold">No active template workflows</p>
              <p className="text-xs mt-1">New prompt drops at 1pm UTC daily</p>
            </div>
          )}
          {templateWorkflows.map(item => (
            <TemplateCard key={item.id} item={item} />
          ))}
        </>
      )}

      {/* Discord Daily Post */}
      {activeTab === 'discord' && <DiscordPanel />}

      {/* Scripts / Ideas — Short Film Scripts */}
      {activeTab === 'scripts' && (
        <>
          <ScriptIdeaWorkflows queue={queue} setQueue={setQueue} />
          {scriptWorkflows.length === 0 && (
            <div className="text-center py-12 text-white/30">
              <FileText size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold">No script ideas</p>
              <p className="text-xs mt-1">Short film ideas appear at 9am ET daily</p>
            </div>
          )}
        </>
      )}

      {/* Archived */}
      {archivedWorkflows.length > 0 && (
        <details className="mt-6">
          <summary className="text-white/40 text-sm cursor-pointer hover:text-white/60">
            Archived ({archivedWorkflows.length})
          </summary>
          <div className="mt-2 space-y-2 opacity-60">
            {archivedWorkflows.map(item => (
              <div key={item.id} className="p-3 bg-white/5 rounded-xl flex items-center gap-3">
                <span className="text-white/50 text-sm truncate flex-1">{item.title || item.date}</span>
                <button
                  onClick={() => updateWorkflow(item.id, { archived: false })}
                  className="text-xs text-gold hover:underline"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal && <EditModal item={editModal} onClose={() => setEditModal(null)} />}
        {stepModal && <NicheModal item={stepModal.item} onClose={() => setStepModal(null)} />}
        {showNicheGallery && (
          <NicheGallery
            selectedNiches={[]}
            onToggleNiche={(id) => console.log('Selected niche:', id)}
            onClose={() => setShowNicheGallery(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Workflows;
