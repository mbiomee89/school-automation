import { apiRequest } from './client'
import type {
  AbsenceReasonItem,
  AbsenceReasonStatus,
  DateRangeFilter,
} from '../sections/counselor-review/types'
import type {
  DailyAbsenceReportDetail,
  HomeworkLogReportDetail,
  LateArrivalsReportDetail,
  ReportSummary,
  WeeklyPlanReportDetail,
} from '../sections/reports/types'

export async function listAbsenceReasons(params?: {
  status?: AbsenceReasonStatus
  q?: string
  from?: string | null
  to?: string | null
}) {
  const search = new URLSearchParams()
  if (params?.status) search.set('status', params.status)
  if (params?.q) search.set('q', params.q)
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  const qs = search.toString() ? `?${search}` : ''
  const data = await apiRequest<{ items: AbsenceReasonItem[] }>(`/absence-reasons${qs}`)
  return data.items
}

export async function reviewAbsenceReason(
  id: number,
  decision: 'APPROVED' | 'REJECTED',
  note?: string
) {
  const data = await apiRequest<{ item: AbsenceReasonItem }>(`/absence-reasons/${id}/review`, {
    method: 'PATCH',
    body: { decision, note: note ?? null },
  })
  return data.item
}

export async function getReportsSummary(date: string) {
  const data = await apiRequest<{ reports: ReportSummary[] }>(
    `/reports/summary?date=${encodeURIComponent(date)}`
  )
  return data.reports
}

export async function getDailyAbsenceReport(date: string): Promise<DailyAbsenceReportDetail> {
  return apiRequest(`/reports/daily-absence?date=${encodeURIComponent(date)}`)
}

export async function getLateArrivalsReport(date: string): Promise<LateArrivalsReportDetail> {
  return apiRequest(`/reports/late-arrivals?date=${encodeURIComponent(date)}`)
}

export async function getHomeworkLogReport(date: string): Promise<HomeworkLogReportDetail> {
  return apiRequest(`/reports/homework-log?date=${encodeURIComponent(date)}`)
}

export async function getWeeklyPlanReport(date: string): Promise<WeeklyPlanReportDetail> {
  return apiRequest(`/reports/weekly-plan?date=${encodeURIComponent(date)}`)
}

export type { DateRangeFilter }
