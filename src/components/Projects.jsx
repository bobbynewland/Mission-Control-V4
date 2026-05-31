import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  FolderOpen,
  Key,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
  Clock,
} from 'lucide-react';
import { database, ref, push, update, remove, onValue } from '../lib/firebase';
import { confirmAction } from '../lib/dialogs';

const PROJECTS_PATH = 'workspaces/winslow_main/projects';
const EMPTY_FORM = {
  name: '',
  type: '',
  status: 'active',
  priority: 'medium',
  url: '',
  description: '',
  targetUsers: '',
  revenueModel: '',
  features: [],
  techStack: '',
  milestones: [],
  apiKeys: [],
  notes: [],
};

const DEFAULT_PROJECTS = [
  {
    id: 'indie-artist-route-planner',
    name: 'Indie Artist AI Route Planner',
    type: 'SaaS',
    status: 'active',
    priority: 'high',
    url: '',
    description:
      'Free branded web app for pro members that turns Spotify audience data into a smart radio and promo route plan. Upload Spotify analytics, confirm listener markets, add preferences, and get AI-scored city recommendations with route options.',
    targetUsers: 'Indie artists',
    revenueModel: 'Free for Pro members',
    features: [
      'Spotify screenshot upload & city extraction',
      'City confirmation/editing interface',
      'Custom preferences (home city, genre, route goal, budget)',
      'Radio station matching by market',
      'City scoring algorithm',
      '3/5/7 stop route generation',
      'Results dashboard with maps',
    ],
    techStack: 'Next.js + Tailwind, Supabase, AI layer, Maps/Geocoding',
    milestones: [
      { text: 'Core flow (upload → extract → confirm → route)', status: 'pending' },
      { text: 'Radio station database', status: 'pending' },
      { text: 'UI polish (cards, map, design)', status: 'pending' },
    ],
    notes: [],
  },
  {
    id: 'mission-control-v3',
    name: 'Mission Control V3',
    type: 'SaaS',
    status: 'active',
    priority: 'high',
    url: 'https://mission-control-v3-pearl.vercel.app',
    description: 'Main productivity dashboard with Kanban, Calendar, Notes, and AI features',
    targetUsers: 'Internal team',
    revenueModel: 'Internal tool',
    features: ['Kanban tasks', 'Calendar', 'Notes', 'AI features'],
    techStack: 'Vite + React + Tailwind + Firebase',
    milestones: [],
    apiKeys: [],
    notes: [
      { date: '2026-03-05', text: 'Fixed save button z-index for mobile, added slide-up modal' },
      { date: '2026-03-04', text: 'Added ContentCalendar component for social media scheduling' },
    ],
  },
  {
    id: 'framelens-media',
    name: 'Framelens Media',
    type: 'Website',
    status: 'active',
    url: 'https://framelens-media.vercel.app',
    description: 'Video production company website',
    apiKeys: [],
    notes: [{ date: '2026-03-04', text: 'Updated portfolio gallery' }],
  },
  {
    id: 'ai-skills-studio',
    name: 'AI Skills Studio',
    type: 'Platform',
    status: 'active',
    url: 'https://aiskills.studio',
    description: 'All-in-one platform for entrepreneurs to launch businesses with AI',
    apiKeys: [],
    notes: [{ date: '2026-03-05', text: 'Template pack system live' }],
  },
];

const todayStamp = () => new Date().toISOString().split('T')[0];
const isoNow = () => new Date().toISOString();

const normalizeProject = (project) => {
  const archived = Boolean(project.archived) || project.status === 'archived' || Boolean(project.archivedAt);
  // Defensive: coerce all array fields to actual arrays (Firebase can store objects)
  const toArray = (val) => Array.isArray(val) ? val : (val ? Object.values(val) : []);
  return {
    ...project,
    status: archived ? 'archived' : project.status || 'active',
    priority: project.priority || 'medium',
    features: toArray(project.features),
    milestones: toArray(project.milestones),
    apiKeys: toArray(project.apiKeys),
    notes: toArray(project.notes),
    archived,
  };
};

