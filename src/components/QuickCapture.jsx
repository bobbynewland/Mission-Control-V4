import React, { useState } from 'react';
import { Plus, X, Lightbulb, CheckSquare, FileText, Send, Zap } from 'lucide-react';
import { database, ref, push, update } from '../lib/firebase';
import { notify } from '../lib/dialogs';

const BOARD_PATH = 'workspaces/winslow_main/tasks';
const NOTES_PATH = 'workspaces/winslow_main/notes';

const QuickCapture = () => {
  const [input, setInput] = useState('');
  const [type, setType] = useState('task'); // task, note, idea
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const types = [
    { id: 'task', label: 'Task', icon: CheckSquare },
    { id: 'note', label: 'Note', icon: FileText },
    { id: 'idea', label: 'Idea', icon: Lightbulb },
  ];

  const handleSave = async () => {
    if (!input.trim()) return;
    
    setSaving(true);
    const timestamp = new Date().toISOString();
    
    try {
      if (type === 'task') {
        // Save to Firebase Tasks
        const taskRef = push(ref(database, BOARD_PATH));
        await update(taskRef, {
          title: input.trim(),
          description: '',
          column: 'todo',
          priority: 'medium',
          dueDate: null,
          id: taskRef.key,
          position: 0,
          createdAt: Date.now(),
        });
      } else {
        // Save to Firebase Notes (Notes and Ideas)
        const noteRef = push(ref(database, NOTES_PATH));
        await update(noteRef, {
          title: input.trim().split('\n')[0].substring(0, 50),
          content: input.trim(),
          type: type,
          created: timestamp,
          updated: timestamp
        });
      }
      
      setInput('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('QuickCapture Error:', error);
      await notify('Failed to save. Check console.', { title: 'Save Failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tight">
          Quick <span className="text-gold">Capture</span>
        </h2>
        <p className="text-white/40 text-sm">Dump thoughts fast — we'll organize later</p>
      </div>

      {/* Type Selector */}
      <div className="flex gap-2">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              type === t.id 
                ? 'bg-gold text-black' 
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <t.icon size={16} />
            <span className="font-bold text-sm">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={`What's on your mind?${type === 'task' ? ' (press Cmd+Enter to save)' : ''}`}
          className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-gold/50 resize-none"
          autoFocus
        />
        
        <button
          onClick={handleSave}
          disabled={!input.trim() || saving}
          className={`absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
            saved 
              ? 'bg-green-500 text-white'
              : input.trim()
                ? 'bg-gold text-black hover:bg-gold/80'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            '✓ Saved!'
          ) : (
            <>
              <Send size={14} />
              Save
            </>
          )}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button 
          onClick={() => setType('task')}
          className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-gold/30 transition-colors text-center"
        >
          <CheckSquare className="mx-auto mb-2 text-gold" size={24} />
          <span className="text-xs font-bold uppercase">Task</span>
        </button>
        <button 
          onClick={() => setType('note')}
          className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-gold/30 transition-colors text-center"
        >
          <FileText className="mx-auto mb-2 text-blue-400" size={24} />
          <span className="text-xs font-bold uppercase">Note</span>
        </button>
        <button 
          onClick={() => setType('idea')}
          className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-gold/30 transition-colors text-center"
        >
          <Lightbulb className="mx-auto mb-2 text-yellow-400" size={24} />
          <span className="text-xs font-bold uppercase">Idea</span>
        </button>
      </div>

      {/* Tips */}
      <div className="p-4 bg-gold/5 border border-gold/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Zap className="text-gold mt-1" size={16} />
          <div className="text-sm text-white/60">
            <p className="font-bold text-white mb-1">Pro Tip</p>
            <p>Press Cmd+Enter (or Ctrl+Enter) to save instantly</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickCapture;
