import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { getDailyAbsenceReport, getReportsSummary } from '../../api/counselor'
import { todayDateStr } from '../../api/teacher'
import { ApiError } from '../../api/client'
import { ReportsHub } from '../../sections/reports/ReportsHub'
import type {
  DailyAbsenceReportDetail,
  ReportSummary,
  ReportType,
} from '../../sections/reports/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

export function ReportsPage() {
  const [date, setDate] = useState(todayDateStr())
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [dailyAbsenceDetail, setDailyAbsenceDetail] = useState<DailyAbsenceReportDetail | null>(
    null
  )
  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (forDate: string) => {
    const [summary, detail] = await Promise.all([
      getReportsSummary(forDate),
      getDailyAbsenceReport(forDate),
    ])
    setReports(summary)
    setDailyAbsenceDetail(detail)
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
      activeReport={activeReport}
      onSelectReport={setActiveReport}
      onCloseReport={() => setActiveReport(null)}
      onPrint={() => window.print()}
      onFilterByDate={async (_type, nextDate) => {
        setDate(nextDate)
      }}
    />
  )
}
