import { useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { formatReportDate } from './dates'
import { fontMono } from './fonts'
import { cn } from './utils'
import { GregorianCalendarPicker } from './GregorianCalendarPicker'

type Props = {
  value: string
  onChange: (next: string) => void
  label?: string
  disabled?: boolean
  /** Shown when value is empty */
  placeholder?: string
  className?: string
}

/** Compact date trigger (calendar icon + dd/mm/yyyy) opening the shared Gregorian popup. */
export function GregorianDateField({
  value,
  onChange,
  label,
  disabled = false,
  placeholder = 'اختر التاريخ',
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const hasValue = /^\d{4}-\d{2}-\d{2}/.test(value)
  const display = hasValue ? formatReportDate(value) : placeholder

  return (
    <div className={cn('relative inline-flex items-center gap-1.5', className)}>
      {label ? (
        <span className="shrink-0 text-sm text-slate-600 dark:text-slate-400">{label}</span>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label ? `${label}: فتح التقويم` : 'فتح التقويم'}
        title="اختيار التاريخ من التقويم"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 min-w-[8.5rem] items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-sm font-semibold tabular-nums hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700',
          hasValue
            ? 'text-slate-900 dark:text-slate-50'
            : 'font-medium text-slate-400 dark:text-slate-500'
        )}
      >
        <Calendar className="size-4 shrink-0 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
        <span style={hasValue ? fontMono : undefined}>{display}</span>
      </button>
      <GregorianCalendarPicker
        value={hasValue ? value.slice(0, 10) : ''}
        open={open}
        onClose={() => setOpen(false)}
        disabled={disabled}
        anchorRef={triggerRef}
        onChange={onChange}
      />
    </div>
  )
}
