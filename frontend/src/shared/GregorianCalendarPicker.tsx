import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  ARABIC_GREGORIAN_MONTHS,
  ARABIC_WEEKDAYS_SHORT_SUN_FIRST,
  getMonthCalendarCells,
  parseDateOnlyParts,
  todayDateOnly,
} from './dates'
import { cn } from './utils'
import { fontArabic } from './fonts'

type Props = {
  value: string
  onChange: (next: string) => void
  open: boolean
  onClose: () => void
  disabled?: boolean
  /** Anchor element for outside-click (trigger button). */
  anchorRef?: RefObject<HTMLElement | null>
}

/** Gregorian month grid with Arabic month names (shared across reports & counselor). */
export function GregorianCalendarPicker({
  value,
  onChange,
  open,
  onClose,
  disabled = false,
  anchorRef,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const safeValue = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : todayDateOnly()
  const parts = parseDateOnlyParts(safeValue)
  const today = todayDateOnly()
  const [viewYear, setViewYear] = useState(parts.year)
  const [viewMonth, setViewMonth] = useState(parts.month)

  useEffect(() => {
    if (!open) return
    const p = parseDateOnlyParts(safeValue)
    setViewYear(p.year)
    setViewMonth(p.month)
  }, [open, safeValue])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (anchorRef?.current?.contains(t)) return
      // Native <select> menus render outside the panel in some browsers
      if (t instanceof Element && t.closest('select, option')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    // click (not mousedown) so month/year <select> can open without closing the popup
    document.addEventListener('click', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onPointer)
    }
  }, [open, onClose, anchorRef])

  const yearOptions = useMemo(() => {
    const center = parts.year
    const start = Math.min(center - 6, new Date().getFullYear() - 6)
    const end = Math.max(center + 2, new Date().getFullYear() + 1)
    const years: number[] = []
    for (let y = end; y >= start; y--) years.push(y)
    return years
  }, [parts.year])

  const cells = useMemo(() => getMonthCalendarCells(viewYear, viewMonth), [viewYear, viewMonth])

  if (!open) return null

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setViewMonth(m)
    setViewYear(y)
  }

  const selectedValue = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      dir="rtl"
      className="absolute end-0 top-full z-40 mt-1 w-[19.5rem] rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-900"
      style={fontArabic}
    >
      <p id={labelId} className="sr-only">
        اختيار التاريخ
      </p>

      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-label="الشهر السابق"
          onClick={() => shiftMonth(-1)}
          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </button>

        <select
          disabled={disabled}
          value={viewMonth}
          aria-label="الشهر"
          onChange={(e) => setViewMonth(Number(e.target.value))}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {ARABIC_GREGORIAN_MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>

        <select
          disabled={disabled}
          value={viewYear}
          aria-label="السنة"
          onChange={(e) => setViewYear(Number(e.target.value))}
          className="w-[5.25rem] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold tabular-nums text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={disabled}
          aria-label="الشهر التالي"
          onClick={() => shiftMonth(1)}
          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
        {ARABIC_WEEKDAYS_SHORT_SUN_FIRST.map((d) => (
          <div
            key={d}
            className="py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell) => {
          const selected = selectedValue !== '' && cell.dateOnly === selectedValue
          const isToday = cell.dateOnly === today
          return (
            <button
              key={cell.dateOnly + String(cell.inMonth)}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(cell.dateOnly)
                onClose()
              }}
              className={cn(
                'inline-flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors',
                !cell.inMonth && 'text-slate-300 dark:text-slate-600',
                cell.inMonth &&
                  !selected &&
                  'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800',
                selected && 'bg-sky-600 font-bold text-white hover:bg-sky-600',
                isToday && !selected && 'ring-1 ring-sky-400 ring-inset'
              )}
            >
              {cell.day}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex justify-center border-t border-slate-100 pt-2 dark:border-slate-700">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const t = todayDateOnly()
            const p = parseDateOnlyParts(t)
            setViewYear(p.year)
            setViewMonth(p.month)
            onChange(t)
            onClose()
          }}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-slate-800"
        >
          اليوم
        </button>
      </div>
    </div>
  )
}
