import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, Clapperboard, ExternalLink, FileText, Lightbulb, RefreshCw, Sparkles } from 'lucide-react';
import { database, ref, push, update, db } from '../lib/firebase';

const WORKFLOW_TYPE = 'script_ideas';
const NOTES_PATH = 'workspaces/winslow_main/notes';
const KNOWLEDGE_PATH = 'workspaces/winslow_main/knowledge';
const AGENT_TASKS_PATH = 'workspaces/winslow_main/agent_tasks';

const STAGES = {
  ideas_ready: { label: 'Ideas Ready', badge: 'bg-blue-500/15 text-blue-300 border-blue-400/20' },
  selected_for_development: { label: 'Selected', badge: 'bg-gold/15 text-gold border-gold/20' },
  developing_script: { label: 'Developing', badge: 'bg-purple-500/15 text-purple-300 border-purple-400/20' },
  script_ready: { label: 'Script Ready', badge: 'bg-green-500/15 text-green-300 border-green-400/20' }
};

const getWorkflowType = (item) => item?.workflowType || item?.workflow_type || item?.kind || item?.type;
const isScriptWorkflow = (item) => getWorkflowType(item) === WORKFLOW_TYPE;

const normalizeIdea = (idea, index, item) => ({
  id: idea?.id || `idea-${index + 1}`,
  rank: idea?.rank || index + 1,
  title: idea?.title || idea?.name || `Idea ${index + 1}`,
  hook: idea?.hook || idea?.summary || idea?.logline || '',
  concept: idea?.concept || idea?.description || idea?.body || '',
  mood: idea?.mood || '',
  status: idea?.status || 'idea',
  noteId: idea?.noteId || idea?.note_id || null,
  knowledgeId: idea?.knowledgeId || idea?.knowledge_id || null,
  script: idea?.script || idea?.fullScript || idea?.full_script || null,
  shotList: idea?.shotList || idea?.shot_by_shot || idea?.shots || idea?.promptPack || null,
  prompt: idea?.prompt || idea?.developmentPrompt || idea?.prompt_text || '',
  updatedAt: idea?.updatedAt || item?.updatedAt || item?.createdAt || null,
  raw: idea
});

const formatIdeaContent = (item, idea) => {
  const workflowTitle = item?.title || 'Daily Short Film Ideas';
  const lines = [
    `Workflow: ${workflowTitle}`,
    `Idea #${idea.rank}: ${idea.title}`,
    '',
  ];

  if (idea.hook) lines.push(`Hook: ${idea.hook}`, '');
  if (idea.concept) lines.push(idea.concept, '');
  if (idea.mood) lines.push(`Mood: ${idea.mood}`, '');
  lines.push(`Status: ${idea.status}`);

  if (idea.script) {
    lines.push('', '## Developed Script', typeof idea.script === 'string' ? idea.script : JSON.stringify(idea.script, null, 2));
  }

  if (idea.shotList) {
    lines.push('', '## Shot-by-shot prompts', typeof idea.shotList === 'string' ? idea.shotList : JSON.stringify(idea.shotList, null, 2));
  }

  if (idea.prompt) {
    lines.push('', '## Development prompt', idea.prompt);
  }

  return lines.join('\n');
};

const buildIdeaUpdate = (idea, status, extra = {}) => ({
  ...idea.raw,
  id: idea.id,
  rank: idea.rank,
  title: idea.title,
  hook: idea.hook,
  concept: idea.concept,
  mood: idea.mood,
  status,
  noteId: extra.noteId || idea.noteId || null,
  knowledgeId: extra.knowledgeId || idea.knowledgeId || null,
  updatedAt: new Date().toISOString(),
  ...extra
});

const stageFromItem = (item, selectedIdea) => {
  if (selectedIdea?.script || selectedIdea?.shotList) return 'script_ready';
  if (item?.stage === 'script_ready') return 'script_ready';
  if (item?.stage === 'developing_script') return 'developing_script';
  if (item?.selectedIdeaId || item?.selected_idea_id) return 'selected_for_development';
  return 'ideas_ready';
};

