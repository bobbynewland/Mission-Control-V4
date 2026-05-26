import React, { useEffect, useState, useCallback } from 'react';
import { format, startOfWeek, addDays, parseISO, isToday } from 'date-fns';
import { 
  Calendar, Clock, RefreshCw, Video, Smartphone, 
  Instagram, Youtube, Facebook, AlertCircle, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';

// ─── Platform Config ───────────────────────────────────────────────────────────
const PLATFORMS = {
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    bgClass: 'bg-red-500',
    textClass: 'text-red-500',
    borderClass: 'border-red-500',
    lightBg: 'bg-red-50',
    icon: Youtube,
  },
  tiktok: {
    label: 'TikTok',
    color: '#000000',
    bgClass: 'bg-black',
    textClass: 'text-black',
    borderClass: 'border-black',
    lightBg: 'bg-gray-50',
    icon: Smartphone,
  },
  instagram: {
    label: 'Instagram',
    color: '#E1306C',
    bgClass: 'bg-pink-500',
    textClass: 'text-pink-500',
    borderClass: 'border-pink-500',
    lightBg: 'bg-pink-50',
    icon: Instagram,
  },
  facebook: {
    label: 'Facebook',
    color: '#1877F2',
    bgClass: 'bg-blue-500',
    textClass: 'text-blue-500',
    borderClass: 'border-blue-500',
    lightBg: 'bg-blue-50',
    icon: Facebook,
  },
};

const PRIORITY_BADGE = {
  urgent: { label: '🔥 Urgent', class: 'bg-red-100 text-red-700' },
  high: { label: '⚡ High', class: 'bg-orange-100 text-orange-700' },
  normal: { label: '• Normal', class: 'bg-gray-100 text-gray-600' },
  low: { label: '▽ Low', class: 'bg-gray-50 text-gray-400' },
};

