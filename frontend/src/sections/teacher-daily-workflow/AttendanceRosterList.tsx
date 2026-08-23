import type { AttendanceStatus, RosterStudent } from './types'
import { TONE_CLASSES } from '../../shared/colors'
import { cn } from '../../shared/utils'
import { ATTENDANCE_STATUS_META } from './statusMeta'

export interface AttendanceRosterListProps {
  roster: RosterStudent[]
  marks: Record<string, AttendanceStatus>
  onSetStatus: (studentId: string, status: AttendanceStatus) => void
}

const STATUS_ORDER: AttendanceStatus[] = ['PRESENT', 'ABSENT']

function initials(nameAr: string) {
  return nameAr.trim().charAt(0)
}

/**
 * Roster with direct-set PRESENT/ABSENT. EXCUSED is counselor-only (shown read-only if already set).
 */
export function AttendanceRosterList({ roster, marks, onSetStatus }: AttendanceRosterListProps) {
  return (
    <ul className="space-y-2.5">
      {roster.map((student) => {
        const status = marks[student.id] ?? 'PRESENT'
        const statusTone = TONE_CLASSES[ATTENDANCE_STATUS_META[status].tone]
        const isExcused = status === 'EXCUSED'

        return (
          <li
            key={student.id}
            className={cn(
              'rounded-2xl border bg-white p-3 transition-colors duration-150 dark:bg-slate-800',
              status === 'PRESENT'
                ? 'border-slate-200 dark:border-slate-700'
                : cn(statusTone.border, 'border-2')
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  statusTone.bg,
                  statusTone.text
                )}
                aria-hidden="true"
              >
                {initials(student.nameAr)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{student.nameAr}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{student.nameEn}</p>
              </div>
            </div>

            {isExcused ? (
              <p className="mt-2.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                معفى (من المرشد) — غيّر إلى حاضر أو غائب إن لزم.
              </p>
            ) : null}

            <div
              role="group"
              aria-label={`حالة حضور ${student.nameAr}`}
              className="mt-2.5 grid grid-cols-2 gap-1.5"
            >
              {STATUS_ORDER.map((option) => {
                const meta = ATTENDANCE_STATUS_META[option]
                const tone = TONE_CLASSES[meta.tone]
                const isActive = status === option
                const Icon = meta.icon
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onSetStatus(student.id, option)}
                    className={cn(
                      'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:focus-visible:ring-offset-slate-800',
                      isActive
                        ? cn(tone.solidBg, tone.solidText, 'border-transparent')
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default AttendanceRosterList
