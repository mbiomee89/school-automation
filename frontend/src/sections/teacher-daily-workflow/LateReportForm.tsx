import { useEffect, useState, type FormEvent } from 'react'
import { Search, AlarmClock, Plus } from 'lucide-react'
import type { RosterStudent } from './types'
import { buttonVariants } from '../../shared/buttonVariants'
import { nowTimeValue, toIsoDateTime } from './statusMeta'

export interface LateReportFormProps {
  roster: RosterStudent[]
  todayDate: string
  onSubmit: (entry: { studentId: string; time: string; reason?: string | null }) => void
}

/** Quick add-form for a late arrival: search-to-narrow student picker, time (defaults to now), optional reason. */
export function LateReportForm({ roster, todayDate, onSubmit }: LateReportFormProps) {
  const [query, setQuery] = useState('')
  const [studentId, setStudentId] = useState(roster[0]?.id ?? '')
  const [time, setTime] = useState(nowTimeValue())
  const [reason, setReason] = useState('')

  useEffect(() => {
    setQuery('')
    setStudentId(roster[0]?.id ?? '')
  }, [roster])

  const q = query.trim().toLowerCase()
  const matches = q
    ? roster.filter((s) => s.nameAr.includes(query.trim()) || s.nameEn.toLowerCase().includes(q))
    : roster

  function handleQueryChange(value: string) {
    setQuery(value)
    const q2 = value.trim().toLowerCase()
    const nextMatches = q2
      ? roster.filter((s) => s.nameAr.includes(value.trim()) || s.nameEn.toLowerCase().includes(q2))
      : roster
    if (nextMatches.length > 0 && !nextMatches.some((s) => s.id === studentId)) {
      setStudentId(nextMatches[0].id)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!studentId || !time) return
    onSubmit({ studentId, time: toIsoDateTime(todayDate, time), reason: reason.trim() || null })
    setReason('')
    setTime(nowTimeValue())
    setQuery('')
    setStudentId(roster[0]?.id ?? '')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-50">
        <AlarmClock className="size-4 text-amber-600 dark:text-amber-400" strokeWidth={1.75} aria-hidden="true" />
        تسجيل تأخر جديد
      </div>

      <label className="block text-sm">
        <span className="text-slate-600 dark:text-slate-400">الطالب</span>
        <div className="relative mt-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="ابحث عن اسم الطالب…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pe-3 ps-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <select
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {matches.length === 0 && <option value="">لا يوجد طالب مطابق</option>}
          {matches.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameAr}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">وقت الوصول</span>
          <input
            required
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            dir="ltr"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">السبب (اختياري)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: ازدحام مروري"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={!studentId}
        className={buttonVariants({ variant: 'primary', size: 'sm', className: 'w-full' })}
      >
        <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
        تسجيل التأخر
      </button>
    </form>
  )
}

export default LateReportForm
