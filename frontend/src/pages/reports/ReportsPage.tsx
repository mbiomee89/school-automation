import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  getAbsenceDaysReport,
  getDailyAbsenceReport,
  getEarlyLeaveReport,
  getHomeworkLogReport,
  getLateArrivalsReport,
  getParentActivationReport,
  getReportsSummary,
  getStudentHistoryReport,
  getWeeklyPlanReport,
  searchStudentsForReport,
} from '../../api/counselor'
import { getAdminFollowUpOptions, getAdminFollowUpReport } from '../../api/weeklyFollowUp'
import { todayDateStr } from '../../api/teacher'
import { ApiError } from '../../api/client'
import { ReportsHub } from '../../sections/reports/ReportsHub'
import type {
  AbsenceDaysReportDetail,
  DailyAbsenceReportDetail,
  EarlyLeaveReportDetail,
  HomeworkLogReportDetail,
  LateArrivalsReportDetail,
  ParentActivationReportDetail,
  ParentActivationStatusFilter,
  ReportSummary,
  ReportType,
  StudentHistoryReportDetail,
  StudentSearchOption,
  WeeklyPlanReportDetail,
  WeeklyFollowUpReportDetail,
  WeeklyFollowUpReportOptions,
} from '../../sections/reports/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

function detailMatchesDate(
  type: ReportType,
  date: string,
  daily: DailyAbsenceReportDetail | null,
  late: LateArrivalsReportDetail | null,
  earlyLeave: EarlyLeaveReportDetail | null,
  homework: HomeworkLogReportDetail | null,
  weekly: WeeklyPlanReportDetail | null
): boolean {
  if (type === 'DAILY_ABSENCE') return daily?.date === date
  if (type === 'LATE_ARRIVALS') return late?.date === date
  if (type === 'EARLY_LEAVE') return earlyLeave?.date === date
  if (type === 'HOMEWORK_LOG') return homework?.date === date
  if (type === 'WEEKLY_PLAN') return weekly?.date === date
  if (type === 'WEEKLY_FOLLOW_UP') return true
  if (type === 'ABSENCE_DAYS') return true
  if (type === 'PARENT_ACTIVATION') return true
  return true
}

