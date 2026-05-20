import React, { createContext, useCallback, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const success = useCallback((msg: string, duration?: number) => toast(msg, 'success', duration), [toast]);
  const error   = useCallback((msg: string, duration?: number) => toast(msg, 'error', duration), [toast]);
  const warning = useCallback((msg: string, duration?: number) => toast(msg, 'warning', duration), [toast]);
  const info    = useCallback((msg: string, duration?: number) => toast(msg, 'info', duration), [toast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
};

// ── Hook ───────────────────────────────────────────────────────────────────────
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

// ── Icon map ───────────────────────────────────────────────────────────────────
const ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />,
  error:   <XCircle      size={16} className="text-red-500 shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-500 shrink-0" />,
  info:    <Info          size={16} className="text-blue-500 shrink-0" />,
};

const BAR_COLOR: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error:   'bg-red-500',
  warning: 'bg-amber-500',
  info:    'bg-blue-500',
};

// ── Single Toast item ──────────────────────────────────────────────────────────
const ToastItem: React.FC<{ toast: Toast; dismiss: (id: string) => void }> = ({ toast, dismiss }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 24, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -12, scale: 0.96 }}
    transition={{ duration: 0.22, ease: 'easeOut' }}
    className="relative flex items-start gap-3 w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/60 px-4 py-3 overflow-hidden"
  >
    {/* colored left accent bar */}
    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${BAR_COLOR[toast.type]}`} />
    <span className="mt-0.5">{ICON[toast.type]}</span>
    <p className="flex-1 text-sm text-slate-700 leading-snug">{toast.message}</p>
    <button
      onClick={() => dismiss(toast.id)}
      className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
      aria-label="Đóng thông báo"
    >
      <X size={14} />
    </button>
  </motion.div>
);

// ── Toaster (container) ────────────────────────────────────────────────────────
const Toaster: React.FC<{ toasts: Toast[]; dismiss: (id: string) => void }> = ({ toasts, dismiss }) => (
  <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
    <AnimatePresence mode="popLayout">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} dismiss={dismiss} />
        </div>
      ))}
    </AnimatePresence>
  </div>
);
