/**
 * Types and props for the Teacher Daily Workflow section screen designs.
 * Renders inside the app shell (see spec.md `shell: true`).
 */

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED'
export type TeacherTab = 'attendance' | 'late' | 'homework' | 'weekly-plan'

export interface TeacherAssignmentOption {
  id: number
  classId: number
  className: string
  subjectId: number
  subjectNameAr: string
  subjectNameEn: string
}

export interface RosterStudent {
  id: string
  nameAr: string
  nameEn: string
}

export interface AttendanceMark {
  studentId: string
  status: AttendanceStatus
}

export interface LateReportEntry {
  id: number
  studentId: string
  studentName: string
  /** ISO datetime of arrival. */
  time: string
  reason: string | null
}

export interface HomeworkEntry {
  id: number
  description: string
  /** Date-only (YYYY-MM-DD); optional. */
  dueDate: string | null
  createdAt: string
}

/** Saudi school weekdays (Sun–Thu). Weekend Fri/Sat are not planned. */
export type SchoolWeekday = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday'

/** A single day's lesson. `null` on a weekday means no lesson that day. */
export interface WeeklyPlanLesson {
  topics: string
  objectives: string | null
  notes: string | null
}

/** One entry per school weekday — always all five keys present; value is lesson or null. */
export type WeeklyPlanDays = Record<SchoolWeekday, WeeklyPlanLesson | null>

export interface WeeklyPlanEntry {
  id: number
  /** Always a Saturday (date-only, YYYY-MM-DD) — the week-start / digest key. */
  weekStart: string
  /** Per-day plan for Sun–Thu. Each day is either a lesson or null (no lesson). */
  days: WeeklyPlanDays
}

export interface TeacherDailyWorkflowProps {
  /** This teacher's class+subject assignments, for the assignment selector. */
  assignments: TeacherAssignmentOption[]
  activeAssignmentId: number | null
  /** Today's timetable lessons (from import); empty if no schedule. */
  todaySlots?: Array<{
    period: string
    className: string
    subjectNameAr: string
    assignmentId: number | null
  }>
  /** Students in the class of the currently selected assignment. */
  roster: RosterStudent[]
  /** Today's date (YYYY-MM-DD), used to label the attendance/late/homework tabs. */
  todayDate: string
  /** Null/undefined means attendance hasn't been saved yet today for this assignment. */
  attendanceSavedAt: string | null
  /** One entry per roster student; defaults to PRESENT until the teacher changes it. */
  attendanceMarks: AttendanceMark[]
  lateReportsToday: LateReportEntry[]
  homeworkToday: HomeworkEntry[]
  /** The Saturday currently being viewed on the Weekly Plan tab. */
  currentWeekStart: string
  /** The saved plan for currentWeekStart + the active assignment's subject, or null if not yet created. */
  weeklyPlan: WeeklyPlanEntry | null
  /** Active tab for controlled preview */
  activeTab?: TeacherTab

  /** Switch tab */
  onTabChange?: (tab: TeacherTab) => void
  /** Switch the active class+subject assignment */
  onSelectAssignment?: (assignmentId: number) => void
  /** Save (or re-save) today's full attendance list in one action */
  onSaveAttendance?: (marks: AttendanceMark[]) => void | Promise<void>
  /** Log a new late arrival for a roster student */
  onAddLateReport?: (entry: { studentId: string; time: string; reason?: string | null }) => void
  /** Edit an existing late report logged today */
  onUpdateLateReport?: (id: number, patch: { time?: string; reason?: string | null }) => void
  /** Remove a late report logged today */
  onDeleteLateReport?: (id: number) => void
  /** Post a new homework entry for today */
  onAddHomework?: (entry: { description: string; dueDate?: string | null }) => void | Promise<void>
  /** Edit an existing homework entry posted today */
  onUpdateHomework?: (id: number, patch: { description?: string; dueDate?: string | null }) => void
  /** Remove a homework entry posted today */
  onDeleteHomework?: (id: number) => void
  /** Move the Weekly Plan tab to a different Saturday (forward/back) */
  onNavigateWeek?: (weekStart: string) => void
  /** Create or update the plan for currentWeekStart + the active assignment's subject */
  onSaveWeeklyPlan?: (entry: {
    weekStart: string
    days: WeeklyPlanDays
  }) => void
}
