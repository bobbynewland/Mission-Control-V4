import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Kanban as KanbanIcon, 
  HardDrive, 
  Search,
  Plus,
  Zap,
  Menu,
  X,
  ChevronRight,
  Radio,
  Terminal,
  Brain,
  Activity as ActivityIcon,
  Command,
  Bell,
  Settings,
  Calendar,
  FileText,
  Image,
  Users,
  BookOpen,
  CheckSquare,
  FolderOpen,
  Lightbulb,
  Clapperboard,
  FileText as FileTextIcon,
  BookOpen as ObsidianIcon
} from 'lucide-react';
import Auth from './components/Auth';
import { initGA, trackPageView, trackEvent } from './lib/analytics';
import TagManager from 'react-gtm-module';

const Kanban = lazy(() => import('./components/Kanban'));
const Projects = lazy(() => import('./components/Projects'));
const GoogleDrive = lazy(() => import('./components/GoogleDrive'));
const QuickCapture = lazy(() => import('./components/QuickCapture'));
const Today = lazy(() => import('./components/Today'));
const Agents = lazy(() => import('./components/Agents'));
const CalendarView = lazy(() => import('./components/Calendar'));
const ContentFactory = lazy(() => import('./components/ContentFactory'));
const ClientList = lazy(() => import('./components/ClientList'));
const ClientPage = lazy(() => import('./components/ClientPage'));
const ObsidianVault = lazy(() => import('./components/ObsidianVault'));
const KnowledgeHub = lazy(() => import('./components/KnowledgeHub'));
const UnifiedSearch = lazy(() => import('./components/UnifiedSearch'));

// Simplified menu - 7 main sections
const menuItems = [
  { id: 'today', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: KanbanIcon },
  { id: 'obsidian', label: 'Obsidian', icon: ObsidianIcon },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'factory', label: 'Content Factory', icon: Clapperboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'knowledge', label: 'Knowledge', icon: Brain },
];

