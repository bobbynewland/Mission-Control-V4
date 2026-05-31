import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  LayoutGrid, 
  FileText, 
  HardDrive, 
  ExternalLink,
  Folder,
  Plus
} from 'lucide-react';
import ClientKanban from './ClientKanban';
import ClientNotes from './ClientNotes';
import { notify } from '../lib/dialogs';

const TABS = [
  { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'drive', label: 'Drive', icon: HardDrive },
];

const ClientPage = ({ client, onBack }) => {
  const [activeTab, setActiveTab] = useState('kanban');
  const [clientData, setClientData] = useState(client);

  // Refresh client data when prop changes
  useEffect(() => {
    if (client) {
      setClientData(client);
    }
  }, [client]);

  const openDriveFolder = () => {
    if (clientData?.folderUrl) {
      window.open(clientData.folderUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: clientData?.color || '#ffd700' }}
            />
            <h1 className="text-xl font-black truncate">{clientData?.name || 'Client'}</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'bg-gold text-black'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'kanban' && (
            <motion.div
              key="kanban"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <ClientKanban clientId={clientData?.id} />
            </motion.div>
          )}

          {activeTab === 'notes' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <ClientNotes clientId={clientData?.id} />
            </motion.div>
          )}

          {activeTab === 'drive' && (
            <motion.div
              key="drive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <DriveTab client={clientData} onOpenFolder={openDriveFolder} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Drive Tab Content
const DriveTab = ({ client, onOpenFolder }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState(client?.folderId ? 'exists' : 'none');

  const createFolder = async () => {
    if (!client?.id || !client?.name) return;
    setIsCreating(true);

    try {
      const res = await fetch('/api/clients/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: client.name, clientId: client.id })
      });
      const data = await res.json();

      if (data.success && data.folderId) {
        // Update localStorage with new folder info
        localStorage.setItem('mc3_client_folder_id', data.folderId);
        localStorage.setItem('mc3_client_folder_url', data.folderUrl);
        setStatus('exists');
        // Force parent re-render via event
        window.dispatchEvent(new CustomEvent('mc3_client_folder_created', { 
          detail: { folderId: data.folderId, folderUrl: data.folderUrl } 
        }));
        onOpenFolder();
      } else {
        await notify('Failed to create Drive folder: ' + (data.message || 'Unknown error'), { title: 'Drive Error' });
      }
    } catch (err) {
      console.error('Failed to create folder:', err);
      await notify('Failed to create Drive folder. Please try again.', { title: 'Drive Error' });
    } finally {
      setIsCreating(false);
    }
  };

  const folderId = client?.folderId || localStorage.getItem('mc3_client_folder_id');
  const folderUrl = client?.folderUrl || localStorage.getItem('mc3_client_folder_url');

  return (
    <div className="flex-1 p-6">
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
          <HardDrive size={40} className="text-blue-400" />
        </div>

        <h2 className="text-xl font-black mb-2">Google Drive</h2>
        <p className="text-white/50 text-sm mb-8 max-w-xs">
          {folderId 
            ? 'Your client folder is ready. Open it to manage files and share with your team.'
            : 'Create a dedicated Drive folder for this client to store documents and assets.'}
        </p>

        {folderId || status === 'exists' ? (
          <div className="space-y-4 w-full max-w-sm">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Folder size={16} className="text-gold" />
                <span className="text-sm font-bold text-white">{client?.name} Files</span>
              </div>
              <p className="text-xs text-white/40">Folder ID: {folderId || '—'}</p>
            </div>

            <button
              onClick={onOpenFolder}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold uppercase tracking-wider rounded-xl transition-colors"
            >
              <ExternalLink size={16} />
              Open Folder
            </button>
          </div>
        ) : (
          <button
            onClick={createFolder}
            disabled={isCreating}
            className="flex items-center gap-2 px-6 py-3 bg-gold text-black font-black uppercase tracking-wider rounded-xl disabled:opacity-50 transition-colors"
          >
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Create Drive Folder
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default ClientPage;
