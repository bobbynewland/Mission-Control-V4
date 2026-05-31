import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  File, 
  Folder, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Clock, 
  Download,
  FileImage,
  FileText,
  FileJson,
  MoreVertical,
  X,
  Trash2,
  FolderInput,
  CheckCircle2,
  Circle,
  Check,
  Upload,
  Edit3,
  ChevronRight,
  Share2,
  Link,
  Globe,
  Lock,
  Copy,
  Users
} from 'lucide-react';
import { confirmAction } from '../lib/dialogs';

const ROOT_FOLDER_ID = '1hU2LW9fW0aht7x_-ki80a4f5MFifIeK7'; // AI Skills Studio Root

const GoogleDrive = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [newFolderName, setSearchQueryState] = useState('');
  const [moveTargetFolder, setMoveTargetFolder] = useState('');
  const [renameName, setRenameName] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(ROOT_FOLDER_ID);
  const [folderHistory, setFolderHistory] = useState([ROOT_FOLDER_ID]);
  const [newFolderNameValue, setNewFolderNameValue] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('/drive-data.json')
      .then(res => res.json())
      .then(data => {
        setFiles(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading drive data:', err);
        setFiles([]);
        setLoading(false);
      });
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === displayFiles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayFiles.map(f => f.id));
    }
  };

  const createFolder = async () => {
    if (!newFolderNameValue) return;
    setCreatingFolder(true);
    
    const newFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderNameValue,
      mimeType: 'application/vnd.google-apps.folder',
      parentId: currentFolderId,
      modifiedTime: new Date().toISOString(),
      webViewLink: '#',
      webContentLink: '#'
    };
    
    setFiles(prev => [...prev, newFolder]);
    
    setTimeout(() => {
      setCreatingFolder(false);
      setShowFolderModal(false);
      setNewFolderNameValue('');
    }, 300);
  };

  const handleUpload = (e) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles.length) return;
    
    setUploading(true);
    
    const newFiles = Array.from(uploadedFiles).map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      parentId: currentFolderId,
      modifiedTime: new Date().toISOString(),
      size: file.size,
      webViewLink: '#',
      webContentLink: '#'
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    setTimeout(() => {
      setUploading(false);
    }, 800);
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    const confirmed = await confirmAction(`Delete ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''}? This cannot be undone.`, {
      title: 'Delete Drive Items',
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;
    setFiles(prev => prev.filter(f => !selectedIds.includes(f.id)));
    setSelectedIds([]);
    setIsSelectMode(false);
  };

  const openMoveModal = () => {
    setMoveTargetFolder(currentFolderId);
    setShowMoveModal(true);
  };

  const moveSelected = () => {
    if (!selectedIds.length) return;
    
    setFiles(prev => prev.map(f => {
      if (selectedIds.includes(f.id)) {
        return { ...f, parentId: moveTargetFolder };
      }
      return f;
    }));
    
    setShowMoveModal(false);
    setSelectedIds([]);
    setIsSelectMode(false);
  };

  const openRenameModal = (file) => {
    setRenameTarget(file);
    setRenameName(file.name);
    setShowRenameModal(true);
  };

  const renameFile = () => {
    if (!renameTarget || !renameName.trim()) return;
    
    setFiles(prev => prev.map(f => {
      if (f.id === renameTarget.id) {
        return { ...f, name: renameName.trim(), modifiedTime: new Date().toISOString() };
      }
      return f;
    }));
    
    setShowRenameModal(false);
    setRenameTarget(null);
    setRenameName('');
  };

  const openShareModal = (file) => {
    setShareTarget(file);
    setShareLink(file.webViewLink || `https://drive.google.com/uc?id=${file.id}&export=download`);
    setIsPublic(file.isPublic || false);
    setLinkCopied(false);
    setShowShareModal(true);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const togglePublic = () => {
    const newPublicState = !isPublic;
    setIsPublic(newPublicState);
    
    setFiles(prev => prev.map(f => {
      if (f.id === shareTarget.id) {
        return { 
          ...f, 
          isPublic: newPublicState,
          webContentLink: newPublicState ? `https://drive.google.com/uc?id=${f.id}&export=download` : null
        };
      }
      return f;
    }));
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (mimeType) => {
    if (mimeType && mimeType.includes('folder')) return <Folder className="text-gold" size={20} />;
    if (mimeType && mimeType.includes('image')) return <FileImage className="text-purple-400" size={20} />;
    if (mimeType && mimeType.includes('json')) return <FileJson className="text-green-400" size={20} />;
    if (mimeType && (mimeType.includes('document') || mimeType.includes('pdf'))) return <FileText className="text-blue-400" size={20} />;
    return <File className="text-white/40" size={20} />;
  };

  const isFolder = (mimeType) => mimeType && mimeType.includes('folder');

  const navigateToFolder = (folderId) => {
    setCurrentFolderId(folderId);
    setFolderHistory(prev => [...prev, folderId]);
    setSelectedIds([]);
  };

  const navigateBack = () => {
    if (folderHistory.length > 1) {
      const newHistory = [...folderHistory];
      newHistory.pop();
      const parentId = newHistory[newHistory.length - 1];
      setFolderHistory(newHistory);
      setCurrentFolderId(parentId);
      setSelectedIds([]);
    }
  };

  const currentFolderFiles = files.filter(f => 
    f.parentId === currentFolderId
  );

  const displayFiles = searchQuery ? filteredFiles : currentFolderFiles;

  const allFolders = files.filter(f => isFolder(f.mimeType));

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const b = parseInt(bytes, 10);
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleUpload}
        className="hidden"
      />

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          {currentFolderId !== ROOT_FOLDER_ID && (
            <button 
              onClick={navigateBack}
              className="p-2 glass rounded-full text-gold hover:text-white transition-all active:scale-90"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
          )}
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/40 italic">Asset Hub</h2>
            <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest mt-0.5">Google Drive Sync</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 bg-gold p-1 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.3)]"
            >
              <button 
                onClick={openMoveModal}
                className="p-2 text-black hover:opacity-70 transition-colors"
                title="Move"
              >
                <FolderInput size={18} />
              </button>
              <button 
                onClick={deleteSelected}
                className="p-2 text-black hover:opacity-70 transition-colors"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
              <div className="h-4 w-[1px] bg-black/20 mx-1"></div>
              <button 
                onClick={() => {
                  setSelectedIds([]);
                  setIsSelectMode(false);
                }}
                className="p-2 text-black hover:opacity-70 transition-colors"
              >
                <X size={18} />
              </button>
            </motion.div>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2.5 glass rounded-full text-purple-400 hover:text-white transition-all active:scale-90"
                title="Upload"
              >
                {uploading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
              <button 
                onClick={() => setShowFolderModal(true)}
                className="p-2.5 glass rounded-full text-gold hover:text-white transition-all active:scale-90"
                title="New Folder"
              >
                <Folder size={16} />
              </button>
              <button 
                onClick={() => setIsSelectMode(!isSelectMode)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isSelectMode ? 'bg-gold text-black' : 'glass text-white/40'}`}
              >
                {isSelectMode ? 'Cancel' : 'Select'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="relative flex-1 mr-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input 
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:border-gold/50 transition-colors text-white"
              />
            </div>
            {isSelectMode && (
              <button 
                onClick={selectAll}
                className="text-[10px] font-black uppercase tracking-widest text-gold hover:text-white transition-colors whitespace-nowrap ml-2"
              >
                {selectedIds.length === displayFiles.length ? 'None' : 'All'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="animate-spin text-gold" size={32} />
              <span className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">Accessing Drive...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {displayFiles.map(file => {
                const isSelected = selectedIds.includes(file.id);
                return (
                  <div 
                    key={file.id}
                    className={`glass p-4 rounded-2xl flex items-center justify-between transition-all active:bg-white/5 group relative border-2 ${isSelected ? 'border-gold/40 bg-gold/5' : 'border-transparent'}`}
                  >
                    <div 
                      onClick={() => {
                        if (isSelectMode) {
                          toggleSelect(file.id);
                        } else if (isFolder(file.mimeType)) {
                          navigateToFolder(file.id);
                        } else {
                          window.open(file.webViewLink, '_blank');
                        }
                      }}
                      className="flex items-center gap-4 overflow-hidden flex-1 cursor-pointer"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                          {getFileIcon(file.mimeType)}
                        </div>
                      </div>
                      <div className="overflow-hidden">
                        <h4 className={`text-sm font-bold truncate leading-tight mb-1 ${isSelected ? 'text-gold' : 'text-white/80'}`}>{file.name}</h4>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-white/20 uppercase tracking-tighter">
                          <span>{file.mimeType ? file.mimeType.split('.').pop().split('/').pop() : 'file'}</span>
                          {file.size && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-white/10"></span>
                              <span>{formatFileSize(file.size)}</span>
                            </>
                          )}
                          <span className="w-1 h-1 rounded-full bg-white/10"></span>
                          <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {!isSelectMode && !isFolder(file.mimeType) && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openShareModal(file);
                            }}
                            className="p-2 text-white/20 hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="Share"
                          >
                            <Share2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openRenameModal(file);
                            }}
                            className="p-2 text-white/20 hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
                            title="Rename"
                          >
                            <Edit3 size={14} />
                          </button>
                        </>
                      )}
                      {isSelectMode ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(file.id);
                          }}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-gold border-gold text-black' : 'border-white/10 text-transparent'}`}
                        >
                          <Check size={14} />
                        </button>
                      ) : (
                        <ExternalLink size={16} className="text-white/10" />
                      )}
                    </div>
                  </div>
                );
              })}
              {displayFiles.length === 0 && (
                <div className="text-center py-20 text-white/20">
                  <p className="text-sm font-bold uppercase tracking-widest italic">No assets found</p>
                  <p className="text-xs mt-2 text-white/10">Upload files or create a folder</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFolderModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-md p-8 rounded-3xl relative z-10 border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-white">
                  New <span className="text-gold">Folder</span>
                </h3>
                <button onClick={() => setShowFolderModal(false)} className="text-white/40 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1 block italic">// Folder Name</label>
                  <input 
                    type="text" 
                    value={newFolderNameValue}
                    onChange={e => setNewFolderNameValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createFolder()}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50 text-white"
                    placeholder="E.g. Marketing Assets"
                    autoFocus
                  />
                </div>
                <button 
                  onClick={createFolder}
                  disabled={creatingFolder || !newFolderNameValue.trim()}
                  className="w-full bg-gold text-black font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.2)] active:scale-95 transition-all disabled:opacity-50"
                >
                  {creatingFolder ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Move Modal */}
      <AnimatePresence>
        {showMoveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoveModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-md p-8 rounded-3xl relative z-10 border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-white">
                  Move <span className="text-purple-400">{selectedIds.length}</span> item{selectedIds.length > 1 ? 's' : ''}
                </h3>
                <button onClick={() => setShowMoveModal(false)} className="text-white/40 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1 block italic">// Destination Folder</label>
                  <select 
                    value={moveTargetFolder}
                    onChange={e => setMoveTargetFolder(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50 text-white"
                  >
                    <option value={ROOT_FOLDER_ID}>Root (AI Skills Studio)</option>
                    {allFolders.filter(f => f.id !== currentFolderId).map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={moveSelected}
                  className="w-full bg-purple-500 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.2)] active:scale-95 transition-all"
                >
                  Move Here
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {showRenameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRenameModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-md p-8 rounded-3xl relative z-10 border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-white">
                  Rename <span className="text-gold">File</span>
                </h3>
                <button onClick={() => setShowRenameModal(false)} className="text-white/40 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1 block italic">// New Name</label>
                  <input 
                    type="text" 
                    value={renameName}
                    onChange={e => setRenameName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && renameFile()}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50 text-white"
                    autoFocus
                  />
                </div>
                <button 
                  onClick={renameFile}
                  disabled={!renameName.trim()}
                  className="w-full bg-gold text-black font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.2)] active:scale-95 transition-all disabled:opacity-50"
                >
                  Rename
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && shareTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-md p-8 rounded-3xl relative z-10 border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-white">
                  Share <span className="text-purple-400">{shareTarget.name}</span>
                </h3>
                <button onClick={() => setShowShareModal(false)} className="text-white/40 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Share Link */}
                <div>
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1 block italic">// Share Link</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/60 truncate font-mono">
                      {shareLink}
                    </div>
                    <button 
                      onClick={copyShareLink}
                      className={`p-3 rounded-xl transition-all ${linkCopied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      {linkCopied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                {/* Public Toggle */}
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    {isPublic ? (
                      <Globe size={20} className="text-green-400" />
                    ) : (
                      <Lock size={20} className="text-white/40" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-white">{isPublic ? 'Public' : 'Private'}</p>
                      <p className="text-[10px] text-white/40">{isPublic ? 'Anyone with link can view' : 'Only you can access'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={togglePublic}
                    className={`w-12 h-6 rounded-full transition-all ${isPublic ? 'bg-green-500' : 'bg-white/20'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Permission Level */}
                <div>
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1 block italic">// Permission</label>
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 bg-purple-500/20 border border-purple-500/50 rounded-xl p-3 text-purple-400 text-sm font-bold">
                      <Users size={16} />
                      Viewer
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 text-white/40 text-sm font-bold">
                      <Edit3 size={16} />
                      Editor
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setShowShareModal(false)}
                  className="w-full bg-gold text-black font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.2)] active:scale-95 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GoogleDrive;
