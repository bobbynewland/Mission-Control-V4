import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { Drawer } from 'vaul';
import {
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  ExternalLink,
  GripVertical,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
  Calendar
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { database, onValue, push, ref, remove, set, update } from '../lib/firebase';

const BOARD_PATH = 'workspaces/winslow_main/tasks';

const COLUMNS = [
  { id: 'todo', title: 'Todo', accent: 'border-white/20' },
  { id: 'progress', title: 'In Progress', accent: 'border-gold/40' },
  { id: 'review', title: 'Review', accent: 'border-purple/40' },
  { id: 'done', title: 'Done', accent: 'border-green-500/40' },
];

const PRIORITIES = [
  { id: 'high', label: 'High', color: 'text-red-400', bg: 'bg-red-500/20' },
  { id: 'medium', label: 'Medium', color: 'text-gold', bg: 'bg-gold/20' },
  { id: 'low', label: 'Low', color: 'text-blue-400', bg: 'bg-blue-500/20' },
];

const emptyBoard = () => ({ todo: [], progress: [], review: [], done: [] });

function buildBoard(tasks, clientId) {
  const board = emptyBoard();
  const filtered = Object.entries(tasks || {})
    .filter(([, task]) => task?.clientId === clientId)
    .sort(([, a], [, b]) => (a?.position || 0) - (b?.position || 0));
  
  filtered.forEach(([id, task]) => {
    const column = task?.column || 'todo';
    if (board[column]) board[column].push(id);
  });
  return board;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < 1024 : true
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const handler = (event) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

function TaskCard({ task, id, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  if (!task) return null;

  const checklist = task.checklist ? Object.values(task.checklist) : [];
  const done = checklist.filter((item) => item.completed).length;
  const files = task.files ? Object.values(task.files) : [];
  
  const priority = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1];
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.column !== 'done';

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className="mb-2.5 w-full max-w-full min-w-0"
    >
      <article className={`glass w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 p-3.5 select-none ${isDragging ? 'shadow-2xl scale-[1.01]' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${priority.bg} ${priority.color}`}>
            {priority.label}
          </span>
          {dueDate && (
            <span className={`text-[9px] flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-white/40'}`}>
              <Calendar size={9} />
              {dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              {isOverdue && <span className="text-red-400 ml-0.5">(Overdue)</span>}
            </span>
          )}
        </div>
        
        <header className="flex min-w-0 items-start justify-between gap-2">
          <button 
            type="button" 
            onClick={() => onOpen(task, id)} 
            className="flex-1 text-left min-h-0 min-w-0"
            style={{ minHeight: 'unset', minWidth: 0 }}
          >
            <h4 className="text-[15px] sm:text-[13px] font-bold text-white/90 leading-tight break-words">{task.title}</h4>
            <p className="text-[12.5px] sm:text-[11px] text-white/45 mt-1 line-clamp-2 break-words">{task.description || 'No description yet.'}</p>
          </button>

          <button
            type="button"
            aria-label="Drag task"
            className="kanban-drag-handle p-1.5 -m-1 rounded-xl text-white/30 active:text-white/70"
            style={{ minHeight: 'unset', minWidth: 'unset' }}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>
        </header>

        <footer className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[10px] text-white/40">
          <div className="flex items-center gap-2 flex-wrap">
            {checklist.length > 0 && (
              <span className="flex items-center gap-1">
                <CheckSquare size={11} />
                {done}/{checklist.length}
              </span>
            )}
            {files.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip size={11} />
                {files.length}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 uppercase">
            <Clock size={11} />
            {task.createdAt ? new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '--'}
          </span>
        </footer>
      </article>
    </div>
  );
}

function Column({ column, ids, tasks, onAdd, onOpen }) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <section className="kanban-page flex h-full min-w-0 flex-col px-2.5 sm:px-3 lg:px-1 overflow-hidden">
      <div className={`mb-3 pb-2 border-b-2 ${column.accent} flex items-center justify-between`}>
        <h3 className="text-[11px] uppercase tracking-[0.18em] font-black text-white/75">{column.title}</h3>
        <span className="text-[10px] text-white/35 font-mono">{ids.length}</span>
      </div>

      <div ref={setNodeRef} className="kanban-column-scroll flex-1 min-w-0 overflow-y-auto pr-1">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => (
            <TaskCard key={id} id={id} task={tasks[id]} onOpen={onOpen} />
          ))}
        </SortableContext>

        <button
          onClick={onAdd}
          className="w-full mt-2 py-5 border-2 border-dashed border-white/15 rounded-2xl text-white/40 hover:text-white/70 hover:border-white/30 transition"
        >
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-black">
            <Plus size={16} /> Add Task
          </span>
        </button>
      </div>
    </section>
  );
}

