import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Youtube,
  Facebook,
  Instagram,
  Music,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Upload,
  Clock,
  ChevronDown,
  ChevronUp,
  Settings,
  Info,
  Zap,
  Loader2,
  Globe
} from 'lucide-react';

const PLATFORM_STATUS_PATH = 'workspaces/winslow_main/platformConnections';
const TASKS_PATH = 'workspaces/winslow_main/tasks';
const LOG_PATH = 'workspaces/winslow_main/log';

const PLATFORMS = [
  {
    key: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'bg-red-500',
    colorText: 'text-red-500',
    functional: true,
    description: 'Full video upload support',
    setupUrl: 'https://console.cloud.google.com/',
    docs: 'Enable YouTube Data API v3 in Google Cloud Console'
  },
  {
    key: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600',
    colorText: 'text-blue-600',
    functional: true,
    description: 'Page posts and Reels',
    setupUrl: 'https://developers.facebook.com/',
    docs: 'Create a Business app with Facebook Pages product'
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    icon: Music,
    color: 'bg-gray-500',
    colorText: 'text-gray-500',
    functional: false,
    description: 'API requires 100k+ followers',
    setupUrl: 'https://developers.tiktok.com/',
    docs: 'Requires Creator API approval (100k+ followers)',
    alternative: 'Use Buffer, Publer, or Later for third-party posting'
  },
  {
    key: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-tr from-purple-500 via-pink-500 to-yellow-500',
    colorText: 'text-pink-500',
    functional: false,
    description: 'Requires Facebook Business verification',
    setupUrl: 'https://developers.facebook.com/',
    docs: 'Add Instagram product to your FB Business app'
  }
];

