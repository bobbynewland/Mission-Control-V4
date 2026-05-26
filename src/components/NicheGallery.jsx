import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, ChevronRight, Sparkles, Image as ImageIcon,
  Dumbbell, Shirt, UtensilsCrossed, Camera, Package, Box, User
} from 'lucide-react';

// ─── Niche Data with Thumbnails ───────────────────────────────────────────────
const NICHE_THUMBNAILS = {
  fitness: {
    id: 'fitness',
    label: 'Fitness',
    icon: Dumbbell,
    image: '/thumb-fitness.png',
    description: 'Athletic wear, gym culture, workout gear'
  },
  fashion: {
    id: 'fashion',
    label: 'Fashion',
    icon: Shirt,
    image: '/thumb-fashion.png',
    description: 'Streetwear, luxury brands, style trends'
  },
  'food-drink': {
    id: 'food-drink',
    label: 'Food & Drink',
    icon: UtensilsCrossed,
    image: '/thumb-food-drink.png',
    description: 'Gourmet cuisine, drinks, restaurant culture'
  },
  photography: {
    id: 'photography',
    label: 'Photography',
    icon: Camera,
    image: '/thumb-photography.png',
    description: 'Camera gear, lenses, studio equipment'
  },
  product: {
    id: 'product',
    label: 'Product',
    icon: Package,
    image: '/thumb-product.png',
    description: 'E-commerce, consumer products, merchandise'
  },
  'illustration-3d': {
    id: 'illustration-3d',
    label: '3D Illustration',
    icon: Box,
    image: '/thumb-illustration-3d.png',
    description: '3D renders, CGI, digital art'
  },
  girl: {
    id: 'girl',
    label: 'Lifestyle',
    icon: User,
    image: '/thumb-girl.png',
    description: 'Beauty, lifestyle, fashion-forward content'
  },
};

const ALL_NICHES = Object.values(NICHE_THUMBNAILS);

// ─── NicheGallery Component ───────────────────────────────────────────────────
const NicheGallery = ({ selectedNiches = [], onToggleNiche, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [previewNiche, setPreviewNiche] = useState(null);

  const filteredNiches = ALL_NICHES.filter(niche =>
    niche.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    niche.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[110] bg-[#111] rounded-3xl border border-white/10 overflow-hidden max-w-2xl mx-auto max-h-[85vh] flex flex-col"
        style={{ maxHeight: 'min(85vh, 700px)' }}
      >
        {/* Header */}
        <div className="shrink-0 p-5 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
                <Sparkles size={18} className="text-gold" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">🎯 Browse Niches</h2>
                <p className="text-white/40 text-xs">Select niches for your template pack</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search niches..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
            />
          </div>
        </div>

        {/* Niche Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredNiches.map((niche) => {
              const Icon = niche.icon;
              const isSelected = selectedNiches.includes(niche.id);
              
              return (
                <motion.div
                  key={niche.id}
                  layout
                  className={`relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-gold ring-2 ring-gold/30' 
                      : 'border-white/10 hover:border-white/30'
                  }`}
                  onClick={() => onToggleNiche(niche.id)}
                >
                  {/* Thumbnail Image */}
                  <div className="aspect-[4/5] relative bg-black/20">
                    <img 
                      src={niche.image} 
                      alt={niche.label}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.classList.add('bg-white/5');
                      }}
                    />
                    {/* Fallback gradient if image fails */}
                    <div className={`absolute inset-0 ${
                      niche.id === 'fitness' ? 'bg-gradient-to-br from-blue-600/40 to-purple-600/40' :
                      niche.id === 'fashion' ? 'bg-gradient-to-br from-amber-600/40 to-rose-600/40' :
                      niche.id === 'food-drink' ? 'bg-gradient-to-br from-orange-600/40 to-red-600/40' :
                      niche.id === 'photography' ? 'bg-gradient-to-br from-cyan-600/40 to-blue-600/40' :
                      niche.id === 'product' ? 'bg-gradient-to-br from-slate-600/40 to-zinc-600/40' :
                      niche.id === 'illustration-3d' ? 'bg-gradient-to-br from-purple-600/40 to-pink-600/40' :
                      'bg-gradient-to-br from-rose-600/40 to-pink-600/40'
                    }`} />
                    
                    {/* Overlay gradient for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    
                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col justify-end p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={12} className="text-gold" />
                        <span className="text-[10px] uppercase tracking-wider text-white/60 font-bold">{niche.label}</span>
                      </div>
                      <p className="text-[10px] text-white/50 leading-tight line-clamp-2">{niche.description}</p>
                    </div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Name below image */}
                  <div className="p-2 bg-white/5 text-center">
                    <span className="text-xs font-bold text-white/80">{niche.label}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredNiches.length === 0 && (
            <div className="text-center py-12 text-white/30">
              <Search size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-bold">No niches found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">
              <span className="text-gold font-bold">{selectedNiches.length}</span> selected
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-white/10 text-white/70 rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gold text-black rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewNiche && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-6"
            onClick={() => setPreviewNiche(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="max-w-sm rounded-2xl overflow-hidden border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={previewNiche.image} alt={previewNiche.label} className="w-full aspect-[4/5] object-cover" />
              <div className="p-4 bg-white/10">
                <h3 className="font-bold text-white">{previewNiche.label}</h3>
                <p className="text-sm text-white/60 mt-1">{previewNiche.description}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NicheGallery;
export { NICHE_THUMBNAILS, ALL_NICHES };