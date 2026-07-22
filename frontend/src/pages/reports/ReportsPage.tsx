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
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<number | null>(null)

  const load = useCallback(async (forDate: string) => {
    const [summary, absence, late, homework, weekly] = await Promise.all([
      getReportsSummary(forDate),
      getDailyAbsenceReport(forDate),
      getLateArrivalsReport(forDate),
      getHomeworkLogReport(forDate),
      getWeeklyPlanReport(forDate),
    ])
    setReports(summary)
    setDailyAbsenceDetail(absence)
    setLateArrivalsDetail(late)
    setHomeworkLogDetail(homework)
    setWeeklyPlanDetail(weekly)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await load(date)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل التقارير')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [date, load])

  useEffect(() => {
    return () => {
      if (searchTimer.current != null) window.clearTimeout(searchTimer.current)
    }
  }, [])

  function handleSearchStudent(query: string) {
    setStudentSearchQuery(query)
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
      } catch {
        setStudentSearchResults([])
      } finally {
        setStudentSearchLoading(false)
      }
    }, 300)
  }

  async function handleSelectStudent(studentId: string) {
    setStudentSearchLoading(true)
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
      setError(err instanceof ApiError ? err.message : 'تعذّر تحميل سجل الطالب')
    } finally {
      setStudentSearchLoading(false)
    }
  }

  if (loading && reports.length === 0 && !error) {
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
        title="تعذّر تحميل التقارير"
        description={error}
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
      activeReport={activeReport}
      onSelectReport={setActiveReport}
      onCloseReport={() => setActiveReport(null)}
      onPrint={() => window.print()}
      onFilterByDate={async (_type, nextDate) => {
        setDate(nextDate)
      }}
      onSearchStudent={handleSearchStudent}
      onSelectStudent={handleSelectStudent}
    />
  )
}