const IdeaCard = ({ idea, isSelected, isReference, onDevelop, disabled }) => (
  <div className={`rounded-2xl border p-4 ${isSelected ? 'border-gold/40 bg-gold/10' : 'border-white/10 bg-white/5'}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Idea {idea.rank}</span>
          {isSelected && <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gold">Selected</span>}
          {isReference && <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Reference</span>}
        </div>
        <h4 className="text-base font-black text-white">{idea.title}</h4>
      </div>
      {idea.script || idea.shotList ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-green-400/20 bg-green-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-green-300">
          <Check size={12} /> Ready
        </span>
      ) : null}
    </div>

    {idea.hook ? <p className="mt-2 text-sm text-white/80">{idea.hook}</p> : null}
    {idea.concept ? <p className="mt-2 text-sm text-white/55 whitespace-pre-wrap">{idea.concept}</p> : null}
    {idea.mood ? <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/35">{idea.mood}</p> : null}

    <div className="mt-4 flex flex-wrap gap-2">
      <button
        onClick={onDevelop}
        disabled={disabled}
        className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${disabled ? 'cursor-not-allowed bg-white/5 text-white/25' : isSelected ? 'bg-gold text-black' : 'bg-white/10 text-white hover:bg-white/15'}`}
      >
        {idea.script || idea.shotList ? 'Re-open development' : isSelected ? 'Developing this one' : 'Develop this one'}
      </button>
    </div>
  </div>
);

