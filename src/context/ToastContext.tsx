import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  notify: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col items-end gap-2"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto flex w-full sm:w-auto sm:max-w-sm items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-xl backdrop-blur-md ${
                toast.type === 'error'
                  ? 'border-[#8B1E24]/40 bg-[#FEF2F2]/95 dark:bg-[#8B1E24]/95 text-[#8B1E24] dark:text-white'
                  : toast.type === 'info'
                  ? 'border-[#C89B3C]/45 bg-[#0B1F3A]/95 dark:bg-[#0D1E36]/95 text-white'
                  : 'border-[#C89B3C]/45 bg-[#0B1F3A]/95 dark:bg-[#0D1E36]/95 text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {toast.type === 'error' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[#8B1E24] dark:text-white" />
                ) : toast.type === 'info' ? (
                  <Info className="h-4 w-4 shrink-0 text-[#E0B44C]" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#E0B44C]" />
                )}
                <span className="leading-snug">{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      notify: () => {},
    };
  }
  return ctx;
}
