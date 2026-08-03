import { useState, type FormEvent } from 'react'
import { NotebookPen, Plus } from 'lucide-react'
import { buttonVariants } from '../../shared/buttonVariants'

export interface HomeworkFormProps {
  todayDate: string
  onSubmit: (entry: { description: string; dueDate?: string | null }) => void | Promise<void>
}

/** Quick add-form for today's homework: multiline description (required) + optional due date. */
export function HomeworkForm({ todayDate, onSubmit }: HomeworkFormProps) {
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const trimmed = description.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await onSubmit({ description: trimmed, dueDate: dueDate || null })
      setDescription('')
      setDueDate('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-50">
        <NotebookPen className="size-4 text-blue-600 dark:text-blue-300" strokeWidth={1.75} aria-hidden="true" />
        إضافة واجب اليوم
      </div>

      <label className="block text-sm">
        <span className="text-slate-600 dark:text-slate-400">الوصف</span>
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={submitting}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950"
        />
      </label>

      <label className="block text-sm">
        <span className="text-slate-600 dark:text-slate-400">تاريخ الاستحقاق (اختياري)</span>
        <input
          type="date"
          min={todayDate}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={submitting}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className={buttonVariants({ variant: 'primary', className: 'w-full disabled:opacity-50' })}
      >
        <Plus className="size-4" strokeWidth={1.75} />
        {submitting ? 'جارٍ الإضافة…' : 'إضافة الواجب'}
      </button>
    </form>
  )
}

export default HomeworkForm