const PlatformPublisher = () => {
  const [platforms, setPlatforms] = useState({});
  const [readyTasks, setReadyTasks] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [expandedPlatform, setExpandedPlatform] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => {
    loadData();
    
    // Subscribe to platform status updates
    const platformRef = window.db ? window.db.ref(PLATFORM_STATUS_PATH) : null;
    if (platformRef) {
      const unsubscribe = window.db.onValue(platformRef, (snapshot) => {
        setPlatforms(snapshot.val() || {});
      });
      return () => unsubscribe && unsubscribe();
    }
  }, []);

  const loadData = async () => {
    if (!window.db) {
      setLoading(false);
      return;
    }

    try {
      // Load platform connections
      const platformSnap = await window.db.get(window.db.ref(PLATFORM_STATUS_PATH));
      setPlatforms(platformSnap.val() || {});

      // Load ready to publish tasks
      const tasksSnap = await window.db.get(window.db.ref(TASKS_PATH));
      const allTasks = tasksSnap.val() || {};
      const ready = Object.entries(allTasks)
        .filter(([id, task]) => task.column === 'ready_publish' || task.status === 'ready_publish')
        .map(([id, task]) => ({ id, ...task }));
      setReadyTasks(ready);

      // Load recent activity
      const logSnap = await window.db.get(window.db.ref(LOG_PATH));
      const logs = logSnap.val() || {};
      const publishLogs = Object.entries(logs)
        .filter(([id, log]) => log.type === 'publish')
        .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
        .slice(0, 10)
        .map(([id, log]) => ({ id, ...log }));
      setRecentActivity(publishLogs);

    } catch (error) {
      console.error('Error loading platform data:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualPublish = async () => {
    if (readyTasks.length === 0) return;
    
    setPublishing(true);
    
    // Trigger the platform-poster script via an API call
    // For now, we'll show a notification
    try {
      // In a real implementation, this would call an API endpoint
      // that runs the platform-poster.js script
      alert('Manual publish triggered! This would run platform-poster.js in a production setup.');
    } catch (error) {
      console.error('Publish error:', error);
    } finally {
      setPublishing(false);
    }
  };

  const getPlatformStatus = (platformKey) => {
    const p = platforms[platformKey];
    if (!p) return 'unknown';
    return p.connected ? 'connected' : 'disconnected';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'disconnected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const functionalPlatforms = PLATFORMS.filter(p => p.functional);
  const unavailablePlatforms = PLATFORMS.filter(p => !p.functional);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Platform Publisher</h2>
              <p className="text-xs text-slate-400">Auto-post to social platforms</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowActivity(!showActivity)}
              className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            >
              <Clock className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={loadData}
              className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ready to Publish Banner */}
        {readyTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-400">
                    {readyTasks.length} task{readyTasks.length > 1 ? 's' : ''} ready to publish
                  </p>
                  <p className="text-xs text-slate-400">
                    {readyTasks.map(t => t.title).slice(0, 2).join(', ')}
                    {readyTasks.length > 2 ? ` +${readyTasks.length - 2} more` : ''}
                  </p>
                </div>
              </div>
              
              <button
                onClick={triggerManualPublish}
                disabled={publishing}
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {publishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Publish Now
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Functional Platforms */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Functional
              </h3>
              <div className="space-y-2">
                {functionalPlatforms.map((platform) => {
                  const Icon = platform.icon;
                  const status = getPlatformStatus(platform.key);
                  const platformData = platforms[platform.key];
                  const isExpanded = expandedPlatform === platform.key;

                  return (
                    <div
                      key={platform.key}
                      className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                        onClick={() => setExpandedPlatform(isExpanded ? null : platform.key)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${platform.color} flex items-center justify-center`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{platform.name}</span>
                              {getStatusIcon(status)}
                            </div>
                            <p className="text-xs text-slate-400">{platform.description}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {status === 'disconnected' && (
                            <button
                              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(platform.setupUrl, '_blank');
                              }}
                            >
                              Connect
                            </button>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 border-t border-slate-700/50 mt-3">
                              <div className="space-y-3">
                                <div className="flex items-start gap-2">
                                  <Info className="w-4 h-4 text-slate-400 mt-0.5" />
                                  <div>
                                    <p className="text-sm text-slate-300">{platform.docs}</p>
                                    <a
                                      href={platform.setupUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1"
                                    >
                                      Open setup guide <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                                
                                {platformData?.lastChecked && (
                                  <div className="text-xs text-slate-500">
                                    Last checked: {formatTime(platformData.lastChecked)}
                                  </div>
                                )}

                                {platformData?.error && (
                                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <p className="text-xs text-red-400">{platformData.error}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unavailable Platforms */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Requires Approval
              </h3>
              <div className="space-y-2">
                {unavailablePlatforms.map((platform) => {
                  const Icon = platform.icon;
                  const isExpanded = expandedPlatform === platform.key;

                  return (
                    <div
                      key={platform.key}
                      className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden opacity-75"
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/20 transition-colors"
                        onClick={() => setExpandedPlatform(isExpanded ? null : platform.key)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${platform.color} flex items-center justify-center`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-300">{platform.name}</span>
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            </div>
                            <p className="text-xs text-slate-500">{platform.description}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs font-medium transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(platform.setupUrl, '_blank');
                            }}
                          >
                            Learn More
                          </button>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 border-t border-slate-700/30 mt-3">
                              <div className="space-y-3">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                                  <p className="text-sm text-slate-400">{platform.docs}</p>
                                </div>
                                
                                {platform.alternative && (
                                  <div className="flex items-start gap-2">
                                    <Globe className="w-4 h-4 text-blue-400 mt-0.5" />
                                    <p className="text-sm text-slate-400">{platform.alternative}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <AnimatePresence>
              {showActivity && recentActivity.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                >
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                    Recent Activity
                  </h3>
                  <div className="space-y-2">
                    {recentActivity.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">{log.taskTitle}</span>
                          <span className="text-xs text-slate-500">{formatTime(log.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {log.platforms?.map((p) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-end z-50"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-h-[80vh] bg-slate-800 rounded-t-2xl p-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Platform Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <XCircle className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-700/50 border border-slate-600">
                  <h4 className="font-medium text-white mb-2">Environment Variables</h4>
                  <p className="text-sm text-slate-400 mb-3">
                    Configure API credentials in your <code className="text-xs bg-slate-600 px-1 py-0.5 rounded">.env</code> file.
                  </p>
                  <a
                    href="https://github.com/your-repo/mission-control-v3/blob/main/.env.example"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                  >
                    View .env.example <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-4 rounded-xl bg-slate-700/50 border border-slate-600">
                  <h4 className="font-medium text-white mb-2">Auto-Publish Schedule</h4>
                  <p className="text-sm text-slate-400">
                    Platform poster runs every 2 hours via cron job.
                  </p>
                  <code className="block mt-2 text-xs bg-slate-600 p-2 rounded text-slate-300">
                    0 */2 * * * - Check ready_publish tasks
                  </code>
                </div>

                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-400 mb-1">Security Note</h4>
                      <p className="text-sm text-slate-400">
                        OAuth tokens are stored in environment variables, not in Firebase.
                        Tokens are automatically refreshed for YouTube.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlatformPublisher;
