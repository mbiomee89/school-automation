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
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[color:var(--pp-ink)]/8"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-bold text-[color:var(--pp-ink)]">
                غياب يوم {formatLongDate(s.attendanceDate)}
              </p>
              <Badge tone={meta.tone} label={meta.label} icon={meta.icon} />
            </div>

            {s.reasonText && (
              <p className="mt-2 text-sm text-[color:var(--pp-ink)]/75">{s.reasonText}</p>
            )}

            {s.attachmentUrl && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[color:var(--pp-ink)]/45">
                <FileCheck2 className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                تم إرفاق صورة/ملف مع هذا العذر
              </p>
            )}

            {s.status === 'REJECTED' && s.counselorNote && (
              <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[color:var(--pp-danger-soft)] px-3 py-2 text-xs text-[color:var(--pp-danger)]">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span>
                  <span className="font-semibold">ملاحظة المرشد: </span>
                  {s.counselorNote}
                </span>
              </p>
            )}

            <p className="mt-3 text-xs text-[color:var(--pp-ink)]/40">
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
