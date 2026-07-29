import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  getDailyAbsenceReport,
  getHomeworkLogReport,
  getLateArrivalsReport,
  getReportsSummary,
  getStudentHistoryReport,
  getWeeklyPlanReport,
  searchStudentsForReport,
} from '../../api/counselor'
import { todayDateStr } from '../../api/teacher'
import { ApiError } from '../../api/client'
import { ReportsHub } from '../../sections/reports/ReportsHub'
import type {
  DailyAbsenceReportDetail,
  HomeworkLogReportDetail,
  LateArrivalsReportDetail,
  ReportSummary,
  ReportType,
  StudentHistoryReportDetail,
  StudentSearchOption,
  WeeklyPlanReportDetail,
} from '../../sections/reports/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

export function ReportsPage() {
  const [date, setDate] = useState(todayDateStr())
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [dailyAbsenceDetail, setDailyAbsenceDetail] = useState<DailyAbsenceReportDetail | null>(
    null
  )
  const [lateArrivalsDetail, setLateArrivalsDetail] = useState<LateArrivalsReportDetail | null>(
    null
  )
  const [homeworkLogDetail, setHomeworkLogDetail] = useState<HomeworkLogReportDetail | null>(null)
  const [weeklyPlanDetail, setWeeklyPlanDetail] = useState<WeeklyPlanReportDetail | null>(null)
  const [studentHistoryDetail, setStudentHistoryDetail] =
    useState<StudentHistoryReportDetail | null>(null)
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [studentSearchResults, setStudentSearchResults] = useState<StudentSearchOption[]>([])
  const [studentSearchLoading, setStudentSearchLoading] = useState(false)
  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const [loading, setLoading] = useState(true)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const searchTimer = useRef<number | null>(null)
  const loadGen = useRef(0)

  const load = useCallback(async (forDate: string) => {
    const gen = ++loadGen.current
    const [summary, absence, late, homework, weekly] = await Promise.all([
      getReportsSummary(forDate),
      getDailyAbsenceReport(forDate),
      getLateArrivalsReport(forDate),
      getHomeworkLogReport(forDate),
      getWeeklyPlanReport(forDate),
    ])
    if (gen !== loadGen.current) return
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
    setDailyAbsenceDetail(absence)
    setLateArrivalsDetail(late)
    setHomeworkLogDetail(homework)
    setWeeklyPlanDetail(weekly)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setActionError(null)
      try {
        await load(date)
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
  }, [date, load])

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

  async function handleSelectStudent(studentId: string) {
    setStudentSearchLoading(true)
    setActionError(null)
    try {
      const detail = await getStudentHistoryReport(studentId)
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
      homeworkLogDetail={homeworkLogDetail}
      weeklyPlanDetail={weeklyPlanDetail}
      studentHistoryDetail={studentHistoryDetail}
      studentSearchQuery={studentSearchQuery}
      studentSearchResults={studentSearchResults}
      studentSearchLoading={studentSearchLoading}
      reportsLoading={loading}
      actionError={actionError}
      onDismissActionError={() => setActionError(null)}
      activeReport={activeReport}
      onSelectReport={setActiveReport}
      onCloseReport={() => setActiveReport(null)}
      onFilterByDate={(_type, nextDate) => {
        if (!nextDate) return
        setDate(nextDate)
      }}
      onSearchStudent={handleSearchStudent}
      onSelectStudent={handleSelectStudent}
    />
  )
}