export default function ClientKanban({ clientId }) {
  const isMobile = useIsMobile();

  const [tasks, setTasks] = useState({});
  const [board, setBoard] = useState(emptyBoard());
  const [activeId, setActiveId] = useState(null);
  const [dragging, setDragging] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [newCheckItem, setNewCheckItem] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    column: 'todo', 
    priority: 'medium',
    dueDate: ''
  });

  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ dragFree: false, align: 'start', containScroll: 'trimSnaps' });

  useEffect(() => {
    const unsub = onValue(ref(database, BOARD_PATH), (snapshot) => {
      const data = snapshot.val() || {};
      setTasks(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeId) setBoard(buildBoard(tasks, clientId));
  }, [tasks, activeId, clientId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 170, tolerance: 10 } }),
  );

  const activeTask = activeId ? tasks[activeId] : null;

  const findContainer = (id, sourceBoard = board) => {
    if (!id) return null;
    if (sourceBoard[id]) return id;
    return Object.keys(sourceBoard).find((col) => sourceBoard[col].includes(id)) || null;
  };

  const persistBoard = async (nextBoard) => {
    const updates = {};
    Object.entries(nextBoard).forEach(([column, ids]) => {
      ids.forEach((taskId, index) => {
        updates[`${BOARD_PATH}/${taskId}/column`] = column;
        updates[`${BOARD_PATH}/${taskId}/position`] = index;
      });
    });
    if (Object.keys(updates).length) await update(ref(database), updates);
  };

  const onDragStart = ({ active }) => {
    setActiveId(active.id);
    setDragging(true);
  };

  const onDragOver = ({ active, over }) => {
    if (!over) return;
    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);
    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      setBoard((current) => {
        const items = current[activeContainer];
        const from = items.indexOf(active.id);
        const to = items.indexOf(over.id);
        if (from < 0 || to < 0 || from === to) return current;
        return { ...current, [activeContainer]: arrayMove(items, from, to) };
      });
      return;
    }

    setBoard((current) => {
      const fromItems = current[activeContainer];
      const toItems = current[overContainer];
      const fromIndex = fromItems.indexOf(active.id);
      if (fromIndex < 0) return current;

      const overIndex = toItems.indexOf(over.id);
      const insertAt = over.id in current ? toItems.length : Math.max(0, overIndex);

      return {
        ...current,
        [activeContainer]: fromItems.filter((item) => item !== active.id),
        [overContainer]: [...toItems.slice(0, insertAt), active.id, ...toItems.slice(insertAt)],
      };
    });
  };

  const onDragEnd = async ({ over }) => {
    setActiveId(null);
    setDragging(false);
    if (!over) {
      setBoard(buildBoard(tasks, clientId));
      return;
    }
    await persistBoard(board);
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    const taskRef = push(ref(database, BOARD_PATH));
    await update(taskRef, {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      column: newTask.column,
      priority: newTask.priority || 'medium',
      dueDate: newTask.dueDate || null,
      clientId: clientId, // Set clientId for the task
      id: taskRef.key,
      position: board[newTask.column]?.length || 0,
      createdAt: Date.now(),
    });
    setShowAddModal(false);
    setNewTask({ title: '', description: '', column: 'todo', priority: 'medium', dueDate: '' });
  };

  const selectedTaskLive = selectedTask?.id ? tasks[selectedTask.id] : null;
  const checklistEntries = selectedTaskLive?.checklist ? Object.entries(selectedTaskLive.checklist) : [];
  const fileEntries = selectedTaskLive?.files ? Object.entries(selectedTaskLive.files) : [];

  const DetailsContent = selectedTask ? (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <select
            value={selectedTask.column || 'todo'}
            onChange={async (e) => {
              const column = e.target.value;
              await update(ref(database, `${BOARD_PATH}/${selectedTask.id}`), {
                column,
                position: board[column]?.length || 0,
              });
              setSelectedTask((prev) => ({ ...prev, column }));
            }}
            className="appearance-none bg-gold text-black text-[11px] font-black uppercase tracking-widest pl-4 pr-9 py-2 rounded-full"
          >
            {COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>{col.title}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
        </div>
        {!isMobile && (
          <button onClick={() => setSelectedTask(null)} className="text-white/45 hover:text-white">
            <X size={26} />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <input
            value={editData.title || ''}
            onChange={(e) => setEditData((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white"
            placeholder="Task title"
          />
          <textarea
            value={editData.description || ''}
            onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 h-32 text-white"
            placeholder="Description"
          />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Priority</p>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setEditData((prev) => ({ ...prev, priority: p.id }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase ${
                    editData.priority === p.id 
                      ? `${p.bg} ${p.color} border border-white/20` 
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Due Date</p>
            <input
              type="date"
              value={editData.dueDate || ''}
              onChange={(e) => setEditData((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white"
            />
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-2xl font-black text-white mb-3">{selectedTask.title}</h3>
          {selectedTask.dueDate && (
            <div className={`flex items-center gap-2 mb-3 text-sm ${
              new Date(selectedTask.dueDate) < new Date() && selectedTask.column !== 'done' 
                ? 'text-red-400' 
                : 'text-white/60'
            }`}>
              <Calendar size={14} />
              <span>Due: {new Date(selectedTask.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          <p className="text-sm text-white/65 bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
            {selectedTask.description || 'No description provided.'}
          </p>
        </div>
      )}

      <div className="flex gap-3 mt-5 pb-safe">
        {isEditing ? (
          <>
            <button 
              onClick={async () => {
                if (!selectedTask?.id || !editData.title?.trim()) return;
                await update(ref(database, `${BOARD_PATH}/${selectedTask.id}`), { 
                  ...editData, 
                  title: editData.title.trim() 
                });
                setSelectedTask({ ...editData, id: selectedTask.id });
                setIsEditing(false);
              }}
              className="flex-1 bg-gold text-black rounded-xl py-3 font-black uppercase text-xs tracking-widest"
            >
              Save
            </button>
            <button onClick={() => setIsEditing(false)} className="px-5 bg-white/10 rounded-xl py-3 text-xs uppercase tracking-widest">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(true)} className="flex-1 bg-white text-black rounded-xl py-3 font-black uppercase text-xs tracking-widest">
              Edit
            </button>
            <button
              onClick={async () => {
                if (!selectedTask?.id || !confirm('Delete task?')) return;
                await remove(ref(database, `${BOARD_PATH}/${selectedTask.id}`));
                setSelectedTask(null);
              }}
              className="px-5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl py-3 text-xs uppercase tracking-widest"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="px-4 md:px-6 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-[0.28em] text-white/40">Tasks</h2>
          <span className="text-[10px] uppercase tracking-wider text-white/35">Client View</span>
        </div>

        {isMobile && (
          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
            {COLUMNS.map((column, index) => (
              <button
                key={column.id}
                onClick={() => {
                  setActiveColumnIndex(index);
                  emblaApi?.scrollTo(index);
                }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wider font-black transition ${
                  activeColumnIndex === index
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-white/65 border-white/15'
                }`}
              >
                {column.title} <span className="text-[10px] ml-1 opacity-80">{(board[column.id] || []).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setDragging(false);
          setBoard(buildBoard(tasks, clientId));
        }}
      >
        {isMobile ? (
          <div className={`embla flex-1 min-h-0 ${dragging ? 'kanban-track-dragging' : ''}`} ref={emblaRef}>
            <div className="embla__container h-full">
              {COLUMNS.map((column) => (
                <div key={column.id} className="embla__slide h-full">
                  <Column
                    column={column}
                    ids={board[column.id] || []}
                    tasks={tasks}
                    onOpen={(task, id) => {
                      setSelectedTask({ ...task, id });
                      setEditData({ ...task });
                      setIsEditing(false);
                    }}
                    onAdd={() => {
                      setNewTask((prev) => ({ ...prev, column: column.id }));
                      setShowAddModal(true);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`kanban-track flex-1 min-h-0 ${dragging ? 'kanban-track-dragging' : ''}`}>
            {COLUMNS.map((column) => (
              <div key={column.id} className="kanban-track-page">
                <Column
                  column={column}
                  ids={board[column.id] || []}
                  tasks={tasks}
                  onOpen={(task, id) => {
                    setSelectedTask({ ...task, id });
                    setEditData({ ...task });
                    setIsEditing(false);
                  }}
                  onAdd={() => {
                    setNewTask((prev) => ({ ...prev, column: column.id }));
                    setShowAddModal(true);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <DragOverlay>
          {activeTask ? (
            <div className="w-[86vw] max-w-[420px]">
              <article className="glass rounded-2xl border border-white/10 p-3.5 select-none shadow-2xl scale-[1.01]">
                <h4 className="text-[13px] font-bold text-white/90 leading-tight">{activeTask.title}</h4>
                <p className="text-[11px] text-white/35 mt-1 line-clamp-2">{activeTask.description || 'No description yet.'}</p>
              </article>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Modal */}
      {isMobile ? (
        <Drawer.Root open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-40 bg-black/70" />
            <Drawer.Content className="glass fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] overflow-y-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-[max(1rem,env(safe-area-inset-bottom,1rem))]">
              <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/25" />
              {DetailsContent}
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        <AnimatePresence>
          {selectedTask && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/85"
                onClick={() => {
                  setSelectedTask(null);
                  setIsEditing(false);
                }}
              />
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                className="glass relative z-10 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-[2rem] p-6"
              >
                {DetailsContent}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      )}

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 grid place-items-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90" onClick={() => setShowAddModal(false)} />
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="glass relative z-10 w-full max-w-md p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-black text-white">New Task</h3>
                <button onClick={() => setShowAddModal(false)} className="text-white/50"><X size={22} /></button>
              </div>

              <div className="space-y-4">
                <input
                  value={newTask.title}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Title"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white"
                />
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Description"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 h-28 text-white"
                />
                
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Priority</p>
                  <div className="flex gap-2">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setNewTask((prev) => ({ ...prev, priority: p.id }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase ${
                          newTask.priority === p.id 
                            ? `${p.bg} ${p.color} border border-white/20` 
                            : 'bg-white/5 text-white/40 border border-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Due Date</p>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask((prev) => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white"
                  />
                </div>
                
                <button 
                  onClick={addTask} 
                  disabled={!newTask.title.trim()}
                  className="w-full bg-gold text-black rounded-xl py-3.5 font-black uppercase text-xs tracking-widest disabled:opacity-50"
                >
                  Create Task
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}