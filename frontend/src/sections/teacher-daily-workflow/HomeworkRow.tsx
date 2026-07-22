import { useState } from 'react'
import { Pencil, Trash2, Check, X, CalendarClock, BookOpenCheck } from 'lucide-react'
import type { HomeworkEntry } from './types'
import { buttonVariants } from '../../shared/buttonVariants'
import { formatShortDate } from './statusMeta'

export interface HomeworkRowProps {
  entry: HomeworkEntry
  todayDate: string
  onUpdate?: (id: number, patch: { description?: string; dueDate?: string | null }) => void
  onDelete?: (id: number) => void
}

export function HomeworkRow({ entry, todayDate, onUpdate, onDelete }: HomeworkRowProps) {
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(entry.description)
  const [dueDate, setDueDate] = useState(entry.dueDate ?? '')

  function startEdit() {
    setDescription(entry.description)
    setDueDate(entry.dueDate ?? '')
    setEditing(true)
  }

  function saveEdit() {
    const trimmed = description.trim()
    if (!trimmed) return
    onUpdate?.(entry.id, { description: trimmed, dueDate: dueDate || null })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="rounded-2xl border border-blue-300 bg-blue-50/40 p-3 dark:border-blue-500/40 dark:bg-blue-500/10">
        <label className="block text-xs">
          <span className="text-slate-500 dark:text-slate-400">الوصف</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="mt-2 block text-xs">
          <span className="text-slate-500 dark:text-slate-400">تاريخ التسليم</span>
          <input
            type="date"
            value={dueDate}
            min={todayDate}
            onChange={(e) => setDueDate(e.target.value)}
            dir="ltr"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={saveEdit}
            disabled={!description.trim()}
            className={buttonVariants({ variant: 'primary', size: 'sm', className: 'flex-1' })}
          >
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
    <li className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
            aria-hidden="true"
          >
            <BookOpenCheck className="size-4" strokeWidth={1.75} />
          </span>
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{entry.description}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={startEdit}
            aria-label="تعديل الواجب"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <Pencil className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(entry.id)}
            aria-label="حذف الواجب"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      {entry.dueDate && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 ps-11 text-xs font-medium text-blue-700 dark:text-blue-300">
          <CalendarClock className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          التسليم: {formatShortDate(entry.dueDate)}
        </p>
      )}
    </li>
  )
}

export default HomeworkRow
