import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Users,
  FileText,
  Image,
  ChevronRight,
  ChevronDown,
  X,
  Copy,
  ExternalLink,
  Search,
  Cloud
} from 'lucide-react';
import { db } from '../lib/firebase';

const ClientManager = () => {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [viewingClient, setViewingClient] = useState(null);
  const [newClient, setNewClient] = useState({ name: '', color: '#ffd700', notes: '' });
  const [newFile, setNewFile] = useState({ name: '', type: 'notes', url: '', notes: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Default client structure
  const DEFAULT_CLIENTS = [
    {
      id: 'client-1',
      name: 'Acme Corp',
      color: '#3b82f6',
      notes: 'Main marketing client - automotive niche',
      createdAt: new Date().toISOString(),
      files: [
        { id: 'f1', name: 'Content Calendar', type: 'link', url: '', notes: 'Master content plan' },
        { id: 'f2', name: 'Brand Guidelines', type: 'doc', url: '', notes: 'Colors, fonts, voice' },
        { id: 'f3', name: 'Campaign Assets', type: 'folder', url: '', notes: '' }
      ]
    },
    {
      id: 'client-2',
      name: 'Wellness Brand',
      color: '#10b981',
      notes: 'Health & wellness product line',
      createdAt: new Date().toISOString(),
      files: [
        { id: 'f1', name: 'Q1 Strategy', type: 'notes', url: '', notes: '' },
        { id: 'f2', name: 'Product Photos', type: 'folder', url: '', notes: '' }
      ]
    }
  ];

  // Load clients from Firebase
  useEffect(() => {
    const unsubscribe = db.clients.subscribe((data) => {
      if (data) {
        const parsed = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        if (parsed.length === 0) {
          setClients(DEFAULT_CLIENTS);
          db.clients.set(DEFAULT_CLIENTS);
        } else {
          setClients(parsed);
        }
      } else {
        setClients(DEFAULT_CLIENTS);
        db.clients.set(DEFAULT_CLIENTS);
      }
    });
    return () => unsubscribe();
  }, []);

  // Save to Firebase when clients change
  useEffect(() => {
    if (clients.length > 0) {
      db.clients.set(clients);
    }
  }, [clients]);

  const getFilteredClients = () => {
    if (!searchQuery) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.notes?.toLowerCase().includes(q)
    );
  };

  const addClient = () => {
    if (!newClient.name.trim()) return;
    const client = {
      id: 'client-' + Date.now(),
      ...newClient,
      createdAt: new Date().toISOString(),
      files: []
    };
    setClients([...clients, client]);
    setNewClient({ name: '', color: '#ffd700', notes: '' });
    setShowAddClient(false);
  };

  const updateClient = () => {
    if (!editingClient || !editingClient.name.trim()) return;
    setClients(clients.map(c => c.id === editingClient.id ? editingClient : c));
    setEditingClient(null);
  };

  const deleteClient = (id) => {
    if (!confirm('Delete this client and all their files?')) return;
    setClients(clients.filter(c => c.id !== id));
    if (selectedClient?.id === id) setSelectedClient(null);
  };

  const addFile = () => {
    if (!newFile.name.trim() || !selectedClient) return;
    const file = {
      id: 'file-' + Date.now(),
      ...newFile
    };
    setClients(clients.map(c => 
      c.id === selectedClient.id 
        ? { ...c, files: [...c.files, file] }
        : c
    ));
    setNewFile({ name: '', type: 'notes', url: '', notes: '' });
    setShowAddFile(false);
  };

  const deleteFile = (clientId, fileId) => {
    if (!confirm('Delete this file?')) return;
    setClients(clients.map(c => 
      c.id === clientId 
        ? { ...c, files: c.files.filter(f => f.id !== fileId) }
        : c
    ));
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'doc': return <FileText size={16} />;
      case 'link': return <ExternalLink size={16} />;
      case 'image': return <Image size={16} />;
      case 'folder': return <Folder size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'doc': return 'Document';
      case 'link': return 'Link';
      case 'image': return 'Image';
      case 'folder': return 'Folder';
      default: return 'Notes';
    }
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
            <motion.div
              key={client.id}
              layout
              className={`p-4 bg-white/5 rounded-2xl border border-white/10 ${
                selectedClient?.id === client.id ? 'border-gold/30' : ''
              }`}
              onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
            >
              <div className="flex items-center gap-3">
                {/* Color Dot */}
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: client.color }}
                />
                
                {/* Client Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{client.name}</p>
                  {client.notes && (
                    <p className="text-xs text-white/40 truncate mt-0.5">{client.notes}</p>
                  )}
                  <p className="text-[10px] text-white/30 mt-1">
                    {client.files?.length || 0} files
                  </p>
                </div>

                {/* Expand Icon */}
                <ChevronRight 
                  size={20} 
                  className={`text-white/30 transition-transform ${
                    selectedClient?.id === client.id ? 'rotate-90' : ''
                  }`}
                />
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {selectedClient?.id === client.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 mt-4 border-t border-white/10">
                      {/* Files List */}
                      <div className="space-y-2 mb-4">
                        {client.files?.map(file => (
                          <div 
                            key={file.id}
                            className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
                          >
                            <div className="text-white/50">
                              {getFileIcon(file.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{file.name}</p>
                              <p className="text-[10px] text-white/40">{getTypeLabel(file.type)}</p>
                            </div>
                            {file.url && (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gold hover:bg-gold/10 rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteFile(client.id, file.id); }}
                              className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewingClient(client); }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-xs font-bold"
                        >
                          View Details
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setShowAddFile(true); }}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-gold/20 text-gold rounded-xl text-xs font-bold"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingClient(client); }}
                          className="p-2 bg-white/10 rounded-xl text-white/60"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteClient(client.id); }}
                          className="p-2 bg-red-500/10 rounded-xl text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
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
              </div>

              <button
                onClick={addClient}
                className="w-full mt-6 py-3 bg-gold text-black font-black uppercase tracking-widest rounded-xl"
              >
                Add Client
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Client Modal */}
      <AnimatePresence>
        {editingClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setEditingClient(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">Edit Client</h2>
                <button onClick={() => setEditingClient(null)} className="p-2">
                  <X size={20} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Client Name</label>
                  <input
                    type="text"
                    value={editingClient.name}
                    onChange={(e) => setEditingClient({...editingClient, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Color</label>
                  <div className="flex gap-2">
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#ffd700'].map(color => (
                      <button
                        key={color}
                        onClick={() => setEditingClient({...editingClient, color})}
                        className={`w-10 h-10 rounded-xl transition-transform ${editingClient.color === color ? 'ring-2 ring-white scale-110' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Notes</label>
                  <textarea
                    value={editingClient.notes || ''}
                    onChange={(e) => setEditingClient({...editingClient, notes: e.target.value})}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-gold/50 resize-none"
                  />
                </div>
              </div>

              <button
                onClick={updateClient}
                className="w-full mt-6 py-3 bg-gold text-black font-black uppercase tracking-widest rounded-xl"
              >
                Save Changes
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add File Modal */}
      <AnimatePresence>
        {showAddFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowAddFile(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">Add File to {selectedClient?.name}</h2>
                <button onClick={() => setShowAddFile(false)} className="p-2">
                  <X size={20} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">File Name</label>
                  <input
                    type="text"
                    value={newFile.name}
                    onChange={(e) => setNewFile({...newFile, name: e.target.value})}
                    placeholder="e.g., Content Calendar"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'notes', label: 'Notes', icon: FileText },
                      { id: 'doc', label: 'Doc', icon: FileText },
                      { id: 'link', label: 'Link', icon: ExternalLink },
                      { id: 'folder', label: 'Folder', icon: Folder }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setNewFile({...newFile, type: type.id})}
                        className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                          newFile.type === type.id 
                            ? 'bg-gold text-black' 
                            : 'bg-white/10 text-white/60'
                        }`}
                      >
                        <type.icon size={16} />
                        <span className="text-[10px] font-bold">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {(newFile.type === 'link' || newFile.type === 'doc') && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">URL</label>
                    <input
                      type="url"
                      value={newFile.url}
                      onChange={(e) => setNewFile({...newFile, url: e.target.value})}
                      placeholder="https://..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Notes</label>
                  <textarea
                    value={newFile.notes}
                    onChange={(e) => setNewFile({...newFile, notes: e.target.value})}
                    placeholder="Optional notes..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50 resize-none"
                  />
                </div>
              </div>

              <button
                onClick={addFile}
                className="w-full mt-6 py-3 bg-gold text-black font-black uppercase tracking-widest rounded-xl"
              >
                Add File
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Client Details Modal */}
      <AnimatePresence>
        {viewingClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setViewingClient(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto pb-28"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: viewingClient.color }}
                  />
                  <h2 className="text-xl font-black">{viewingClient.name}</h2>
                </div>
                <button onClick={() => setViewingClient(null)} className="p-2">
                  <X size={20} className="text-white/40" />
                </button>
              </div>

              {/* Parse intake data if available */}
              {(() => {
                let intakeData = null;
                const intakeFile = viewingClient.files?.find(f => f.name === 'Intake Form');
                if (intakeFile?.notes) {
                  try {
                    intakeData = JSON.parse(intakeFile.notes);
                  } catch (e) {}
                }
                
                return (
                  <div className="space-y-4">
                    {intakeData && (
                      <>
                        {intakeData.email && (
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/40">Email</span>
                            <a href={`mailto:${intakeData.email}`} className="text-sm text-gold">{intakeData.email}</a>
                          </div>
                        )}
                        {intakeData.phone && (
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/40">Phone</span>
                            <a href={`tel:${intakeData.phone}`} className="text-sm text-gold">{intakeData.phone}</a>
                          </div>
                        )}
                        {intakeData.address && (
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/40">Address</span>
                            <span className="text-sm text-white">{intakeData.address}</span>
                          </div>
                        )}
                        {intakeData.website && (
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/40">Website</span>
                            <a href={intakeData.website.startsWith('http') ? intakeData.website : `https://${intakeData.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-gold">{intakeData.website}</a>
                          </div>
                        )}
                        {intakeData.socialLinks && (
                          <div className="flex items-start justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/40">Social</span>
                            <span className="text-sm text-white text-right">{intakeData.socialLinks}</span>
                          </div>
                        )}
                        {intakeData.project && (
                          <div className="p-3 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/40 block mb-2">Project</span>
                            <p className="text-sm text-white">{intakeData.project}</p>
                          </div>
                        )}
                        {intakeData.referral && (
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/40">Referral Source</span>
                            <span className="text-sm text-white capitalize">{intakeData.referral}</span>
                          </div>
                        )}
                        {intakeData.submittedAt && (
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/40">Submitted</span>
                            <span className="text-sm text-white/60">{new Date(intakeData.submittedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Notes */}
                    {viewingClient.notes && !intakeData && (
                      <div className="p-3 bg-white/5 rounded-xl">
                        <span className="text-xs text-white/40 block mb-2">Notes</span>
                        <p className="text-sm text-white whitespace-pre-wrap">{viewingClient.notes}</p>
                      </div>
                    )}

                    {/* Files */}
                    {viewingClient.files?.length > 0 && (
                      <div>
                        <span className="text-xs text-white/40 block mb-2">Files</span>
                        <div className="space-y-2">
                          {viewingClient.files.map(file => (
                            <div key={file.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-white/40" />
                                <span className="text-sm text-white">{file.name}</span>
                              </div>
                              {file.url && (
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-gold">
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientManager;
