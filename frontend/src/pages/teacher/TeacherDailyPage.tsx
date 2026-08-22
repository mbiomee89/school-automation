import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Inbox } from 'lucide-react'
import {
  addHomework,
  addLateReport,
  deleteHomework,
  deleteLateReport,
  getAttendance,
  getHomework,
  getLateReports,
  listRoster,
  listTeacherAssignments,
  getTeacherToday,
  saveAttendance,
  todayDateStr,
  updateHomework,
  updateLateReport,
  weekStartSaturday,
} from '../../api/teacher'
import { ApiError } from '../../api/client'
import { TeacherDailyWorkflow } from '../../sections/teacher-daily-workflow/TeacherDailyWorkflow'
import type {
  AttendanceMark,
  HomeworkEntry,
  LateReportEntry,
  RosterStudent,
  TeacherAssignmentOption,
  TeacherTab,
} from '../../sections/teacher-daily-workflow/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

function alertError(err: unknown, fallback: string) {
  window.alert(err instanceof ApiError ? err.message : fallback)
}

export function TeacherDailyPage() {
  const today = todayDateStr()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab: TeacherTab =
    tabParam === 'homework' || tabParam === 'late' || tabParam === 'weekly-plan' || tabParam === 'attendance'
      ? tabParam
      : 'attendance'
  const [activeTab, setActiveTab] = useState<TeacherTab>(initialTab)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<TeacherAssignmentOption[]>([])
  const [todaySlots, setTodaySlots] = useState<
    Array<{
      period: string
      className: string
      subjectNameAr: string
      assignmentId: number | null
    }>
  >([])
  const [activeAssignmentId, setActiveAssignmentId] = useState<number | null>(null)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [attendanceMarks, setAttendanceMarks] = useState<AttendanceMark[]>([])
  const [attendanceSavedAt, setAttendanceSavedAt] = useState<string | null>(null)
  const [lateReportsToday, setLateReportsToday] = useState<LateReportEntry[]>([])
  const [homeworkToday, setHomeworkToday] = useState<HomeworkEntry[]>([])
  const [currentWeekStart] = useState(weekStartSaturday(today))
  const weeklyPlan = null

  const active = assignments.find((a) => a.id === activeAssignmentId) ?? null

  const loadAssignmentData = useCallback(
    async (assignment: TeacherAssignmentOption) => {
      const [students, attendance, late, homework] = await Promise.all([
        listRoster(assignment.classId),
        getAttendance(assignment.classId, today),
        getLateReports(assignment.classId, today),
        getHomework(assignment.classId, assignment.subjectId, today),
      ])
      setRoster(students)
      setAttendanceMarks(attendance.marks)
      setAttendanceSavedAt(attendance.savedAt)
      setLateReportsToday(late)
      setHomeworkToday(homework)
    },
    [today]
  )

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'homework' || t === 'late' || t === 'weekly-plan' || t === 'attendance') {
      setActiveTab(t)
    }
  }, [searchParams])

  const selectAssignment = useCallback(
    async (assignmentId: number) => {
      const next = assignments.find((a) => a.id === assignmentId)
      if (!next) return
      try {
        await loadAssignmentData(next)
        setActiveAssignmentId(assignmentId)
      } catch (err) {
        alertError(err, 'فشل تحميل بيانات الصف')
      }
    },
    [assignments, loadAssignmentData]
  )

  function handleTabChange(tab: TeacherTab) {
    setActiveTab(tab)
    if (tab === 'attendance') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab }, { replace: true })
    }
    if (tab === 'homework') {
      const todayIds = todaySlots.map((s) => s.assignmentId).filter((id): id is number => id != null)
      if (todayIds.length > 0 && (activeAssignmentId == null || !todayIds.includes(activeAssignmentId))) {
        void selectAssignment(todayIds[0])
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [list, schedule] = await Promise.all([
          listTeacherAssignments(),
          getTeacherToday(today).catch(() => ({
            date: today,
            dayOfWeek: null,
            academicYear: null,
            slots: [],
          })),
        ])
        if (cancelled) return
        setAssignments(list)
        const slots = (schedule.slots || []).map((s) => ({
          period: s.period,
          className: s.className,
          subjectNameAr: s.subjectNameAr,
          assignmentId: s.assignmentId,
        }))
        setTodaySlots(slots)
        if (list.length === 0) {
          setActiveAssignmentId(null)
          return
        }
        // Prefer first today's lesson with an assignment; else first assignment
        const fromSchedule =
          slots.find((s) => s.assignmentId != null)?.assignmentId ??
          list[0].id
        const initial = list.find((a) => a.id === fromSchedule) ?? list[0]
        setActiveAssignmentId(initial.id)
        await loadAssignmentData(initial)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل أعمال المعلم')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadAssignmentData, today])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        tone="error"
        title="تعذّر التحميل"
        description={error}
        actionLabel="تحديث الصفحة"
        onAction={() => window.location.reload()}
      />
    )
  }

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="لا توجد توزيعات"
        description="لم يُسند إليك أي صف/مادة بعد. تواصل مع الإدارة لإضافة توزيع معلم."
      />
    )
  }

  return (
    <TeacherDailyWorkflow
      assignments={assignments}
      activeAssignmentId={activeAssignmentId}
      todaySlots={todaySlots}
      roster={roster}
      todayDate={today}
      attendanceSavedAt={attendanceSavedAt}
      attendanceMarks={attendanceMarks}
      lateReportsToday={lateReportsToday}
      homeworkToday={homeworkToday}
      currentWeekStart={currentWeekStart}
      weeklyPlan={weeklyPlan}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onSelectAssignment={selectAssignment}
      onSaveAttendance={async (marks) => {
        if (!active) return
        try {
          const result = await saveAttendance(active.classId, today, marks)
          setAttendanceMarks(marks)
          setAttendanceSavedAt(result.savedAt)
        } catch (err) {
          alertError(err, 'فشل حفظ الحضور')
          throw err
        }
      }}
      onAddLateReport={async (entry) => {
        if (!active) return
        try {
          const row = await addLateReport({
            studentId: entry.studentId,
            classId: active.classId,
            date: today,
            time: entry.time,
            reason: entry.reason,
          })
          setLateReportsToday((prev) => [...prev, row])
        } catch (err) {
          alertError(err, 'فشل تسجيل التأخر')
        }
      }}
      onUpdateLateReport={async (id, patch) => {
        try {
          const row = await updateLateReport(id, patch)
          setLateReportsToday((prev) => prev.map((r) => (r.id === id ? row : r)))
        } catch (err) {
          alertError(err, 'فشل تعديل التأخر')
        }
      }}
      onDeleteLateReport={async (id) => {
        try {
          await deleteLateReport(id)
          setLateReportsToday((prev) => prev.filter((r) => r.id !== id))
        } catch (err) {
          alertError(err, 'فشل حذف التأخر')
        }
      }}
      onAddHomework={async (entry) => {
        if (!active) return
        try {
          const row = await addHomework({
            classId: active.classId,
            subjectId: active.subjectId,
            date: today,
            description: entry.description,
            dueDate: entry.dueDate,
          })
          setHomeworkToday((prev) => [row, ...prev])
        } catch (err) {
          alertError(err, 'فشل إضافة الواجب')
        }
      }}
      onUpdateHomework={async (id, patch) => {
        try {
          const row = await updateHomework(id, patch)
          setHomeworkToday((prev) => prev.map((h) => (h.id === id ? row : h)))
        } catch (err) {
          alertError(err, 'فشل تعديل الواجب')
        }
      }}
      onDeleteHomework={async (id) => {
        try {
          await deleteHomework(id)
          setHomeworkToday((prev) => prev.filter((h) => h.id !== id))
        } catch (err) {
          alertError(err, 'فشل حذف الواجب')
        }
      }}
      onNavigateWeek={() => {}}
      onSaveWeeklyPlan={async () => {}}
    />
  )
}