const LoadingPane = () => (
  <div className="flex h-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('mc3_active_tab') || 'today';
    } catch (e) {
      return 'today';
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isPwaMode, setIsPwaMode] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [clientPageClient, setClientPageClient] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dialog, setDialog] = useState(null);
  const mainRef = useRef(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  // Handle navigation to ClientPage
  useEffect(() => {
    const handleNavigateClient = (e) => {
      if (e.detail) {
        setClientPageClient(e.detail);
      }
    };
    window.addEventListener('mc3_navigate_client', handleNavigateClient);
    return () => window.removeEventListener('mc3_navigate_client', handleNavigateClient);
  }, []);

  useEffect(() => {
    const handleDialog = (event) => setDialog(event.detail);
    window.addEventListener('mc3_dialog', handleDialog);
    return () => window.removeEventListener('mc3_dialog', handleDialog);
  }, []);

  const closeDialog = (value) => {
    dialog?.resolve?.(value);
    setDialog(null);
  };

  // Handle back navigation from ClientPage
  const handleClientBack = () => {
    localStorage.removeItem('mc3_client_page');
    localStorage.removeItem('mc3_client_id');
    localStorage.removeItem('mc3_client_name');
    localStorage.removeItem('mc3_client_color');
    localStorage.removeItem('mc3_client_folder_id');
    localStorage.removeItem('mc3_client_folder_url');
    setClientPageClient(null);
  };

  // Listen for folder created events
  useEffect(() => {
    const handleFolderCreated = (e) => {
      if (e.detail && clientPageClient) {
        setClientPageClient(prev => ({
          ...prev,
          folderId: e.detail.folderId,
          folderUrl: e.detail.folderUrl
        }));
      }
    };
    window.addEventListener('mc3_client_folder_created', handleFolderCreated);
    return () => window.removeEventListener('mc3_client_folder_created', handleFolderCreated);
  }, [clientPageClient]);

  useEffect(() => {
    // Safely check localStorage with try-catch for SSR/hydration safety
    try {
      const auth = localStorage.getItem('mc_auth');
      setIsAuthenticated(auth === 'true');
    } catch (e) {
      setIsAuthenticated(false);
    }
    
    const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (GA_ID) initGA(GA_ID);

    const GTM_ID = import.meta.env.VITE_GTM_ID;
    if (GTM_ID) TagManager.initialize({ gtmId: GTM_ID });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      trackPageView(activeTab);
      try {
        localStorage.setItem('mc3_active_tab', activeTab);
      } catch (e) {
        console.error('Failed to save active tab to localStorage');
      }
    }
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const updatePwaMode = () => {
      setIsPwaMode(Boolean(media.matches || window.navigator.standalone));
    };
    updatePwaMode();
    media.addEventListener?.('change', updatePwaMode);
    return () => media.removeEventListener?.('change', updatePwaMode);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Cmd/Ctrl + N for capture
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setActiveTab('capture');
      }
      // Escape to close search
      if (e.key === 'Escape') {
        setShowSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAuth = (authenticated) => {
    setIsAuthenticated(authenticated);
    try {
      localStorage.setItem('mc_auth', authenticated ? 'true' : 'false');
    } catch (e) {
      console.log('localStorage not available');
    }
  };

  const handleNav = (id) => {
    trackEvent('Navigation', 'Click', id);
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  const handleTouchStart = (e) => {
    if (!isPwaMode || window.innerWidth >= 1024 || mobileMenuOpen || isRefreshing) return;
    const scrollTop = mainRef.current?.scrollTop || 0;
    const isAtTop = scrollTop <= 0;
    if (!isAtTop) return;
    touchStartY.current = e.touches[0].clientY;
    isPulling.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current || !isPwaMode || window.innerWidth >= 1024 || isRefreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    // Only trigger if pulling DOWN (delta > 0) and at least 10px
    if (delta <= 10) {
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(110, (delta - 10) * 0.45));
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= 75 && isPwaMode && !isRefreshing) {
      setIsRefreshing(true);
      setTimeout(() => {
        window.location.reload();
      }, 120);
      return;
    }

    setPullDistance(0);
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth onAuth={handleAuth} />;
  }

  return (
    <div className="app-container mobile-app-shell flex h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-background text-white font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/5 p-4">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">
            Mission <span className="text-gold">Control</span>
          </h1>
          <p className="text-[8px] font-mono text-white/40 uppercase tracking-[0.2em]">
            System v3.1 // Clean
          </p>
        </div>
        
        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-gold/10 border border-gold/30 text-gold' 
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="text-sm font-bold uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="pt-4 border-t border-white/5 space-y-2">
          <button 
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition-all"
          >
            <Command size={18} />
            <span className="text-sm">Search</span>
            <span className="ml-auto text-xs text-white/20">⌘K</span>
          </button>
          <div className="flex items-center gap-3 p-3 glass rounded-xl">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gold/20">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Bobby" alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Bobby Newland</p>
              <p className="text-[10px] text-white/40">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div
        ref={mainRef}
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <header style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))' }} className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0a0a0a]/92 backdrop-blur-xl lg:px-6 lg:pb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 glass rounded-xl text-white/60 hover:text-white transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="lg:hidden">
              <h1 className="text-xl font-black tracking-tighter uppercase italic">
                Mission <span className="text-gold">Control</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSearch(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 glass rounded-xl text-white/40 hover:text-white transition-colors"
            >
              <Search size={16} />
              <span className="text-xs">Search...</span>
              <span className="text-xs text-white/20 ml-1">⌘K</span>
            </button>
            <button 
              onClick={() => setActiveTab('capture')}
              className="flex items-center gap-2 px-3 py-2 bg-gold text-black rounded-xl font-bold text-xs uppercase hover:bg-gold/80 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Capture</span>
            </button>
          </div>
        </header>

        {/* Pull to refresh indicator */}
        {isPwaMode && (
          <div
            className="lg:hidden flex justify-center pointer-events-none"
            style={{ height: `${pullDistance}px`, transition: isRefreshing ? 'none' : 'height 120ms ease-out' }}
          >
            <div className="text-[10px] text-white/50 font-mono uppercase tracking-widest">
              {isRefreshing ? 'Refreshing...' : pullDistance >= 75 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="mobile-app-main flex-1 flex min-w-0 flex-col overflow-hidden overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:overflow-x-hidden lg:overflow-y-hidden lg:pb-0">
          <Suspense fallback={<LoadingPane />}>
            {activeTab === 'today' && <Today onNavigate={setActiveTab} />}
            {activeTab === 'calendar' && <CalendarView />}
            {activeTab === 'obsidian' && <ObsidianVault />}
            {activeTab === 'factory' && <ContentFactory />}
            {activeTab === 'clients' && !clientPageClient && <ClientList />}
            {activeTab === 'clients' && clientPageClient && <ClientPage client={clientPageClient} onBack={handleClientBack} />}
            {activeTab === 'knowledge' && <KnowledgeHub />}
            {activeTab === 'tasks' && <Kanban />}
            {activeTab === 'projects' && <Projects />}
            {activeTab === 'capture' && <QuickCapture onNavigate={setActiveTab} />}
            {activeTab === 'drive' && <GoogleDrive />}
            {activeTab === 'agents' && <Agents />}
          </Suspense>
        </main>

        {/* Mobile Bottom Navigation (5 items) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-white/10 safe-area-pb z-30">
          <div className="flex items-center justify-around py-2 px-1">
            {[
{ id: 'today', icon: LayoutDashboard, label: 'Home'},
              { id: 'tasks', icon: KanbanIcon, label: 'Tasks'},
              { id: 'obsidian', icon: ObsidianIcon, label: 'Vault'},
              { id: 'factory', icon: Clapperboard, label: 'Factory'},
              { id: 'calendar', icon: Calendar, label: 'Cal'},
              { id: 'knowledge', icon: Brain, label: 'Brain'},
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 min-w-[64px] rounded-xl transition-all ${
                  activeTab === item.id 
                    ? 'text-gold' 
                    : 'text-white/40'
                }`}
              >
                <item.icon size={22} className={activeTab === item.id ? 'text-gold' : ''} />
                <span className="text-[10px] font-bold uppercase">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-[280px] bg-[#0a0a0a] border-r border-white/10 z-50 lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tighter italic">
                    Mission <span className="text-gold">Control</span>
                  </h2>
                  <p className="text-[8px] text-white/40 font-mono uppercase">v3.1 // Clean</p>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-white/40 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <p className="text-[8px] text-white/30 uppercase tracking-widest px-2 mb-2">Navigation</p>
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      activeTab === item.id 
                        ? 'bg-gold/10 border border-gold/30 text-gold' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} />
                      <span className="text-sm font-bold uppercase tracking-wider">{item.label}</span>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>

              <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-3 p-3 glass rounded-xl">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gold/20">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Bobby" alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Bobby Newland</p>
                    <p className="text-[10px] text-white/40">Admin</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global Search Modal */}
      <AnimatePresence>
        {showSearch && (
          <Suspense fallback={null}>
            <UnifiedSearch 
              onClose={() => setShowSearch(false)} 
              onNavigate={(tab) => {
                setActiveTab(tab);
                setShowSearch(false);
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialog && (
          <div className="fixed inset-0 z-[200] grid place-items-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => closeDialog(false)}
            />
            <motion.div
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 18, opacity: 0, scale: 0.98 }}
              className="glass relative z-10 w-full max-w-sm rounded-2xl p-5 shadow-2xl"
            >
              <h2 className="text-lg font-black text-white">{dialog.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{dialog.message}</p>
              <div className="mt-5 flex gap-2">
                {dialog.type === 'confirm' && (
                  <button
                    onClick={() => closeDialog(false)}
                    className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white/70"
                  >
                    {dialog.cancelLabel}
                  </button>
                )}
                <button
                  onClick={() => closeDialog(true)}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-black ${
                    dialog.tone === 'danger'
                      ? 'bg-red-500 text-white'
                      : 'bg-gold text-black'
                  }`}
                >
                  {dialog.confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-gold/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple/5 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
};

export default App;
