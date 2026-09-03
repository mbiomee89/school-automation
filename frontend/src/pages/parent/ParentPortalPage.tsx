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
  getParentTimetable,
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
  ClassTimetable,
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
  const [classTimetable, setClassTimetable] = useState<ClassTimetable | null>(null)
  const [classTimetableError, setClassTimetableError] = useState<string | null>(null)
  const [classTimetableLoading, setClassTimetableLoading] = useState(false)

  useEffect(() => {
    if (students.length === 0) return
    if (!activeChildId || !students.some((s) => s.id === activeChildId)) {
      setActiveChildId(students[0].id)
    }
  }, [students, activeChildId])

  const loadGen = useRef(0)
  const lastPlanAnchorLoaded = useRef<string | null>(null)

  const loadChild = useCallback(async (studentId: string, browseDate: string, planAnchor: string) => {
    const gen = ++loadGen.current
    setError(null)
    setClassTimetableLoading(true)
    setClassTimetableError(null)

    try {
      const [summary, attendance, homeworkRes, plansRes, excuses, earlyLeave, timetableResult] =
        await Promise.all([
          getParentSummary(studentId),
          getParentAttendance(studentId),
          getParentHomework(studentId, { date: browseDate }),
          getParentWeeklyPlans(studentId, { date: planAnchor }),
          getParentExcuses(studentId),
          getParentEarlyLeave(studentId),
          getParentTimetable(studentId).then(
            (data) => ({ ok: true as const, data }),
            (err) => ({ ok: false as const, err })
          ),
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

      if (timetableResult.ok) {
        const t = timetableResult.data
        setClassTimetable({
          weekStart: t.weekStart,
          weekEnd: t.weekEnd,
          academicYear: t.academicYear,
          today: t.today,
          classId: t.classId,
          className: t.className,
          studentId: t.studentId,
          studentNameAr: t.studentNameAr,
          schoolName: t.schoolName,
          educationAdminName: t.educationAdminName,
          logoUrl: t.logoUrl,
          principalName: t.principalName,
          days: t.days,
        })
        setClassTimetableError(null)
        if (t.schoolName) {
          setReportBrand((prev) => ({
            ...prev,
            schoolName: t.schoolName || prev.schoolName,
            academicYear: t.academicYear || prev.academicYear,
            educationAdminName: t.educationAdminName ?? prev.educationAdminName,
            logoUrl: t.logoUrl ?? prev.logoUrl,
            principalName: t.principalName ?? prev.principalName,
          }))
        }
        if (t.className) setReportClassName(t.className)
      } else {
        setClassTimetable(null)
        setClassTimetableError(
          timetableResult.err instanceof ApiError
            ? timetableResult.err.message
            : 'تعذّر تحميل الجدول الأسبوعي'
        )
      }

      setLoadedChildId(studentId)
      lastPlanAnchorLoaded.current = planAnchor
    } finally {
      if (gen === loadGen.current) setClassTimetableLoading(false)
    }
  }, [])

  const loadWeeklyPlanOnly = useCallback(async (studentId: string, planAnchor: string) => {
    const plansRes = await getParentWeeklyPlans(studentId, { date: planAnchor })
    setWeeklyPlans(plansRes.weeklyPlans ?? [])
    setWeeklyPlanRows(plansRes.rows ?? [])
    setWeeklyPlanWeekStart(plansRes.weekStart ?? null)
    setWeeklyPlanWeekEnd(plansRes.weekEnd ?? null)
    if (plansRes.schoolName) {
      setReportBrand((prev) => ({
        schoolName: plansRes.schoolName || prev.schoolName,
        academicYear: plansRes.academicYear || prev.academicYear,
        educationAdminName: plansRes.educationAdminName ?? prev.educationAdminName,
        logoUrl: plansRes.logoUrl ?? prev.logoUrl,
        principalName: plansRes.principalName ?? prev.principalName,
      }))
    }
    if (plansRes.className) setReportClassName(plansRes.className)
  }, [])

  // Full reload when child or homework browse date changes (includes weekly plan for current anchor).
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
    // weeklyPlanAnchorDate read for initial/child/homework loads; week-only nav uses the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChildId, homeworkBrowseDate, loadChild, logout, navigate])

  // Week-only fetch when parent flips weekly plan week (avoids full portal refetch).
  useEffect(() => {
    if (!activeChildId || loadedChildId !== activeChildId) return
    if (lastPlanAnchorLoaded.current === weeklyPlanAnchorDate) return
    lastPlanAnchorLoaded.current = weeklyPlanAnchorDate
    let cancelled = false
    ;(async () => {
      try {
        await loadWeeklyPlanOnly(activeChildId, weeklyPlanAnchorDate)
      } catch (err) {
        if (!cancelled && err instanceof ApiError && err.status === 401) {
          logout()
          navigate('/parent/login', { replace: true })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [weeklyPlanAnchorDate, activeChildId, loadedChildId, loadWeeklyPlanOnly, logout, navigate])

  function selectChild(childId: string) {
    if (childId === activeChildId) return
    setLoading(true)
    setLoadedChildId('')
    lastPlanAnchorLoaded.current = null
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
      classTimetable={classTimetable}
      classTimetableError={classTimetableError}
      classTimetableLoading={classTimetableLoading}
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
