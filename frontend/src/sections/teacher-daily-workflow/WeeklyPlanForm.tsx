import { useState, useRef, useEffect, type FormEvent } from 'react'
import { ChevronRight, ChevronLeft, CalendarRange, Check } from 'lucide-react'
import type {
  SchoolWeekday,
  WeeklyPlanDays,
  WeeklyPlanEntry,
  WeeklyPlanLesson,
} from './types'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { cn } from '../../shared/utils'
import { addDaysToDateOnly, formatLongDate } from './statusMeta'

export interface WeeklyPlanFormProps {
  weekStart: string
  /** The saved plan for `weekStart`, or null if the teacher hasn't created one for this week yet. */
  plan: WeeklyPlanEntry | null
  onNavigateWeek?: (weekStart: string) => void
  onSave?: (entry: { weekStart: string; days: WeeklyPlanDays }) => void
}

const WEEKDAYS: { key: SchoolWeekday; label: string }[] = [
  { key: 'sunday', label: 'الأحد' },
  { key: 'monday', label: 'الاثنين' },
  { key: 'tuesday', label: 'الثلاثاء' },
  { key: 'wednesday', label: 'الأربعاء' },
  { key: 'thursday', label: 'الخميس' },
]

const EMPTY_DAYS: WeeklyPlanDays = {
  sunday: null,
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: null,
}

function emptyLesson(): WeeklyPlanLesson {
  return { topics: '', objectives: null, notes: null }
}

function cloneDays(source: WeeklyPlanDays | null | undefined): WeeklyPlanDays {
  if (!source) {
    return { ...EMPTY_DAYS }
  }
  const next = { ...EMPTY_DAYS }
  for (const { key } of WEEKDAYS) {
    const day = source[key]
    next[key] = day
      ? {
          topics: day.topics,
          objectives: day.objectives,
          notes: day.notes,
        }
      : null
  }
  return next
}

/**
 * Day-by-day weekly plan editor (Sun–Thu). Each day is either null (no lesson)
 * or a lesson with topics + optional objectives/notes.
 */
export function WeeklyPlanForm({ weekStart, plan, onNavigateWeek, onSave }: WeeklyPlanFormProps) {
  const [syncedWeekStart, setSyncedWeekStart] = useState(weekStart)
  const [days, setDays] = useState<WeeklyPlanDays>(() => cloneDays(plan?.days))
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (syncedWeekStart !== weekStart) {
    setSyncedWeekStart(weekStart)
    setDays(cloneDays(plan?.days))
    setJustSaved(false)
    setError(null)
  }

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  function setDayMode(key: SchoolWeekday, hasLesson: boolean) {
    setJustSaved(false)
    setError(null)
    setDays((prev) => ({
      ...prev,
      [key]: hasLesson ? emptyLesson() : null,
    }))
  }

  function patchLesson(key: SchoolWeekday, patch: Partial<WeeklyPlanLesson>) {
    setJustSaved(false)
    setError(null)
    setDays((prev) => {
      const current = prev[key]
      if (!current) return prev
      return {
        ...prev,
        [key]: { ...current, ...patch },
      }
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return

    const lessonDays = WEEKDAYS.filter(({ key }) => days[key] != null)
    if (lessonDays.length === 0) {
      setError('حدّد حصة واحدة على الأقل في أحد أيام الأسبوع قبل الحفظ.')
      return
    }

    for (const { key, label } of WEEKDAYS) {
      const day = days[key]
      if (day && !day.topics.trim()) {
        setError(`موضوعات يوم ${label} مطلوبة — أو حوّل اليوم إلى «لا حصة».`)
        return
      }
    }

    const normalized: WeeklyPlanDays = { ...EMPTY_DAYS }
    for (const { key } of WEEKDAYS) {
      const day = days[key]
      normalized[key] = day
        ? {
            topics: day.topics.trim(),
            objectives: day.objectives?.trim() || null,
            notes: day.notes?.trim() || null,
          }
        : null
    }

    setSaving(true)
    onSave?.({ weekStart, days: normalized })
    saveTimeoutRef.current = setTimeout(() => {
      setSaving(false)
      setJustSaved(true)
    }, 600)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => onNavigateWeek?.(addDaysToDateOnly(weekStart, -7))}
          aria-label="الأسبوع السابق"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <ChevronRight className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center">
          <CalendarRange
            className="size-4 shrink-0 text-blue-600 dark:text-blue-300"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">
              أسبوع {formatLongDate(weekStart)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">بداية الأسبوع (السبت) · أيام الدراسة أحد–خميس</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateWeek?.(addDaysToDateOnly(weekStart, 7))}
          aria-label="الأسبوع القادم"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {!plan && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          لا توجد خطة محفوظة لهذا الأسبوع بعد — حدّد لكل يوم «حصة» أو «لا حصة» ثم احفظ.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {WEEKDAYS.map(({ key, label }) => {
          const lesson = days[key]
          const hasLesson = lesson != null
          return (
            <fieldset
              key={key}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
            >
              <legend className="px-1 text-sm font-bold text-slate-900 dark:text-slate-50">{label}</legend>

              <div
                role="group"
                aria-label={`نوع يوم ${label}`}
                className="mt-2 grid grid-cols-2 gap-2"
              >
                <button
                  type="button"
                  aria-pressed={!hasLesson}
                  onClick={() => setDayMode(key, false)}
                  className={cn(
                    'min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    !hasLesson
                      ? 'border-slate-700 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700'
                  )}
                >
                  لا حصة
                </button>
                <button
                  type="button"
                  aria-pressed={hasLesson}
                  onClick={() => setDayMode(key, true)}
                  className={cn(
                    'min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    hasLesson
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700'
                  )}
                >
                  حصة
                </button>
              </div>

              {hasLesson && lesson && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                  <label className="block text-sm">
                    <span className="text-slate-600 dark:text-slate-400">الموضوعات (مطلوب)</span>
                    <textarea
                      required
                      value={lesson.topics}
                      onChange={(e) => patchLesson(key, { topics: e.target.value })}
                      rows={2}
                      placeholder="مثال: الوحدة الرابعة — الكسور العشرية"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600 dark:text-slate-400">الأهداف (اختياري)</span>
                    <textarea
                      value={lesson.objectives ?? ''}
                      onChange={(e) => patchLesson(key, { objectives: e.target.value || null })}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600 dark:text-slate-400">ملاحظات (اختياري)</span>
                    <textarea
                      value={lesson.notes ?? ''}
                      onChange={(e) => patchLesson(key, { notes: e.target.value || null })}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                </div>
              )}
            </fieldset>
          )
        })}

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className={buttonVariants({ variant: 'primary', className: 'w-full' })}
        >
          {saving ? (
            <span className={SPINNER_CLASS} aria-hidden="true" />
          ) : justSaved ? (
            <Check className="size-4" strokeWidth={2} aria-hidden="true" />
          ) : null}
          {saving ? 'جارٍ الحفظ…' : justSaved ? 'تم الحفظ — قابل للتعديل' : plan ? 'حفظ التعديلات' : 'حفظ الخطة'}
        </button>
      </form>
    </div>
  )
}

export default WeeklyPlanForm
