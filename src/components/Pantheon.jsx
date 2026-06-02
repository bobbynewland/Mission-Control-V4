import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Zap,
  Feather,
  Hammer,
  Wrench,
  Sparkles,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Image as ImageIcon,
  Code2,
} from 'lucide-react';
import {
  fetchPersonas,
  fetchSkillsRegistry,
  loadLocalPersonas,
  saveLocalPersona,
} from '../lib/pantheon';

const ICONS = {
  Brain,
  Zap,
  Feather,
  Hammer,
  Wrench,
  Sparkles,
};

const MODELS = [
  'opus',
  'sonnet',
  'haiku',
  'opus-4-7',
  'claude-opus-4-7',
];

function PersonaCard({ persona }) {
  const Icon = ICONS[persona.icon] || Sparkles;
  const color = persona.color || '#A855F7';
  return (
    <div className="glass relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-30"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10"
            style={{ background: `${color}22`, color }}
          >
            <Icon size={20} />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-tight text-white">
              {persona.name}
            </h3>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              {persona.role}
            </p>
          </div>
        </div>
        <span
          className="rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-white/70"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          {persona.model}
        </span>
      </div>

      {persona.systemPrompt && (
        <p className="mt-4 line-clamp-3 text-xs leading-relaxed text-white/60">
          {persona.systemPrompt}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-white/30">
          {persona.id || persona.name?.toLowerCase()}
        </span>
        <button
          type="button"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-white"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('mc3_dialog', {
                detail: {
                  title: persona.name,
                  message: persona.systemPrompt || persona.role || '',
                  type: 'alert',
                  confirmLabel: 'Close',
                  resolve: () => {},
                },
              })
            )
          }
        >
          View
        </button>
      </div>
    </div>
  );
}

function NewPersonaModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    role: '',
    model: 'sonnet',
    systemPrompt: '',
  });

  useEffect(() => {
    if (open) setForm({ name: '', role: '', model: 'sonnet', systemPrompt: '' });
  }, [open]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const persona = {
      id: `local_${Date.now()}`,
      name: form.name.trim(),
      role: form.role.trim(),
      model: form.model,
      systemPrompt: form.systemPrompt.trim(),
      color: '#A855F7',
      icon: 'Sparkles',
    };
    onSubmit(persona);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.form
        onSubmit={submit}
        initial={{ y: 18, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 18, opacity: 0, scale: 0.98 }}
        className="glass relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a]/95 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight text-white">
            New Persona
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-white/40">
              Name
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Hermes"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-gold/50"
              required
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-white/40">
              Role
            </span>
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="e.g. Messenger, routing"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-gold/50"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-white/40">
              Model
            </span>
            <select
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-gold/50"
            >
              {MODELS.map((m) => (
                <option key={m} value={m} className="bg-[#0a0a0a]">
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-white/40">
              System Prompt
            </span>
            <textarea
              value={form.systemPrompt}
              onChange={(e) =>
                setForm({ ...form, systemPrompt: e.target.value })
              }
              rows={5}
              placeholder="You are..."
              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-gold/50"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-gold px-4 py-3 text-sm font-black text-black"
          >
            Save
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function SkillRow({ skill }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Code2 size={12} className="text-white/30" />
          <span className="truncate text-sm font-semibold text-white">
            {skill.name}
          </span>
        </div>
        {skill.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-white/50">
            {skill.description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-white/40">
        {skill.hasScripts && (
          <span title="scripts" className="rounded bg-white/5 px-1.5 py-0.5">
            S
          </span>
        )}
        {skill.hasReferences && (
          <span title="references" className="rounded bg-white/5 px-1.5 py-0.5">
            R
          </span>
        )}
        {skill.hasAssets && (
          <span title="assets" className="rounded bg-white/5 px-1.5 py-0.5">
            A
          </span>
        )}
        <span className="ml-1 font-mono text-white/60">
          {skill.fileCount}
        </span>
      </div>
    </div>
  );
}

function CategoryAccordion({ name, skills, isOpen, onToggle }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown size={16} className="text-white/40" />
          ) : (
            <ChevronRight size={16} className="text-white/40" />
          )}
          <Folder size={16} className="text-gold/80" />
          <span className="text-sm font-bold uppercase tracking-wider text-white">
            {name}
          </span>
        </div>
        <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60">
          {skills.length}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="space-y-2 p-3">
              {skills.map((s) => (
                <SkillRow key={s.path || s.name} skill={s} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Pantheon = () => {
  const [personas, setPersonas] = useState([]);
  const [registry, setRegistry] = useState({
    categories: {},
    totalCount: 0,
    totalCategories: 0,
  });
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchPersonas();
        if (!mounted) return;
        const remote = Array.isArray(data?.personas) ? data.personas : [];
        const local = loadLocalPersonas();
        setPersonas([...remote, ...local]);
      } catch (e) {
        if (mounted) setError(String(e.message || e));
      } finally {
        if (mounted) setLoadingPersonas(false);
      }
    })();
    (async () => {
      try {
        const data = await fetchSkillsRegistry();
        if (!mounted) return;
        setRegistry({
          categories: data?.categories || {},
          totalCount: data?.totalCount || 0,
          totalCategories: data?.totalCategories || 0,
        });
      } catch (e) {
        if (mounted) setError(String(e.message || e));
      } finally {
        if (mounted) setLoadingSkills(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const categoryEntries = useMemo(() => {
    const entries = Object.entries(registry.categories || {});
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [registry]);

  const handleAddPersona = (persona) => {
    saveLocalPersona(persona);
    setPersonas((prev) => [...prev, persona]);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 lg:px-8 lg:pt-10">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
              System // Pantheon
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-tighter italic lg:text-4xl">
              The <span className="text-gold">Pantheon</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/50">
              Personas you orchestrate and the skills they invoke.
            </p>
          </div>
        </div>

        {/* Personas */}
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">
              Personas
            </h2>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-purple/40 bg-purple/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-purple-300 hover:bg-purple/20"
              style={{ color: '#C4B5FD' }}
            >
              <Plus size={14} />
              New Persona
            </button>
          </div>

          {loadingPersonas ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]"
                />
              ))}
            </div>
          ) : personas.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
              No personas yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {personas.map((p) => (
                <PersonaCard key={p.id || p.name} persona={p} />
              ))}
            </div>
          )}
        </section>

        {/* Skills */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">
              Skills Registry
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              {registry.totalCount} skills · {registry.totalCategories} categories
            </span>
          </div>

          {loadingSkills ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]"
                />
              ))}
            </div>
          ) : categoryEntries.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
              Skills registry is empty or unreachable.
            </div>
          ) : (
            <div className="space-y-3">
              {categoryEntries.map(([name, skills]) => (
                <CategoryAccordion
                  key={name}
                  name={name}
                  skills={skills}
                  isOpen={openCategory === name}
                  onToggle={() =>
                    setOpenCategory((cur) => (cur === name ? null : name))
                  }
                />
              ))}
            </div>
          )}
        </section>

        {error && (
          <p className="mt-6 text-xs text-red-400/80">Warning: {error}</p>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <NewPersonaModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSubmit={handleAddPersona}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Pantheon;
