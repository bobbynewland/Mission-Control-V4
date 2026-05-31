import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search,
  ChevronRight,
  X,
  Users,
  Folder
} from 'lucide-react';
import { db } from '../lib/firebase';
import { notify } from '../lib/dialogs';

const ClientList = () => {
  const [clients, setClients] = useState([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', color: '#ffd700', notes: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Load clients from Firebase
  useEffect(() => {
    const unsubscribe = db.clients.subscribe((data) => {
      if (data) {
        const parsed = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        setClients(parsed);
      }
    });
    return () => unsubscribe();
  }, []);

  const getFilteredClients = () => {
    if (!searchQuery) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => 
      c.name?.toLowerCase().includes(q) || 
      c.notes?.toLowerCase().includes(q)
    );
  };

  // Create Drive folder via API
  const createDriveFolder = async (clientName, clientId) => {
    try {
      const res = await fetch('/api/clients/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName, clientId })
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to create Drive folder:', err);
      return { success: false };
    }
  };

  // Add new client with Drive folder
  const addClient = async () => {
    if (!newClient.name.trim()) return;
    setIsCreating(true);

    try {
      // First push to Firebase to get the ID
      const timestamp = new Date().toISOString();
      const clientData = {
        name: newClient.name.trim(),
        color: newClient.color,
        notes: newClient.notes || '',
        createdAt: timestamp,
        files: []
      };

      // Push and get the key
      let clientId;
      const result = await db.clients.push(clientData);
      clientId = result.key || result.id;

      // Create Drive folder for this client
      const folderResult = await createDriveFolder(newClient.name.trim(), clientId);
      
      // Update with folder info if successful
      if (folderResult.success && folderResult.folderId) {
        await db.clients.update(clientId, {
          folderId: folderResult.folderId,
          folderUrl: folderResult.folderUrl
        });
      }

      setNewClient({ name: '', color: '#ffd700', notes: '' });
      setShowAddClient(false);
    } catch (err) {
      console.error('Failed to add client:', err);
      await notify('Failed to add client. Please try again.', { title: 'Client Error' });
    } finally {
      setIsCreating(false);
    }
  };

  // Navigate to ClientPage
  const openClient = (client) => {
    localStorage.setItem('mc3_client_page', 'true');
    localStorage.setItem('mc3_client_id', client.id);
    localStorage.setItem('mc3_client_name', client.name);
    localStorage.setItem('mc3_client_color', client.color || '#ffd700');
    // Trigger a re-render/navigation
    window.dispatchEvent(new CustomEvent('mc3_navigate_client', { detail: client }));
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold/90">
              Client Management
            </p>
            <h1 className="text-2xl font-black">Clients</h1>
          </div>
          <button
            onClick={() => setShowAddClient(true)}
            className="w-12 h-12 bg-gold rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={24} className="text-black" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
          />
        </div>
      </div>

      {/* Client List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {getFilteredClients().length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/20">
            <Users size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">No clients yet</p>
            <p className="text-xs text-white/30 mt-1">Tap + to add your first client</p>
          </div>
        ) : (
          getFilteredClients().map(client => (
            <motion.button
              key={client.id}
              layout
              onClick={() => openClient(client)}
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 text-left hover:border-gold/30 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                {/* Color Dot */}
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: client.color || '#ffd700' }}
                />
                
                {/* Client Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{client.name}</p>
                  {client.notes && (
                    <p className="text-xs text-white/40 truncate mt-0.5">{client.notes}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
                    {client.files?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Folder size={10} />
                        {client.files.length} files
                      </span>
                    )}
                    {client.folderId && (
                      <span className="text-gold/60">Drive folder</span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight size={20} className="text-white/30" />
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* Add Client Modal */}
      <AnimatePresence>
        {showAddClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowAddClient(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">Add New Client</h2>
                <button onClick={() => setShowAddClient(false)} className="p-2">
                  <X size={20} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Client Name</label>
                  <input
                    type="text"
                    value={newClient.name}
                    onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                    placeholder="Company name..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Color</label>
                  <div className="flex gap-2">
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#ffd700'].map(color => (
                      <button
                        key={color}
                        onClick={() => setNewClient({...newClient, color})}
                        className={`w-10 h-10 rounded-xl transition-transform ${newClient.color === color ? 'ring-2 ring-white scale-110' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Notes</label>
                  <textarea
                    value={newClient.notes}
                    onChange={(e) => setNewClient({...newClient, notes: e.target.value})}
                    placeholder="Brief notes about this client..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50 resize-none"
                  />
                </div>

                <p className="text-xs text-white/40">
                  A Google Drive folder will be automatically created for this client.
                </p>
              </div>

              <button
                onClick={addClient}
                disabled={!newClient.name.trim() || isCreating}
                className="w-full mt-6 py-3 bg-gold text-black font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Add Client'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientList;
