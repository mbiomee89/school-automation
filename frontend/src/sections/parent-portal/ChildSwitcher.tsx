import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { Child } from './types'
import { cn } from '../../shared/utils'

export interface ChildSwitcherProps {
  children: Child[]
  activeChildId: string
  onSelectChild?: (childId: string) => void
}

function initials(nameAr: string) {
  return nameAr.trim().slice(0, 1)
}

/**
 * Persistent child-context switcher shown at the top of every screen in this
 * section. Only becomes an interactive dropdown when the parent has more than
 * one child enrolled — otherwise it's a plain read-only label (per spec).
 */
export function ChildSwitcher({ children, activeChildId, onSelectChild }: ChildSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeChild = children.find((c) => c.id === activeChildId) ?? children[0]

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (!activeChild) return null

  const avatar = (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--pp-primary)] text-sm font-bold text-white"
      aria-hidden="true"
    >
      {initials(activeChild.nameAr)}
    </span>
  )

  if (children.length <= 1) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        {avatar}
        <div className="min-w-0 text-start">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{activeChild.nameAr}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{activeChild.className}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`الابن النشط: ${activeChild.nameAr}. اضغط للتبديل بين الأبناء`}
        className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1 text-start transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-800"
      >
        {avatar}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{activeChild.nameAr}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{activeChild.className}</p>
        </div>
        <ChevronDown
          className={cn('size-4 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="اختيار الابن"
          className="absolute start-0 top-full z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800 animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
        >
          {children.map((c) => {
            const isActive = c.id === activeChild.id
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setOpen(false)
                  if (!isActive) onSelectChild?.(c.id)
                }}
                className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 motion-reduce:transition-none dark:hover:bg-slate-700"
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  {initials(c.nameAr)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 dark:text-slate-50">{c.nameAr}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{c.className}</span>
                </span>
                {isActive && <Check className="size-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ChildSwitcher
