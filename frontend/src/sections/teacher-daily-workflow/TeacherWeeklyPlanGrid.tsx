import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '../../shared/utils'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import {
  deleteWeeklyPlan,
  getTeacherWeek,
  saveWeeklyPlanCell,
  todayDateStr,
  weekStartSunday,
  type TeacherWeekGrid,
  type TeacherWeekSlot,
} from '../../api/teacher'
import { ApiError } from '../../api/client'

const DAY_LABELS: Record<string, string> = {
  SUN: 'الأحد',
  MON: 'الإثنين',
  TUE: 'الثلاثاء',
  WED: 'الأربعاء',
  THU: 'الخميس',
}

const PERIODS = ['1', '2', '3', '4', '5', '6']

function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return utc.toISOString().slice(0, 10)
}

/** Saturday opens the upcoming Sun–Thu week; otherwise the week containing today. */
function defaultPlanAnchor(today: string) {
  const week = weekStartSunday(today)
  const [y, m, d] = today.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (dow === 6) return addDays(week, 7)
  return week
}

function alertError(err: unknown, fallback: string) {
  window.alert(err instanceof ApiError ? err.message : fallback)
}

export function TeacherWeeklyPlanGrid() {
  const today = todayDateStr()
  const [anchor, setAnchor] = useState(() => defaultPlanAnchor(today))
  const [grid, setGrid] = useState<TeacherWeekGrid | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TeacherWeekSlot | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  async function reload(nextAnchor = anchor) {
    setLoading(true)
    try {
      const data = await getTeacherWeek(nextAnchor)
      setGrid(data)
    } catch (err) {
      alertError(err, 'تعذّر تحميل جدول الخطة')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload(anchor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor])

  const editable = grid?.planEditable ?? grid?.editable ?? false
  const weekStart = grid?.weekStart ?? weekStartSunday(anchor)
  const maxEditableWeek = defaultPlanAnchor(today)

  const cellMap = useMemo(() => {
    const map = new Map<string, TeacherWeekSlot>()
    for (const day of grid?.days ?? []) {
      for (const slot of day.slots) {
        map.set(`${day.dayOfWeek}|${slot.period}`, slot)
      }
    }
    return map
  }, [grid])

  const missingToday = useMemo(() => {
    if (!grid) return []
    const todayDay = grid.days.find((d) => d.date === today)
    if (!todayDay || !editable) return []
    return todayDay.slots.filter((s) => !s.hasPlan && s.assignmentId != null)
  }, [grid, today, editable])

  function openCell(slot: TeacherWeekSlot) {
    setSelected(slot)
    setTitle(slot.planTitle || '')
  }

  async function savePlan() {
    if (!selected || !editable) return
    const trimmed = title.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await saveWeeklyPlanCell({
        classId: selected.classId,
        subjectId: selected.subjectId,
        date: selected.date,
        period: selected.period,
        title: trimmed,
      })
      setSelected(null)
      await reload()
    } catch (err) {
      alertError(err, 'فشل حفظ عنوان الدرس')
    } finally {
      setBusy(false)
    }
  }

  async function removePlan() {
    if (!selected?.planId || !editable) return
    if (!window.confirm('حذف عنوان هذه الحصة؟')) return
    setBusy(true)
    try {
      await deleteWeeklyPlan(selected.planId)
      setSelected(null)
      await reload()
    } catch (err) {
      alertError(err, 'فشل الحذف')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">الخطة الأسبوعية</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            تبدأ إضافة الخطة من السبت للأسبوع القادم (أحد–خميس) · يمكن التعديل حتى الجمعة
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            onClick={() => setAnchor(addDays(weekStart, -7))}
            aria-label="الأسبوع السابق"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="min-w-36 text-center text-sm font-semibold tabular-nums" dir="ltr">
            {weekStart} → {addDays(weekStart, 4)}
          </span>
          <button
            type="button"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            onClick={() => setAnchor(addDays(weekStart, 7))}
            disabled={weekStart >= maxEditableWeek}
            aria-label="الأسبوع التالي"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
      </div>

      {!editable && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          خارج فترة التعديل — عرض فقط
        </p>
      )}

      {editable && missingToday.length > 0 && (
        <button
          type="button"
          onClick={() => openCell(missingToday[0])}
          className="flex w-full items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50"
        >
          <span>متبقي اليوم: {missingToday.length} حصة</span>
          <span className="text-xs font-medium opacity-80">اضغط للانتقال</span>
        </button>
      )}

      {loading || !grid ? (
        <div className="flex justify-center py-16">
          <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80">
                <th className="border-b border-e border-slate-200 px-2 py-2 text-xs font-bold dark:border-slate-700">
                  اليوم
                </th>
                {PERIODS.map((period) => (
                  <th
                    key={period}
                    className="border-b border-e border-slate-200 px-2 py-2 text-xs font-bold tabular-nums dark:border-slate-700"
                  >
                    ح{period}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.days.map((day) => {
                const isTodayRow = day.date === today
                return (
                  <tr
                    key={day.dayOfWeek}
                    className={cn(isTodayRow && 'bg-blue-50/40 dark:bg-blue-500/5')}
                  >
                    <td
                      className={cn(
                        'border-b border-e border-slate-200 px-2 py-2 text-xs font-bold dark:border-slate-700',
                        isTodayRow && 'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100'
                      )}
                    >
                      <div>{DAY_LABELS[day.dayOfWeek]}</div>
                      <div className="mt-0.5 font-normal tabular-nums opacity-70" dir="ltr">
                        {day.date.slice(5)}
                      </div>
                    </td>
                    {PERIODS.map((period) => {
                      const slot = cellMap.get(`${day.dayOfWeek}|${period}`)
                      if (!slot) {
                        return (
                          <td
                            key={period}
                            className="border-b border-e border-slate-100 bg-slate-50/50 px-1 py-1 dark:border-slate-800 dark:bg-slate-950/40"
                          />
                        )
                      }
                      return (
                        <td
                          key={period}
                          className="border-b border-e border-slate-200 p-1 dark:border-slate-700"
                        >
                          <button
                            type="button"
                            onClick={() => openCell(slot)}
                            className={cn(
                              'flex min-h-16 w-full flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-start transition-colors',
                              slot.hasPlan &&
                                'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10',
                              !slot.hasPlan &&
                                isTodayRow &&
                                editable &&
                                'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10',
                              !slot.hasPlan &&
                                !(isTodayRow && editable) &&
                                'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-600 dark:bg-slate-900'
                            )}
                          >
                            <span className="text-[11px] font-bold leading-tight text-slate-900 dark:text-slate-50">
                              {slot.className}
                            </span>
                            <span className="text-[10px] leading-tight text-slate-600 dark:text-slate-300">
                              {slot.subjectNameAr}
                            </span>
                            {slot.hasPlan && (
                              <span className="line-clamp-2 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                                {slot.planTitle}
                              </span>
                            )}
                            {!slot.hasPlan && isTodayRow && editable && (
                              <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                                لم يُسجّل
                              </span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">
                  {DAY_LABELS[selected.dayOfWeek]} · الحصة {selected.period}
                  <span className="mx-1">·</span>
                  <span dir="ltr">{selected.date}</span>
                </p>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-50">
                  {selected.className} · {selected.subjectNameAr}
                </h3>
                {!editable && (
                  <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">عرض فقط</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <label className="mt-4 block text-sm">
              <span className="text-slate-600 dark:text-slate-400">عنوان الدرس</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!editable || busy}
                placeholder="مثال: الوحدة الرابعة — الكسور"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950"
              />
            </label>

            {editable && (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy || !title.trim()}
                  onClick={() => void savePlan()}
                  className={buttonVariants({ variant: 'primary', className: 'w-full disabled:opacity-50' })}
                >
                  {busy ? 'جارٍ الحفظ…' : selected.planId ? 'تحديث العنوان' : 'حفظ العنوان'}
                </button>
                {selected.planId ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removePlan()}
                    className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400"
                  >
                    حذف التسجيل
                  </button>
                ) : null}
              </div>
            )}

            {!editable && selected.planTitle && (
              <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">{selected.planTitle}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherWeeklyPlanGrid
