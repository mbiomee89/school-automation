import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Printer,
  CalendarOff,
  Clock,
  BookOpen,
  CalendarRange,
  History,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import type {
  DailyAbsenceReportDetail,
  HomeworkLogReportDetail,
  LateArrivalsReportDetail,
  ReportsProps,
  ReportSummary,
  ReportType,
  StudentHistoryReportDetail,
  WeeklyPlanReportDetail,
} from './types'
import { cn } from '../../shared/utils'
import { fontArabic, fontMono } from '../../shared/fonts'
import { PhoneText } from '../../shared/PhoneText'
import {
  addDaysToDateOnly,
  formatReportDate,
  formatReportDateRange,
  todayDateOnly,
} from '../../shared/dates'
import { ReportCalendarPicker } from './ReportCalendarPicker'

const ICON_MAP: Record<ReportSummary['iconHint'], LucideIcon> = {
  CALENDAR_OFF: CalendarOff,
  CLOCK: Clock,
  BOOK_OPEN: BookOpen,
  CALENDAR_RANGE: CalendarRange,
  HISTORY: History,
}

const STATUS_AR: Record<'PRESENT' | 'ABSENT' | 'EXCUSED', string> = {
  PRESENT: 'حاضر',
  ABSENT: 'غائب',
  EXCUSED: 'غياب بعذر',
}

const DATE_FILTER_TYPES: ReportType[] = [
  'DAILY_ABSENCE',
  'LATE_ARRIVALS',
  'HOMEWORK_LOG',
  'WEEKLY_PLAN',
]

/** Homework + weekly plan are generated as one sheet per class. */
const CLASS_FILTER_TYPES: ReportType[] = ['HOMEWORK_LOG', 'WEEKLY_PLAN']

