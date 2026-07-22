import { Camera, AlertCircle } from 'lucide-react'
import type { AttendanceDay } from './types'
import { Badge } from '../../shared/Badge'
import { TONE_CLASSES } from '../../shared/colors'
import { ATTENDANCE_STATUS_META, EXCUSE_STATUS_META, formatLongDate } from './statusMeta'

export interface AttendanceDayRowProps {
  day: AttendanceDay
  onUploadExcuse?: (day: AttendanceDay) => void
}

/**
 * One row in the attendance history list. Status is always paired with an
 * icon + Arabic text label (never color alone), per the section's UI spec.
 */
export function AttendanceDayRow({ day, onUploadExcuse }: AttendanceDayRowProps) {
  const status = ATTENDANCE_STATUS_META[day.status]
  const StatusIcon = status.icon
  const statusTone = TONE_CLASSES[status.tone]
  const needsExcuse = day.status === 'ABSENT' && day.excuseStatus === 'NONE'

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${statusTone.bg} ${statusTone.text}`}
            aria-hidden="true"
          >
            <StatusIcon className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{formatLongDate(day.date)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={status.tone} label={status.label} icon={status.icon} />
              {day.status === 'LATE' && day.lateMinutes != null && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  (<span dir="ltr">{day.lateMinutes}</span> دقيقة)
                </span>
              )}
              {day.excuseStatus !== 'NONE' && (
                <Badge
                  tone={EXCUSE_STATUS_META[day.excuseStatus].tone}
                  label={`العذر: ${EXCUSE_STATUS_META[day.excuseStatus].label}`}
                  icon={EXCUSE_STATUS_META[day.excuseStatus].icon}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {day.excuseStatus === 'REJECTED' && day.excuseNote && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{day.excuseNote}</span>
        </p>
      )}

      {needsExcuse && (
        <button
          type="button"
          onClick={() => onUploadExcuse?.(day)}
          className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors duration-150 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25"
        >
          <Camera className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          رفع عذر الغياب
        </button>
      )}
    </li>
  )
}

export default AttendanceDayRow