const ScriptIdeaWorkflows = ({ queue, setQueue }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [busyIdeaId, setBusyIdeaId] = useState(null);

  const workflows = useMemo(
    () => queue.filter(isScriptWorkflow).map((item) => {
      const ideas = (item?.ideas || item?.scriptIdeas || []).map((idea, index) => normalizeIdea(idea, index, item));
      const selectedIdeaId = item?.selectedIdeaId || item?.selected_idea_id || null;
      const selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId) || null;
      return { ...item, ideas, selectedIdeaId, selectedIdea, uiStage: stageFromItem(item, selectedIdea) };
    }),
    [queue]
  );

  const patchWorkflow = async (itemId, patch) => {
    await update(ref(database, `workspaces/winslow_main/approvalQueue/${itemId}`), patch);
  };

  const syncIdeaRecord = async (item, idea, nextStatus) => {
    const content = formatIdeaContent(item, { ...idea, status: nextStatus });
    let noteId = idea.noteId;
    let knowledgeId = idea.knowledgeId;

    const notePayload = {
      title: `${idea.title}`,
      content,
      type: 'idea',
      workflowType: WORKFLOW_TYPE,
      workflowId: item.id,
      ideaId: idea.id,
      status: nextStatus,
      updated: new Date().toISOString(),
      created: idea.raw?.created || new Date().toISOString()
    };

    if (noteId) {
      await db.notes.updateNote(noteId, notePayload);
    } else {
      const noteRef = push(ref(database, NOTES_PATH));
      noteId = noteRef.key;
      await update(noteRef, notePayload);
    }

    const knowledgePayload = {
      title: `${idea.title}`,
      type: 'notes',
      category: 'reference',
      content,
      tags: ['script-idea', item.id, nextStatus].filter(Boolean).join(','),
      workflowType: WORKFLOW_TYPE,
      workflowId: item.id,
      ideaId: idea.id,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      createdAt: idea.raw?.createdAt || new Date().toISOString()
    };

    if (knowledgeId) {
      await db.knowledge.update(knowledgeId, knowledgePayload);
    } else {
      const knowledgeRef = push(ref(database, KNOWLEDGE_PATH));
      knowledgeId = knowledgeRef.key;
      await update(knowledgeRef, knowledgePayload);
    }

    return { noteId, knowledgeId };
  };

  const queueDevelopmentTask = async (item, idea) => {
    const taskRef = push(ref(database, AGENT_TASKS_PATH));
    await update(taskRef, {
      type: 'script-workflow.develop-idea',
      status: 'queued',
      createdAt: Date.now(),
      workflowType: WORKFLOW_TYPE,
      workflowId: item.id,
      workflowTitle: item.title || 'Daily Short Film Ideas',
      ideaId: idea.id,
      selectedIdea: {
        id: idea.id,
        rank: idea.rank,
        title: idea.title,
        hook: idea.hook,
        concept: idea.concept,
        mood: idea.mood,
        prompt: idea.prompt,
        script: idea.script,
        shotList: idea.shotList
      },
      instructions: 'Expand the selected short-film idea into a full shot-by-shot prompt workflow while keeping the other ideas as references.'
    });
  };

  const handleDevelop = async (item, idea) => {
    setBusyIdeaId(`${item.id}:${idea.id}`);
    try {
      const nextIdeas = [];
      for (const candidate of item.ideas) {
        const nextStatus = candidate.id === idea.id ? (candidate.script || candidate.shotList ? 'selected' : 'developing') : 'reference';
        const refs = await syncIdeaRecord(item, candidate, nextStatus);
        nextIdeas.push(buildIdeaUpdate(candidate, nextStatus, refs));
      }

      const selectedIdea = nextIdeas.find((candidate) => candidate.id === idea.id);
      const nextStage = selectedIdea?.script || selectedIdea?.shotList ? 'script_ready' : 'developing_script';
      const nextStatus = selectedIdea?.script || selectedIdea?.shotList ? 'needs_approval' : 'running';

      const patch = {
        workflowType: WORKFLOW_TYPE,
        stage: nextStage,
        status: nextStatus,
        selectedIdeaId: idea.id,
        selected_idea_id: idea.id,
        selectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ideas: nextIdeas
      };

      await patchWorkflow(item.id, patch);
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry));

      if (!(selectedIdea?.script || selectedIdea?.shotList)) {
        await queueDevelopmentTask(item, selectedIdea);
      }
    } finally {
      setBusyIdeaId(null);
    }
  };

  if (workflows.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black uppercase tracking-tight text-white">Short-Film Script Generator</h2>
        <p className="text-sm text-white/40">Three ideas in. One gets developed. The other two stay parked for reference.</p>
      </div>

      {workflows.map((item) => {
        const stage = STAGES[item.uiStage] || STAGES.ideas_ready;
        const isExpanded = expandedId === item.id;
        const selectedIdea = item.selectedIdea;

        return (
          <div key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <button
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 p-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
                    <Clapperboard size={12} /> Script workflow
                  </span>
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${stage.badge}`}>
                    {stage.label}
                  </span>
                </div>
                <h3 className="truncate text-base font-black text-white">{item.title || 'Daily Short Film Ideas'}</h3>
                <p className="mt-1 text-sm text-white/45">
                  {selectedIdea ? `Selected: ${selectedIdea.title}` : `${item.ideas.length} ideas ready to review`}
                </p>
              </div>
              <ChevronDown size={20} className={`text-white/35 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isExpanded ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/10"
                >
                  <div className="space-y-4 p-4">
                    {selectedIdea ? (
                      <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4">
                        <div className="mb-3 flex items-center gap-2 text-gold">
                          <Sparkles size={16} />
                          <span className="text-xs font-black uppercase tracking-[0.18em]">Chosen for development</span>
                        </div>
                        <IdeaCard
                          idea={selectedIdea}
                          isSelected
                          disabled={busyIdeaId === `${item.id}:${selectedIdea.id}`}
                          onDevelop={() => handleDevelop(item, selectedIdea)}
                        />

                        {selectedIdea.prompt ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Development prompt</p>
                            <p className="whitespace-pre-wrap text-sm text-white/70">{selectedIdea.prompt}</p>
                          </div>
                        ) : null}

                        {selectedIdea.script ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                              <FileText size={12} /> Full script
                            </p>
                            <p className="whitespace-pre-wrap text-sm text-white/75">{typeof selectedIdea.script === 'string' ? selectedIdea.script : JSON.stringify(selectedIdea.script, null, 2)}</p>
                          </div>
                        ) : null}

                        {selectedIdea.shotList ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                              <Clapperboard size={12} /> Shot-by-shot prompts
                            </p>
                            <p className="whitespace-pre-wrap text-sm text-white/75">{typeof selectedIdea.shotList === 'string' ? selectedIdea.shotList : JSON.stringify(selectedIdea.shotList, null, 2)}</p>
                          </div>
                        ) : (
                          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/55">
                            <RefreshCw size={14} className={busyIdeaId === `${item.id}:${selectedIdea.id}` ? 'animate-spin text-gold' : ''} />
                            {busyIdeaId === `${item.id}:${selectedIdea.id}` ? 'Queueing script development…' : 'Shot-by-shot prompts will show here once the agent writes them back.'}
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div>
                      <div className="mb-3 flex items-center gap-2 text-white/45">
                        <Lightbulb size={16} />
                        <span className="text-xs font-black uppercase tracking-[0.18em]">Idea bank</span>
                      </div>
                      <div className="space-y-3">
                        {item.ideas.map((idea) => (
                          <IdeaCard
                            key={idea.id}
                            idea={idea}
                            isSelected={item.selectedIdeaId === idea.id}
                            isReference={Boolean(item.selectedIdeaId && item.selectedIdeaId !== idea.id)}
                            disabled={busyIdeaId === `${item.id}:${idea.id}`}
                            onDevelop={() => handleDevelop(item, idea)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                      <p className="font-bold text-white/75">Manual follow-up later works the same way.</p>
                      <p className="mt-1">If Bobby comes back and says “develop this one,” tap that idea’s button again. The workflow keeps the unused ideas parked as references.</p>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

export { isScriptWorkflow };
export default ScriptIdeaWorkflows;
