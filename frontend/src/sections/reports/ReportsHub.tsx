import { useState, type ReactNode } from 'react'
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

function formatGeneratedAt(iso: string | null | undefined) {
  if (!iso) return 'لم يُولَّد بعد'
  return `آخر توليد: ${new Date(iso).toLocaleString('ar-SA')}`
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
  activeReport: controlledActiveReport,
  onSelectReport,
  onCloseReport,
  onPrint,
  onFilterByDate,
  onSearchStudent,
  onSelectStudent,
}: ReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportType | null>(
    controlledActiveReport ?? null
  )
  const [dateFilter, setDateFilter] = useState(
    dailyAbsenceDetail?.date || weeklyPlanDetail?.date || ''
  )

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
      className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
      style={fontArabic}
    >
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-blue-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/40">
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
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 print:hidden"
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
                    <span>{report.context}</span>
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
              <button
                type="button"
                onClick={closeReport}
                className="inline-flex items-center gap-2 text-sm text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
              >
                <LayoutGrid className="size-4" strokeWidth={1.5} />
                كل التقارير
              </button>
              {DATE_FILTER_TYPES.includes(currentActive) && (
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span>{currentActive === 'WEEKLY_PLAN' ? 'يوم من الأسبوع' : 'التاريخ'}</span>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value)
                      onFilterByDate?.(currentActive, e.target.value)
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                    style={fontMono}
                  />
                </label>
              )}
            </div>

            {currentActive === 'DAILY_ABSENCE' && dailyAbsenceDetail ? (
              <DailyAbsenceDetailView detail={dailyAbsenceDetail} />
            ) : currentActive === 'LATE_ARRIVALS' && lateArrivalsDetail ? (
              <LateArrivalsDetailView detail={lateArrivalsDetail} />
            ) : currentActive === 'HOMEWORK_LOG' && homeworkLogDetail ? (
              <HomeworkLogDetailView detail={homeworkLogDetail} />
            ) : currentActive === 'WEEKLY_PLAN' && weeklyPlanDetail ? (
              <WeeklyPlanDetailView detail={weeklyPlanDetail} />
            ) : currentActive === 'STUDENT_HISTORY' ? (
              <StudentHistoryDetailView
                detail={studentHistoryDetail}
                searchQuery={studentSearchQuery}
                searchResults={studentSearchResults}
                searchLoading={studentSearchLoading}
                onSearchStudent={onSearchStudent}
                onSelectStudent={onSelectStudent}
              />
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
        subtitle="تقرير الغياب اليومي"
        dateLabel={detail.date}
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
              <tr key={row.studentId} className="border-t border-slate-100 dark:border-slate-800">
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
            key={row.studentId}
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
        subtitle="تقرير التأخر"
        dateLabel={detail.date}
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

function HomeworkLogDetailView({ detail }: { detail: HomeworkLogReportDetail }) {
  const classes =
    detail.classes && detail.classes.length > 0
      ? detail.classes
      : groupFlatByClass(detail.rows)

  if (classes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        لا توجد واجبات مسجّلة لهذا اليوم.
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
          principalName={detail.principalName}
          metaLines={[`تاريخ الواجبات: ${detail.date}`]}
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
              r.dueDate || '—',
            ])}
          />
        </FormalClassSheet>
      ))}
    </div>
  )
}

function WeeklyPlanDetailView({ detail }: { detail: WeeklyPlanReportDetail }) {
  const classes =
    detail.classes && detail.classes.length > 0
      ? detail.classes
      : groupFlatByClass(detail.rows)
  const weekEnd = detail.weekEnd ?? detail.weekStart

  if (classes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        لا توجد خطط أسبوعية لهذا الأسبوع.
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
          principalName={detail.principalName}
          metaLines={[
            `العام الدراسي ${detail.academicYear}`,
            `من ${detail.weekStart} إلى ${weekEnd}`,
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
  principalName,
  metaLines,
  title,
  children,
}: {
  schoolName: string
  academicYear: string
  principalName?: string | null
  metaLines: string[]
  title: string
  children: ReactNode
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm print:break-after-page print:shadow-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
      style={{ fontFamily: '"Noto Naskh Arabic", "Amiri", "Times New Roman", serif' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6 dark:border-slate-800">
        <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <p>الإدارة العامة للتعليم</p>
          <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">مدرسة {schoolName}</p>
          {academicYear ? (
            <p className="mt-1 text-xs text-slate-500">العام الدراسي {academicYear}</p>
          ) : null}
        </div>
        <div className="min-w-[12rem] rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm">
          {metaLines.map((line) => (
            <p key={line} className="leading-6">
              {line}
            </p>
          ))}
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
              <dd className="mt-1 font-medium" style={fontMono}>
                {detail.student.parentPhone}
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
              e.startDate,
              e.endDate ?? '—',
            ])}
          />

          <h3 className="mb-2 mt-6 text-sm font-bold">الحضور والغياب</h3>
          <SimpleTable
            headers={['التاريخ', 'الفصل', 'الحالة', 'العذر']}
            empty="لا يوجد سجل حضور."
            rows={detail.attendance.map((a) => [
              a.date,
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
              l.date,
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

function ReportHeader({
  schoolName,
  academicYear,
  subtitle,
  dateLabel,
  generatedAt,
}: {
  schoolName: string
  academicYear: string
  subtitle: string
  dateLabel: string
  generatedAt?: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
      <div>
        <h2 className="text-lg font-bold">{schoolName}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {subtitle} · العام الدراسي {academicYear}
        </p>
        <p className="mt-1 text-xs text-slate-400">{formatGeneratedAt(generatedAt)}</p>
      </div>
      <p className="text-sm text-slate-500" style={fontMono}>
        {dateLabel}
      </p>
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
          <dd className="mt-1 font-medium">{report.context}</dd>
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
