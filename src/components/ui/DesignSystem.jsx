import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';

// 1. BUTTON
export function Button({ children, variant = 'primary', size = 'md', className = '', disabled, ...props }) {
  const variants = {
    primary: 'bg-[#00C853] hover:bg-[#34D399] text-[#050810] font-semibold shadow-[0_0_24px_rgba(0,200,83,0.25)]',
    gold: 'bg-[#FFAA00] hover:bg-[#FFC857] text-[#050810] font-semibold shadow-[0_0_24px_rgba(255,170,0,0.25)]',
    outline: 'border border-white/15 hover:border-[#FFAA00] text-[#F2F4F8] hover:text-[#FFAA00] bg-transparent',
    ghost: 'text-[#8A93A6] hover:text-white hover:bg-white/[0.04]',
    danger: 'border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-[10px] tracking-widest',
    md: 'px-4 py-2.5 text-xs tracking-[0.18em]',
    lg: 'px-6 py-3.5 text-xs tracking-[0.22em]'
  };
  return (
    <button
      disabled={disabled}
      className={`font-mono uppercase transition-all duration-200 inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// 2. CARD
export function Card({ children, className = '', glow = false, ...props }) {
  return (
    <div
      className={`bg-[#070b14]/90 border border-white/[0.07] backdrop-blur-md p-6 relative transition-colors ${
        glow ? 'hover:border-[#FFAA00]/40' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// 3. INPUT
export const Input = React.forwardRef(({ label, error, className = '', ...props }, ref) => (
  <div className="w-full">
    {label && (
      <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1.5">
        {label}
      </label>
    )}
    <input
      ref={ref}
      className={`w-full bg-[#050810] border ${
        error ? 'border-red-500/70' : 'border-white/10 focus:border-[#FFAA00]'
      } px-3.5 py-2.5 text-sm text-[#F2F4F8] placeholder-[#4A5464] focus:outline-none transition-colors ${className}`}
      {...props}
    />
    {error && <p className="mt-1 font-mono text-[10px] text-red-400">{error}</p>}
  </div>
));

// 4. BADGE
export function Badge({ children, color = 'emerald', className = '' }) {
  const colors = {
    emerald: 'bg-[#00C853]/10 border-[#00C853]/35 text-[#34D399]',
    gold: 'bg-[#FFAA00]/10 border-[#FFAA00]/35 text-[#FFAA00]',
    cyan: 'bg-[#22D3EE]/10 border-[#22D3EE]/35 text-[#22D3EE]',
    purple: 'bg-purple-500/10 border-purple-500/35 text-purple-300',
    red: 'bg-red-500/10 border-red-500/35 text-red-400'
  };
  return (
    <span className={`px-2.5 py-0.5 border font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 ${colors[color]} ${className}`}>
      {children}
    </span>
  );
}

// 5. AVATAR
export function Avatar({ src, username = '@user', status = 'online', size = 'md', onClick }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' };
  const statusColor = {
    online: 'bg-[#00C853]',
    away: 'bg-[#FFAA00]',
    dnd: 'bg-red-500',
    offline: 'bg-zinc-600'
  };
  const initials = username.replace('@', '').slice(0, 2).toUpperCase();

  return (
    <div onClick={onClick} className={`relative inline-flex shrink-0 ${onClick ? 'cursor-pointer' : ''}`}>
      {src ? (
        <img src={src} alt={username} className={`${sizes[size]} rounded-full object-cover border border-[#00C853]/60`} />
      ) : (
        <div className={`${sizes[size]} rounded-full bg-[#0c1424] border border-[#FFAA00]/40 flex items-center justify-center font-mono font-bold text-[#FFAA00]`}>
          {initials}
        </div>
      )}
      {status && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#050810] ${statusColor[status] || statusColor.online}`} />
      )}
    </div>
  );
}

// 6. MODAL
export function Modal({ isOpen, onClose, title, eyebrow = 'ЮГРА.НЕФТЬ', children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-xl bg-[#050810] border border-white/15 p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFAA00] to-transparent" />
            <button onClick={onClose} className="absolute top-5 right-5 text-[#8A93A6] hover:text-white">
              <X size={18} />
            </button>
            <div className="eyebrow mb-1">{eyebrow}</div>
            <h3 className="text-xl font-light text-white mb-5">{title}</h3>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 7. SKELETON
export function Skeleton({ className = 'h-24 w-full' }) {
  return <div className={`animate-pulse bg-white/[0.04] border border-white/[0.03] ${className}`} />;
}

// 8. EMPTY STATE
export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="p-10 border border-dashed border-white/10 bg-[#070b14]/50 text-center space-y-3">
      <div className="font-mono text-xs uppercase tracking-widest text-[#FFAA00]">{title}</div>
      <p className="text-xs text-[#8A93A6] max-w-md mx-auto leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

// 9. TOAST SYSTEM
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-16 md:bottom-6 right-6 z-[150] space-y-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto p-4 border bg-[#050810]/95 backdrop-blur-xl shadow-2xl flex items-start gap-3 text-xs font-mono ${
                t.type === 'error'
                  ? 'border-red-500/50 text-red-300'
                  : t.type === 'success'
                  ? 'border-[#00C853]/50 text-[#34D399]'
                  : 'border-[#FFAA00]/50 text-[#FFAA00]'
              }`}
            >
              {t.type === 'error' ? <AlertCircle size={16} /> : t.type === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
              <span className="flex-1">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);