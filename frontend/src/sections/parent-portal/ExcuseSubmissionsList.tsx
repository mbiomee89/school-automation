import { AlertCircle, FileCheck2, Inbox } from 'lucide-react'
import type { ExcuseSubmission } from './types'
import { Badge } from '../../shared/Badge'
import { EmptyState } from '../../shared/EmptyState'
import { EXCUSE_STATUS_META, formatDateTime, formatLongDate } from './statusMeta'

export interface ExcuseSubmissionsListProps {
  submissions: ExcuseSubmission[]
}

/** The "أعذاري المُرسلة" view — every excuse the parent has submitted, with review status/notes. */
export function ExcuseSubmissionsList({ submissions }: ExcuseSubmissionsListProps) {
  if (submissions.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="لا توجد أعذار مُرسلة"
        description="عند رفع عذر غياب، ستظهر حالته ومتابعته هنا."
      />
    )
  }

  const sorted = [...submissions].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))

  return (
    <ul className="space-y-3">
      {sorted.map((s) => {
        const meta = EXCUSE_STATUS_META[s.status]
        return (
          <li
            key={s.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                غياب يوم {formatLongDate(s.attendanceDate)}
              </p>
              <Badge tone={meta.tone} label={meta.label} icon={meta.icon} />
            </div>

            {s.reasonText && (
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{s.reasonText}</p>
            )}

            {s.attachmentUrl && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <FileCheck2 className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                تم إرفاق صورة/ملف مع هذا العذر
              </p>
            )}

            {s.status === 'REJECTED' && s.counselorNote && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span>
                  <span className="font-semibold">ملاحظة المرشد: </span>
                  {s.counselorNote}
                </span>
              </p>
            )}

            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              أُرسل {formatDateTime(s.submittedAt)}
              {s.reviewedAt && <> · رُوجع {formatDateTime(s.reviewedAt)}</>}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export default ExcuseSubmissionsList
