import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import {
  addHomework,
  addLateReport,
  deleteHomework,
  deleteLateReport,
  getAttendance,
  getHomework,
  getLateReports,
  getWeeklyPlan,
  listRoster,
  listTeacherAssignments,
  saveAttendance,
  saveWeeklyPlan,
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
  WeeklyPlanEntry,
} from '../../sections/teacher-daily-workflow/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

function alertError(err: unknown, fallback: string) {
  window.alert(err instanceof ApiError ? err.message : fallback)
}

export function TeacherDailyPage() {
  const today = todayDateStr()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<TeacherAssignmentOption[]>([])
  const [activeAssignmentId, setActiveAssignmentId] = useState<number | null>(null)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [attendanceMarks, setAttendanceMarks] = useState<AttendanceMark[]>([])
  const [attendanceSavedAt, setAttendanceSavedAt] = useState<string | null>(null)
  const [lateReportsToday, setLateReportsToday] = useState<LateReportEntry[]>([])
  const [homeworkToday, setHomeworkToday] = useState<HomeworkEntry[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState(weekStartSaturday(today))
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanEntry | null>(null)

  const active = assignments.find((a) => a.id === activeAssignmentId) ?? null

  const loadAssignmentData = useCallback(
    async (assignment: TeacherAssignmentOption, weekStart: string) => {
      const [students, attendance, late, homework, plan] = await Promise.all([
        listRoster(assignment.classId),
        getAttendance(assignment.classId, today),
        getLateReports(assignment.classId, today),
        getHomework(assignment.classId, assignment.subjectId, today),
        getWeeklyPlan(assignment.classId, assignment.subjectId, weekStart),
      ])
      setRoster(students)
      setAttendanceMarks(attendance.marks)
      setAttendanceSavedAt(attendance.savedAt)
      setLateReportsToday(late)
      setHomeworkToday(homework)
      setWeeklyPlan(plan)
    },
    [today]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listTeacherAssignments()
        if (cancelled) return
        setAssignments(list)
        if (list.length === 0) {
          setActiveAssignmentId(null)
          return
        }
        const first = list[0]
        setActiveAssignmentId(first.id)
        await loadAssignmentData(first, weekStartSaturday(today))
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
      roster={roster}
      todayDate={today}
      attendanceSavedAt={attendanceSavedAt}
      attendanceMarks={attendanceMarks}
      lateReportsToday={lateReportsToday}
      homeworkToday={homeworkToday}
      currentWeekStart={currentWeekStart}
      weeklyPlan={weeklyPlan}
      onSelectAssignment={async (assignmentId) => {
        const next = assignments.find((a) => a.id === assignmentId)
        if (!next) return
        setActiveAssignmentId(assignmentId)
        try {
          await loadAssignmentData(next, currentWeekStart)
        } catch (err) {
          alertError(err, 'فشل تحميل بيانات الصف')
        }
      }}
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
      onNavigateWeek={async (weekStart) => {
        setCurrentWeekStart(weekStart)
        if (!active) return
        try {
          setWeeklyPlan(await getWeeklyPlan(active.classId, active.subjectId, weekStart))
        } catch (err) {
          alertError(err, 'فشل تحميل الخطة الأسبوعية')
        }
      }}
      onSaveWeeklyPlan={async (entry) => {
        if (!active) return
        try {
          const plan = await saveWeeklyPlan({
            classId: active.classId,
            subjectId: active.subjectId,
            weekStart: entry.weekStart,
            days: entry.days,
          })
          setCurrentWeekStart(entry.weekStart)
          setWeeklyPlan(plan)
        } catch (err) {
          alertError(err, 'فشل حفظ الخطة الأسبوعية')
        }
      }}
    />
  )
}
