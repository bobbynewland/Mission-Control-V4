import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X, FileText, CheckSquare, Database } from 'lucide-react';
import { database, ref, get } from '../lib/firebase';

const UnifiedSearch = ({ onNavigate, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ tasks: [], notes: [], memories: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    const q = query.toLowerCase();

    try {
      // 1) Quick Capture local search
      const captures = JSON.parse(localStorage.getItem('quick_capture') || '[]');
      const captureTaskResults = captures.filter(t =>
        t.type === 'task' && String(t.content || '').toLowerCase().includes(q)
      ).slice(0, 5);
      const noteResults = captures.filter(n =>
        (n.type === 'note' || n.type === 'idea') && String(n.content || '').toLowerCase().includes(q)
      ).slice(0, 6);

      // 2) Firebase Kanban tasks
      const taskSnap = await get(ref(database, 'workspaces/winslow_main/tasks'));
      const taskData = taskSnap.exists() ? taskSnap.val() : {};
      const firebaseTasks = Object.entries(taskData)
        .filter(([, t]) => {
          const hay = `${t?.title || ''} ${t?.description || ''} ${(t?.tags || []).join(' ')}`.toLowerCase();
          return hay.includes(q);
        })
        .slice(0, 8)
        .map(([id, t]) => ({
          id,
          type: 'task',
          content: t?.title || 'Untitled task',
          description: t?.description || '',
          created: t?.createdAt || Date.now(),
          column: t?.column || 'todo',
          source: 'kanban',
        }));

      // 3) Memory index API (best effort)
      let memoryResults = [];
      try {
        const res = await fetch(`/api/memory-search?q=${encodeURIComponent(query)}&topK=5`, { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data?.results) {
          memoryResults = data.results.slice(0, 5).map((r) => ({
            preview: r.text || r.preview || r.chunk || 'Memory result',
            file: r.path || r.source || 'memory',
          }));
        }
      } catch {
        // ignore memory search failures
      }

      setResults({
        tasks: [...firebaseTasks, ...captureTaskResults].slice(0, 10),
        notes: noteResults,
        memories: memoryResults,
        files: [],
      });
    } catch {
      setResults({ tasks: [], notes: [], memories: [], files: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') search();
  };

  const getIcon = (type) => {
    switch(type) {
      case 'task': return <CheckSquare size={14} className="text-green-400" />;
      case 'note': return <FileText size={14} className="text-blue-400" />;
      case 'idea': return <span className="text-yellow-400 text-xs">💡</span>;
      default: return <FileText size={14} className="text-white/40" />;
    }
  };

  const totalResults = results.tasks.length + results.notes.length + results.memories.length + results.files.length;

  const openResult = (item, section) => {
    if (section === 'tasks' && item?.id) {
      localStorage.setItem('mc3_open_task_id', item.id);
      onNavigate?.('tasks');
      onClose?.();
      return;
    }

    if (section === 'notes') {
      localStorage.setItem('mc3_search_focus_note', item?.content || '');
      onNavigate?.('capture');
      onClose?.();
      return;
    }

    if (section === 'memories') {
      localStorage.setItem('mc3_search_focus_memory', item?.file || '');
      onNavigate?.('memory');
      onClose?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Search tasks, notes, memories..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-12 text-white placeholder-white/40 focus:outline-none focus:border-gold/50"
              autoFocus
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults({tasks:[],notes:[],memories:[],files:[]}); setSearched(false); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {searched && !loading && (
            <div className="space-y-4">
              {totalResults > 0 ? (
                <>
                  <p className="text-xs text-white/40 uppercase tracking-wider">
                    {totalResults} result{totalResults !== 1 ? 's' : ''} found
                  </p>

                  {/* Tasks */}
                  {results.tasks.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-2">
                        <CheckSquare size={12} /> Tasks
                      </h3>
                      {results.tasks.map((task, i) => (
                        <button
                          key={task.id || i}
                          onClick={() => openResult(task, 'tasks')}
                          className="w-full text-left p-3 bg-white/5 border border-white/10 rounded-xl hover:border-gold/40 hover:bg-white/10 transition-all"
                        >
                          <p className="text-sm text-white">{task.content}</p>
                          <p className="text-xs text-white/30 mt-1">
                            {new Date(task.created).toLocaleDateString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Notes & Ideas */}
                  {results.notes.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                        <FileText size={12} /> Notes & Ideas
                      </h3>
                      {results.notes.map((note, i) => (
                        <button
                          key={i}
                          onClick={() => openResult(note, 'notes')}
                          className="w-full text-left p-3 bg-white/5 border border-white/10 rounded-xl hover:border-gold/40 hover:bg-white/10 transition-all"
                        >
                          <div className="flex items-start gap-2">
                            {getIcon(note.type)}
                            <p className="text-sm text-white">{note.content}</p>
                          </div>
                          <p className="text-xs text-white/30 mt-1">
                            {new Date(note.created).toLocaleDateString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Memories */}
                  {results.memories.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                        <Database size={12} /> Memory
                      </h3>
                      {results.memories.map((mem, i) => (
                        <button
                          key={i}
                          onClick={() => openResult(mem, 'memories')}
                          className="w-full text-left p-3 bg-white/5 border border-white/10 rounded-xl hover:border-gold/40 hover:bg-white/10 transition-all"
                        >
                          <p className="text-sm text-white">{mem.preview}</p>
                          <p className="text-xs text-white/30 mt-1">{mem.file}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/40">No results for "{query}"</p>
                  <p className="text-white/20 text-sm mt-2">Try different keywords</p>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!searched && (
            <div className="text-center py-8 text-white/30">
              <Search size={48} className="mx-auto mb-4 opacity-20" />
              <p>Search across Tasks, Notes, Memories & Files</p>
              <p className="text-xs mt-4 text-white/20">Press Enter to search</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default UnifiedSearch;
