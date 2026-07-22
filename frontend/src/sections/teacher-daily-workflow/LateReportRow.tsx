import { useState } from 'react'
import { Pencil, Trash2, Check, X, AlarmClock } from 'lucide-react'
import type { LateReportEntry } from './types'
import { buttonVariants } from '../../shared/buttonVariants'
import { timeToInputValue, toIsoDateTime } from './statusMeta'

export interface LateReportRowProps {
  entry: LateReportEntry
  todayDate: string
  onUpdate?: (id: number, patch: { time?: string; reason?: string | null }) => void
  onDelete?: (id: number) => void
}

export function LateReportRow({ entry, todayDate, onUpdate, onDelete }: LateReportRowProps) {
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState(timeToInputValue(entry.time))
  const [reason, setReason] = useState(entry.reason ?? '')

  function startEdit() {
    setTime(timeToInputValue(entry.time))
    setReason(entry.reason ?? '')
    setEditing(true)
  }

  function saveEdit() {
    onUpdate?.(entry.id, { time: toIsoDateTime(todayDate, time), reason: reason.trim() || null })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="rounded-2xl border border-blue-300 bg-blue-50/40 p-3 dark:border-blue-500/40 dark:bg-blue-500/10">
        <p className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">{entry.studentName}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs">
            <span className="text-slate-500 dark:text-slate-400">وقت الوصول</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              dir="ltr"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-500 dark:text-slate-400">السبب</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
        <div className="mt-2.5 flex gap-2">
          <button type="button" onClick={saveEdit} className={buttonVariants({ variant: 'primary', size: 'sm', className: 'flex-1' })}>
            <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
            حفظ
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'flex-1' })}
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
            إلغاء
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          aria-hidden="true"
        >
          <AlarmClock className="size-4" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{entry.studentName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            وصل الساعة <span dir="ltr">{timeToInputValue(entry.time)}</span>
            {entry.reason ? ` · ${entry.reason}` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={startEdit}
          aria-label={`تعديل تأخر ${entry.studentName}`}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <Pencil className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(entry.id)}
          aria-label={`حذف تأخر ${entry.studentName}`}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </li>
  )
}

export default LateReportRow
