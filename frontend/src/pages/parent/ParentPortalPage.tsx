import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import {
  cancelParentEarlyLeave,
  createParentEarlyLeave,
  getParentAttendance,
  getParentEarlyLeave,
  getParentExcuses,
  getParentHomework,
  getParentSummary,
  getParentWeeklyPlans,
  submitExcuse,
  type ParentChild,
} from '../../api/parent'
import { ApiError } from '../../api/client'
import { useParentAuth } from '../../lib/parentAuth'
import { ParentPortal } from '../../sections/parent-portal/ParentPortal'
import { PARENT_PORTAL_THEME, schoolTodayIso } from '../../sections/parent-portal/theme'
import type {
  AttendanceDay,
  EarlyLeaveRequest,
  ExcuseSubmission,
  HomeworkItem,
  ReportBrand,
  TodaySummary,
  WeeklyPlanFormalRow,
  WeeklyPlanItem,
} from '../../sections/parent-portal/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic } from '../../shared/fonts'

function toChild(s: ParentChild) {
  return {
    id: s.id,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    className: s.className,
    gradeLevel: s.gradeLevel,
  }
}

function emptySummary(date: string): TodaySummary {
  return {
    date,
    attendanceStatus: null,
    homeworkDueCount: 0,
    newAlertsCount: 0,
  }
}

