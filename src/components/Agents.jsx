import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Terminal,
  Settings,
  Activity,
  Cpu,
  HardDrive,
  ArrowRight,
  Loader2,
  Play,
  Pause,
  Square,
  Calendar,
  X,
  Code
} from 'lucide-react';
import { db, database, ref, get } from '../lib/firebase';

const Agents = () => {
  const [loading, setLoading] = useState(true);
  const [cronJobs, setCronJobs] = useState([]);
  const [agents, setAgents] = useState([
    { id: 'cos', name: 'Winslow (Win)', role: 'Chief of Staff / CTO', status: 'active', model: 'Gemini 3.1 Pro', lastActive: 'Now' },
    { id: 'research', name: 'Research Team', role: 'Market & Trend Analysis', status: 'active', model: 'Kimi Swarm (10 Nodes)', lastActive: 'Ongoing' },
    { id: 'engineering', name: 'Engineering Team', role: 'Full-Stack Development', status: 'idle', model: 'Kimi Swarm (10 Nodes)', lastActive: '2h ago' },
    { id: 'creative', name: 'Creative Team', role: 'Image & Content Gen', status: 'active', model: 'Nano Banana / fal.ai', lastActive: '15m ago' },
    { id: 'ops', name: 'Operations', role: 'Task & System Mgmt', status: 'active', model: 'OpenClaw Gateway', lastActive: 'Now' }
  ]);
  const [systemStats, setSystemStats] = useState({
    uptime: '0h',
    diskUsage: '0%',
    memoryUsage: '0%',
    apiHealth: 100
  });
  const [activeTab, setActiveTab] = useState('crons');
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobDetail, setShowJobDetail] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Load telemetry from Firebase (stats, cron jobs, agents)
      const teleSnap = await get(ref(database, 'workspaces/winslow_main/live_telemetry'));
      if (teleSnap.exists()) {
        const data = teleSnap.val();
        console.log('Telemetry received:', data);
        
        // System Stats
        setSystemStats({
          uptime: data?.stats?.uptime || '0h',
          diskUsage: data?.stats?.diskUsage || '0%',
          memoryUsage: data?.stats?.memoryUsage || '0%',
          apiHealth: data?.stats?.apiHealthPct || 100
        });

        // Cron Jobs - ensure we map the status correctly for icons
        if (data.cronJobs) {
          setCronJobs(data.cronJobs);
        } else if (data.jobs) {
          // Fallback to old path if needed
          setCronJobs(data.jobs);
        }

        // AI Agents
        if (data.agents) {
          setAgents(data.agents);
        }
      }
    } catch (err) {
      console.error('Error loading agent data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleJobEnabled = async (job) => {
    const nextEnabled = !job.enabled;
    const nextStatus = nextEnabled ? 'idle' : 'paused';
    
    // Optimistic UI update
    setCronJobs(prev => prev.map(j => j.id === job.id ? { ...j, enabled: nextEnabled, status: nextStatus } : j));
    
    try {
      // 1. Post to agent_tasks so Winslow can actually run the cron command on the server
      const newTask = {
        type: 'cron-control',
        jobId: job.id,
        action: nextEnabled ? 'enable' : 'disable',
        status: 'queued',
        createdAt: Date.now()
      };
      
      // Use the db.agentActivity structure since it maps to agent_tasks in some contexts, 
      // or just do a manual push to the agent_tasks path
      const { push: fbPush, ref: fbRef } = await import('../lib/firebase');
      await fbPush(fbRef(database, 'workspaces/winslow_main/agent_tasks'), newTask);
      
      // 2. Also update live_telemetry immediately for UI feedback
      const jobIdx = cronJobs.findIndex(j => j.id === job.id);
      if (jobIdx !== -1) {
        await fetch(`https://winslow-756c3-default-rtdb.firebaseio.com/workspaces/winslow_main/live_telemetry/cronJobs/${jobIdx}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: nextEnabled, status: nextStatus })
        });
      }
    } catch (err) {
      console.error('Failed to toggle job:', err);
      // Revert on failure
      loadData();
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <Loader2 size={16} className="animate-spin text-green-400" />;
      case 'success': return <CheckCircle2 size={16} className="text-green-400" />;
      case 'error': return <XCircle size={16} className="text-red-400" />;
      case 'paused': return <Pause size={16} className="text-white/40" />;
      case 'idle': return <Clock size={16} className="text-yellow-400" />;
      default: return <AlertCircle size={16} className="text-white/40" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-green-400';
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'paused': return 'bg-white/30';
      case 'idle': return 'bg-yellow-400';
      default: return 'bg-white/30';
    }
  };

  if (loading && cronJobs.length === 0) {
    return (
      <div className="p-10 flex items-center justify-center">
        <RefreshCw className="animate-spin text-gold" size={28} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 pb-28 lg:px-6 lg:py-6 lg:pb-8">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gold/90">
                <Radio size={14} /> Agent Command Center
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">Agents & Automation</h2>
            </div>
            <button 
              onClick={loadData}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase hover:bg-white/10 flex items-center gap-2"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </section>

        {/* System Health Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-green-400" />
              <span className="text-[10px] text-white/40 uppercase">Uptime</span>
            </div>
            <p className="text-xl font-black text-white">{systemStats.uptime}</p>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive size={16} className="text-blue-400" />
              <span className="text-[10px] text-white/40 uppercase">Disk</span>
            </div>
            <p className="text-xl font-black text-white">{systemStats.diskUsage}</p>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={16} className="text-purple-400" />
              <span className="text-[10px] text-white/40 uppercase">Memory</span>
            </div>
            <p className="text-xl font-black text-white">{systemStats.memoryUsage}</p>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-gold" />
              <span className="text-[10px] text-white/40 uppercase">API Health</span>
            </div>
            <p className="text-xl font-black text-white">{systemStats.apiHealth}%</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10">
          {[
            { id: 'crons', label: 'Cron Jobs', count: cronJobs.length },
            { id: 'agents', label: 'AI Agents', count: agents.length },
            { id: 'system', label: 'System' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === tab.id 
                  ? 'text-gold border-gold' 
                  : 'text-white/40 border-transparent hover:text-white/60'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-white/10 rounded text-[10px]">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Cron Jobs Tab */}
        {activeTab === 'crons' && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="space-y-3">
              {cronJobs.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <Clock size={32} className="mx-auto mb-3 opacity-30" />
                  <p>No cron jobs found</p>
                </div>
              ) : (
                cronJobs.map(job => (
                  <div 
                    key={job.id} 
                    onClick={() => {
                      setSelectedJob(job);
                      setShowJobDetail(true);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    job.status === 'error' 
                      ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' 
                      : job.status === 'running'
                      ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                      : 'bg-white/5 border-white/10 hover:border-gold/30 hover:bg-white/[0.08]'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(job.status)} ${job.status === 'running' ? 'animate-pulse' : ''}`} />
                        {getStatusIcon(job.status)}
                        <div>
                          <h4 className="text-sm font-bold text-white">{job.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar size={12} className="text-white/40" />
                            <p className="text-[10px] text-gold">{job.schedule}</p>
                            {!job.enabled && (
                              <span className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] text-white/40">PAUSED</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleJobEnabled(job);
                          }}
                          className={`p-1.5 rounded-lg border transition-all ${
                            job.enabled 
                              ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20' 
                              : 'bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20'
                          }`}
                          title={job.enabled ? "Pause Job" : "Resume Job"}
                        >
                          {job.enabled ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                          job.status === 'running' ? 'bg-green-500/20 text-green-400' :
                          job.status === 'success' ? 'bg-blue-500/20 text-blue-400' :
                          job.status === 'error' ? 'bg-red-500/20 text-red-400' :
                          job.status === 'paused' ? 'bg-white/10 text-white/40' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-white/5">
                      <div>
                        <p className="text-[10px] text-white/40 uppercase">Last Run</p>
                        <p className="text-xs text-white/60">{job.lastRun}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase">Duration</p>
                        <p className="text-xs text-white/60">{job.lastDuration}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase">Next Run</p>
                        <p className="text-xs text-white/60">{job.nextRun}</p>
                      </div>
                    </div>
                    
                    {job.consecutiveErrors > 0 && (
                      <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-[10px] text-red-400">
                          ⚠️ {job.consecutiveErrors} consecutive errors
                        </p>
                        {job.lastError && (
                          <p className="text-[9px] text-red-300/70 mt-1 truncate">{job.lastError}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <section className="space-y-6">
            {/* Leadership Tier */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Leadership</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.slice(0, 2).map(agent => (
                  <div key={agent.id} className="p-5 bg-gold/5 rounded-[2rem] border border-gold/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Radio size={40} className="text-gold" />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full bg-gold shadow-[0_0_10px_rgba(234,179,8,0.5)]`} />
                        <h4 className="text-lg font-black text-white italic uppercase tracking-tight">{agent.name}</h4>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-gold text-black px-2 py-0.5 rounded-full">{agent.role.split('/')[0]}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      <span>{agent.model}</span>
                      <span className="flex items-center gap-1.5"><Clock size={10} /> {agent.lastActive}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Tier */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Specialized Teams</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {agents.slice(2).map(agent => (
                  <div key={agent.id} className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                      <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-400' : 'bg-white/20'}`} />
                    </div>
                    <p className="text-[10px] text-gold font-bold uppercase tracking-wider mb-2">{agent.role}</p>
                    <div className="text-[10px] text-white/30 font-mono truncate">{agent.model}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/80 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-left">
                  <Terminal size={20} className="text-white/40 mb-2" />
                  <span className="text-sm font-bold text-white">Run Command</span>
                </button>
                <button className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-left">
                  <Play size={20} className="text-green-400 mb-2" />
                  <span className="text-sm font-bold text-white">Start Agent</span>
                </button>
                <button className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-left">
                  <Pause size={20} className="text-yellow-400 mb-2" />
                  <span className="text-sm font-bold text-white">Pause All</span>
                </button>
                <button className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-left">
                  <Settings size={20} className="text-white/40 mb-2" />
                  <span className="text-sm font-bold text-white">Settings</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/80 mb-3">System Logs</h3>
              <div className="p-4 bg-black/40 rounded-xl font-mono text-xs text-white/40 space-y-1 max-h-48 overflow-y-auto">
                <div>[14:02:39] Disk check: 48% usage ✓</div>
                <div>[13:02:39] Disk check: 49% usage ✓</div>
                <div>[12:02:39] Disk check: 48% usage ✓</div>
                <div>[11:02:39] Disk check: 48% usage ✓</div>
                <div className="text-green-400">[09:00:00] Daily Prompt Pack Drop completed ✓</div>
                <div className="text-yellow-400">[07:30:00] Morning Briefing generated ✓</div>
                <div>[00:00:00] GA4 Real-time Sync started ✓</div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Cron Job Detail Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showJobDetail && selectedJob && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4" style={{ zIndex: 10000 }}>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowJobDetail(false)}
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
                      Job <span className="text-gold">Detail</span>
                    </h3>
                  </div>
                  <button 
                    onClick={() => setShowJobDetail(false)}
                    className="w-10 h-10 glass rounded-full flex items-center justify-center text-white/40 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh] no-scrollbar">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(selectedJob.status)}`} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Current Status: {selectedJob.status}</span>
                    </div>
                    <h2 className="text-2xl font-black text-white leading-tight">{selectedJob.name}</h2>
                    <p className="text-sm text-gold font-bold mt-1 flex items-center gap-2">
                      <Calendar size={14} /> {selectedJob.schedule}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Last Run</p>
                        <p className="text-xs text-white/80 font-bold">{selectedJob.lastRun}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Last Duration</p>
                        <p className="text-xs text-white/80 font-bold">{selectedJob.lastDuration}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Next Scheduled</p>
                      <p className="text-xs text-white/80 font-bold">{selectedJob.nextRun}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">
                      <Code size={14} /> Execution Payload
                    </h4>
                    <div className="p-5 bg-black/40 rounded-[1.5rem] border border-white/5 font-mono text-xs leading-relaxed text-green-400/90 break-all whitespace-pre-wrap">
                      {selectedJob.payload?.text || selectedJob.payload?.message || JSON.stringify(selectedJob.payload, null, 2)}
                    </div>
                  </div>

                  {selectedJob.lastError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Last Known Error</p>
                      <p className="text-xs text-red-300/70 font-mono italic">{selectedJob.lastError}</p>
                    </div>
                  )}

                  <div className="pt-4">
                    <button 
                      onClick={() => setShowJobDetail(false)}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-sm hover:bg-white/10 transition-all"
                    >
                      Close Detail
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

export default Agents;