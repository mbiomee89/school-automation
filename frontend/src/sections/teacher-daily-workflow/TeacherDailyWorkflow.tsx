import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Inbox,
  Save,
} from 'lucide-react'
import type {
  AttendanceMark,
  AttendanceStatus,
  RosterStudent,
  TeacherDailyWorkflowProps,
} from './types'
import { EmptyState } from '../../shared/EmptyState'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic } from '../../shared/fonts'
import { cn } from '../../shared/utils'
import { AssignmentSelector } from './AssignmentSelector'
import { AttendanceRosterList } from './AttendanceRosterList'
import { TeacherHomeworkGrid } from './TeacherHomeworkGrid'
import { TeacherWeeklyPlanGrid } from './TeacherWeeklyPlanGrid'
import { formatLongDate } from './statusMeta'

function buildInitialMarks(roster: RosterStudent[], marks: AttendanceMark[]): Record<string, AttendanceStatus> {
  const map: Record<string, AttendanceStatus> = {}
  for (const student of roster) map[student.id] = 'PRESENT'
  for (const mark of marks) map[mark.studentId] = mark.status
  return map
}

export function TeacherDailyWorkflow({
  assignments,
  activeAssignmentId,
  todaySlots = [],
  roster,
  todayDate,
  attendanceSavedAt,
  attendanceMarks,
  homeworkToday,
  currentWeekStart,
  weeklyPlan,
  activeTab: controlledTab,
  onSelectAssignment,
  onSaveAttendance,
  onAddHomework: _onAddHomework,
  onUpdateHomework: _onUpdateHomework,
  onDeleteHomework: _onDeleteHomework,
  onNavigateWeek: _onNavigateWeek,
  onSaveWeeklyPlan: _onSaveWeeklyPlan,
}: TeacherDailyWorkflowProps) {
  void _onAddHomework
  void _onUpdateHomework
  void _onDeleteHomework
  void _onNavigateWeek
  void _onSaveWeeklyPlan
  void currentWeekStart
  void weeklyPlan
  void homeworkToday
  const currentTab = controlledTab ?? 'attendance'

  // Attendance draft: local until "حفظ الحضور" is pressed, since the whole
  // point of the batch-save flow is editing several students before one
  // save call. Re-synced (adjusted during render) whenever the selected
  // assignment changes, since that implies a fresh roster + marks from props.
  const [syncedAssignmentId, setSyncedAssignmentId] = useState(activeAssignmentId)
  const [draftMarks, setDraftMarks] = useState<Record<string, AttendanceStatus>>(() =>
    buildInitialMarks(roster, attendanceMarks)
  )
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [justSavedAt, setJustSavedAt] = useState<string | null>(null)

  if (syncedAssignmentId !== activeAssignmentId) {
    setSyncedAssignmentId(activeAssignmentId)
    setDraftMarks(buildInitialMarks(roster, attendanceMarks))
    setJustSavedAt(null)
  }

  function handleSetStatus(studentId: string, status: AttendanceStatus) {
    setDraftMarks((prev) => ({ ...prev, [studentId]: status }))
    setJustSavedAt(null)
  }

  function handleSaveAttendance() {
    if (savingAttendance) return
    void (async () => {
      setSavingAttendance(true)
      setJustSavedAt(null)
      const marks: AttendanceMark[] = roster.map((student) => ({
        studentId: student.id,
        status: draftMarks[student.id] ?? 'PRESENT',
      }))
      try {
        await onSaveAttendance?.(marks)
        setJustSavedAt(new Date().toISOString())
      } catch {
        // Caller surfaces the error (alert); do not show a false success.
      } finally {
        setSavingAttendance(false)
      }
    })()
  }

  const effectiveSavedAt = justSavedAt ?? attendanceSavedAt
  const attendanceCounts = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, EXCUSED: 0 } as Record<AttendanceStatus, number>
    for (const student of roster) {
      const status = draftMarks[student.id] ?? 'PRESENT'
      counts[status] += 1
    }
    return counts
  }, [roster, draftMarks])

  if (assignments.length === 0) {
    return (
      <div
        dir="rtl"
        lang="ar"
        className="flex min-h-full items-center justify-center bg-slate-50 p-4 dark:bg-slate-950"
        style={fontArabic}
      >
        <EmptyState
          icon={Inbox}
          title="لا توجد تكليفات لك حالياً"
          description="لم تُخصَّص لك أي فصول أو مواد بعد. تواصل مع الإدارة المدرسية لتوزيع التكليفات."
        />
      </div>
    )
  }

  return (
    <div dir="rtl" lang="ar" className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50" style={fontArabic}>
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-4 dark:border-slate-700 dark:from-blue-500/10 dark:via-slate-900 dark:to-slate-900 sm:p-5">
          <div
            className="pointer-events-none absolute -end-8 -top-10 size-36 rounded-full bg-blue-100/60 dark:bg-blue-500/10"
            aria-hidden="true"
          />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                اليوم · {formatLongDate(todayDate)}
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50 sm:text-2xl">
                {currentTab === 'homework'
                  ? 'الواجبات'
                  : currentTab === 'weekly-plan'
                    ? 'الخطة الأسبوعية'
                    : 'الحضور'}
              </h1>
            </div>
            {currentTab !== 'homework' && currentTab !== 'weekly-plan' && (
              <AssignmentSelector
                assignments={assignments}
                activeAssignmentId={activeAssignmentId}
                onSelectAssignment={onSelectAssignment}
              />
            )}
          </div>
          {currentTab !== 'homework' && currentTab !== 'weekly-plan' && todaySlots.length > 0 && (
            <div className="relative mt-3 flex flex-wrap gap-2">
              <span className="w-full text-xs font-medium text-slate-500 dark:text-slate-400">
                حصص اليوم — اضغط للانتقال مباشرة
              </span>
              {todaySlots.map((slot) => {
                const active = slot.assignmentId != null && slot.assignmentId === activeAssignmentId
                return (
                  <button
                    key={`${slot.period}-${slot.className}-${slot.subjectNameAr}`}
                    type="button"
                    disabled={!slot.assignmentId}
                    onClick={() => slot.assignmentId && onSelectAssignment?.(slot.assignmentId)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
                      !slot.assignmentId && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <span className="tabular-nums opacity-80">ح{slot.period}</span>
                    <span>
                      {slot.className} · {slot.subjectNameAr}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className={cn('mx-auto max-w-3xl px-4 py-4 sm:px-6', currentTab === 'attendance' && 'pb-28')}>
        {currentTab === 'attendance' && (
          <div className="space-y-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            <div className="flex items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span>{roster.length} طلاب في الفصل</span>
              {effectiveSavedAt && (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  آخر حفظ الساعة{' '}
                  <span dir="ltr">
                    {new Date(effectiveSavedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              )}
            </div>

            {roster.length === 0 ? (
              <EmptyState icon={Inbox} title="لا يوجد طلاب في هذا الفصل" />
            ) : (
              <AttendanceRosterList roster={roster} marks={draftMarks} onSetStatus={handleSetStatus} />
            )}
          </div>
        )}

        {currentTab === 'homework' && <TeacherHomeworkGrid />}

        {currentTab === 'weekly-plan' && <TeacherWeeklyPlanGrid />}
      </div>

      {currentTab === 'attendance' && roster.length > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
              <span dir="ltr">{attendanceCounts.PRESENT}</span> حاضر ·{' '}
              <span dir="ltr">{attendanceCounts.ABSENT}</span> غائب ·{' '}
              <span dir="ltr">{attendanceCounts.EXCUSED}</span> معفى
            </p>
            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={savingAttendance}
              className={buttonVariants({ variant: 'primary', className: 'flex-1 sm:flex-none sm:min-w-48' })}
            >
              {savingAttendance ? (
                <span className={SPINNER_CLASS} aria-hidden="true" />
              ) : (
                <Save className="size-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              {savingAttendance ? 'جارٍ الحفظ…' : 'حفظ الحضور'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherDailyWorkflow
