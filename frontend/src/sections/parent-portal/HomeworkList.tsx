import { BookOpenCheck, CalendarClock } from 'lucide-react'
import type { HomeworkItem } from './types'
import { EmptyState } from '../../shared/EmptyState'
import { cn } from '../../shared/utils'
import { formatShortDate } from './statusMeta'

export interface HomeworkListProps {
  items: HomeworkItem[]
  /** Compact mode drops the date group headers — used in the Home tab preview. */
  compact?: boolean
}

export function HomeworkList({ items, compact }: HomeworkListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={BookOpenCheck}
        title="لا توجد واجبات اليوم"
        description="عندما يُضيف المعلمون واجبات جديدة، ستظهر هنا فوراً."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{item.subjectNameAr}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.subjectNameEn}</p>
            </div>
            {!compact && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                {formatShortDate(item.date)}
              </span>
            )}
          </div>
          <p className={cn('mt-2 text-sm text-slate-700 dark:text-slate-300', compact && 'line-clamp-2')}>
            {item.description}
          </p>
          {item.dueDate && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
              <CalendarClock className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              التسليم: {formatShortDate(item.dueDate)}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

export default HomeworkList
