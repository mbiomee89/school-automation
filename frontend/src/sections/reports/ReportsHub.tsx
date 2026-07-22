import { useState } from 'react'
import {
  Printer,
  CalendarOff,
  Clock,
  BookOpen,
  CalendarRange,
  History,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react'
import type {
  DailyAbsenceReportDetail,
  ReportsProps,
  ReportSummary,
  ReportType,
} from './types'
import { cn } from '../../shared/utils'

const ICON_MAP: Record<ReportSummary['iconHint'], LucideIcon> = {
  CALENDAR_OFF: CalendarOff,
  CLOCK: Clock,
  BOOK_OPEN: BookOpen,
  CALENDAR_RANGE: CalendarRange,
  HISTORY: History,
}

const STATUS_AR: Record<'ABSENT' | 'EXCUSED', string> = {
  ABSENT: 'غائب',
  EXCUSED: 'غياب بعذر',
}

const fontSerif = { fontFamily: '"Amiri", "Times New Roman", serif' } as const
const fontMono = { fontFamily: '"IBM Plex Mono", ui-monospace, monospace' } as const

function formatGeneratedAt(iso: string | null) {
  if (!iso) return 'لم يُولَّد بعد'
  return `آخر توليد: ${new Date(iso).toLocaleString('ar-SA')}`
}

export function ReportsHub({
  reports,
  dailyAbsenceDetail,
  activeReport: controlledActiveReport,
  onSelectReport,
  onCloseReport,
  onPrint,
  onFilterByDate,
}: ReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportType | null>(
    controlledActiveReport ?? null
  )
  const [dateFilter, setDateFilter] = useState(dailyAbsenceDetail?.date ?? '')

  const currentActive = controlledActiveReport ?? activeReport
  const activeSummary = reports.find((r) => r.type === currentActive) ?? null

  function openReport(type: ReportType) {
    setActiveReport(type)
    onSelectReport?.(type)
  }

  function closeReport() {
    setActiveReport(null)
    onCloseReport?.()
  }

  function printReport(type: ReportType) {
    setActiveReport(type)
    onSelectReport?.(type)
    onPrint?.(type)
    window.setTimeout(() => window.print(), 50)
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-full bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-50"
      style={fontSerif}
    >
      <div className="relative overflow-hidden border-b border-stone-200 bg-gradient-to-bl from-stone-100 via-white to-lime-50 px-4 py-6 sm:px-6 dark:border-stone-800 dark:from-stone-900 dark:via-stone-950 dark:to-lime-950/40">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">منصة إدارة المدرسة</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
              التقارير
            </h1>
            <p className="mt-1 text-stone-600 dark:text-stone-400">
              {activeSummary
                ? activeSummary.title
                : 'مركز تقارير مشترك للإداري والمرشد الطلابي — عرض وطباعة فقط'}
            </p>
          </div>
          {currentActive && (
            <button
              type="button"
              onClick={() => printReport(currentActive)}
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800 print:hidden"
            >
              <Printer className="size-4" strokeWidth={1.5} />
              طباعة
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {!currentActive && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => {
              const Icon = ICON_MAP[report.iconHint]
              return (
                <div
                  key={report.type}
                  className="flex flex-col rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-lime-500/15 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300">
                      <Icon className="size-5" strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-bold">{report.title}</h2>
                      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                        {report.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <span>{report.context}</span>
                    <span className="tabular-nums" style={fontMono}>
                      {report.count != null ? `${report.count} سطراً` : 'يُحدَّد عند الفتح'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                    {formatGeneratedAt(report.lastGeneratedAt)}
                  </p>
                  <div className="mt-4 flex gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={() => openReport(report.type)}
                      className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
                    >
                      عرض التقرير
                    </button>
                    <button
                      type="button"
                      onClick={() => printReport(report.type)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-lime-500 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-lime-400 active:bg-lime-600"
                    >
                      <Printer className="size-4" strokeWidth={1.5} />
                      طباعة
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {currentActive && activeSummary && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
              <button
                type="button"
                onClick={closeReport}
                className="inline-flex items-center gap-2 text-sm text-stone-600 underline hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50"
              >
                <LayoutGrid className="size-4" strokeWidth={1.5} />
                كل التقارير
              </button>
              {currentActive === 'DAILY_ABSENCE' && dailyAbsenceDetail && (
                <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                  <span>التاريخ</span>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value)
                      onFilterByDate?.('DAILY_ABSENCE', e.target.value)
                    }}
                    className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-950"
                    style={fontMono}
                  />
                </label>
              )}
            </div>

            {currentActive === 'DAILY_ABSENCE' && dailyAbsenceDetail ? (
              <DailyAbsenceDetailView detail={dailyAbsenceDetail} />
            ) : (
              <ReportSummarySheet report={activeSummary} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DailyAbsenceDetailView({ detail }: { detail: DailyAbsenceReportDetail }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 sm:p-6 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 pb-4 dark:border-stone-800">
        <div>
          <h2 className="text-lg font-bold">{detail.schoolName}</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            تقرير الغياب اليومي · العام الدراسي {detail.academicYear}
          </p>
        </div>
        <p className="text-sm text-stone-500" style={fontMono}>
          {detail.date}
        </p>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800 md:block">
        <table className="w-full text-start text-sm">
          <thead className="bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            <tr>
              <th className="px-3 py-2 font-medium">الطالب</th>
              <th className="px-3 py-2 font-medium">الفصل</th>
              <th className="px-3 py-2 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {detail.rows.map((row) => (
              <tr
                key={row.studentId}
                className="border-t border-stone-100 dark:border-stone-800"
              >
                <td className="px-3 py-2 font-semibold">{row.studentName}</td>
                <td className="px-3 py-2">{row.className}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      row.status === 'ABSENT'
                        ? 'bg-red-500/15 text-red-800 dark:text-red-300'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    )}
                  >
                    {STATUS_AR[row.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail.rows.length === 0 && (
          <p className="p-6 text-center text-sm text-stone-500">لا يوجد غياب مسجل لهذا اليوم.</p>
        )}
      </div>

      <div className="space-y-2 md:hidden">
        {detail.rows.map((row) => (
          <div
            key={row.studentId}
            className="rounded-lg border border-stone-200 p-3 text-sm dark:border-stone-800"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{row.studentName}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  row.status === 'ABSENT'
                    ? 'bg-red-500/15 text-red-800 dark:text-red-300'
                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                )}
              >
                {STATUS_AR[row.status]}
              </span>
            </div>
            <div className="mt-1 text-stone-500">{row.className}</div>
          </div>
        ))}
        {detail.rows.length === 0 && (
          <p className="p-6 text-center text-sm text-stone-500">لا يوجد غياب مسجل لهذا اليوم.</p>
        )}
      </div>
    </div>
  )
}

function ReportSummarySheet({ report }: { report: ReportSummary }) {
  const Icon = ICON_MAP[report.iconHint]
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start gap-3 border-b border-stone-100 pb-4 dark:border-stone-800">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-lime-500/15 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300">
          <Icon className="size-6" strokeWidth={1.5} />
        </span>
        <div>
          <h2 className="text-xl font-bold">{report.title}</h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{report.description}</p>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-stone-100 p-3 dark:bg-stone-800">
          <dt className="text-xs text-stone-500 dark:text-stone-400">النطاق</dt>
          <dd className="mt-1 font-medium">{report.context}</dd>
        </div>
        <div className="rounded-md bg-stone-100 p-3 dark:bg-stone-800">
          <dt className="text-xs text-stone-500 dark:text-stone-400">عدد السطور</dt>
          <dd className="mt-1 font-medium tabular-nums" style={fontMono}>
            {report.count != null ? report.count : 'يُحدَّد عند الفتح'}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
        {formatGeneratedAt(report.lastGeneratedAt)}
      </p>
      <p className="mt-4 rounded-md border border-dashed border-stone-300 bg-stone-50 p-3 text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-950/40 dark:text-stone-400">
        التفاصيل الكاملة لهذا التقرير تُعرض من هذه الصفحة عند ربطها بمصدر البيانات الفعلي.
      </p>
    </div>
  )
}

export default ReportsHub