export function ParentPortalPage() {
  const { students, isAuthenticated, bootstrapping, logout } = useParentAuth()
  const navigate = useNavigate()

  const [activeChildId, setActiveChildId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadedChildId, setLoadedChildId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [todaySummary, setTodaySummary] = useState<TodaySummary>(() => emptySummary(schoolTodayIso()))
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceDay[]>([])
  const [homeworkItems, setHomeworkItems] = useState<HomeworkItem[]>([])
  const [homeHomeworkItems, setHomeHomeworkItems] = useState<HomeworkItem[]>([])
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanItem[]>([])
  const [weeklyPlanRows, setWeeklyPlanRows] = useState<WeeklyPlanFormalRow[]>([])
  const [weeklyPlanWeekStart, setWeeklyPlanWeekStart] = useState<string | null>(null)
  const [weeklyPlanWeekEnd, setWeeklyPlanWeekEnd] = useState<string | null>(null)
  const [weeklyPlanAnchorDate, setWeeklyPlanAnchorDate] = useState(() => schoolTodayIso())
  const [reportBrand, setReportBrand] = useState<ReportBrand>({
    schoolName: 'المدرسة',
    academicYear: '',
  })
  const [reportClassName, setReportClassName] = useState('بدون فصل')
  const [excuseSubmissions, setExcuseSubmissions] = useState<ExcuseSubmission[]>([])
  const [earlyLeaveRequests, setEarlyLeaveRequests] = useState<EarlyLeaveRequest[]>([])
  const [homeworkBrowseDate, setHomeworkBrowseDate] = useState(() => schoolTodayIso())

  useEffect(() => {
    if (students.length === 0) return
    if (!activeChildId || !students.some((s) => s.id === activeChildId)) {
      setActiveChildId(students[0].id)
    }
  }, [students, activeChildId])

  const loadGen = useRef(0)

  const loadChild = useCallback(async (studentId: string, browseDate: string, planAnchor: string) => {
    const gen = ++loadGen.current
    setError(null)
    const [summary, attendance, homeworkRes, plansRes, excuses, earlyLeave] = await Promise.all([
      getParentSummary(studentId),
      getParentAttendance(studentId),
      getParentHomework(studentId, { date: browseDate }),
      getParentWeeklyPlans(studentId, { date: planAnchor }),
      getParentExcuses(studentId),
      getParentEarlyLeave(studentId),
    ])
    if (gen !== loadGen.current) return

    let todayHomework = homeworkRes.homework
    if (browseDate !== summary.date) {
      const todayRes = await getParentHomework(studentId, { date: summary.date })
      if (gen !== loadGen.current) return
      todayHomework = todayRes.homework
    }

    setTodaySummary({
      date: summary.date,
      attendanceStatus: summary.attendanceStatus,
      homeworkDueCount: summary.homeworkDueCount,
      newAlertsCount: summary.newAlertsCount,
    })
    setAttendanceHistory(attendance)
    setHomeworkItems(homeworkRes.homework)
    setHomeHomeworkItems(todayHomework)
    setWeeklyPlans(plansRes.weeklyPlans ?? [])
    setWeeklyPlanRows(plansRes.rows ?? [])
    setWeeklyPlanWeekStart(plansRes.weekStart ?? null)
    setWeeklyPlanWeekEnd(plansRes.weekEnd ?? null)
    setReportBrand({
      schoolName: homeworkRes.schoolName || plansRes.schoolName || 'المدرسة',
      academicYear: homeworkRes.academicYear || plansRes.academicYear || '',
      educationAdminName: homeworkRes.educationAdminName ?? plansRes.educationAdminName ?? null,
      logoUrl: homeworkRes.logoUrl ?? plansRes.logoUrl ?? null,
      principalName: homeworkRes.principalName ?? plansRes.principalName ?? null,
    })
    setReportClassName(homeworkRes.className || plansRes.className || 'بدون فصل')
    setExcuseSubmissions(excuses)
    setEarlyLeaveRequests(earlyLeave)
    setLoadedChildId(studentId)
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
        await loadChild(activeChildId, homeworkBrowseDate, weeklyPlanAnchorDate)
      } catch (err) {
        if (!cancelled && loadGen.current) {
          if (err instanceof ApiError && err.status === 401) {
            logout()
            navigate('/parent/login', { replace: true })
            return
          }
          setError(
            err instanceof ApiError
              ? err.message
              : 'تعذّر تحميل بيانات الابن'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeChildId, homeworkBrowseDate, weeklyPlanAnchorDate, loadChild, logout, navigate])

  function selectChild(childId: string) {
    if (childId === activeChildId) return
    setLoading(true)
    setLoadedChildId('')
    setAttendanceHistory([])
    setHomeworkItems([])
    setHomeHomeworkItems([])
    setWeeklyPlans([])
    setWeeklyPlanRows([])
    setExcuseSubmissions([])
    setEarlyLeaveRequests([])
    setTodaySummary(emptySummary(schoolTodayIso()))
    setHomeworkBrowseDate(schoolTodayIso())
    setWeeklyPlanAnchorDate(schoolTodayIso())
    setActiveChildId(childId)
  }

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
        actionLabel={error.includes('انتهت الجلسة') ? 'تسجيل الدخول' : 'إعادة المحاولة'}
        onAction={() => {
          if (error.includes('انتهت الجلسة')) {
            logout()
            navigate('/parent/login', { replace: true })
            return
          }
          if (activeChildId) {
            setLoading(true)
            setError(null)
            loadChild(activeChildId, homeworkBrowseDate, weeklyPlanAnchorDate)
              .catch((err) => {
                if (err instanceof ApiError && err.status === 401) {
                  logout()
                  navigate('/parent/login', { replace: true })
                  return
                }
                setError(err instanceof ApiError ? err.message : 'فشل')
              })
              .finally(() => setLoading(false))
          }
        }}
      />
    )
  }

  const waitingForChild = loading && loadedChildId !== activeChildId
  if (waitingForChild) {
    return (
      <div
        dir="rtl"
        lang="ar"
        className="flex min-h-screen items-center justify-center bg-[color:var(--pp-sky)]"
        style={{ ...fontArabic, ...PARENT_PORTAL_THEME }}
      >
        <span
          className={`${SPINNER_CLASS} size-8 rounded-full border-2 border-[color:var(--pp-primary)] border-t-transparent`}
          aria-label="جارٍ التحميل"
        />
      </div>
    )
  }

  return (
    <ParentPortal
      children={students.map(toChild)}
      activeChildId={activeChildId || students[0].id}
      todaySummary={todaySummary}
      attendanceHistory={attendanceHistory}
      homeworkItems={homeworkItems}
      homeHomeworkItems={homeHomeworkItems}
      weeklyPlans={weeklyPlans}
      weeklyPlanRows={weeklyPlanRows}
      weeklyPlanWeekStart={weeklyPlanWeekStart}
      weeklyPlanWeekEnd={weeklyPlanWeekEnd}
      reportBrand={reportBrand}
      reportClassName={reportClassName}
      excuseSubmissions={excuseSubmissions}
      earlyLeaveRequests={earlyLeaveRequests}
      homeworkBrowseDate={homeworkBrowseDate}
      onHomeworkBrowseDateChange={setHomeworkBrowseDate}
      weeklyPlanAnchorDate={weeklyPlanAnchorDate}
      onWeeklyPlanAnchorDateChange={setWeeklyPlanAnchorDate}
      onSelectChild={selectChild}
      onSubmitExcuse={async (input) => {
        const day = attendanceHistory.find(
          (d) => d.date === input.attendanceDate && d.status === 'ABSENT'
        )
        if (!day) {
          throw new Error('لم يُعثر على سجل غياب لهذا اليوم')
        }
        await submitExcuse(day.id, input.reasonText, input.file)
        try {
          await loadChild(activeChildId, homeworkBrowseDate, weeklyPlanAnchorDate)
        } catch {
          // Upload already succeeded — keep success toast even if refresh fails.
        }
      }}
      onSubmitEarlyLeave={async (input) => {
        await createParentEarlyLeave(activeChildId, input)
        try {
          const list = await getParentEarlyLeave(activeChildId)
          setEarlyLeaveRequests(list)
        } catch {
          // Create succeeded — keep success toast even if refresh fails.
        }
      }}
      onCancelEarlyLeave={async (requestId) => {
        await cancelParentEarlyLeave(requestId)
        try {
          const list = await getParentEarlyLeave(activeChildId)
          setEarlyLeaveRequests(list)
        } catch {
          setEarlyLeaveRequests((prev) =>
            prev.map((r) =>
              r.id === requestId
                ? { ...r, status: 'CANCELLED', cancelledAt: new Date().toISOString() }
                : r
            )
          )
        }
      }}
      onLogout={() => {
        logout()
        navigate('/parent/login', { replace: true })
      }}
    />
  )
}
