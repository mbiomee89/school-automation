import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from './utils'

export type StaffToastTone = 'ok' | 'error'

type ShowToast = (message: string, tone?: StaffToastTone) => void

const StaffToastContext = createContext<ShowToast | null>(null)

export function useStaffToast(): ShowToast {
  const ctx = useContext(StaffToastContext)
  if (!ctx) {
    // Safe no-op outside provider (e.g. isolated story/preview) — avoid crashing saves.
    return () => {}
  }
  return ctx
}

export function StaffToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: StaffToastTone } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const showToast = useCallback<ShowToast>((message, tone = 'ok') => {
    setToast({ message, tone })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const value = useMemo(() => showToast, [showToast])

  return (
    <StaffToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4 print:hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
        >
          <p
            className={cn(
              'pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-center text-sm font-medium shadow-lg',
              toast.tone === 'error'
                ? 'bg-red-700 text-white'
                : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            )}
          >
            {toast.message}
          </p>
        </div>
      ) : null}
    </StaffToastContext.Provider>
  )
}
