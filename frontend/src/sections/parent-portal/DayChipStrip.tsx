import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../shared/utils'
import { addDaysIso, weekStartSundayIso } from './theme'

const DAY_SHORT = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']

export interface DayChipStripProps {
  /** Selected YYYY-MM-DD */
  value: string
  onChange: (date: string) => void
  /** Anchor for “today” highlight */
  today: string
  label?: string
}

/** Mobile-friendly week strip instead of raw date input. */
export function DayChipStrip({ value, onChange, today, label = 'اختر اليوم' }: DayChipStripProps) {
  const weekStart = weekStartSundayIso(value)
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i))

  return (
    <div className="space-y-2" role="group" aria-label={label}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="الأسبوع السابق"
          onClick={() => onChange(addDaysIso(weekStart, -7))}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-[color:var(--pp-ink)] transition-colors hover:bg-[color:var(--pp-sky)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
        >
          <ChevronRight className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <p className="text-xs font-semibold tabular-nums text-[color:var(--pp-ink)]/60" dir="ltr">
          {weekStart} → {addDaysIso(weekStart, 6)}
        </p>
        <button
          type="button"
          aria-label="الأسبوع التالي"
          onClick={() => onChange(addDaysIso(weekStart, 7))}
          disabled={weekStart >= weekStartSundayIso(today)}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-[color:var(--pp-ink)] transition-colors hover:bg-[color:var(--pp-sky)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {days.map((date) => {
          const [y, m, d] = date.split('-').map(Number)
          const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
          const isSchoolDay = dow >= 0 && dow <= 4
          const selected = date === value
          const isToday = date === today
          return (
            <button
              key={date}
              type="button"
              disabled={!isSchoolDay}
              onClick={() => onChange(date)}
              className={cn(
                'flex min-h-11 min-w-[3.25rem] shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)] motion-reduce:transition-none',
                !isSchoolDay && 'cursor-not-allowed opacity-35',
                selected
                  ? 'bg-[color:var(--pp-primary)] text-white'
                  : isToday
                    ? 'bg-[color:var(--pp-primary-soft)] text-[color:var(--pp-ink)]'
                    : 'bg-[color:var(--pp-sand)] text-[color:var(--pp-ink)]/80 hover:bg-[color:var(--pp-sky)]'
              )}
            >
              <span className="whitespace-nowrap text-[10px] font-semibold opacity-80">{DAY_SHORT[dow]}</span>
              <span className="text-sm font-bold tabular-nums">{String(d).padStart(2, '0')}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
