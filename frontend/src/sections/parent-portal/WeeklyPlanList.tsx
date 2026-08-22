import { NotebookPen, Ban } from 'lucide-react'
import type { SchoolWeekday, WeeklyPlanItem, WeeklyPlanLesson } from './types'
import { EmptyState } from '../../shared/EmptyState'
import { formatShortDate } from './statusMeta'

export interface WeeklyPlanListProps {
  items: WeeklyPlanItem[]
}

const WEEKDAYS: { key: SchoolWeekday; label: string }[] = [
  { key: 'sunday', label: 'الأحد' },
  { key: 'monday', label: 'الاثنين' },
  { key: 'tuesday', label: 'الثلاثاء' },
  { key: 'wednesday', label: 'الأربعاء' },
  { key: 'thursday', label: 'الخميس' },
]

function DayBlock({
  label,
  lesson,
}: {
  label: string
  lesson: WeeklyPlanLesson | null
}) {
  if (!lesson) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Ban className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{label}</span>
          <span className="font-normal">— لا حصة</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{label}</p>
      <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{lesson.topics}</p>
    </div>
  )
}

export function WeeklyPlanList({ items }: WeeklyPlanListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="لا توجد خطة أسبوعية بعد"
        description="ستظهر خطة الأسبوع الدراسي بمجرد نشرها من قِبل المعلمين."
      />
    )
  }

  const cellItems = items.filter((i) => i.title && i.date)
  const legacyItems = items.filter((i) => i.days && !i.title)

  return (
    <div className="space-y-3">
      {cellItems.length > 0 && (
        <ul className="space-y-3">
          {cellItems.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{item.subjectNameAr}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.subjectNameEn}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.dayLabel ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                      {item.dayLabel}
                    </span>
                  ) : null}
                  {item.period ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                      الحصة {item.period}
                    </span>
                  ) : null}
                  {item.date ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                      {formatShortDate(item.date)}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
            </li>
          ))}
        </ul>
      )}

      {legacyItems.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
        >
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{item.subjectNameAr}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.subjectNameEn}</p>
            <p className="mt-1 text-xs text-slate-500">الأسبوع من {formatShortDate(item.weekStart)}</p>
          </div>
          <div className="mt-3 space-y-2">
            {WEEKDAYS.map(({ key, label }) => (
              <DayBlock key={key} label={label} lesson={item.days?.[key] ?? null} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default WeeklyPlanList
