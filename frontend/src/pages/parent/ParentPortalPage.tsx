import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import {
  getParentAttendance,
  getParentExcuses,
  getParentHomework,
  getParentNotifications,
  getParentSummary,
  getParentWeeklyPlans,
  setParentWaOptIn,
  submitExcuse,
  type ParentChild,
} from '../../api/parent'
import { ApiError } from '../../api/client'
import { useParentAuth } from '../../lib/parentAuth'
import { ParentPortal } from '../../sections/parent-portal/ParentPortal'
import type {
  AttendanceDay,
  ExcuseSubmission,
  HomeworkItem,
  NotificationItem,
  TodaySummary,
  WeeklyPlanItem,
} from '../../sections/parent-portal/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

function toChild(s: ParentChild) {
  return {
    id: s.id,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    className: s.className,
    gradeLevel: s.gradeLevel,
  }
}

export function ParentPortalPage() {
  const { students, isAuthenticated, bootstrapping, logout, setStudents } = useParentAuth()
  const navigate = useNavigate()

  const [activeChildId, setActiveChildId] = useState<string>('')
  const [, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [todaySummary, setTodaySummary] = useState<TodaySummary>({
    date: new Date().toISOString().slice(0, 10),
    attendanceStatus: null,
    homeworkDueCount: 0,
    newAlertsCount: 0,
  })
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceDay[]>([])
  const [homeworkItems, setHomeworkItems] = useState<HomeworkItem[]>([])
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [excuseSubmissions, setExcuseSubmissions] = useState<ExcuseSubmission[]>([])
  const [waOptedIn, setWaOptedIn] = useState(false)

  useEffect(() => {
    if (students.length === 0) return
    if (!activeChildId || !students.some((s) => s.id === activeChildId)) {
      setActiveChildId(students[0].id)
    }
  }, [students, activeChildId])

  const loadChild = useCallback(async (studentId: string) => {
    setError(null)
    const [summary, attendance, homework, plans, notifs, excuses] = await Promise.all([
      getParentSummary(studentId),
      getParentAttendance(studentId),
      getParentHomework(studentId),
      getParentWeeklyPlans(studentId),
      getParentNotifications(studentId),
      getParentExcuses(studentId),
    ])
    setTodaySummary({
      date: summary.date,
      attendanceStatus: summary.attendanceStatus,
      homeworkDueCount: summary.homeworkDueCount,
      newAlertsCount: summary.newAlertsCount,
    })
    setWaOptedIn(summary.waOptedIn)
    setAttendanceHistory(attendance)
    setHomeworkItems(homework)
    setWeeklyPlans(plans)
    setNotifications(notifs)
    setExcuseSubmissions(excuses)
  }, [])

  useEffect(() => {
    if (!activeChildId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await loadChild(activeChildId)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل بيانات الابن')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeChildId, loadChild])

  if (bootstrapping) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/parent/login" replace />
  }

  if (students.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="لا يوجد أبناء مرتبطون"
        description="لم يُعثر على طلاب مرتبطين بهذا الجوال. تواصل مع إدارة المدرسة."
        actionLabel="تسجيل الخروج"
        onAction={() => {
          logout()
          navigate('/parent/login')
        }}
      />
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        tone="error"
        title="تعذّر التحميل"
        description={error}
        actionLabel="إعادة المحاولة"
        onAction={() => {
          if (activeChildId) {
            setLoading(true)
            loadChild(activeChildId)
              .catch((err) => setError(err instanceof ApiError ? err.message : 'فشل'))
              .finally(() => setLoading(false))
          }
        }}
      />
    )
  }

  return (
    <ParentPortal
      children={students.map(toChild)}
      activeChildId={activeChildId || students[0].id}
      todaySummary={todaySummary}
      attendanceHistory={attendanceHistory}
      homeworkItems={homeworkItems}
      weeklyPlans={weeklyPlans}
      notifications={notifications}
      excuseSubmissions={excuseSubmissions}
      waOptedIn={waOptedIn}
      onSelectChild={setActiveChildId}
      onSubmitExcuse={async (input) => {
        const day = attendanceHistory.find(
          (d) => d.date === input.attendanceDate && d.status === 'ABSENT'
        )
        if (!day) {
          window.alert('لم يُعثر على سجل غياب لهذا اليوم')
          return
        }
        try {
          await submitExcuse(day.id, input.reasonText, input.file)
          await loadChild(activeChildId)
        } catch (err) {
          window.alert(err instanceof ApiError ? err.message : 'فشل إرسال العذر')
        }
      }}
      onToggleWaOptIn={async (optedIn) => {
        try {
          const updated = await setParentWaOptIn(optedIn, activeChildId)
          setStudents(updated)
          setWaOptedIn(optedIn)
        } catch (err) {
          window.alert(err instanceof ApiError ? err.message : 'فشل تحديث موافقة واتساب')
        }
      }}
      onLogout={() => {
        logout()
        navigate('/parent/login', { replace: true })
      }}
    />
  )
}