export function ReportsPage() {
  const [date, setDate] = useState(todayDateStr())
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [dailyAbsenceDetail, setDailyAbsenceDetail] = useState<DailyAbsenceReportDetail | null>(
    null
  )
  const [lateArrivalsDetail, setLateArrivalsDetail] = useState<LateArrivalsReportDetail | null>(
    null
  )
  const [earlyLeaveDetail, setEarlyLeaveDetail] = useState<EarlyLeaveReportDetail | null>(null)
  const [homeworkLogDetail, setHomeworkLogDetail] = useState<HomeworkLogReportDetail | null>(null)
  const [weeklyPlanDetail, setWeeklyPlanDetail] = useState<WeeklyPlanReportDetail | null>(null)
  const [weeklyFollowUpDetail, setWeeklyFollowUpDetail] = useState<WeeklyFollowUpReportDetail | null>(
    null
  )
  const [weeklyFollowUpOptions, setWeeklyFollowUpOptions] =
    useState<WeeklyFollowUpReportOptions | null>(null)
  const [studentHistoryDetail, setStudentHistoryDetail] =
    useState<StudentHistoryReportDetail | null>(null)
  const [absenceDaysDetail, setAbsenceDaysDetail] = useState<AbsenceDaysReportDetail | null>(null)
  const [parentActivationDetail, setParentActivationDetail] =
    useState<ParentActivationReportDetail | null>(null)
  const [parentActivationStatus, setParentActivationStatus] =
    useState<ParentActivationStatusFilter>('all')
  const [absenceDaysOpts, setAbsenceDaysOpts] = useState<{
    from?: string
    to?: string
    minDays?: number
  }>({ minDays: 0 })
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [studentSearchResults, setStudentSearchResults] = useState<StudentSearchOption[]>([])
  const [studentSearchLoading, setStudentSearchLoading] = useState(false)
  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const searchTimer = useRef<number | null>(null)
  const summaryGen = useRef(0)
  const detailGen = useRef(0)

  const loadSummary = useCallback(async (forDate: string) => {
    const gen = ++summaryGen.current
    const summary = await getReportsSummary(forDate)
    if (gen !== summaryGen.current) return
    setReports((prev) => {
      const hist = prev.find((r) => r.type === 'STUDENT_HISTORY')
      return summary.map((r) => {
        if (r.type === 'STUDENT_HISTORY' && hist?.lastGeneratedAt) {
          return {
            ...r,
            context: hist.context,
            count: hist.count,
            lastGeneratedAt: hist.lastGeneratedAt,
          }
        }
        return r
      })
    })
    // Date change invalidates cached detail payloads.
    setDailyAbsenceDetail(null)
    setLateArrivalsDetail(null)
    setEarlyLeaveDetail(null)
    setHomeworkLogDetail(null)
    setWeeklyPlanDetail(null)
    setWeeklyFollowUpDetail(null)
    setParentActivationDetail(null)
  }, [])

  const loadDetail = useCallback(async (type: ReportType, forDate: string) => {
    if (type === 'STUDENT_HISTORY') return
    if (type === 'PARENT_ACTIVATION') {
      const gen = ++detailGen.current
      setDetailLoading(true)
      setActionError(null)
      try {
        const detail = await getParentActivationReport(parentActivationStatus)
        if (gen !== detailGen.current) return
        setParentActivationDetail(detail)
      } catch (err) {
        if (gen !== detailGen.current) return
        setActionError(err instanceof ApiError ? err.message : 'تعذّر تحميل تقرير التفعيل')
      } finally {
        if (gen === detailGen.current) setDetailLoading(false)
      }
      return
    }
    if (type === 'WEEKLY_FOLLOW_UP') {
      const gen = ++detailGen.current
      setDetailLoading(true)
      setActionError(null)
      try {
        const opts = weeklyFollowUpOptions ?? (await getAdminFollowUpOptions())
        if (gen !== detailGen.current) return
        setWeeklyFollowUpOptions(opts)
      } catch (err) {
        if (gen !== detailGen.current) return
        setActionError(err instanceof ApiError ? err.message : 'تعذّر تحميل خيارات المتابعة')
      } finally {
        if (gen === detailGen.current) setDetailLoading(false)
      }
      return
    }
    const gen = ++detailGen.current
    setDetailLoading(true)
    setActionError(null)
    try {
      if (type === 'DAILY_ABSENCE') {
        const detail = await getDailyAbsenceReport(forDate)
        if (gen !== detailGen.current) return
        setDailyAbsenceDetail(detail)
      } else if (type === 'LATE_ARRIVALS') {
        const detail = await getLateArrivalsReport(forDate)
        if (gen !== detailGen.current) return
        setLateArrivalsDetail(detail)
      } else if (type === 'EARLY_LEAVE') {
        const detail = await getEarlyLeaveReport(forDate)
        if (gen !== detailGen.current) return
        setEarlyLeaveDetail(detail)
      } else if (type === 'HOMEWORK_LOG') {
        const detail = await getHomeworkLogReport(forDate)
        if (gen !== detailGen.current) return
        setHomeworkLogDetail(detail)
      } else if (type === 'WEEKLY_PLAN') {
        const detail = await getWeeklyPlanReport(forDate)
        if (gen !== detailGen.current) return
        setWeeklyPlanDetail(detail)
      } else if (type === 'ABSENCE_DAYS') {
        const detail = await getAbsenceDaysReport(absenceDaysOpts)
        if (gen !== detailGen.current) return
        setAbsenceDaysDetail(detail)
      }
    } catch (err) {
      if (gen === detailGen.current) {
        setActionError(err instanceof ApiError ? err.message : 'تعذّر تحميل التقرير')
      }
    } finally {
      if (gen === detailGen.current) setDetailLoading(false)
    }
  }, [absenceDaysOpts, weeklyFollowUpOptions, parentActivationStatus])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setActionError(null)
      try {
        await loadSummary(date)
        if (!cancelled) setFatalError(null)
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : 'تعذّر تحميل التقارير'
          if (reports.length === 0) setFatalError(message)
          else setActionError(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when date changes
  }, [date, loadSummary])

  useEffect(() => {
    if (!activeReport || activeReport === 'STUDENT_HISTORY') return
    if (activeReport === 'PARENT_ACTIVATION') {
      if (parentActivationDetail) return
      void loadDetail('PARENT_ACTIVATION', date)
      return
    }
    if (activeReport === 'WEEKLY_FOLLOW_UP') {
      if (weeklyFollowUpOptions) return
      void loadDetail('WEEKLY_FOLLOW_UP', date)
      return
    }
    if (
      detailMatchesDate(
        activeReport,
        date,
        dailyAbsenceDetail,
        lateArrivalsDetail,
        earlyLeaveDetail,
        homeworkLogDetail,
        weeklyPlanDetail
      )
    ) {
      return
    }
    void loadDetail(activeReport, date)
  }, [
    activeReport,
    date,
    dailyAbsenceDetail,
    lateArrivalsDetail,
    earlyLeaveDetail,
    homeworkLogDetail,
    weeklyPlanDetail,
    absenceDaysDetail,
    parentActivationDetail,
    loadDetail,
    weeklyFollowUpOptions,
  ])

  useEffect(() => {
    return () => {
      if (searchTimer.current != null) window.clearTimeout(searchTimer.current)
    }
  }, [])

  function handleSearchStudent(query: string) {
    setStudentSearchQuery(query)
    setActionError(null)
    if (searchTimer.current != null) window.clearTimeout(searchTimer.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setStudentSearchResults([])
      setStudentSearchLoading(false)
      return
    }
    setStudentSearchLoading(true)
    searchTimer.current = window.setTimeout(async () => {
      try {
        const results = await searchStudentsForReport(trimmed)
        setStudentSearchResults(results.slice(0, 20))
      } catch (err) {
        setStudentSearchResults([])
        setActionError(err instanceof ApiError ? err.message : 'تعذّر البحث عن الطلاب')
      } finally {
        setStudentSearchLoading(false)
      }
    }, 300)
  }

  async function handleSelectStudent(studentId: string, range?: { from?: string; to?: string }) {
    setStudentSearchLoading(true)
    setActionError(null)
    try {
      const detail = await getStudentHistoryReport(studentId, range)
      setStudentHistoryDetail(detail)
      setStudentSearchResults([])
      setStudentSearchQuery(detail.student.nameAr)
      setReports((prev) =>
        prev.map((r) =>
          r.type === 'STUDENT_HISTORY'
            ? {
                ...r,
                context: detail.student.nameAr,
                count: detail.count,
                lastGeneratedAt: detail.generatedAt ?? new Date().toISOString(),
              }
            : r
        )
      )
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'تعذّر تحميل سجل الطالب')
    } finally {
      setStudentSearchLoading(false)
    }
  }

  const handleFilterWeeklyFollowUp = useCallback(
    async (opts: { classId: number; subjectId: number; weekStart: string }) => {
      const gen = ++detailGen.current
      setDetailLoading(true)
      setActionError(null)
      try {
        const detail = await getAdminFollowUpReport(opts)
        if (gen !== detailGen.current) return
        setWeeklyFollowUpDetail(detail)
      } catch (err) {
        if (gen !== detailGen.current) return
        setWeeklyFollowUpDetail(null)
        setActionError(err instanceof ApiError ? err.message : 'تعذّر تحميل المتابعة الأسبوعية')
      } finally {
        if (gen === detailGen.current) setDetailLoading(false)
      }
    },
    []
  )

  async function handleFilterAbsenceDays(opts: {
    from?: string
    to?: string
    minDays?: number
  }) {
    setAbsenceDaysOpts(opts)
    setDetailLoading(true)
    setActionError(null)
    try {
      const detail = await getAbsenceDaysReport(opts)
      setAbsenceDaysDetail(detail)
      setReports((prev) =>
        prev.map((r) =>
          r.type === 'ABSENCE_DAYS'
            ? {
                ...r,
                count: detail.count,
                context: `أكثر من ${detail.minDays} يوم`,
                lastGeneratedAt: detail.generatedAt,
              }
            : r
        )
      )
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'تعذّر تحميل تقرير أيام الغياب')
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleFilterParentActivation(status: ParentActivationStatusFilter) {
    const gen = ++detailGen.current
    setDetailLoading(true)
    setActionError(null)
    try {
      const detail = await getParentActivationReport(status)
      if (gen !== detailGen.current) return
      setParentActivationStatus(status)
      setParentActivationDetail(detail)
      setReports((prev) =>
        prev.map((r) =>
          r.type === 'PARENT_ACTIVATION'
            ? {
                ...r,
                count: detail.summary.notActivated,
                context: `مفعّل ${detail.summary.activated} من ${detail.summary.activated + detail.summary.notActivated}`,
                lastGeneratedAt: detail.generatedAt,
              }
            : r
        )
      )
    } catch (err) {
      if (gen !== detailGen.current) return
      setActionError(err instanceof ApiError ? err.message : 'تعذّر تحميل تقرير التفعيل')
    } finally {
      if (gen === detailGen.current) setDetailLoading(false)
    }
  }

  if (loading && reports.length === 0 && !fatalError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (fatalError && reports.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        tone="error"
        title="تعذّر تحميل التقارير"
        description={fatalError}
        actionLabel="إعادة المحاولة"
        onAction={() => window.location.reload()}
      />
    )
  }

  return (
    <ReportsHub
      reports={reports}
      dailyAbsenceDetail={dailyAbsenceDetail}
      lateArrivalsDetail={lateArrivalsDetail}
      earlyLeaveDetail={earlyLeaveDetail}
      homeworkLogDetail={homeworkLogDetail}
      weeklyPlanDetail={weeklyPlanDetail}
      studentHistoryDetail={studentHistoryDetail}
      absenceDaysDetail={absenceDaysDetail}
      parentActivationDetail={parentActivationDetail}
      studentSearchQuery={studentSearchQuery}
      studentSearchResults={studentSearchResults}
      studentSearchLoading={studentSearchLoading}
      reportsLoading={loading || detailLoading}
      selectedDate={date}
      actionError={actionError}
      onDismissActionError={() => setActionError(null)}
      activeReport={activeReport}
      onSelectReport={(type) => {
        if (type === 'PARENT_ACTIVATION') {
          // Force a fresh snapshot each open (avoid stale outreach lists).
          setParentActivationDetail(null)
        }
        setActiveReport(type)
      }}
      onCloseReport={() => {
        setActiveReport(null)
        setParentActivationDetail(null)
      }}
      onFilterByDate={(_type, nextDate) => {
        if (!nextDate) return
        setDate(nextDate)
      }}
      onSearchStudent={handleSearchStudent}
      onSelectStudent={handleSelectStudent}
      onFilterAbsenceDays={handleFilterAbsenceDays}
      onFilterParentActivation={handleFilterParentActivation}
      weeklyFollowUpDetail={weeklyFollowUpDetail}
      weeklyFollowUpOptions={weeklyFollowUpOptions}
      onFilterWeeklyFollowUp={handleFilterWeeklyFollowUp}
    />
  )
}
