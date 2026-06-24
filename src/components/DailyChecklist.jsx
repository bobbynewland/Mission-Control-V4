import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  Flag,
  StickyNote,
  X,
  ChevronUp,
  ChevronDown,
  Target,
  Sparkles,
  RotateCcw
} from 'lucide-react';

const PRIORITY_OPTIONS = [
  { key: 'urgent', label: 'Urgent', color: '#ef4444', bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', glow: 'shadow-red-500/20' },
  { key: 'high', label: 'High', color: '#f97316', bg: 'bg-orange-500/15', border: 'border-orange-500/40', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
  { key: 'medium', label: 'Medium', color: '#fbbf24', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
  { key: 'low', label: 'Low', color: '#3b82f6', bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  { key: 'none', label: 'None', color: '#9ca3af', bg: 'bg-white/5', border: 'border-white/15', text: 'text-white/50', glow: '' }
];

const PRIORITY_MAP = PRIORITY_OPTIONS.reduce((acc, p) => { acc[p.key] = p; return acc; }, {});

const fmtDueDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dDay = new Date(d);
  dDay.setHours(0, 0, 0, 0);
  const diff = Math.round((dDay - today) / 86400000);
  if (diff === 0) return { label: 'Today', tone: 'gold' };
  if (diff === 1) return { label: 'Tomorrow', tone: 'gold' };
  if (diff === -1) return { label: 'Yesterday', tone: 'red' };
  if (diff < -1) return { label: `${Math.abs(diff)}d overdue`, tone: 'red' };
  if (diff <= 7) return { label: `In ${diff}d`, tone: 'amber' };
  return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tone: 'muted' };
};

const toneClasses = {
  gold: 'bg-gold/15 text-gold border-gold/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  muted: 'bg-white/5 text-white/50 border-white/10'
};

const isoNow = () => new Date().toISOString();

const DailyChecklist = () => {
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [draftPriority, setDraftPriority] = useState('medium');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [addingError, setAddingError] = useState('');
  const inputRef = useRef(null);

  // Subscribe to firebase
  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      try {
        const { db } = await import('../lib/firebase');
        unsub = db.dailyChecklist.subscribe((snap) => {
          if (cancelled) return;
          setItems(snap || {});
          setLoading(false);
        });
      } catch (err) {
        console.error('[DailyChecklist] subscribe failed:', err);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; unsub(); };
  }, []);

  // Sorted items
  const sorted = useMemo(() => {
    const arr = Object.entries(items).map(([id, it]) => ({ id, ...it }));
    arr.sort((a, b) => {
      // Completed items go last
      if (Boolean(a.completed) !== Boolean(b.completed)) return a.completed ? 1 : -1;
      // Active items: priority weight, then due date, then order
      const pa = PRIORITY_OPTIONS.findIndex((p) => p.key === (a.priority || 'none'));
      const pb = PRIORITY_OPTIONS.findIndex((p) => p.key === (b.priority || 'none'));
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    return arr;
  }, [items]);

  const active = sorted.filter((i) => !i.completed);
  const completed = sorted.filter((i) => i.completed);
  const totalCount = sorted.length;
  const doneCount = completed.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Handlers
  const addItem = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setAddingError('');
    try {
      const { db } = await import('../lib/firebase');
      const payload = {
        text,
        completed: false,
        priority: draftPriority,
        dueDate: draftDueDate || null,
        note: '',
        createdAt: isoNow(),
        updatedAt: isoNow(),
        completedAt: null,
        order: Date.now()
      };
      await db.dailyChecklist.push(payload);
      setDraft('');
      setDraftPriority('medium');
      setDraftDueDate('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('[DailyChecklist] add failed:', err);
      setAddingError('Failed to add. Try again.');
    }
  }, [draft, draftPriority, draftDueDate]);

  const toggleComplete = useCallback(async (item) => {
    const next = !item.completed;
    // Optimistic update
    setItems((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], completed: next, completedAt: next ? isoNow() : null, updatedAt: isoNow() }
    }));
    try {
      const { db } = await import('../lib/firebase');
      await db.dailyChecklist.update(item.id, {
        completed: next,
        completedAt: next ? isoNow() : null,
        updatedAt: isoNow()
      });
    } catch (err) {
      console.error('[DailyChecklist] toggle failed:', err);
    }
  }, []);

  const deleteItem = useCallback(async (id) => {
    setItems((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const { db } = await import('../lib/firebase');
      await db.dailyChecklist.remove(id);
    } catch (err) {
      console.error('[DailyChecklist] delete failed:', err);
    }
  }, []);

  const updateField = useCallback(async (id, field, value) => {
    setItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, updatedAt: isoNow() }
    }));
    try {
      const { db } = await import('../lib/firebase');
      await db.dailyChecklist.update(id, { [field]: value, updatedAt: isoNow() });
    } catch (err) {
      console.error('[DailyChecklist] update failed:', err);
    }
  }, []);

  const moveItem = useCallback(async (item, direction) => {
    const list = active;
    const idx = list.findIndex((i) => i.id === item.id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= list.length) return;
    const swap = list[newIdx];
    // Optimistic swap of order
    setItems((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], order: swap.order ?? 0 },
      [swap.id]: { ...prev[swap.id], order: item.order ?? 0 }
    }));
    try {
      const { db } = await import('../lib/firebase');
      const a = item.order ?? 0;
      const b = swap.order ?? 0;
      await db.dailyChecklist.update(item.id, { order: b, updatedAt: isoNow() });
      await db.dailyChecklist.update(swap.id, { order: a, updatedAt: isoNow() });
    } catch (err) {
      console.error('[DailyChecklist] move failed:', err);
    }
  }, [active]);

  const clearCompleted = useCallback(async () => {
    if (completed.length === 0) return;
    if (!window.confirm(`Delete ${completed.length} completed item${completed.length === 1 ? '' : 's'}?`)) return;
    const ids = completed.map((c) => c.id);
    setItems((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { delete next[id]; });
      return next;
    });
    try {
      const { db } = await import('../lib/firebase');
      await Promise.all(ids.map((id) => db.dailyChecklist.remove(id)));
    } catch (err) {
      console.error('[DailyChecklist] clear failed:', err);
    }
  }, [completed]);

  const onAddKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addItem();
    }
  };

  const startEditNote = (item) => {
    setEditingNoteId(item.id);
    setNoteDraft(item.note || '');
  };
  const saveNote = async () => {
    if (!editingNoteId) return;
    await updateField(editingNoteId, 'note', noteDraft);
    setEditingNoteId(null);
    setNoteDraft('');
  };
  const cancelNote = () => {
    setEditingNoteId(null);
    setNoteDraft('');
  };

  // Inline-edit text
  const [editingTextId, setEditingTextId] = useState(null);
  const [textDraft, setTextDraft] = useState('');
  const startEditText = (item) => { setEditingTextId(item.id); setTextDraft(item.text || ''); };
  const saveText = async () => {
    if (!editingTextId) return;
    const v = textDraft.trim();
    if (v) await updateField(editingTextId, 'text', v);
    setEditingTextId(null);
    setTextDraft('');
  };
  const cancelText = () => { setEditingTextId(null); setTextDraft(''); };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Target size={16} className="animate-pulse text-gold" /> Loading checklist…
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      {/* Header with progress ring */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <motion.circle
                cx="18" cy="18" r="15" fill="none"
                stroke="url(#progressGrad)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 94.25} 94.25`}
                initial={{ strokeDasharray: '0 94.25' }}
                animate={{ strokeDasharray: `${(pct / 100) * 94.25} 94.25` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-gold">
              {pct}%
            </div>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/90">
              <Target size={16} className="text-gold" /> Must Do Today
            </h3>
            <p className="text-[10px] text-white/45 uppercase tracking-wider">
              {doneCount}/{totalCount} {totalCount === 1 ? 'item' : 'items'} done
              {active.length > 0 && ` · ${active.length} pending`}
            </p>
          </div>
        </div>
        {completed.length > 0 && (
          <button
            onClick={clearCompleted}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white transition"
            title="Delete all completed items"
          >
            <RotateCcw size={11} /> Clear done
          </button>
        )}
      </div>

      {/* Add item row */}
      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setAddingError(''); }}
            onKeyDown={onAddKey}
            placeholder="What needs to get done?"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
            maxLength={200}
          />
          <button
            onClick={addItem}
            disabled={!draft.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/90 text-black transition hover:bg-gold disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Add item"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Priority chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.key}
                onClick={() => setDraftPriority(p.key)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                  draftPriority === p.key
                    ? `${p.bg} ${p.border} ${p.text}`
                    : 'border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/10'
                }`}
                aria-pressed={draftPriority === p.key}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Calendar size={12} className="text-white/40" />
            <input
              type="date"
              value={draftDueDate}
              onChange={(e) => setDraftDueDate(e.target.value)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/80 outline-none focus:border-gold/40"
            />
            {draftDueDate && (
              <button
                onClick={() => setDraftDueDate('')}
                className="text-white/40 hover:text-white"
                aria-label="Clear due date"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        {addingError && (
          <p className="mt-2 text-[10px] text-red-400">{addingError}</p>
        )}
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="text-center py-8 text-white/40">
          <Sparkles size={28} className="mx-auto mb-2 opacity-30 text-gold" />
          <p className="text-sm font-medium text-white/60">Nothing on the list yet</p>
          <p className="text-[10px] mt-1">Add what you must get done today.</p>
        </div>
      )}

      {/* Active items */}
      {active.length > 0 && (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {active.map((item, idx) => (
              <ChecklistItem
                key={item.id}
                item={item}
                index={idx}
                isFirst={idx === 0}
                isLast={idx === active.length - 1}
                onToggle={() => toggleComplete(item)}
                onDelete={() => deleteItem(item.id)}
                onMove={(dir) => moveItem(item, dir)}
                onUpdatePriority={(p) => updateField(item.id, 'priority', p)}
                onUpdateDue={(d) => updateField(item.id, 'dueDate', d || null)}
                editingNoteId={editingNoteId}
                editingTextId={editingTextId}
                noteDraft={noteDraft}
                setNoteDraft={setNoteDraft}
                startEditNote={startEditNote}
                saveNote={saveNote}
                cancelNote={cancelNote}
                startEditText={startEditText}
                textDraft={textDraft}
                setTextDraft={setTextDraft}
                saveText={saveText}
                cancelText={cancelText}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* Completed section */}
      {completed.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompleted((s) => !s)}
            className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[10px] uppercase tracking-wider text-white/45 hover:bg-white/[0.05]"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-green-400" />
              Completed ({completed.length})
            </span>
            <span>{showCompleted ? 'Hide' : 'Show'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showCompleted && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-1.5 overflow-hidden"
              >
                {completed.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    index={0}
                    isFirst={false}
                    isLast={true}
                    completed
                    onToggle={() => toggleComplete(item)}
                    onDelete={() => deleteItem(item.id)}
                    onMove={() => {}}
                    onUpdatePriority={() => {}}
                    onUpdateDue={() => {}}
                    editingNoteId={editingNoteId}
                    editingTextId={editingTextId}
                    noteDraft={noteDraft}
                    setNoteDraft={setNoteDraft}
                    startEditNote={startEditNote}
                    saveNote={saveNote}
                    cancelNote={cancelNote}
                    startEditText={startEditText}
                    textDraft={textDraft}
                    setTextDraft={setTextDraft}
                    saveText={saveText}
                    cancelText={cancelText}
                  />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
};

const ChecklistItem = ({
  item,
  index,
  isFirst,
  isLast,
  completed,
  onToggle,
  onDelete,
  onMove,
  onUpdatePriority,
  onUpdateDue,
  editingNoteId,
  editingTextId,
  noteDraft,
  setNoteDraft,
  startEditNote,
  saveNote,
  cancelNote,
  startEditText,
  textDraft,
  setTextDraft,
  saveText,
  cancelText
}) => {
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const pri = PRIORITY_MAP[item.priority || 'none'] || PRIORITY_MAP.none;
  const due = fmtDueDate(item.dueDate);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ duration: 0.18 }}
      className={`group relative rounded-xl border bg-black/30 transition-all ${
        completed
          ? 'border-white/5 opacity-60'
          : `${pri.border} ${pri.bg}`
      }`}
    >
      <div className="flex items-start gap-2.5 p-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className="mt-0.5 flex-shrink-0 transition-transform active:scale-90"
          aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {completed ? (
            <CheckCircle2 size={22} className="text-green-400" />
          ) : (
            <Circle size={22} className="text-white/30 hover:text-gold transition" />
          )}
        </button>

        {/* Body */}
        <div className="flex-1 min-w-0">
          {editingTextId === item.id ? (
            <input
              autoFocus
              type="text"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onBlur={saveText}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveText(); }
                if (e.key === 'Escape') { cancelText(); }
              }}
              className="w-full bg-transparent text-sm text-white outline-none border-b border-gold/40 pb-0.5"
              maxLength={200}
            />
          ) : (
            <p
              onClick={() => !completed && startEditText(item)}
              className={`text-sm leading-snug cursor-text ${
                completed
                  ? 'line-through text-white/40'
                  : 'text-white hover:text-white'
              }`}
              title="Click to edit"
            >
              {item.text}
            </p>
          )}

          {/* Meta row: priority chip, due date, note toggle */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {!completed && (
              <div className="relative">
                <button
                  onClick={() => setShowPriorityPicker((s) => !s)}
                  className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition ${pri.bg} ${pri.border} ${pri.text}`}
                >
                  <Flag size={9} />
                  {pri.label}
                </button>
                {showPriorityPicker && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-32 rounded-lg border border-white/10 bg-[#0a0a0a] p-1 shadow-xl">
                    {PRIORITY_OPTIONS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => { onUpdatePriority(p.key); setShowPriorityPicker(false); }}
                        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                          p.key === item.priority
                            ? `${p.bg} ${p.text}`
                            : 'text-white/60 hover:bg-white/5'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!completed && (
              <div className={`group/date flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition ${due ? toneClasses[due.tone] : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'}`}>
                <Calendar size={9} />
                {due ? (
                  <>
                    <span>{due.label}</span>
                    <button
                      onClick={() => onUpdateDue(null)}
                      className="ml-0.5 hover:text-white"
                      aria-label="Clear due date"
                    >
                      <X size={9} />
                    </button>
                  </>
                ) : (
                  <label className="cursor-pointer">
                    Set due
                    <input
                      type="date"
                      value={item.dueDate || ''}
                      onChange={(e) => onUpdateDue(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
            )}

            {completed && item.completedAt && (
              <span className="text-[9px] text-white/40 uppercase tracking-wider">
                ✓ {new Date(item.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}

            {/* Note chip / indicator */}
            {item.note && editingNoteId !== item.id && (
              <button
                onClick={() => startEditNote(item)}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-white/50 hover:bg-white/10"
                title={item.note}
              >
                <StickyNote size={9} />
                note
              </button>
            )}
            {!completed && !item.note && editingNoteId !== item.id && (
              <button
                onClick={() => startEditNote(item)}
                className="flex items-center gap-1 rounded-full border border-dashed border-white/10 px-1.5 py-0.5 text-[9px] text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-white hover:border-white/30"
                title="Add note"
              >
                <StickyNote size={9} />
                +note
              </button>
            )}
          </div>

          {/* Note editor */}
          {editingNoteId === item.id && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-gold/30 bg-black/40 p-2">
              <StickyNote size={14} className="text-gold mt-1 flex-shrink-0" />
              <textarea
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); }
                  if (e.key === 'Escape') cancelNote();
                }}
                placeholder="Add a note (Cmd+Enter to save)"
                rows={2}
                className="flex-1 resize-none bg-transparent text-xs text-white placeholder-white/30 outline-none"
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={saveNote}
                  className="rounded bg-gold/90 px-2 py-0.5 text-[10px] font-bold text-black hover:bg-gold"
                >
                  Save
                </button>
                <button
                  onClick={cancelNote}
                  className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions: move + delete */}
        {!completed && (
          <div className="flex flex-shrink-0 flex-col items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={() => onMove(-1)}
              disabled={isFirst}
              className="text-white/40 hover:text-white disabled:opacity-20"
              aria-label="Move up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={isLast}
              className="text-white/40 hover:text-white disabled:opacity-20"
              aria-label="Move down"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}
        <button
          onClick={onDelete}
          className="flex-shrink-0 self-start rounded p-1 text-white/30 opacity-0 transition hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
          aria-label="Delete item"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.li>
  );
};

export default DailyChecklist;