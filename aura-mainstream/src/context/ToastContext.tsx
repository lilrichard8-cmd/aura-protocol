import { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer } from '@/components/ui/Toast';
import type { Toast, ToastAction, ToastType } from '@/components/ui/Toast';
import type { ReactNode } from 'react';

interface ToastContextType {
  /** Show a toast. The legacy 4-arg signature is preserved; pass an object
   *  in the 3rd slot to include an action button (used for Buy ORA CTAs). */
  showToast: (
    type: ToastType,
    title: string,
    messageOrOpts?: string | { message?: string; duration?: number; action?: ToastAction },
    duration?: number,
  ) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (
      type: ToastType,
      title: string,
      messageOrOpts?: string | { message?: string; duration?: number; action?: ToastAction },
      duration?: number,
    ) => {
      const id = Math.random().toString(36).substring(2);
      // Backward-compatible: string third arg is treated as message.
      const opts = typeof messageOrOpts === 'string'
        ? { message: messageOrOpts }
        : (messageOrOpts ?? {});
      const newToast: Toast = {
        id,
        type,
        title,
        message: opts.message,
        // Toasts with an action stay longer so users have time to click.
        duration: opts.duration ?? duration ?? (opts.action ? 6000 : 3000),
        action: opts.action,
      };
      setToasts(prev => [...prev, newToast]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}