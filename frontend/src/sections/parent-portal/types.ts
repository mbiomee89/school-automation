/**
 * Types and props for the Parent Portal section screen designs.
 * Standalone, mobile-first — no app shell chrome (see spec.md `shell: false`).
 */

export type AttendanceDayStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
export type ExcuseStatus = 'NONE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
export type NotificationEventType = 'ABSENCE' | 'LATE' | 'HOMEWORK_DIGEST' | 'WEEKLY_PLAN'
export type NotificationStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
export type EarlyLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type ParentTab = 'home' | 'attendance' | 'homework' | 'early-leave' | 'notifications' | 'settings'

export interface Child {
  id: string
  nameAr: string
  nameEn: string
  className: string
  gradeLevel: string
}

export interface TodaySummary {
  date: string
  attendanceStatus: AttendanceDayStatus | null
  homeworkDueCount: number
  newAlertsCount: number
}

export interface AttendanceDay {
  id: number
  date: string
  status: AttendanceDayStatus
  period: string
  lateMinutes: number | null
  /** NONE unless this day is ABSENT and the parent has submitted (or is submitting) an excuse. */
  excuseStatus: ExcuseStatus
  /** Counselor's rejection note, if excuseStatus is REJECTED. */
  excuseNote: string | null
  hasExcuseAttachment: boolean
}

export interface HomeworkItem {
  id: number
  date: string
  subjectNameAr: string
  subjectNameEn: string
  description: string
  dueDate: string | null
  period?: string | null
  noHomework?: boolean
  teacherName?: string | null
  className?: string | null
}

export interface ReportBrand {
  schoolName: string
  academicYear: string
  educationAdminName?: string | null
  logoUrl?: string | null
  principalName?: string | null
}

export interface ClassTimetableSlot {
  id: number
  period: string
  dayOfWeek: string
  date: string
  subjectId: number
  subjectNameAr: string
  subjectNameEn: string
  teacherId?: number
  teacherName?: string | null
}

export interface ClassTimetableDay {
  dayOfWeek: string
  date: string
  slots: ClassTimetableSlot[]
}

export interface ClassTimetable {
  weekStart: string
  weekEnd: string
  academicYear: string | null
  today: string
  classId: number | null
  className: string
  studentId: string
  studentNameAr: string
  schoolName: string
  educationAdminName?: string | null
  logoUrl?: string | null
  principalName?: string | null
  days: ClassTimetableDay[]
}

export interface WeeklyPlanFormalRow {
  planId: number
  dayKey: string
  dayLabel: string
  subjectName: string
  lessonTopic: string
  notes: string | null
  period?: string | null
  teacherName?: string
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

export interface WeeklyPlanItem {
  id: number
  weekStart: string
  subjectNameAr: string
  subjectNameEn: string
  /** Cell-based plan fields (new). */
  date?: string | null
  period?: string | null
  dayLabel?: string | null
  title?: string | null
  /** Legacy per-day JSON. Null for new cell rows. */
  days?: WeeklyPlanDays | null
}

export interface NotificationItem {
  id: number
  eventType: NotificationEventType
  status: NotificationStatus
  summary: string
  sentAt: string | null
}

export interface ExcuseSubmission {
  id: number
  attendanceDate: string
  reasonText: string
  attachmentUrl: string | null
  status: ExcuseStatus
  submittedAt: string
  reviewedAt: string | null
  counselorNote: string | null
}

export interface ExcuseSubmissionInput {
  attendanceDate: string
  reasonText: string
  /** From either the camera-capture flow or the file picker. */
  file: File
}

export interface EarlyLeaveRequest {
  id: number
  studentId: string
  classId: number
  className: string | null
  date: string
  /** ISO datetime of planned exit. */
  leaveTime: string
  reason: string
  pickupName: string
  pickupRelation: string
  pickupPhone: string
  status: EarlyLeaveStatus
  requestedAt: string
  reviewedAt: string | null
  reviewNote: string | null
  cancelledAt: string | null
}

export interface EarlyLeaveSubmitInput {
  date: string
  /** HH:mm */
  leaveTime: string
  reason: string
  pickupName: string
  pickupRelation: string
  pickupPhone: string
}

export interface ParentPortalProps {
  children: Child[]
  activeChildId: string
  todaySummary: TodaySummary
  attendanceHistory: AttendanceDay[]
  homeworkItems: HomeworkItem[]
  /** Today’s homework for the home tab (independent of homeworkBrowseDate). */
  homeHomeworkItems?: HomeworkItem[]
  weeklyPlans: WeeklyPlanItem[]
  /** Formal weekly-plan rows for the selected week (report shape). */
  weeklyPlanRows?: WeeklyPlanFormalRow[]
  weeklyPlanWeekStart?: string | null
  weeklyPlanWeekEnd?: string | null
  reportBrand?: ReportBrand
  reportClassName?: string
  /** Class weekly timetable for home (paper sheet). */
  classTimetable?: ClassTimetable | null
  classTimetableError?: string | null
  classTimetableLoading?: boolean
  /** WhatsApp notification log — hidden in UI for now (manual messaging). */
  notifications?: NotificationItem[]
  excuseSubmissions: ExcuseSubmission[]
  earlyLeaveRequests?: EarlyLeaveRequest[]
  /** WhatsApp opt-in — hidden in UI for now. */
  waOptedIn?: boolean
  /** Active bottom-nav tab for controlled preview */
  activeTab?: ParentTab

