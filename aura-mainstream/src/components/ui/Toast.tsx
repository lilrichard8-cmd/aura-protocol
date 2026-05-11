import { useState, useEffect } from 'react';
import { Check, X, Info, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  /** Button label shown on the right of the toast. */
  label: string;
  /** Called on click. Toast auto-dismisses after click. */
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  /** Optional inline CTA — e.g. "Buy ORA" for insufficient-balance toasts. */
  action?: ToastAction;
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const icons = {
  success: Check,
  error: X,
  info: Info,
  warning: AlertCircle,
};

const styles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
};

const iconStyles = {
  success: 'text-emerald-600 bg-emerald-100',
  error: 'text-red-600 bg-red-100',
  info: 'text-blue-600 bg-blue-100',
  warning: 'text-amber-600 bg-amber-100',
};

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const Icon = icons[toast.type];

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    
    // Auto-remove after duration
    const duration = toast.duration || 3000;
    const removeTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, [toast, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm
        transition-all duration-300 ease-out
        ${styles[toast.type]}
        ${isVisible && !isExiting 
          ? 'translate-y-0 opacity-100 scale-100' 
          : isExiting 
            ? 'translate-y-2 opacity-0 scale-95'
            : 'translate-y-8 opacity-0 scale-95'
        }
      `}
    >
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${iconStyles[toast.type]}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{toast.title}</div>
        {toast.message && (
          <div className="text-xs mt-1 opacity-80">{toast.message}</div>
        )}
      </div>

      {toast.action && (
        <button
          onClick={() => {
            toast.action?.onClick();
            handleClose();
          }}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          {toast.action.label}
        </button>
      )}

      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}