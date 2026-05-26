import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

const CORRECT_PASSWORD = 'NewlandBobby1983@@';

const Auth = ({ onAuth }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 500));
    
    if (password === CORRECT_PASSWORD) {
      localStorage.setItem('mc_auth', 'true');
      onAuth(true);
    } else {
      setError('Incorrect password');
      setPassword('');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white">
            Mission <span className="text-gold">Control</span>
          </h1>
          <p className="text-white/40 text-sm mt-2 font-mono">SYSTEM V3.0 // RESTRICTED</p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-white/40 focus:outline-none focus:border-gold/50 transition-colors"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            className="w-full py-4 bg-gold text-black font-black uppercase tracking-wider rounded-2xl hover:bg-gold/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Verifying...' : 'Access System'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-white/20 text-xs mt-8">
          Unauthorized access is prohibited
        </p>
      </div>
    </div>
  );
};

export default Auth;