// ─── Time Slot Grid ───────────────────────────────────────────────────────────
const TIME_SLOTS = [
  { time: '07:00', label: '7am', period: 'morning' },
  { time: '09:00', label: '9am', period: 'morning' },
  { time: '11:00', label: '11am', period: 'midday' },
  { time: '12:00', label: '12pm', period: 'midday' },
  { time: '13:00', label: '1pm', period: 'afternoon' },
  { time: '14:00', label: '2pm', period: 'afternoon' },
  { time: '17:00', label: '5pm', period: 'evening' },
  { time: '19:00', label: '7pm', period: 'evening' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = [0, 1, 2, 3, 4, 5, 6]; // Monday=0 in date-fns

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getWeekDates(weekStart) {
  return DAY_KEYS.map((d) => addDays(weekStart, d));
}

function taskToSlotKey(task) {
  if (!task.scheduledDate) return null;
  const [date, time] = task.scheduledDate.split('T');
  return `${date}_${time.slice(0, 5)}`;
}

function slotKey(date, time) {
  return `${format(date, 'yyyy-MM-dd')}_${time}`;
}

function matchesTimeSlot(scheduledDate, time) {
  if (!scheduledDate) return false;
  const [, t] = scheduledDate.split('T');
  return t?.startsWith(time);
}

function isLongForm(task) {
  const tags = (task.tags || []).map((t) => t.toLowerCase());
  return (
    (tags.includes('youtube') && (tags.includes('long') || tags.includes('casestudy') || tags.includes('feature'))) ||
    (task.scheduledSlot?.type === 'long')
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PublishingCalendar() {
  const [tasks, setTasks] = useState([]);
  const [cfColumns, setCfColumns] = useState({});
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [notification, setNotification] = useState(null);

  // ── Load data from Firebase ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = db.projects.subscribe((projects) => {
      if (projects?.content_factory) {
        const cf = projects.content_factory;
        const allTasks = cf.tasks || {};
        const taskList = Object.entries(allTasks).map(([id, t]) => ({ ...t, id }));
        setTasks(taskList);
        setCfColumns(cf.columns || {});
      } else {
        setTasks([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Auto-refresh every 30s ────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      db.projects.get().then((snap) => {
        const projects = snap.val();
        if (projects?.content_factory) {
          const allTasks = projects.content_factory.tasks || {};
          setTasks(Object.entries(allTasks).map(([id, t]) => ({ ...t, id })));
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────
  const weekDates = getWeekDates(weekStart);

  const scheduledTasks = tasks.filter((t) => t.column === 'scheduled' && t.scheduledDate);
  const ideaPoolTasks = tasks.filter((t) => t.column === 'idea_pool');

  // Build grid: { [slotKey]: task[] }
  const grid = {};
  for (const task of scheduledTasks) {
    for (const date of weekDates) {
      for (const ts of TIME_SLOTS) {
        const key = slotKey(date, ts.time);
        if (matchesTimeSlot(task.scheduledDate, ts.time)) {
          const dayMatch = task.scheduledDate.startsWith(format(date, 'yyyy-MM-dd'));
          if (dayMatch) {
            if (!grid[key]) grid[key] = [];
            grid[key].push(task);
          }
        }
      }
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // ── Regenerate ───────────────────────────────────────────────────────────
  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    setNotification(null);
    try {
      const result = await fetch(
        `${import.meta.env.VITE_FUNCTIONS_URL || 'http://localhost:3001'}/api/schedule-autopopulate`,
        { method: 'POST' }
      );
      const data = await result.json();
      setNotification({
        type: 'success',
        message: `Scheduled ${data.scheduled} tasks for next week!`,
      });
      setLastRun(new Date());
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Failed to run schedule. Make sure the API endpoint is configured.',
      });
    } finally {
      setRegenerating(false);
    }
  }, []);

  // ── Slot click → view task ───────────────────────────────────────────────
  const [selectedTask, setSelectedTask] = useState(null);

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h2 className="text-base font-semibold text-gray-800">Publishing Calendar</h2>
          <span className="text-xs text-gray-400">
            {format(weekDates[0], 'MMM d')} – {format(weekDates[6], 'MMM d, yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
          >
            Today
          </button>
          <button onClick={prevWeek} className="p-1.5 rounded-md hover:bg-gray-100 transition">
            ‹
          </button>
          <button onClick={nextWeek} className="p-1.5 rounded-md hover:bg-gray-100 transition">
            ›
          </button>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 ml-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Scheduling...' : 'Regenerate Schedule'}
          </button>
        </div>
      </div>

      {/* ── Notification ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mx-4 mt-3 px-3 py-2 rounded-md text-xs font-medium ${
              notification.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
            )}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-2 flex items-center gap-4 flex-shrink-0 bg-white border-b border-gray-100">
        {Object.entries(PLATFORMS).map(([key, p]) => {
          const Icon = p.icon;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="text-xs text-gray-600">{p.label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400" />
          <span className="text-xs text-gray-500">Prime slot</span>
        </div>
      </div>

      {/* ── Calendar Grid ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[800px] h-full flex flex-col">
            {/* Day Headers */}
            <div className="flex border-b border-gray-200 flex-shrink-0">
              <div className="w-16 flex-shrink-0" /> {/* Time gutter */}
              {weekDates.map((date, i) => {
                const today = isToday(date);
                return (
                  <div
                    key={i}
                    className={`flex-1 py-2 text-center border-l border-gray-100 ${
                      today ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <div className={`text-xs font-medium ${today ? 'text-blue-600' : 'text-gray-500'}`}>
                      {DAYS[i]}
                    </div>
                    <div className={`text-sm font-semibold ${today ? 'text-blue-700' : 'text-gray-800'}`}>
                      {format(date, 'd')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time Rows */}
            <div className="flex-1 overflow-y-auto">
              {TIME_SLOTS.map((ts) => (
                <div key={ts.time} className="flex min-h-[64px] border-b border-gray-100">
                  {/* Time label */}
                  <div className="w-16 flex-shrink-0 px-1 py-1 flex items-start justify-end">
                    <span className="text-[10px] text-gray-400 mt-0.5">{ts.label}</span>
                  </div>

                  {/* Day cells */}
                  {weekDates.map((date, di) => {
                    const key = slotKey(date, ts.time);
                    const cellTasks = grid[key] || [];
                    const isPrime = (ts.time === '14:00' && di === 1) || // Tue 2pm
                                   (ts.time === '14:00' && di === 3) || // Thu 2pm
                                   ts.time === '07:00' || // TikTok morning prime
                                   ts.time === '19:00'; // Evening prime

                    return (
                      <div
                        key={di}
                        className={`flex-1 min-h-[64px] border-l border-gray-100 p-0.5 ${
                          isPrime ? 'bg-yellow-50/50' : ''
                        } ${isToday(date) ? 'bg-blue-50/30' : ''}`}
                      >
                        {cellTasks.map((task) => {
                          const platform = task.scheduledSlot?.platform || 
                            (task.tags || []).find((t) =>
                              ['youtube', 'tiktok', 'instagram', 'facebook'].includes(t.toLowerCase())
                            )?.toLowerCase() || 'youtube';
                          const p = PLATFORMS[platform] || PLATFORMS.youtube;
                          const Icon = p.icon;
                          const long = isLongForm(task);

                          return (
                            <button
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className={`w-full text-left mb-0.5 px-1.5 py-1 rounded text-white text-[10px] leading-tight overflow-hidden cursor-pointer hover:opacity-90 transition ${p.bgClass}`}
                              style={long ? { background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)` } : {}}
                              title={task.title}
                            >
                              <div className="flex items-center gap-0.5">
                                <Icon className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate font-medium">{task.title}</span>
                              </div>
                              {long && (
                                <div className="text-[9px] opacity-75">Long-form</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Idea Pool Rail ──────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white">
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">📥 Idea Pool</span>
              <span className="text-xs text-gray-400">({ideaPoolTasks.length} unscheduled)</span>
            </div>
            <span className="text-[10px] text-gray-400">
              Drag to schedule or click "Regenerate" above
            </span>
          </div>
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
            {ideaPoolTasks.length === 0 && (
              <div className="text-xs text-gray-400 italic py-1">No pending ideas — you're all scheduled!</div>
            )}
            {ideaPoolTasks.map((task) => {
              const platform = (task.tags || []).find((t) =>
                ['youtube', 'tiktok', 'instagram', 'facebook'].includes(t.toLowerCase())
              )?.toLowerCase() || 'youtube';
              const p = PLATFORMS[platform] || PLATFORMS.youtube;
              const pb = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.normal;

              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="flex-shrink-0 max-w-[180px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-left hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
                    <span className="text-[10px] text-gray-500 truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${pb.class}`}>
                      {pb.label}
                    </span>
                    {task.tags?.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Task Detail Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTask && (
          <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({ task, onClose }) {
  const platform = task.scheduledSlot?.platform ||
    (task.tags || []).find((t) => ['youtube', 'tiktok', 'instagram', 'facebook'].includes(t.toLowerCase()))?.toLowerCase() ||
    'youtube';
  const p = PLATFORMS[platform] || PLATFORMS.youtube;
  const Icon = p.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: p.color + '20' }}>
              <Icon className="w-4 h-4" style={{ color: p.color }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">{task.title}</h3>
              <p className="text-xs text-gray-500">{p.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        {task.description && (
          <p className="text-xs text-gray-600 mb-3">{task.description}</p>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Status</div>
            <div className="text-xs font-medium text-gray-700 capitalize">
              {task.column?.replace('_', ' ') || 'Unknown'}
            </div>
          </div>
          {task.scheduledDate && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Scheduled</div>
              <div className="text-xs font-medium text-gray-700">
                {format(parseISO(task.scheduledDate), 'MMM d, h:mm a')}
              </div>
            </div>
          )}
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {task.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {tag}
              </span>
            ))}
          </div>
        )}

        {task.scheduledSlot && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 mb-3">
            <strong>Slot:</strong> {task.scheduledSlot.label} ({task.scheduledSlot.duration}) on {task.scheduledSlot.platform}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}
