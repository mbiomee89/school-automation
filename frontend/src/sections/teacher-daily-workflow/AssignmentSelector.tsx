import { BookOpen, ChevronDown } from 'lucide-react'
import type { TeacherAssignmentOption } from './types'

export interface AssignmentSelectorProps {
  assignments: TeacherAssignmentOption[]
  activeAssignmentId: number | null
  onSelectAssignment?: (assignmentId: number) => void
}

/**
 * Class + subject picker. Per spec, this collapses to a plain read-only
 * summary (no dropdown chrome) when the teacher only has one assignment —
 * a real `<select>` with a single option would just be visual noise.
 */
export function AssignmentSelector({ assignments, activeAssignmentId, onSelectAssignment }: AssignmentSelectorProps) {
  const active = assignments.find((a) => a.id === activeAssignmentId) ?? assignments[0]
  if (!active) return null

  if (assignments.length <= 1) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200/70 bg-white/70 px-3 py-2 text-sm dark:border-blue-500/20 dark:bg-slate-900/50">
        <BookOpen className="size-4 shrink-0 text-blue-600 dark:text-blue-300" strokeWidth={1.75} aria-hidden="true" />
        <span className="font-bold text-slate-900 dark:text-slate-50">{active.className}</span>
        <span className="text-slate-400 dark:text-slate-500">·</span>
        <span className="text-slate-600 dark:text-slate-300">{active.subjectNameAr}</span>
      </div>
    )
  }

  return (
    <label className="relative inline-flex items-center gap-2">
      <span className="sr-only">اختر الفصل والمادة</span>
      <BookOpen
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-blue-600 dark:text-blue-300"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <select
        value={active.id}
        onChange={(e) => onSelectAssignment?.(Number(e.target.value))}
        className="min-h-11 w-full appearance-none rounded-xl border border-blue-200/70 bg-white ps-9 pe-9 py-2 text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-500/20 dark:bg-slate-900/50 dark:text-slate-50 sm:min-w-64"
      >
        {assignments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.className} · {a.subjectNameAr}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </label>
  )
}

export default AssignmentSelector
