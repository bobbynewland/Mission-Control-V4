import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Calendar,
  CalendarDays,
  Clock,
  Target,
  CheckCircle2,
  Activity,
  Brain,
  Cpu,
  ArrowRight,
  RefreshCw,
  Zap,
  HardDrive,
  Radio,
  MapPin,
  Video,
  Flag,
  X
} from 'lucide-react';

const BOARD_PATH = 'workspaces/winslow_main/tasks';

const PRIORITY_WEIGHTS = { high: 3, medium: 2, low: 1 };

const Today = ({ onNavigate }) => {
  const [time, setTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTasks: 0,
    inProgress: 0,
    completed: 0,
    apiHealthPct: 100,
    uptime: '0h'
  });
  const [topTasks, setTopTasks] = useState([]);
  const [captureStats, setCaptureStats] = useState({
    pendingTasks: 0,
    notesToday: 0
  });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [error, setError] = useState(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load data safely - run once on mount
  useEffect(() => {
    let isMounted = true;
    
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const calendarConnected = urlParams.get('calendar') === 'connected';
    const oauthError = urlParams.get('error');
    
    if (calendarConnected) {
      // Clear the URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (oauthError) {
      console.error('OAuth error:', oauthError);
      // Clear the URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    const loadAllData = async () => {
      if (!isMounted) return;
      await loadData();
      if (!isMounted) return;
      await loadCalendar();
    };
    
    loadAllData();
    
    // Set up interval for periodic refresh
    const interval = setInterval(() => {
      if (isMounted) {
        loadData();
        loadCalendar();
      }
    }, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  };

  const handleEditEvent = (event) => {
    // Navigate to calendar with the event ID to open edit modal
    localStorage.setItem('mc3_open_event_id', event.id);
    onNavigate?.('calendar');
    setShowEventDetail(false);
    setShowAllUpcoming(false);
  };

  const loadData = async () => {
    try {
      setError(null);
      
      // Timeout fallback - ensure loading stops after 5 seconds
      const timeoutId = setTimeout(() => {
        setLoading(false);
      }, 5000);
      
      // Safe Firebase loading with fallback
      let firebaseData = null;
      let tasksData = null;
      try {
        const { database, ref, onValue } = await import('../lib/firebase');
        
        // Get tasks for top priorities
        const tasksRef = ref(database, BOARD_PATH);
        onValue(tasksRef, (snap) => {
          if (snap.exists()) {
            tasksData = snap.val();
            processTopTasks(tasksData);
          }
        });
        
        // Get stats
        const statsSnap = await new Promise((resolve) => {
          onValue(ref(database, 'workspaces/winslow_main/live_telemetry'), resolve, { onlyOnce: true });
        });
        if (statsSnap.exists()) firebaseData = statsSnap.val();
      } catch (e) {
        console.log('Firebase not available, using local data');
      }
      
      clearTimeout(timeoutId);
      
      if (firebaseData) {
        setStats({
          totalTasks: firebaseData?.stats?.totalTasks || 0,
          inProgress: firebaseData?.stats?.inProgress || 0,
          completed: firebaseData?.stats?.completed || 0,
          apiHealthPct: firebaseData?.stats?.apiHealthPct || 100,
          uptime: firebaseData?.stats?.uptime || '0h'
        });
      }

      // Load capture stats
      try {
        const items = JSON.parse(localStorage.getItem('quick_capture') || '[]');
        const today = new Date().toDateString();
        setCaptureStats({
          pendingTasks: items.filter(i => i.type === 'task' && i.status !== 'completed').length,
          notesToday: items.filter(i => i.type === 'note' && new Date(i.created).toDateString() === today).length
        });
      } catch (e) {
        console.log('Capture stats not available');
      }
    } catch (err) {
      console.error('Error loading Today data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Process top 3 priority tasks
  const processTopTasks = (tasks) => {
    if (!tasks) return;
    
    const now = Date.now();
    const taskList = Object.entries(tasks)
      .map(([id, task]) => ({ id, ...task }))
      // Filter out completed tasks
      .filter(task => task.column !== 'done')
      // Sort by priority (high > medium > low) then by due date
      .sort((a, b) => {
        const priorityDiff = (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        
        // If same priority, sort by due date (earlier first)
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        
        // Finally by created date
        return (b.createdAt || 0) - (a.createdAt || 0);
      })
      .slice(0, 3);
    
    setTopTasks(taskList);
  };

  const loadCalendar = async () => {
    try {
      // Check for cached calendar events with validation
      try {
        const cached = localStorage.getItem('mc3_calendar_events');
        if (cached) {
          const events = JSON.parse(cached);
          if (Array.isArray(events)) {
            setCalendarEvents(events);
          }
        }
      } catch (e) {
        console.log('Calendar cache parse error, ignoring cache');
        try { localStorage.removeItem('mc3_calendar_events'); } catch (e) {}
      }

      const res = await fetch('/api/calendar/events?days=30&maxResults=50', { 
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.connected && data.events && Array.isArray(data.events)) {
          setCalendarEvents(data.events);
          setCalendarConnected(true);
          localStorage.setItem('mc3_calendar_events', JSON.stringify(data.events));
        } else {
          setCalendarConnected(false);
        }
      } else {
        if (res.status === 401) setCalendarConnected(false);
        console.log('Calendar API fetch failed:', res.status);
      }
    } catch (e) {
      console.log('Calendar loading error:', e);
    }
  };

  const connectCalendar = () => {
    window.location.href = '/api/auth/google?action=init';
  };

  const toggleTaskDone = async (taskId, currentColumn) => {
    try {
      const { database, ref, update } = await import('../lib/firebase');
      const newColumn = currentColumn === 'done' ? 'todo' : 'done';
      await update(ref(database, `${BOARD_PATH}/${taskId}`), { 
        column: newColumn,
        completedAt: newColumn === 'done' ? Date.now() : null
      });
      // Refresh will happen via onValue listener
    } catch (e) {
      console.error('Error toggling task:', e);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-gold';
      case 'low': return 'text-blue-400';
      default: return 'text-white/40';
    }
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const completedCount = topTasks.filter(t => t.column === 'done').length;

  // Filter events
  const todayEvents = calendarEvents.filter(e => {
    const eventDate = new Date(e.start);
    return eventDate.toDateString() === new Date().toDateString();
  });

  const upcomingEvents = calendarEvents.filter(e => {
    const eventDate = new Date(e.start);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Compare against end of today
    return eventDate > today;
  }).slice(0, 3);

  const formatEventTime = (start, end) => {
    const startTime = new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (!end) return startTime;
    const endTime = new Date(end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  };

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <RefreshCw className="animate-spin text-gold" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">Error loading data: {error}</p>
          <button onClick={loadData} className="mt-2 text-xs text-gold hover:text-white">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 pb-28 lg:px-6 lg:py-6 lg:pb-8">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gold/90">
                <Sun size={14} /> {greeting}
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Today is {todayLabel}
              </h2>
              <p className="mt-1 text-xs text-white/50 flex items-center gap-2">
                <Clock size={14} />
                {time.toLocaleTimeString('en-US', { hour12: true })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-gold">{topTasks.length > 0 ? completedCount : 0}/{topTasks.length || 3}</p>
              <p className="text-[10px] text-white/40 uppercase">Priorities Done</p>
            </div>
          </div>
        </section>

        {/* Calendar Section */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/80">
              <CalendarDays size={16} className="text-gold" /> Calendar
            </h3>
            {!calendarConnected && (
              <button 
                onClick={connectCalendar}
                className="text-[10px] text-gold hover:text-white"
              >
                Connect
              </button>
            )}
          </div>

          {!calendarConnected ? (
            <div className="text-center py-6 text-white/40">
              <Calendar size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No calendar connected</p>
              <button 
                onClick={connectCalendar}
                className="mt-2 px-3 py-1.5 bg-gold/10 border border-gold/30 rounded-lg text-xs text-gold hover:bg-gold/20 transition-colors"
              >
                Connect Google Calendar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todayEvents.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Today's Events</p>
                  <div className="space-y-2">
                    {todayEvents.map((event, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleEventClick(event)}
                        className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-shrink-0 w-16 text-center">
                          <p className="text-[10px] text-gold font-bold">{formatEventTime(event.start, event.end)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{event.summary}</p>
                          {event.location && (
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin size={10} className="text-white/30" />
                              <p className="text-[10px] text-white/40 truncate">{event.location}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {upcomingEvents.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Upcoming</p>
                    <button 
                      onClick={() => setShowAllUpcoming(true)}
                      className="text-[10px] text-gold hover:underline font-bold uppercase tracking-widest"
                    >
                      View All Schedule
                    </button>
                  </div>
                  <div className="space-y-2">
                    {upcomingEvents.map((event, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleEventClick(event)}
                        className="flex items-center gap-3 p-2.5 bg-white/[0.02] rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-shrink-0 w-16">
                          <p className="text-[9px] text-white/40 font-bold uppercase leading-tight">
                            {new Date(event.start).toLocaleDateString('en-US', { weekday: 'short' })}
                          </p>
                          <p className="text-[11px] text-white/80 font-black">
                            {new Date(event.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0 border-l border-white/10 pl-3">
                          <p className="text-sm text-white/80 truncate font-bold">{event.summary}</p>
                          <p className="text-[10px] text-gold/60 font-medium">{formatEventTime(event.start, event.end)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {todayEvents.length === 0 && upcomingEvents.length === 0 && (
                <div className="text-center py-4 text-white/40">
                  <p className="text-sm">No events for the next 2 days</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={16} className="text-gold" />
              <span className="text-[10px] text-white/40 uppercase">Total Jobs</span>
            </div>
            <p className="text-xl font-black text-white">{stats.totalTasks}</p>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-green-400" />
              <span className="text-[10px] text-white/40 uppercase">In Progress</span>
            </div>
            <p className="text-xl font-black text-white">{stats.inProgress}</p>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={16} className="text-purple-400" />
              <span className="text-[10px] text-white/40 uppercase">API Health</span>
            </div>
            <p className="text-xl font-black text-white">{stats.apiHealthPct}%</p>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive size={16} className="text-blue-400" />
              <span className="text-[10px] text-white/40 uppercase">Uptime</span>
            </div>
            <p className="text-xl font-black text-white">{stats.uptime}</p>
          </div>
        </div>

        {/* Top 3 Priorities - From Firebase Tasks */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/80">
              <Target size={16} className="text-gold" /> Top 3 Priorities
            </h3>
            <button 
              onClick={() => onNavigate?.('tasks')}
              className="text-[10px] text-gold hover:text-white flex items-center gap-1"
            >
              View All Tasks <ArrowRight size={12} />
            </button>
          </div>

          {topTasks.length === 0 ? (
            <div className="text-center py-6 text-white/40">
              <Target size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No pending tasks</p>
              <p className="text-[10px] mt-1">Add tasks with priority to see them here</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topTasks.map((task, index) => (
                <div key={task.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <button
                    onClick={() => toggleTaskDone(task.id, task.column)}
                    className={`rounded-md p-1.5 transition flex-shrink-0 ${
                      task.column === 'done' ? 'text-green-400' : 'text-white/35 hover:text-white/70'
                    }`}
                  >
                    <CheckCircle2 size={20} />
                  </button>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      localStorage.setItem('mc3_open_task_id', task.id);
                      onNavigate?.('tasks');
                    }}
                  >
                    <p className={`text-sm font-medium truncate ${task.column === 'done' ? 'line-through text-white/45' : 'text-white'}`}>
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className={`text-[10px] mt-0.5 ${
                        new Date(task.dueDate) < new Date() && task.column !== 'done' 
                          ? 'text-red-400' 
                          : 'text-white/40'
                      }`}>
                        Due: {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {new Date(task.dueDate) < new Date() && task.column !== 'done' && ' (Overdue)'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Flag size={14} className={getPriorityColor(task.priority)} />
                    <span className={`text-[10px] uppercase font-bold ${getPriorityColor(task.priority)}`}>
                      {task.priority || 'Medium'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/80">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button 
              onClick={() => onNavigate?.('capture')}
              className="p-4 bg-gold/10 border border-gold/20 rounded-xl hover:bg-gold/20 transition-colors text-left"
            >
              <Zap size={20} className="text-gold mb-2" />
              <span className="text-sm font-bold text-white">Quick Capture</span>
            </button>
            <button 
              onClick={() => onNavigate?.('tasks')}
              className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-left"
            >
              <Target size={20} className="text-white/40 mb-2" />
              <span className="text-sm font-bold text-white">View Tasks</span>
            </button>
            <button 
              onClick={() => onNavigate?.('drive')}
              className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-left"
            >
              <HardDrive size={20} className="text-white/40 mb-2" />
              <span className="text-sm font-bold text-white">Open Drive</span>
            </button>
            <button 
              onClick={() => onNavigate?.('agents')}
              className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-left"
            >
              <Radio size={20} className="text-white/40 mb-2" />
              <span className="text-sm font-bold text-white">Monitor Agents</span>
            </button>
          </div>
        </section>

        {/* Activity Summary */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/80">Today's Activity</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-white/10 bg-black/20 py-3">
              <p className="text-xl font-black text-gold">{captureStats.pendingTasks}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/45">Pending Tasks</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 py-3">
              <p className="text-xl font-black text-gold">{captureStats.notesToday}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/45">Notes Today</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 py-3">
              <p className="text-xl font-black text-gold">{stats.inProgress}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/45">Jobs Running</p>
            </div>
          </div>
        </section>
      </div>

      {/* All Upcoming Events Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showAllUpcoming && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6 md:py-8" style={{ zIndex: 9999 }}>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAllUpcoming(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="glass w-full max-w-2xl max-h-full rounded-[2rem] relative z-10 border border-white/10 overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter italic text-white">
                      Full <span className="text-gold">Schedule</span>
                    </h3>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mt-0.5">
                      Upcoming events (next 30 days)
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowAllUpcoming(false)}
                    className="w-10 h-10 glass rounded-full flex items-center justify-center text-white/40 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                  {calendarEvents.length === 0 ? (
                    <div className="text-center py-20 text-white/20 uppercase font-black tracking-widest italic">
                      No Events Found
                    </div>
                  ) : (
                    calendarEvents.map((event, idx) => (
                      <div 
                        key={event.id || idx}
                        onClick={() => handleEventClick(event)}
                        className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/[0.08] transition-all group cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-20 text-center">
                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                              {new Date(event.start).toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                            <p className="text-lg font-black text-white leading-tight">
                              {new Date(event.start).getDate()}
                            </p>
                            <p className="text-[10px] text-gold/80 font-black uppercase tracking-tighter">
                              {new Date(event.start).toLocaleDateString('en-US', { month: 'short' })}
                            </p>
                          </div>
                          
                          <div className="flex-1 min-w-0 border-l border-white/10 pl-4">
                            <h4 className="text-base font-bold text-white group-hover:text-gold transition-colors truncate">
                              {event.summary}
                            </h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                              <span className="text-[11px] font-bold text-white/40 flex items-center gap-1.5">
                                <Clock size={12} className="text-gold" />
                                {formatEventTime(event.start, event.end)}
                              </span>
                              {event.location && (
                                <span className="text-[11px] font-bold text-white/40 flex items-center gap-1.5 truncate">
                                  <MapPin size={12} className="text-purple-400" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                            {event.hangoutLink && (
                              <a 
                                href={event.hangoutLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-500/20 transition-all"
                              >
                                <Video size={12} />
                                Join Meeting
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="p-4 bg-white/[0.02] border-t border-white/10 text-center pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))]">
                  <button 
                    onClick={() => {
                      setShowAllUpcoming(false);
                      onNavigate?.('calendar');
                    }}
                    className="text-xs font-black uppercase tracking-widest text-gold hover:text-white"
                  >
                    Open Full Calendar View
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Event Detail Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showEventDetail && selectedEvent && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4" style={{ zIndex: 10000 }}>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEventDetail(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="glass w-full max-w-lg rounded-[2rem] relative z-10 border border-white/10 overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter italic text-white">
                      Event <span className="text-gold">Detail</span>
                    </h3>
                  </div>
                  <button 
                    onClick={() => setShowEventDetail(false)}
                    className="w-10 h-10 glass rounded-full flex items-center justify-center text-white/40 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-white leading-tight">{selectedEvent.summary}</h2>
                    <div className="flex flex-wrap gap-4 mt-4">
                      <div className="flex items-center gap-2 text-gold font-bold">
                        <Clock size={16} />
                        <span className="text-sm">{formatEventTime(selectedEvent.start, selectedEvent.end)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/40 font-bold">
                        <Calendar size={16} />
                        <span className="text-sm">{new Date(selectedEvent.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <MapPin className="text-purple-400 mt-1" size={20} />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Location</p>
                        <p className="text-sm text-white/80 font-medium">{selectedEvent.location}</p>
                      </div>
                    </div>
                  )}

                  {selectedEvent.description && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Description</p>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                        {selectedEvent.description}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 pt-4">
                    {selectedEvent.hangoutLink && (
                      <a 
                        href={selectedEvent.hangoutLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-4 bg-blue-500/20 border border-blue-500/30 rounded-2xl text-blue-400 font-black uppercase tracking-widest text-sm hover:bg-blue-500/30 transition-all"
                      >
                        <Video size={20} />
                        Join Google Meet
                      </a>
                    )}
                    <button 
                      onClick={() => handleEditEvent(selectedEvent)}
                      className="flex items-center justify-center gap-2 py-4 bg-gold text-black rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_4px_20px_rgba(234,179,8,0.3)] active:scale-95 transition-all"
                    >
                      Edit Event Details
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default Today;