function formatGeneratedAt(iso: string | null | undefined) {
  if (!iso) return 'لم يُولَّد بعد'
  return `آخر توليد: ${formatReportDate(iso)}`
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function ReportsHub({
  reports,
  dailyAbsenceDetail,
  lateArrivalsDetail,
  homeworkLogDetail,
  weeklyPlanDetail,
  studentHistoryDetail,
  studentSearchResults = [],
  studentSearchQuery = '',
  studentSearchLoading = false,
  reportsLoading = false,
  selectedDate,
  actionError = null,
  onDismissActionError,
  activeReport: controlledActiveReport,
  onSelectReport,
  onCloseReport,
  onFilterByDate,
  onSearchStudent,
  onSelectStudent,
}: ReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportType | null>(
    controlledActiveReport ?? null
  )
  const [dateFilter, setDateFilter] = useState(
    selectedDate || dailyAbsenceDetail?.date || weeklyPlanDetail?.date || ''
  )
  /** `ALL` or stringified classId — scopes homework / weekly sheets to one class. */
  const [classFilter, setClassFilter] = useState<string>('ALL')
  /** When set, open that report then trigger browser print once the detail is on screen. */
  const [pendingPrint, setPendingPrint] = useState<ReportType | null>(null)
  const [printHint, setPrintHint] = useState<string | null>(null)
  /** Guards against React effect re-runs opening the print dialog twice. */
  const printStartedFor = useRef<ReportType | null>(null)

  const currentActive = controlledActiveReport ?? activeReport
  const activeSummary = reports.find((r) => r.type === currentActive) ?? null

  const classOptions = useMemo(() => {
    if (currentActive === 'HOMEWORK_LOG' && homeworkLogDetail) {
      const groups =
        homeworkLogDetail.classes && homeworkLogDetail.classes.length > 0
          ? homeworkLogDetail.classes
          : groupFlatByClass(homeworkLogDetail.rows)
      return groups.map((c) => ({
        id: String(c.classId ?? c.className),
        name: c.className,
      }))
    }
    if (currentActive === 'WEEKLY_PLAN' && weeklyPlanDetail) {
      const groups =
        weeklyPlanDetail.classes && weeklyPlanDetail.classes.length > 0
          ? weeklyPlanDetail.classes
          : groupFlatByClass(weeklyPlanDetail.rows)
      return groups.map((c) => ({
        id: String(c.classId ?? c.className),
        name: c.className,
      }))
    }
    return [] as Array<{ id: string; name: string }>
  }, [currentActive, homeworkLogDetail, weeklyPlanDetail])

  useEffect(() => {
    const next =
      selectedDate ||
      dailyAbsenceDetail?.date ||
      lateArrivalsDetail?.date ||
      homeworkLogDetail?.date ||
      weeklyPlanDetail?.date ||
      ''
    if (next) setDateFilter(next)
  }, [
    selectedDate,
    dailyAbsenceDetail?.date,
    lateArrivalsDetail?.date,
    homeworkLogDetail?.date,
    weeklyPlanDetail?.date,
  ])

  useEffect(() => {
    setClassFilter('ALL')
  }, [currentActive, homeworkLogDetail?.date, weeklyPlanDetail?.weekStart])

  useEffect(() => {
    if (classFilter === 'ALL') return
    if (classOptions.length === 0) return
    if (!classOptions.some((c) => c.id === classFilter)) setClassFilter('ALL')
  }, [classFilter, classOptions])

  useEffect(() => {
    if (!pendingPrint) return
    if (currentActive !== pendingPrint) return
    if (reportsLoading) return
    if (pendingPrint === 'STUDENT_HISTORY' && !studentHistoryDetail) {
      setPendingPrint(null)
      setPrintHint('اختر طالبًا أولًا ثم اضغط طباعة.')
      return
    }
    if (printStartedFor.current === pendingPrint) return

    const timer = window.setTimeout(() => {
      printStartedFor.current = pendingPrint
      window.print()
      setPendingPrint(null)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [pendingPrint, currentActive, studentHistoryDetail, reportsLoading])

  function openReport(type: ReportType) {
    setPrintHint(null)
    setActiveReport(type)
    onSelectReport?.(type)
  }

  function closeReport() {
    setPendingPrint(null)
    setPrintHint(null)
    printStartedFor.current = null
    setActiveReport(null)
    onCloseReport?.()
  }

  function printReport(type: ReportType) {
    setPrintHint(null)
    if (type === 'STUDENT_HISTORY' && !studentHistoryDetail) {
      openReport(type)
      setPrintHint('اختر طالبًا من البحث أدناه ثم اضغط طباعة.')
      return
    }
    printStartedFor.current = null
    setPendingPrint(type)
    setActiveReport(type)
    onSelectReport?.(type)
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
      style={fontArabic}
    >
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-blue-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/40 print:hidden">
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
            <p className="text-xs text-slate-500 dark:text-slate-400">منصة إدارة المدرسة</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
              التقارير
            </h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              {activeSummary
                ? activeSummary.title
                : 'مركز تقارير مشترك للإداري والمرشد الطلابي — عرض وطباعة فقط'}
            </p>
          </div>
          {currentActive && (
            <button
              type="button"
              onClick={() => printReport(currentActive)}
              disabled={!!pendingPrint || reportsLoading}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 print:hidden"
            >
              <Printer className="size-4" strokeWidth={1.5} />
              طباعة
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {(actionError || printHint) && (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            <span>{actionError || printHint}</span>
            <button
              type="button"
              className="text-xs underline"
              onClick={() => {
                onDismissActionError?.()
                setPrintHint(null)
              }}
            >
              إغلاق
            </button>
          </div>
        )}

        {reportsLoading && (
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-500 print:hidden">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            جارٍ تحديث التقرير…
          </div>
        )}

        {!currentActive && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
            {reports.map((report) => {
              const Icon = ICON_MAP[report.iconHint]
              return (
                <div
                  key={report.type}
                  className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300">
                      <Icon className="size-5" strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-bold">{report.title}</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {report.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{formatReportDate(report.context)}</span>
                    <span className="tabular-nums" style={fontMono}>
                      {report.count != null ? `${report.count} سطراً` : 'يُحدَّد عند الفتح'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {formatGeneratedAt(report.lastGeneratedAt)}
                  </p>
                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => openReport(report.type)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      عرض التقرير
                    </button>
                    <button
                      type="button"
                      onClick={() => printReport(report.type)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800"
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
          <div className="space-y-4 report-print-area">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
              <button
                type="button"
                onClick={closeReport}
                className="inline-flex items-center gap-2 text-sm text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
              >
                <LayoutGrid className="size-4" strokeWidth={1.5} />
                كل التقارير
              </button>
              <div className="flex flex-wrap items-center gap-3">
                {DATE_FILTER_TYPES.includes(currentActive) && (
                  <ReportDateNavigator
                    value={dateFilter || selectedDate || todayDateOnly()}
                    stepDays={currentActive === 'WEEKLY_PLAN' ? 7 : 1}
                    weekMode={currentActive === 'WEEKLY_PLAN'}
                    disabled={reportsLoading}
                    onChange={(next) => {
                      setDateFilter(next)
                      onFilterByDate?.(currentActive, next)
                    }}
                  />
                )}
                {CLASS_FILTER_TYPES.includes(currentActive) && classOptions.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span>الفصل</span>
                    <select
                      value={classFilter}
                      disabled={reportsLoading}
                      onChange={(e) => setClassFilter(e.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950"
                    >
                      <option value="ALL">كل الفصول</option>
                      {classOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            {currentActive === 'DAILY_ABSENCE' && dailyAbsenceDetail ? (
              <DailyAbsenceDetailView detail={dailyAbsenceDetail} />
            ) : currentActive === 'LATE_ARRIVALS' && lateArrivalsDetail ? (
              <LateArrivalsDetailView detail={lateArrivalsDetail} />
            ) : currentActive === 'HOMEWORK_LOG' && homeworkLogDetail ? (
              <HomeworkLogDetailView detail={homeworkLogDetail} classFilter={classFilter} />
            ) : currentActive === 'WEEKLY_PLAN' && weeklyPlanDetail ? (
              <WeeklyPlanDetailView detail={weeklyPlanDetail} classFilter={classFilter} />
            ) : currentActive === 'STUDENT_HISTORY' ? (
              <StudentHistoryDetailView
                detail={studentHistoryDetail}
                searchQuery={studentSearchQuery}
                searchResults={studentSearchResults}
                searchLoading={studentSearchLoading}
                onSearchStudent={onSearchStudent}
                onSelectStudent={onSelectStudent}
              />
            ) : reportsLoading ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                جارٍ تحميل التقرير…
              </p>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <ReportHeader
        schoolName={detail.schoolName}
        academicYear={detail.academicYear}
        educationAdminName={detail.educationAdminName}
        logoUrl={detail.logoUrl}
        subtitle="تقرير الغياب اليومي"
        dateLabel={formatReportDate(detail.date)}
        generatedAt={detail.generatedAt}
      />
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 md:block">
        <table className="w-full text-start text-sm">
          <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 font-medium">الطالب</th>
              <th className="px-3 py-2 font-medium">الفصل</th>
              <th className="px-3 py-2 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {detail.rows.map((row) => (
              <tr
                key={row.id ?? `${row.studentId}-${row.period ?? ''}-${row.date}`}
                className="border-t border-slate-100 dark:border-slate-800"
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
          <p className="p-6 text-center text-sm text-slate-500">لا يوجد غياب مسجل لهذا اليوم.</p>
        )}
      </div>
      <div className="space-y-2 md:hidden">
        {detail.rows.map((row) => (
          <div
            key={row.id ?? `${row.studentId}-${row.period ?? ''}-${row.date}`}
            className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
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
            <div className="mt-1 text-slate-500">{row.className}</div>
          </div>
        ))}
        {detail.rows.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">لا يوجد غياب مسجل لهذا اليوم.</p>
        )}
      </div>
    </div>
  )
}

function LateArrivalsDetailView({ detail }: { detail: LateArrivalsReportDetail }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <ReportHeader
        schoolName={detail.schoolName}
        academicYear={detail.academicYear}
        educationAdminName={detail.educationAdminName}
        logoUrl={detail.logoUrl}
        subtitle="تقرير التأخر"
        dateLabel={formatReportDate(detail.date)}
        generatedAt={detail.generatedAt}
      />
      <SimpleTable
        headers={['الطالب', 'الفصل', 'الوقت', 'السبب']}
        empty="لا يوجد تأخر مسجل لهذا اليوم."
        rows={detail.rows.map((r) => [
          r.studentName,
          r.className,
          formatTime(r.time),
          r.reason || '—',
        ])}
      />
    </div>
  )
}

function filterClassesBySelection<
  T extends { classId?: number | null; className: string; rows: unknown[] },
>(classes: T[], classFilter: string): T[] {
  if (classFilter === 'ALL') return classes
  return classes.filter((c) => String(c.classId ?? c.className) === classFilter)
}

function HomeworkLogDetailView({
  detail,
  classFilter = 'ALL',
}: {
  detail: HomeworkLogReportDetail
  classFilter?: string
}) {
  const allClasses =
    detail.classes && detail.classes.length > 0
      ? detail.classes
      : groupFlatByClass(detail.rows)
  const classes = filterClassesBySelection(allClasses, classFilter)

  if (allClasses.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        لا توجد واجبات مسجّلة لهذا اليوم.
      </p>
    )
  }

  if (classes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        لا توجد واجبات للفصل المحدد.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {classes.map((cls) => (
        <FormalClassSheet
          key={cls.classId ?? cls.className}
          schoolName={detail.schoolName}
          academicYear={detail.academicYear}
          educationAdminName={detail.educationAdminName}
          logoUrl={detail.logoUrl}
          principalName={detail.principalName}
          metaLines={[
            `تاريخ الواجبات: ${formatReportDate(detail.date)}`,
            `الفصل: ${cls.className}`,
          ]}
          title={`سجل الواجبات — ${cls.className}`}
        >
          <FormalTable
            headers={['المادة', 'المعلم', 'الوصف', 'الاستحقاق']}
            colWidths={['18%', '16%', '48%', '18%']}
            empty="لا توجد واجبات لهذا الفصل."
            rows={cls.rows.map((r) => [
              r.subjectName,
              r.teacherName,
              r.description,
              r.dueDate ? formatReportDate(r.dueDate) : '—',
            ])}
          />
        </FormalClassSheet>
      ))}
    </div>
  )
}

function WeeklyPlanDetailView({
  detail,
  classFilter = 'ALL',
}: {
  detail: WeeklyPlanReportDetail
  classFilter?: string
}) {
  const allClasses =
    detail.classes && detail.classes.length > 0
      ? detail.classes
      : groupFlatByClass(detail.rows)
  const classes = filterClassesBySelection(allClasses, classFilter)
  const weekEnd = detail.weekEnd ?? detail.weekStart

  if (allClasses.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        لا توجد خطط أسبوعية لهذا الأسبوع.
      </p>
    )
  }

  if (classes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        لا توجد خطة أسبوعية للفصل المحدد.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {classes.map((cls) => (
        <FormalClassSheet
          key={cls.classId ?? cls.className}
          schoolName={detail.schoolName}
          academicYear={detail.academicYear}
          educationAdminName={detail.educationAdminName}
          logoUrl={detail.logoUrl}
          principalName={detail.principalName}
          metaLines={[
            `العام الدراسي ${detail.academicYear}`,
            formatReportDateRange(detail.weekStart, weekEnd),
            `الفصل: ${cls.className}`,
          ]}
          title={`الخطة الدراسية الأسبوعية — ${cls.className}`}
        >
          <WeeklyPlanClassTable rows={cls.rows} />
        </FormalClassSheet>
      ))}
    </div>
  )
}

function groupFlatByClass<T extends { classId?: number | null; className: string }>(
  rows: T[]
): Array<{ classId: number | null; className: string; rows: T[] }> {
  const map = new Map<string, { classId: number | null; className: string; rows: T[] }>()
  for (const row of rows) {
    const key = String(row.classId ?? row.className)
    if (!map.has(key)) {
      map.set(key, {
        classId: row.classId ?? null,
        className: row.className,
        rows: [],
      })
    }
    map.get(key)!.rows.push(row)
  }
  return [...map.values()]
}

const PARENT_NOTE =
  'عزيزي ولي الأمر: أنت شريك في نجاح العملية التعليمية وتحقيق الانضباط المدرسي، فكن عوناً لنا.'

function FormalClassSheet({
  schoolName,
  academicYear,
  educationAdminName,
  logoUrl,
  principalName,
  metaLines,
  title,
  children,
}: {
  schoolName: string
  academicYear: string
  educationAdminName?: string | null
  logoUrl?: string | null
  principalName?: string | null
  metaLines: string[]
  title: string
  children: ReactNode
}) {
  const adminLabel = educationAdminName?.trim() || 'الإدارة العامة للتعليم'
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm print:break-after-page print:shadow-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
      style={{ fontFamily: '"Noto Naskh Arabic", "Amiri", "Times New Roman", serif' }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 dark:border-slate-800">
        <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{adminLabel}</p>
          <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">مدرسة {schoolName}</p>
          {academicYear ? (
            <p className="mt-1 text-xs text-slate-500">العام الدراسي {academicYear}</p>
          ) : null}
        </div>
        <div className="flex justify-center self-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={schoolName}
              className="h-20 w-20 object-contain sm:h-24 sm:w-24"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400 sm:h-24 sm:w-24">
              الشعار
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <div className="min-w-[10rem] rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm">
            {metaLines.map((line) => (
              <p key={line} className="leading-6">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#1e3a5f] px-4 py-3 text-center text-base font-bold text-white sm:text-lg">
        {title}
      </div>

      <div className="p-4 sm:p-5">{children}</div>

      <div className="flex flex-wrap items-stretch gap-3 border-t border-slate-100 px-4 py-4 sm:px-6 dark:border-slate-800">
        <p className="text-sm font-bold text-teal-700 dark:text-teal-300">ملاحظات:</p>
        <div className="min-w-[14rem] flex-1 rounded-xl border-2 border-teal-500/70 px-4 py-3 text-sm leading-7 text-slate-700 dark:text-slate-200">
          {PARENT_NOTE}
        </div>
        <div className="flex min-w-[10rem] flex-col justify-center rounded-xl border-2 border-teal-500/70 px-4 py-3 text-center text-sm">
          <p className="font-bold text-slate-800 dark:text-slate-100">قائد المدرسة</p>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {principalName?.trim() || 'اسم القائد'}
          </p>
        </div>
      </div>
    </section>
  )
}

function FormalTable({
  headers,
  rows,
  empty,
  colWidths,
}: {
  headers: string[]
  rows: string[][]
  empty: string
  colWidths?: string[]
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-teal-600/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="bg-teal-600 text-white">
              {headers.map((h, i) => (
                <th
                  key={h}
                  className="border border-teal-700 px-2 py-2.5 font-bold"
                  style={colWidths?.[i] ? { width: colWidths[i] } : undefined}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cols, i) => (
              <tr key={i} className="bg-white dark:bg-slate-950">
                {cols.map((c, j) => (
                  <td
                    key={j}
                    className="border border-slate-200 px-2 py-2 align-top text-slate-800 dark:border-slate-700 dark:text-slate-100"
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{empty}</p>}
    </div>
  )
}

function WeeklyPlanClassTable({
  rows,
}: {
  rows: WeeklyPlanReportDetail['rows']
}) {
  // Merge consecutive same-day cells (no حصة column — يوم | مادة | موضوع | ملاحظات/واجب)
  const spans: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].dayKey === rows[i - 1].dayKey) {
      spans[i] = 0
      continue
    }
    let span = 1
    while (i + span < rows.length && rows[i + span].dayKey === rows[i].dayKey) span++
    spans[i] = span
  }

  return (
    <div className="overflow-hidden rounded-xl border border-teal-600/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="bg-teal-600 text-white">
              <th className="w-[12%] border border-teal-700 px-2 py-2.5 font-bold">اليوم</th>
              <th className="w-[18%] border border-teal-700 px-2 py-2.5 font-bold">المادة</th>
              <th className="w-[30%] border border-teal-700 px-2 py-2.5 font-bold">موضوع الدرس</th>
              <th className="w-[40%] border border-teal-700 px-2 py-2.5 font-bold">
                ملاحظات / الواجب
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.planId}-${r.dayKey}-${r.subjectName}-${i}`} className="bg-white dark:bg-slate-950">
                {spans[i] > 0 && (
                  <td
                    rowSpan={spans[i]}
                    className="border border-slate-200 px-2 py-2 text-center font-bold align-middle text-slate-800 dark:border-slate-700 dark:text-slate-100"
                  >
                    {r.dayLabel}
                  </td>
                )}
                <td className="border border-slate-200 px-2 py-2 align-top text-slate-800 dark:border-slate-700 dark:text-slate-100">
                  {r.subjectName}
                </td>
                <td className="border border-slate-200 px-2 py-2 align-top text-slate-800 dark:border-slate-700 dark:text-slate-100">
                  {r.lessonTopic}
                </td>
                <td className="border border-slate-200 px-2 py-2 align-top text-slate-800 dark:border-slate-700 dark:text-slate-100">
                  {r.notes || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-500">لا توجد دروس مسجّلة لهذا الفصل.</p>
      )}
    </div>
  )
}

function StudentHistoryDetailView({
  detail,
  searchQuery,
  searchResults,
  searchLoading,
  onSearchStudent,
  onSelectStudent,
}: {
  detail: StudentHistoryReportDetail | null | undefined
  searchQuery: string
  searchResults: Array<{ id: string; nameAr: string; className: string | null }>
  searchLoading: boolean
  onSearchStudent?: (query: string) => void
  onSelectStudent?: (studentId: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 print:hidden dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          ابحث عن طالب (الاسم أو رقم الهوية)
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchStudent?.(e.target.value)}
            placeholder="اكتب للبحث…"
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          />
        </label>
        {searchLoading && (
          <p className="mt-2 text-xs text-slate-400">جارٍ البحث…</p>
        )}
        {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">لا نتائج مطابقة.</p>
        )}
        {searchResults.length > 0 && (
          <ul className="mt-3 max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
            {searchResults.map((s) => (
              <li key={s.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectStudent?.(s.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="font-semibold">{s.nameAr}</span>
                  <span className="text-xs text-slate-500" style={fontMono}>
                    {s.className ?? 'بدون فصل'} · {s.id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!detail ? (
        <ReportSummarySheet
          report={{
            type: 'STUDENT_HISTORY',
            title: 'سجل طالب',
            description: 'تاريخ الحضور والتأخر والفصول لطالب واحد',
            iconHint: 'HISTORY',
            context: 'اختر طالبًا من البحث أعلاه',
            count: null,
            lastGeneratedAt: null,
          }}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <ReportHeader
            schoolName={detail.schoolName}
            academicYear={detail.academicYear}
            educationAdminName={detail.educationAdminName}
            logoUrl={detail.logoUrl}
            subtitle={`سجل الطالب · ${detail.student.nameAr}`}
            dateLabel={detail.student.id}
            generatedAt={detail.generatedAt}
          />
          <dl className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="text-xs text-slate-500">الفصل الحالي</dt>
              <dd className="mt-1 font-medium">{detail.student.currentClassName ?? '—'}</dd>
            </div>
            <div className="rounded-md bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="text-xs text-slate-500">جوال ولي الأمر</dt>
              <dd className="mt-1 font-medium">
                <PhoneText value={detail.student.parentPhone} />
              </dd>
            </div>
            <div className="rounded-md bg-slate-100 p-3 dark:bg-slate-800">
              <dt className="text-xs text-slate-500">الحالة</dt>
              <dd className="mt-1 font-medium">{detail.student.isActive ? 'نشط' : 'موقوف'}</dd>
            </div>
          </dl>

          <h3 className="mb-2 text-sm font-bold">سجل الالتحاق بالفصول</h3>
          <SimpleTable
            headers={['الفصل', 'العام', 'من', 'إلى']}
            empty="لا يوجد سجل التحاق."
            rows={detail.enrollments.map((e) => [
              e.className + (e.isCurrent ? ' (حالي)' : ''),
              e.academicYear,
              formatReportDate(e.startDate),
              e.endDate ? formatReportDate(e.endDate) : '—',
            ])}
          />

          <h3 className="mb-2 mt-6 text-sm font-bold">الحضور والغياب</h3>
          <SimpleTable
            headers={['التاريخ', 'الفصل', 'الحالة', 'العذر']}
            empty="لا يوجد سجل حضور."
            rows={detail.attendance.map((a) => [
              formatReportDate(a.date),
              a.className,
              STATUS_AR[a.status] ?? a.status,
              a.absenceReason || '—',
            ])}
          />

          <h3 className="mb-2 mt-6 text-sm font-bold">التأخر</h3>
          <SimpleTable
            headers={['التاريخ', 'الفصل', 'الوقت', 'السبب']}
            empty="لا يوجد سجل تأخر."
            rows={detail.lateArrivals.map((l) => [
              formatReportDate(l.date),
              l.className,
              formatTime(l.time),
              l.reason || '—',
            ])}
          />
        </div>
      )}
    </div>
  )
}

/** Prev/next (+ today) with Gregorian calendar popup (Arabic month names). */
function ReportDateNavigator({
  value,
  onChange,
  stepDays = 1,
  weekMode = false,
  disabled = false,
}: {
  value: string
  onChange: (next: string) => void
  stepDays?: number
  weekMode?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const safeValue = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : todayDateOnly()
  const today = todayDateOnly()
  const label = weekMode
    ? `أسبوع ${formatReportDate(safeValue)}`
    : formatReportDate(safeValue)
  const prevLabel = weekMode ? 'الأسبوع السابق' : 'اليوم السابق'
  const nextLabel = weekMode ? 'الأسبوع التالي' : 'اليوم التالي'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-900">
        <button
          type="button"
          disabled={disabled}
          aria-label={prevLabel}
          title={prevLabel}
          onClick={() => onChange(addDaysToDateOnly(safeValue, -stepDays))}
          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronRight className="size-5" strokeWidth={1.75} />
        </button>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="فتح التقويم"
          title="اختيار التاريخ من التقويم"
          onClick={() => setOpen((v) => !v)}
          className="min-w-[8.5rem] rounded-lg px-2 py-1 text-center hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800"
        >
          <p
            className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50"
            style={fontMono}
          >
            {label}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {weekMode ? 'بداية الأسبوع (السبت)' : 'اضغط للتقويم'}
          </p>
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label={nextLabel}
          title={nextLabel}
          onClick={() => onChange(addDaysToDateOnly(safeValue, stepDays))}
          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </button>
        <ReportCalendarPicker
          value={safeValue}
          open={open}
          onClose={() => setOpen(false)}
          disabled={disabled}
          anchorRef={triggerRef}
          onChange={onChange}
        />
      </div>
      <button
        type="button"
        disabled={disabled || safeValue === today}
        onClick={() => onChange(today)}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        اليوم
      </button>
    </div>
  )
}

function ReportHeader({
  schoolName,
  academicYear,
  educationAdminName,
  logoUrl,
  subtitle,
  dateLabel,
  generatedAt,
}: {
  schoolName: string
  academicYear: string
  educationAdminName?: string | null
  logoUrl?: string | null
  subtitle: string
  dateLabel: string
  generatedAt?: string
}) {
  const adminLabel = educationAdminName?.trim() || 'الإدارة العامة للتعليم'
  return (
    <div className="mb-4 border-b border-slate-100 pb-4 dark:border-slate-800">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{adminLabel}</p>
          <h2 className="text-lg font-bold">{schoolName}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {subtitle} · العام الدراسي {academicYear}
          </p>
          <p className="mt-1 text-xs text-slate-400">{formatGeneratedAt(generatedAt)}</p>
        </div>
        <div className="flex justify-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={schoolName}
              className="h-16 w-16 object-contain sm:h-20 sm:w-20"
            />
          ) : null}
        </div>
        <p className="text-end text-sm text-slate-500" style={fontMono}>
          {dateLabel}
        </p>
      </div>
    </div>
  )
}

function SimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[]
  rows: string[][]
  empty: string
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-start text-sm">
          <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cols, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                {cols.map((c, j) => (
                  <td key={j} className={cn('px-3 py-2', j === 0 && 'font-semibold')}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{empty}</p>}
    </div>
  )
}

function ReportSummarySheet({ report, note }: { report: ReportSummary; note?: string }) {
  const Icon = ICON_MAP[report.iconHint]
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300">
          <Icon className="size-6" strokeWidth={1.5} />
        </span>
        <div>
          <h2 className="text-xl font-bold">{report.title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{report.description}</p>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-100 p-3 dark:bg-slate-800">
          <dt className="text-xs text-slate-500 dark:text-slate-400">النطاق</dt>
          <dd className="mt-1 font-medium">{formatReportDate(report.context)}</dd>
        </div>
        <div className="rounded-md bg-slate-100 p-3 dark:bg-slate-800">
          <dt className="text-xs text-slate-500 dark:text-slate-400">عدد السطور</dt>
          <dd className="mt-1 font-medium tabular-nums" style={fontMono}>
            {report.count != null ? report.count : 'يُحدَّد عند الفتح'}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        {formatGeneratedAt(report.lastGeneratedAt)}
      </p>
      {note && (
        <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
          {note}
        </p>
      )}
    </div>
  )
}

export default ReportsHub
