import { NotebookPen, Target, StickyNote, Ban } from 'lucide-react'
import type {
  SchoolWeekday,
  WeeklyPlanItem,
  WeeklyPlanLesson,
} from './types'
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
      {lesson.objectives && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <Target
            className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>{lesson.objectives}</span>
        </p>
      )}
      {lesson.notes && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <StickyNote className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{lesson.notes}</span>
        </p>
      )}
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

  const weekStart = items[0]?.weekStart

  return (
    <div className="space-y-3">
      {weekStart && (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          الأسبوع الممتد من {formatShortDate(weekStart)}
        </p>
      )}
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{item.subjectNameAr}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.subjectNameEn}</p>
            </div>
            <div className="mt-3 space-y-2">
              {WEEKDAYS.map(({ key, label }) => (
                <DayBlock key={key} label={label} lesson={item.days[key]} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default WeeklyPlanList
