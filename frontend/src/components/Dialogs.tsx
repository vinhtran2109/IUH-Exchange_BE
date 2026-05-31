import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

// ── ConfirmDialog ───────────────────────────────────────────────────────────────
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
}

type ConfirmResolver = (value: boolean) => void;

interface ConfirmState extends ConfirmOptions {
  resolve: ConfirmResolver;
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmDialogContext = React.createContext<ConfirmDialogContextValue | null>(null);

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<ConfirmResolver | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    resolverRef.current?.(result);
    setState(null);
  };

  const variantStyles = {
    danger:  { btn: 'bg-red-600 hover:bg-red-700 text-white', icon: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' },
    warning: { btn: 'bg-amber-500 hover:bg-amber-600 text-white', icon: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
    default: { btn: 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900', icon: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
  };
  const v = variantStyles[state?.variant ?? 'default'];

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-9998 flex items-center justify-center bg-slate-950/40 px-4"
            onClick={() => handleClose(false)}
          >
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-start gap-3 p-5 ${v.bg}`}>
                <AlertTriangle size={20} className={`${v.icon} shrink-0 mt-0.5`} />
                <div>
                  {state.title && (
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{state.title}</h3>
                  )}
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{state.message}</p>
                </div>
                <button
                  onClick={() => handleClose(false)}
                  className="ml-auto p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex gap-2.5 px-5 py-4">
                <button
                  onClick={() => handleClose(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {state.cancelText ?? 'Hủy'}
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${v.btn}`}
                >
                  {state.confirmText ?? 'Xác nhận'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmDialogContext.Provider>
  );
};

export const useConfirm = (): ConfirmDialogContextValue => {
  const ctx = React.useContext(ConfirmDialogContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmDialogProvider>');
  return ctx;
};

// ── PromptDialog (thay thế window.prompt) ──────────────────────────────────────
interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  minLength?: number;
  rows?: number;
}

type PromptResolver = (value: string | null) => void;

interface PromptState extends PromptOptions {
  resolve: PromptResolver;
}

interface PromptDialogContextValue {
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const PromptDialogContext = React.createContext<PromptDialogContextValue | null>(null);

export const PromptDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PromptState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState('');

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setInputValue('');
      setValidationError('');
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: string | null) => {
    state?.resolve(result);
    setState(null);
    setInputValue('');
    setValidationError('');
  };

  const handleConfirm = () => {
    const minLen = state?.minLength ?? 5;
    if (inputValue.trim().length < minLen) {
      setValidationError(`Vui lòng nhập ít nhất ${minLen} ký tự.`);
      return;
    }
    handleClose(inputValue.trim());
  };

  return (
    <PromptDialogContext.Provider value={{ prompt }}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            key="prompt-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-9998 flex items-center justify-center bg-slate-950/40 px-4"
            onClick={() => handleClose(null)}
          >
            <motion.div
              key="prompt-dialog"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between p-5 border-b border-slate-100">
                <div>
                  {state.title && <h3 className="text-base font-semibold text-slate-900 mb-0.5">{state.title}</h3>}
                  <p className="text-sm text-slate-500 leading-relaxed">{state.message}</p>
                </div>
                <button onClick={() => handleClose(null)} className="p-1 text-slate-400 hover:text-slate-600 transition-colors ml-4 shrink-0">
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {(state.rows ?? 1) > 1 ? (
                  <textarea
                    autoFocus
                    rows={state.rows ?? 3}
                    value={inputValue}
                    onChange={e => { setInputValue(e.target.value); setValidationError(''); }}
                    placeholder={state.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-slate-400 focus:outline-none resize-none transition-colors"
                  />
                ) : (
                  <input
                    autoFocus
                    type="text"
                    value={inputValue}
                    onChange={e => { setInputValue(e.target.value); setValidationError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                    placeholder={state.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-slate-400 focus:outline-none transition-colors"
                  />
                )}
                {validationError && (
                  <p className="text-xs text-red-500 font-medium">{validationError}</p>
                )}
              </div>
              <div className="flex gap-2.5 px-5 pb-5">
                <button
                  onClick={() => handleClose(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {state.cancelText ?? 'Hủy'}
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
                >
                  {state.confirmText ?? 'Gửi'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PromptDialogContext.Provider>
  );
};

export const usePrompt = (): PromptDialogContextValue => {
  const ctx = React.useContext(PromptDialogContext);
  if (!ctx) throw new Error('usePrompt must be used inside <PromptDialogProvider>');
  return ctx;
};
