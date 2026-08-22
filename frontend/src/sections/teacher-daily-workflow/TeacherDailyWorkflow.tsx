import { useMemo, useState } from 'react'
import {
  ClipboardCheck,
  AlarmClock,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  Inbox,
  Save,
  type LucideIcon,
} from 'lucide-react'
import type {
  AttendanceMark,
  AttendanceStatus,
  RosterStudent,
  TeacherDailyWorkflowProps,
  TeacherTab,
} from './types'
import { EmptyState } from '../../shared/EmptyState'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic } from '../../shared/fonts'
import { cn } from '../../shared/utils'
import { AssignmentSelector } from './AssignmentSelector'
import { AttendanceRosterList } from './AttendanceRosterList'
import { LateReportForm } from './LateReportForm'
import { LateReportRow } from './LateReportRow'
import { HomeworkForm } from './HomeworkForm'
import { HomeworkRow } from './HomeworkRow'
import { WeeklyPlanForm } from './WeeklyPlanForm'
import { formatLongDate } from './statusMeta'

function buildInitialMarks(roster: RosterStudent[], marks: AttendanceMark[]): Record<string, AttendanceStatus> {
  const map: Record<string, AttendanceStatus> = {}
  for (const student of roster) map[student.id] = 'PRESENT'
  for (const mark of marks) map[mark.studentId] = mark.status
  return map
}

interface TabDef {
  id: TeacherTab
  label: string
  icon: LucideIcon
}

const TABS: TabDef[] = [
  { id: 'attendance', label: 'الحضور', icon: ClipboardCheck },
  { id: 'late', label: 'التأخير', icon: AlarmClock },
  { id: 'homework', label: 'الواجبات', icon: BookOpenCheck },
  { id: 'weekly-plan', label: 'الخطة الأسبوعية', icon: CalendarRange },
]

export function TeacherDailyWorkflow({
  assignments,
  activeAssignmentId,
  todaySlots = [],
  roster,
  todayDate,
  attendanceSavedAt,
  attendanceMarks,
  lateReportsToday,
  homeworkToday,
  currentWeekStart,
  weeklyPlan,
  activeTab: controlledTab,
  onTabChange,
  onSelectAssignment,
  onSaveAttendance,
  onAddLateReport,
  onUpdateLateReport,
  onDeleteLateReport,
  onAddHomework,
  onUpdateHomework,
  onDeleteHomework,
  onNavigateWeek,
  onSaveWeeklyPlan,
}: TeacherDailyWorkflowProps) {
  const [tab, setTab] = useState<TeacherTab>(controlledTab ?? 'attendance')
  const currentTab = controlledTab ?? tab

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

  // Weekly plan is only demonstrated for `currentWeekStart` in the sample
  // data, so viewing a different (adjacent) week shows the correct "no plan
  // yet" empty state rather than a stale plan bleeding across weeks.
  const [viewedWeekStart, setViewedWeekStart] = useState(currentWeekStart)
  const [syncedBaseWeekStart, setSyncedBaseWeekStart] = useState(currentWeekStart)
  if (syncedBaseWeekStart !== currentWeekStart) {
    setSyncedBaseWeekStart(currentWeekStart)
    setViewedWeekStart(currentWeekStart)
  }
  const planForViewedWeek = viewedWeekStart === currentWeekStart ? weeklyPlan : null

  function switchTab(next: TeacherTab) {
    setTab(next)
    onTabChange?.(next)
  }

  function handleNavigateWeek(nextWeekStart: string) {
    setViewedWeekStart(nextWeekStart)
    onNavigateWeek?.(nextWeekStart)
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
                أعمال المعلم اليومية
              </h1>
            </div>
            <AssignmentSelector
              assignments={assignments}
              activeAssignmentId={activeAssignmentId}
              onSelectAssignment={onSelectAssignment}
            />
          </div>
          {todaySlots.length > 0 && (
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

      <div className="sticky top-0 z-10 mt-4 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => {
            const isActive = currentTab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none',
                  isActive
                    ? 'border-blue-600 font-bold text-blue-700 dark:border-blue-400 dark:text-blue-300'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {t.label}
                <TabIndicator
                  tab={t.id}
                  attendanceSaved={effectiveSavedAt != null}
                  lateCount={lateReportsToday.length}
                  homeworkCount={homeworkToday.length}
                  hasWeeklyPlan={planForViewedWeek != null}
                />
              </button>
            )
          })}
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

        {currentTab === 'late' && (
          <div className="space-y-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            <LateReportForm roster={roster} todayDate={todayDate} onSubmit={(entry) => onAddLateReport?.(entry)} />

            {lateReportsToday.length === 0 ? (
              <EmptyState icon={AlarmClock} title="لا توجد سجلات تأخير اليوم" description="ستظهر هنا سجلات تأخر الطلاب فور إضافتها." />
            ) : (
              <ul className="space-y-2.5">
                {lateReportsToday.map((entry) => (
                  <LateReportRow
                    key={entry.id}
                    entry={entry}
                    todayDate={todayDate}
                    onUpdate={onUpdateLateReport}
                    onDelete={onDeleteLateReport}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {currentTab === 'homework' && (
          <div className="space-y-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            <HomeworkForm todayDate={todayDate} onSubmit={(entry) => onAddHomework?.(entry)} />

            {homeworkToday.length === 0 ? (
              <EmptyState icon={BookOpenCheck} title="لا توجد واجبات اليوم" description="الواجبات التي تضيفها لهذا الفصل والمادة ستظهر هنا." />
            ) : (
              <ul className="space-y-2.5">
                {homeworkToday.map((entry) => (
                  <HomeworkRow
                    key={entry.id}
                    entry={entry}
                    todayDate={todayDate}
                    onUpdate={onUpdateHomework}
                    onDelete={onDeleteHomework}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {currentTab === 'weekly-plan' && (
          <div className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            <WeeklyPlanForm
              weekStart={viewedWeekStart}
              plan={planForViewedWeek}
              onNavigateWeek={handleNavigateWeek}
              onSave={(entry) => onSaveWeeklyPlan?.(entry)}
            />
          </div>
        )}
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

interface TabIndicatorProps {
  tab: TeacherTab
  attendanceSaved: boolean
  lateCount: number
  homeworkCount: number
  hasWeeklyPlan: boolean
}

function TabIndicator({ tab, attendanceSaved, lateCount, homeworkCount, hasWeeklyPlan }: TabIndicatorProps) {
  if (tab === 'attendance' && attendanceSaved) {
    return (
      <CheckCircle2
        className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
        strokeWidth={2}
        aria-label="تم حفظ الحضور"
      />
    )
  }
  if (tab === 'late' && lateCount > 0) {
    return <CountPill count={lateCount} />
  }
  if (tab === 'homework' && homeworkCount > 0) {
    return <CountPill count={homeworkCount} />
  }
  if (tab === 'weekly-plan' && hasWeeklyPlan) {
    return (
      <CheckCircle2
        className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
        strokeWidth={2}
        aria-label="توجد خطة محفوظة لهذا الأسبوع"
      />
    )
  }
  return null
}

function CountPill({ count }: { count: number }) {
  return (
    <span
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-100 px-1 text-[10px] font-bold text-blue-700 dark:bg-blue-500/25 dark:text-blue-300"
      dir="ltr"
    >
      {count}
    </span>
  )
}

export default TeacherDailyWorkflow
