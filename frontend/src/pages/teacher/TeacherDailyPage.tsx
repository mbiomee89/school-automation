import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Inbox } from 'lucide-react'
import {
  addHomework,
  deleteHomework,
  getAttendance,
  getHomework,
  listRoster,
  listTeacherAssignments,
  getTeacherToday,
  saveAttendance,
  todayDateStr,
  updateHomework,
  weekStartSaturday,
} from '../../api/teacher'
import { ApiError } from '../../api/client'
import { TeacherDailyWorkflow } from '../../sections/teacher-daily-workflow/TeacherDailyWorkflow'
import type {
  AttendanceMark,
  HomeworkEntry,
  RosterStudent,
  TeacherAssignmentOption,
  TeacherTab,
} from '../../sections/teacher-daily-workflow/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'
import { useStaffToast } from '../../shared/StaffToast'

function alertError(err: unknown, fallback: string) {
  window.alert(err instanceof ApiError ? err.message : fallback)
}

export function TeacherDailyPage() {
  const showToast = useStaffToast()
  const today = todayDateStr()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab: TeacherTab =
    tabParam === 'homework' || tabParam === 'weekly-plan' || tabParam === 'attendance'
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
  const [homeworkToday, setHomeworkToday] = useState<HomeworkEntry[]>([])
  const [currentWeekStart] = useState(weekStartSaturday(today))
  const weeklyPlan = null

  const active = assignments.find((a) => a.id === activeAssignmentId) ?? null

  const loadAssignmentData = useCallback(
    async (assignment: TeacherAssignmentOption) => {
      const [students, attendance, homework] = await Promise.all([
        listRoster(assignment.classId),
        getAttendance(assignment.classId, today),
        getHomework(assignment.classId, assignment.subjectId, today),
      ])
      setRoster(students)
      setAttendanceMarks(attendance.marks)
      setAttendanceSavedAt(attendance.savedAt)
      setHomeworkToday(homework)
    },
    [today]
  )

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'homework' || t === 'weekly-plan' || t === 'attendance') {
      setActiveTab(t)
    } else if (t === 'late' || !t) {
      setActiveTab('attendance')
      setSearchParams({ tab: 'attendance' }, { replace: true })
    }
  }, [searchParams, setSearchParams])

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
      homeworkToday={homeworkToday}
      currentWeekStart={currentWeekStart}
      weeklyPlan={weeklyPlan}
      activeTab={activeTab}
      onSelectAssignment={selectAssignment}
      onSaveAttendance={async (marks) => {
        if (!active) return
        try {
          const result = await saveAttendance(active.classId, today, marks)
          setAttendanceMarks(marks)
          setAttendanceSavedAt(result.savedAt)
          showToast('تم حفظ الحضور')
        } catch (err) {
          alertError(err, 'فشل حفظ الحضور')
          throw err
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
          showToast('تم حفظ الواجب')
        } catch (err) {
          alertError(err, 'فشل إضافة الواجب')
        }
      }}
      onUpdateHomework={async (id, patch) => {
        try {
          const row = await updateHomework(id, patch)
          setHomeworkToday((prev) => prev.map((h) => (h.id === id ? row : h)))
          showToast('تم حفظ الواجب')
        } catch (err) {
          alertError(err, 'فشل تعديل الواجب')
        }
      }}
      onDeleteHomework={async (id) => {
        try {
          await deleteHomework(id)
          setHomeworkToday((prev) => prev.filter((h) => h.id !== id))
          showToast('تم حذف الواجب')
        } catch (err) {
          alertError(err, 'فشل حذف الواجب')
        }
      }}
      onNavigateWeek={() => {}}
      onSaveWeeklyPlan={async () => {}}
    />
  )
}
