import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(id => clearTimeout(id))
    }
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter
    setToasts(prev => [...prev, { id, message, type }])
    const tid = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timeoutsRef.current.delete(id)
    }, 4000)
    timeoutsRef.current.set(id, tid)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-sm ${
              t.type === 'success'
                ? 'bg-green-600'
                : t.type === 'error'
                ? 'bg-red-600'
                : 'bg-gray-800 dark:bg-gray-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