  /** Switch bottom-nav tab */
  onTabChange?: (tab: ParentTab) => void
  /** Switch the active child in the child-switcher dropdown */
  onSelectChild?: (childId: string) => void
  /** Open a single attendance day's detail (e.g. to start an excuse upload) */
  onSelectAttendanceDay?: (attendanceDayId: number) => void
  /** Submit an absence excuse — may return a Promise; rejection shows a toast. */
  onSubmitExcuse?: (input: ExcuseSubmissionInput) => void | Promise<void>
  /** Submit an early-leave (استئذان) request. */
  onSubmitEarlyLeave?: (input: EarlyLeaveSubmitInput) => void | Promise<void>
  /** Cancel a pending or approved early-leave request. */
  onCancelEarlyLeave?: (requestId: number) => void | Promise<void>
  /** Toggle WhatsApp notifications — unused while messaging is manual. */
  onToggleWaOptIn?: (optedIn: boolean) => void
  /** Log out of the parent portal */
  onLogout?: () => void
  /** Date used to browse homework (YYYY-MM-DD). Defaults to today on the page. */
  homeworkBrowseDate?: string
  onHomeworkBrowseDateChange?: (date: string) => void
  /** Anchor date for weekly plan week (YYYY-MM-DD). */
  weeklyPlanAnchorDate?: string
  onWeeklyPlanAnchorDateChange?: (date: string) => void
}

export type ParentLoginMode = 'login' | 'register' | 'reset'

export type ParentLoginErrorCode =
  | 'INVALID_PHONE'
  | 'INVALID_CREDENTIALS'
  | 'PHONE_NOT_FOUND'
  | 'ACCOUNT_EXISTS'
  | 'WEAK_PASSWORD'
  | 'STUDENT_ID_REQUIRED'
  | 'RESET_FAILED'
  | 'NETWORK'

export interface ParentLoginBrand {
  schoolName: string
  logoUrl: string | null
}

export interface ParentLoginProps {
  /** Optional school branding stamped on the login screen. */
  brand?: ParentLoginBrand
  /** login = existing account; register = first-time; reset = forgot password. */
  mode?: ParentLoginMode
  /** Prefill phone for demos. */
  initialPhone?: string
  /** Inline error to display, if any. */
  errorCode?: ParentLoginErrorCode | null
  /** Optional free-text error from the API (Arabic/English). */
  errorMessage?: string | null
  /** True while a request is in flight. */
  isSubmitting?: boolean

  onModeChange?: (mode: ParentLoginMode) => void
  /**
   * Submit credentials. `studentId` is required in register and reset modes
   * (national ID of one child linked to this phone).
   */
  onSubmit?: (credentials: {
    phone: string
    password: string
    mode: ParentLoginMode
    studentId?: string
  }) => void
  /** Navigate to the staff login screen (different auth realm — no shared session). */
  onOpenStaffLogin?: () => void
}
