import { Camera, AlertCircle } from 'lucide-react'
import type { AttendanceDay } from './types'
import { Badge } from '../../shared/Badge'
import { TONE_CLASSES } from '../../shared/colors'
import { ATTENDANCE_STATUS_META, EXCUSE_STATUS_META, formatLongDate } from './statusMeta'
import { cn } from '../../shared/utils'

export interface AttendanceDayRowProps {
  day: AttendanceDay
  onUploadExcuse?: (day: AttendanceDay) => void
}

export function AttendanceDayRow({ day, onUploadExcuse }: AttendanceDayRowProps) {
  const status = ATTENDANCE_STATUS_META[day.status]
  const StatusIcon = status.icon
  const statusTone = TONE_CLASSES[status.tone]
  const needsExcuse =
    day.status === 'ABSENT' &&
    (day.excuseStatus === 'NONE' || day.excuseStatus === 'REJECTED')
  const quiet = day.status === 'PRESENT'

  return (
    <li
      className={cn(
        'rounded-2xl p-4 transition-colors',
        quiet
          ? 'bg-[color:var(--pp-sand)]/70'
          : 'border border-[color:var(--pp-ink)]/10 bg-white shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-2xl ${statusTone.bg} ${statusTone.text}`}
            aria-hidden="true"
          >
            <StatusIcon className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-bold text-[color:var(--pp-ink)]">{formatLongDate(day.date)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={status.tone} label={status.label} icon={status.icon} />
              {day.status === 'LATE' && day.lateMinutes != null && (
                <span className="text-xs text-[color:var(--pp-ink)]/55">
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
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[color:var(--pp-danger-soft)] px-3 py-2 text-xs text-[color:var(--pp-danger)]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{day.excuseNote}</span>
        </p>
      )}

      {needsExcuse && (
        <button
          type="button"
          onClick={() => onUploadExcuse?.(day)}
          className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[color:var(--pp-primary)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)] focus-visible:ring-offset-2"
        >
          <Camera className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {day.excuseStatus === 'REJECTED' ? 'إعادة رفع العذر' : 'رفع عذر الغياب'}
        </button>
      )}
    </li>
  )
}

export default AttendanceDayRow
