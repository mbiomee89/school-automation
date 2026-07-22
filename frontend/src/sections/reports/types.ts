/**
 * Types and props for the shared Reports section screen designs.
 * Reachable from the app shell's "التقارير" nav item by ADMIN and COUNSELOR roles.
 */

export type ReportType =
  | 'DAILY_ABSENCE'
  | 'LATE_ARRIVALS'
  | 'HOMEWORK_LOG'
  | 'WEEKLY_PLAN'
  | 'STUDENT_HISTORY'

/** Maps to a lucide-react icon chosen in the component layer. */
export type ReportIconHint = 'CALENDAR_OFF' | 'CLOCK' | 'BOOK_OPEN' | 'CALENDAR_RANGE' | 'HISTORY'

export interface ReportSummary {
  type: ReportType
  title: string
  description: string
  iconHint: ReportIconHint
  /** Human-readable date/week scope shown on the card, e.g. a specific day or a week range. */
  context: string
  /** Row count for this report if known ahead of generation; null when it depends on a per-student selection (e.g. student history). */
  count: number | null
  /** ISO timestamp of the last time this report was generated/viewed; null if never. */
  lastGeneratedAt: string | null
}

export type AbsenceRowStatus = 'ABSENT' | 'EXCUSED'

export interface DailyAbsenceRow {
  studentId: string
  studentName: string
  className: string
  date: string
  status: AbsenceRowStatus
}

export interface DailyAbsenceReportDetail {
  date: string
  schoolName: string
  academicYear: string
  generatedAt?: string
  rows: DailyAbsenceRow[]
}

export interface LateArrivalsReportDetail {
  date: string
  schoolName: string
  academicYear: string
  generatedAt?: string
  rows: Array<{
    studentId: string
    studentName: string
    className: string
    time: string
    reason: string | null
  }>
  count: number
}

export interface HomeworkLogReportDetail {
  date: string
  schoolName: string
  academicYear: string
  principalName?: string | null
  generatedAt?: string
  rows: Array<{
    id: number
    classId: number
    className: string
    subjectName: string
    teacherName: string
    description: string
    dueDate: string | null
  }>
  classes?: Array<{
    classId: number | null
    className: string
    rows: HomeworkLogReportDetail['rows']
  }>
  count: number
}

export interface WeeklyPlanLessonRow {
  planId: number
  classId: number
  className: string
  dayKey: string
  dayLabel: string
  subjectName: string
  teacherName: string
  lessonTopic: string
  notes: string | null
}

export interface WeeklyPlanReportDetail {
  date: string
  weekStart: string
  weekEnd?: string
  schoolName: string
  academicYear: string
  principalName?: string | null
  generatedAt?: string
  rows: WeeklyPlanLessonRow[]
  classes?: Array<{
    classId: number | null
    className: string
    rows: WeeklyPlanLessonRow[]
  }>
  count: number
}

export interface StudentHistoryReportDetail {
  schoolName: string
  academicYear: string
  generatedAt?: string
  student: {
    id: string
    nameAr: string
    nameEn: string
    parentPhone: string
    isActive: boolean
    currentClassName: string | null
    currentAcademicYear: string | null
  }
  attendance: Array<{
    id: number
    date: string
    period: string
    status: 'PRESENT' | 'ABSENT' | 'EXCUSED'
    className: string
    reasonStatus: string
    absenceReason: string | null
  }>
  lateArrivals: Array<{
    id: number
    date: string
    time: string
    className: string
    reason: string | null
  }>
  enrollments: Array<{
    id: number
    className: string
    academicYear: string
    startDate: string
    endDate: string | null
    isCurrent: boolean
  }>
  count: number
}

export interface StudentSearchOption {
  id: string
  nameAr: string
  className: string | null
}

export interface ReportsProps {
  reports: ReportSummary[]
  dailyAbsenceDetail?: DailyAbsenceReportDetail | null
  lateArrivalsDetail?: LateArrivalsReportDetail | null
  homeworkLogDetail?: HomeworkLogReportDetail | null
  weeklyPlanDetail?: WeeklyPlanReportDetail | null
  studentHistoryDetail?: StudentHistoryReportDetail | null
  studentSearchResults?: StudentSearchOption[]
  studentSearchQuery?: string
  studentSearchLoading?: boolean
  /** Currently opened report, for controlled preview. */
  activeReport?: ReportType | null
  /** Open a report's detail/printable view */
  onSelectReport?: (type: ReportType) => void
  /** Close the currently opened report and return to the hub grid */
  onCloseReport?: () => void
  /** Trigger browser print for a report (opens/keeps the printable view, then the browser print dialog) */
  onPrint?: (type: ReportType) => void
  /** Change the date scope for date-based reports (daily absence, late arrivals) */
  onFilterByDate?: (type: ReportType, date: string) => void
  /** Change the week scope for week-based reports (homework log, weekly plan) */
  onFilterByWeek?: (type: ReportType, weekStart: string) => void
  /** Search students for the student-history report */
  onSearchStudent?: (query: string) => void
  /** Load student history for a selected student id */
  onSelectStudent?: (studentId: string) => void
}