const sortProjects = (items) =>
  [...items].sort((a, b) => {
    const aUpdated = a.updatedAt || a.createdAt || '';
    const bUpdated = b.updatedAt || b.createdAt || '';
    return bUpdated.localeCompare(aUpdated) || (a.name || '').localeCompare(b.name || '');
  });

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState('active');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [newNote, setNewNote] = useState('');
  const [newApiKey, setNewApiKey] = useState({ name: '', value: '' });
  const [newFeature, setNewFeature] = useState('');
  const [newMilestone, setNewMilestone] = useState('');

  useEffect(() => {
    const projectsRef = ref(database, PROJECTS_PATH);
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const projectList = Object.entries(data).map(([id, project]) => normalizeProject({ id, ...project }));
        setProjects(projectList.length > 0 ? sortProjects(projectList) : sortProjects(DEFAULT_PROJECTS.map(normalizeProject)));
      } else {
        setProjects(sortProjects(DEFAULT_PROJECTS.map(normalizeProject)));
      }
    });
    return () => unsubscribe();
  }, []);

  const projectCounts = useMemo(() => {
    const archived = projects.filter((project) => project.archived).length;
    const completed = projects.filter((project) => !project.archived && project.status === 'completed').length;
    return {
      total: projects.length,
      archived,
      completed,
      visible: projects.length - archived,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sortProjects(
      projects.filter((project) => {
        const matchesView = view === 'archived' ? project.archived : !project.archived;
        const matchesSearch =
          !query ||
          project.name?.toLowerCase().includes(query) ||
          project.type?.toLowerCase().includes(query) ||
          project.description?.toLowerCase().includes(query);

        return matchesView && matchesSearch;
      })
    );
  }, [projects, searchQuery, view]);

  const statusColors = {
    active: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-blue-500/20 text-blue-400',
    archived: 'bg-white/10 text-white/60',
  };

  const priorityColors = {
    low: 'bg-blue-500/20 text-blue-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-orange-500/20 text-orange-400',
    urgent: 'bg-red-500/20 text-red-400',
  };

  const resetEditor = () => {
    setSelectedProject(null);
    setFormData(EMPTY_FORM);
    setNewNote('');
    setNewApiKey({ name: '', value: '' });
    setNewFeature('');
    setNewMilestone('');
  };

  const closeEditor = () => {
    setShowForm(false);
    resetEditor();
  };

  const buildProjectPayload = (base = {}) => ({
    ...base,
    ...formData,
    archived: Boolean(base.archived ?? formData.archived),
    archivedAt: base.archivedAt ?? formData.archivedAt ?? null,
    restoredAt: base.restoredAt ?? formData.restoredAt ?? null,
    previousStatus: base.previousStatus ?? formData.previousStatus ?? null,
    updatedAt: isoNow(),
  });

  const updateCurrentProject = async (patch) => {
    if (!selectedProject?.id) return;
    const next = normalizeProject({ ...selectedProject, ...patch });
    setSelectedProject(next);
    setFormData((prev) => ({ ...prev, ...patch }));
    await update(ref(database, `${PROJECTS_PATH}/${selectedProject.id}`), patch);
  };

  const handleSave = async () => {
    const projectData = buildProjectPayload();

    if (selectedProject?.id) {
      await update(ref(database, `${PROJECTS_PATH}/${selectedProject.id}`), projectData);
    } else {
      const newRef = push(ref(database, PROJECTS_PATH));
      await update(newRef, {
        ...projectData,
        id: newRef.key,
        createdAt: isoNow(),
        archived: false,
        archivedAt: null,
        restoredAt: null,
        previousStatus: null,
      });
    }

    closeEditor();
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const note = { date: todayStamp(), text: newNote.trim() };
    const updatedNotes = [note, ...(formData.notes || [])];
    setFormData((prev) => ({ ...prev, notes: updatedNotes }));
    setNewNote('');
    if (selectedProject?.id) await updateCurrentProject({ notes: updatedNotes });
  };

  const handleDeleteNote = async (index) => {
    const updatedNotes = formData.notes.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, notes: updatedNotes }));
    if (selectedProject?.id) await updateCurrentProject({ notes: updatedNotes });
  };

  const handleAddApiKey = async () => {
    if (!newApiKey.name.trim() || !newApiKey.value.trim()) return;
    const updatedKeys = [...(formData.apiKeys || []), { name: newApiKey.name.trim(), value: newApiKey.value.trim() }];
    setFormData((prev) => ({ ...prev, apiKeys: updatedKeys }));
    setNewApiKey({ name: '', value: '' });
    if (selectedProject?.id) await updateCurrentProject({ apiKeys: updatedKeys });
  };

  const handleDeleteApiKey = async (index) => {
    const updatedKeys = formData.apiKeys.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, apiKeys: updatedKeys }));
    if (selectedProject?.id) await updateCurrentProject({ apiKeys: updatedKeys });
  };

  const handleAddFeature = async () => {
    if (!newFeature.trim()) return;
    const updatedFeatures = [...(formData.features || []), newFeature.trim()];
    setFormData((prev) => ({ ...prev, features: updatedFeatures }));
    setNewFeature('');
    if (selectedProject?.id) await updateCurrentProject({ features: updatedFeatures });
  };

  const handleDeleteFeature = async (index) => {
    const updatedFeatures = formData.features.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, features: updatedFeatures }));
    if (selectedProject?.id) await updateCurrentProject({ features: updatedFeatures });
  };

  const handleAddMilestone = async () => {
    if (!newMilestone.trim()) return;
    const milestone = { text: newMilestone.trim(), status: 'pending' };
    const updatedMilestones = [...(formData.milestones || []), milestone];
    setFormData((prev) => ({ ...prev, milestones: updatedMilestones }));
    setNewMilestone('');
    if (selectedProject?.id) await updateCurrentProject({ milestones: updatedMilestones });
  };

  const handleDeleteMilestone = async (index) => {
    const updatedMilestones = formData.milestones.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, milestones: updatedMilestones }));
    if (selectedProject?.id) await updateCurrentProject({ milestones: updatedMilestones });
  };

  const handleToggleMilestone = async (index) => {
    const updatedMilestones = formData.milestones.map((milestone, i) =>
      i === index
        ? { ...milestone, status: milestone.status === 'completed' ? 'pending' : 'completed' }
        : milestone
    );
    setFormData((prev) => ({ ...prev, milestones: updatedMilestones }));
    if (selectedProject?.id) await updateCurrentProject({ milestones: updatedMilestones });
  };

  const openProject = (project) => {
    const normalized = normalizeProject(project);
    // Belt-and-suspenders: coerce arrays even after normalizeProject (handles edge cases)
    const toArray = (val) => Array.isArray(val) ? val : (val ? Object.values(val) : []);
    setSelectedProject(normalized);
    setFormData({
      name: normalized.name || '',
      type: normalized.type || '',
      status: normalized.status || 'active',
      priority: normalized.priority || 'medium',
      url: normalized.url || '',
      description: normalized.description || '',
      targetUsers: normalized.targetUsers || '',
      revenueModel: normalized.revenueModel || '',
      features: toArray(normalized.features),
      techStack: normalized.techStack || '',
      milestones: toArray(normalized.milestones),
      apiKeys: toArray(normalized.apiKeys),
      notes: toArray(normalized.notes),
      archived: normalized.archived || false,
      archivedAt: normalized.archivedAt || null,
      restoredAt: normalized.restoredAt || null,
      previousStatus: normalized.previousStatus || null,
    });
    setShowForm(true);
  };

  const archiveProject = async (project) => {
    const normalized = normalizeProject(project);
    if (normalized.archived) return;
    const confirmed = await confirmAction(`Archive "${normalized.name}"? It will disappear from the main project list until restored.`, {
      title: 'Archive Project',
      confirmLabel: 'Archive'
    });
    if (!confirmed) return;

    const patch = {
      archived: true,
      status: 'archived',
      archivedAt: isoNow(),
      previousStatus: normalized.status === 'archived' ? normalized.previousStatus || 'completed' : normalized.status || 'completed',
      updatedAt: isoNow(),
    };

    await update(ref(database, `${PROJECTS_PATH}/${normalized.id}`), patch);

    if (selectedProject?.id === normalized.id) {
      setSelectedProject((prev) => normalizeProject({ ...prev, ...patch }));
      setFormData((prev) => ({ ...prev, ...patch }));
    }

    if (view !== 'archived') setShowForm(false);
  };

  const restoreProject = async (project) => {
    const normalized = normalizeProject(project);
    const restoreStatus = normalized.previousStatus && normalized.previousStatus !== 'archived'
      ? normalized.previousStatus
      : 'completed';

    const patch = {
      archived: false,
      status: restoreStatus,
      restoredAt: isoNow(),
      updatedAt: isoNow(),
    };

    await update(ref(database, `${PROJECTS_PATH}/${normalized.id}`), patch);

    if (selectedProject?.id === normalized.id) {
      setSelectedProject((prev) => normalizeProject({ ...prev, ...patch }));
      setFormData((prev) => ({ ...prev, ...patch }));
    }
  };

  const permanentlyDeleteProject = async (project) => {
    const normalized = normalizeProject(project);
    if (!normalized.archived) return;

    const first = await confirmAction(`Permanently delete "${normalized.name}"? This cannot be undone.`, {
      title: 'Delete Forever',
      confirmLabel: 'Continue',
      tone: 'danger'
    });
    if (!first) return;
    const second = await confirmAction('Last check: permanently delete this archived project forever?', {
      title: 'Final Confirmation',
      confirmLabel: 'Delete Forever',
      tone: 'danger'
    });
    if (!second) return;

    await remove(ref(database, `${PROJECTS_PATH}/${normalized.id}`));

    if (selectedProject?.id === normalized.id) {
      closeEditor();
    }
  };

  const createNewProject = () => {
    resetEditor();
    setShowForm(true);
  };

  const currentProject = selectedProject ? normalizeProject(selectedProject) : null;
  const isArchivedView = view === 'archived';
  const canArchiveCurrentProject = currentProject && !currentProject.archived && formData.status === 'completed';

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">
            <span className="text-gold">Projects</span>
          </h2>
          <p className="text-white/40 text-sm">
            {projectCounts.visible} live • {projectCounts.archived} archived • {projectCounts.completed} completed
          </p>
        </div>
        <button onClick={createNewProject} className="p-3 bg-gold text-black rounded-xl font-bold">
          <Plus size={20} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setView('active')}
          className={`rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
            !isArchivedView ? 'border-gold/40 bg-gold/10 text-gold' : 'border-white/10 bg-white/5 text-white/60'
          }`}
        >
          Main Projects ({projectCounts.visible})
        </button>
        <button
          onClick={() => setView('archived')}
          className={`rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
            isArchivedView ? 'border-gold/40 bg-gold/10 text-gold' : 'border-white/10 bg-white/5 text-white/60'
          }`}
        >
          Archived ({projectCounts.archived})
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isArchivedView ? 'Search archived projects...' : 'Search projects...'}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
        />
      </div>

      <div className="grid gap-3">
        {filteredProjects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/50">
              {isArchivedView ? <Archive size={20} /> : <FolderOpen size={20} />}
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">
              {isArchivedView ? 'No archived projects' : 'No matching projects'}
            </h3>
            <p className="mt-2 text-sm text-white/50">
              {isArchivedView
                ? 'Archive completed work to keep the main list clean without losing history.'
                : 'Try a different search or create a new project.'}
            </p>
          </div>
        )}

        {filteredProjects.map((project) => {
          const completedMilestones = (project.milestones || []).filter((milestone) => milestone.status === 'completed').length;
          const totalMilestones = project.milestones?.length || 0;

          return (
            <div
              key={project.id}
              onClick={() => openProject(project)}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-gold/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-white">{project.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${statusColors[project.status] || statusColors.active}`}>
                      {project.status}
                    </span>
                    {project.archived && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold bg-white/10 text-white/60">
                        Archived
                      </span>
                    )}
                    {project.priority && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${priorityColors[project.priority] || priorityColors.medium}`}>
                        {project.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs mb-2">{project.type || 'Project'}</p>
                  <p className="text-white/60 text-sm line-clamp-2">{project.description}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
                    {totalMilestones > 0 && (
                      <span className="rounded-full bg-white/5 px-2 py-1">
                        {completedMilestones}/{totalMilestones} milestones done
                      </span>
                    )}
                    {project.updatedAt && (
                      <span className="rounded-full bg-white/5 px-2 py-1">Updated {project.updatedAt.slice(0, 10)}</span>
                    )}
                    {project.archivedAt && isArchivedView && (
                      <span className="rounded-full bg-white/5 px-2 py-1">Archived {project.archivedAt.slice(0, 10)}</span>
                    )}
                  </div>

                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-gold text-xs mt-3 hover:underline"
                    >
                      <ExternalLink size={12} /> {project.url.replace('https://', '')}
                    </a>
                  )}
                </div>
                <ChevronRight className="text-white/30 shrink-0" size={20} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                {!project.archived && project.status === 'completed' && (
                  <button
                    onClick={() => archiveProject(project)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gold"
                  >
                    <Archive size={12} /> Archive
                  </button>
                )}
                {project.archived && (
                  <>
                    <button
                      onClick={() => restoreProject(project)}
                      className="inline-flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-green-400"
                    >
                      <RotateCcw size={12} /> Restore
                    </button>
                    <button
                      onClick={() => permanentlyDeleteProject(project)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-400"
                    >
                      <Trash2 size={12} /> Delete Forever
                    </button>
                  </>
                )}
              </div>

              {project.notes?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Latest Update</p>
                  <p className="text-xs text-white/50">• {project.notes[0]?.text}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]" onClick={closeEditor} />
          <div className="fixed left-0 right-0 top-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] bg-[#0f0f0f] rounded-t-3xl sm:rounded-[2rem] z-[110] flex flex-col border border-white/10 sm:left-4 sm:right-4 sm:top-20 sm:bottom-4">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] flex-shrink-0 gap-3 pt-[max(1rem,env(safe-area-inset-top,1rem))] sm:pt-4">
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <button onClick={closeEditor} className="p-2 -ml-2 text-white/40 hover:text-gold transition-colors shrink-0">
                  <ChevronLeft size={24} />
                </button>
                <div className="min-w-0">
                  <h3 className="text-lg font-black italic uppercase tracking-tight text-white truncate">
                    {currentProject ? '✏️ Edit' : '➕ New'} <span className="text-gold">Project</span>
                  </h3>
                  {currentProject?.archivedAt && (
                    <p className="text-xs text-white/40 mt-1">Archived {currentProject.archivedAt.slice(0, 10)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {currentProject?.archived && (
                  <button
                    onClick={() => restoreProject(currentProject)}
                    className="inline-flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-green-400"
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                )}
                <button onClick={closeEditor} className="p-2 text-white/40 hover:text-white flex-shrink-0">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-6 overscroll-contain max-w-full overflow-x-hidden">
              <div className="space-y-4 max-w-full overflow-x-hidden">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 ml-1">Project Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Awesome Project"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-full overflow-hidden">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 ml-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-gold/50"
                    >
                      <option value="">Select type...</option>
                      <option value="SaaS">SaaS</option>
                      <option value="Website">Website</option>
                      <option value="Platform">Platform</option>
                      <option value="Agency">Agency</option>
                      <option value="Content">Content</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 ml-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-gold/50"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                {formData.status === 'completed' && !currentProject?.archived && (
                  <div className="rounded-xl border border-gold/20 bg-gold/5 p-3 text-sm text-white/70">
                    Completed project. Save it, then archive it to clear the main view without losing the record.
                  </div>
                )}

                {currentProject?.archived && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                    This project is archived. Restore it to bring it back into the main projects view.
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 ml-1">URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 ml-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What does this project do?"
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-white/30 focus:outline-none focus:border-gold/50 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-full overflow-hidden">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 ml-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-gold/50"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 ml-1">Target Users</label>
                    <input
                      type="text"
                      value={formData.targetUsers}
                      onChange={(e) => setFormData({ ...formData, targetUsers: e.target.value })}
                      placeholder="Who is this for?"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 ml-1">Revenue Model</label>
                  <input
                    type="text"
                    value={formData.revenueModel}
                    onChange={(e) => setFormData({ ...formData, revenueModel: e.target.value })}
                    placeholder="e.g., Free for Pro, $29/mo, etc."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 ml-1">Tech Stack</label>
                  <input
                    type="text"
                    value={formData.techStack}
                    onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
                    placeholder="Next.js, Supabase, etc."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">🚀 Core Features</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFeature()}
                    placeholder="Add a feature..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                  />
                  <button onClick={handleAddFeature} className="p-2 bg-gold text-black rounded-xl">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.features || []).map((feature, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg p-3 gap-3">
                      <span className="text-sm text-white break-words">• {feature}</span>
                      <button onClick={() => handleDeleteFeature(i)} className="text-white/30 hover:text-red-400 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">🎯 Milestones</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMilestone}
                    onChange={(e) => setNewMilestone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMilestone()}
                    placeholder="Add a milestone..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                  />
                  <button onClick={handleAddMilestone} className="p-2 bg-gold text-black rounded-xl">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.milestones || []).map((milestone, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg p-3 gap-3">
                      <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => handleToggleMilestone(i)}>
                        <input
                          type="checkbox"
                          checked={milestone.status === 'completed'}
                          onChange={() => handleToggleMilestone(i)}
                          className="accent-gold"
                        />
                        <span className={`text-sm ${milestone.status === 'completed' ? 'text-white/40 line-through' : 'text-white'}`}>
                          {milestone.text}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteMilestone(i)} className="text-white/30 hover:text-red-400 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">🔑 API Keys</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newApiKey.name}
                    onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
                    placeholder="Key name"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                  />
                  <input
                    type="password"
                    value={newApiKey.value}
                    onChange={(e) => setNewApiKey({ ...newApiKey, value: e.target.value })}
                    placeholder="Value"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                  />
                  <button onClick={handleAddApiKey} className="p-2 bg-gold text-black rounded-xl">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.apiKeys || []).map((key, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg p-3 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Key size={14} className="text-gold shrink-0" />
                        <span className="text-sm text-white truncate">{key.name}</span>
                      </div>
                      <button onClick={() => handleDeleteApiKey(i)} className="text-white/30 hover:text-red-400 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">📝 Update Log</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Add an update..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50"
                  />
                  <button onClick={handleAddNote} className="p-2 bg-gold text-black rounded-xl">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(formData.notes || []).map((note, i) => (
                    <div key={i} className="flex items-start justify-between bg-white/5 rounded-lg p-3 gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Clock size={12} className="text-white/40 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] text-gold">{note.date}</span>
                          <p className="text-sm text-white/70 break-words">{note.text}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteNote(i)} className="text-white/30 hover:text-red-400 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 mt-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] bg-[#0f0f0f]/98 border-t border-white/10 z-10 space-y-2 backdrop-blur supports-[backdrop-filter]:bg-[#0f0f0f]/90">
              {currentProject && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {canArchiveCurrentProject && (
                    <button
                      onClick={() => archiveProject(currentProject)}
                      className="w-full py-3 rounded-lg border border-gold/30 bg-gold/10 text-gold font-bold uppercase tracking-wider text-sm"
                    >
                      🗃️ Archive Project
                    </button>
                  )}
                  {currentProject?.archived && (
                    <>
                      <button
                        onClick={() => restoreProject(currentProject)}
                        className="w-full py-3 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 font-bold uppercase tracking-wider text-sm"
                      >
                        ♻️ Restore Project
                      </button>
                      <button
                        onClick={() => permanentlyDeleteProject(currentProject)}
                        className="w-full py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 font-bold uppercase tracking-wider text-sm"
                      >
                        ☠️ Delete Forever
                      </button>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={!formData.name}
                className="w-full py-3 bg-gold text-black font-bold uppercase tracking-wider rounded-lg text-sm disabled:opacity-30"
              >
                💾 {currentProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Projects;
