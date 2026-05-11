import { FC, createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

export const ToastProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Date.now().toString()
    const toast: Toast = { id, message, type, duration }
    
    setToasts(prev => [...prev, toast])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const getToastStyle = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-600 border-green-600'
      case 'error':
        return 'bg-aura-accent border-aura-accent'
      case 'warning':
        return 'bg-aura-gold border-aura-gold'
      default:
        return 'bg-blue-600 border-blue-600'
    }
  }

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      default: return 'ℹ️'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${getToastStyle(toast.type)} text-white px-6 py-4 rounded-xl shadow-lg border animate-slide-in-right max-w-sm`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{getToastIcon(toast.type)}</span>
              <p className="text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-auto text-white/70 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const Toast: FC = () => null // Export component for compatibility