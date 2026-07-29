/**
 * Types and props for the School Administration section screen designs.
 */

export type StaffRole = 'ADMIN' | 'TEACHER' | 'COUNSELOR'
export type LangPref = 'AR' | 'EN'
export type NotificationEventType = 'ABSENCE' | 'LATE' | 'HOMEWORK_DIGEST' | 'WEEKLY_PLAN'
export type NotificationStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'

export type AdminTab =
  | 'overview'
  | 'students'
  | 'classes'
  | 'staff'
  | 'assignments'
  | 'import'
  | 'notifications'
  | 'settings'

export interface OverviewStats {
  activeStudents: number
  staffCount: number
  classesThisYear: number
  notificationsFailedToday: number
  academicYear: string
}

/**
 * Singleton school profile: name, logo, academic year, principal, education admin, and address.
 * Stamped on every printed report header (roster, overview, and future report
 * print views). Configured from the "إعدادات المدرسة" tab.
 */
export interface SchoolSettings {
  name: string
  logoUrl: string | null
  academicYear: string
  principalName: string | null
  /** إدارة التعليم — shown on report headers */
  educationAdminName: string | null
  address: string | null
}

export interface Staff {
  id: number
  name: string
  email: string
  role: StaffRole
  langPref: LangPref
  isActive: boolean
  phone: string | null
}

export interface ClassItem {
  id: number
  name: string
  gradeLevel: string
  section: string | null
  academicYear: string
  studentCount: number
  /** False when the class has current students or any historical records (cannot delete). */
  canDelete: boolean
}

export interface Subject {
  id: number
  nameAr: string
  nameEn: string
}

export interface TeacherAssignment {
  id: number
  teacherId: number
  teacherName: string
  classId: number
  className: string
  subjectId: number
  subjectNameEn: string
  subjectNameAr: string
}

export interface Student {
  id: string
  nameAr: string
  nameEn: string
  /** Null means the student currently has no class ("بدون فصل") — either never
   * assigned or removed via unassign / remove-all-students, pending re-assignment. */
  classId: number | null
  className: string | null
  parentPhone: string
  parentEmail: string | null
  waOptedIn: boolean
  isActive: boolean
}

export interface ClassEnrollment {
  id: number
  studentId: string
  className: string
  academicYear: string
  startDate: string
  endDate: string | null
  changedByName: string | null
}

export interface ImportBatch {
  id: number
  fileName: string | null
  rowCount: number
  importedAt: string
  importerName: string
  created: number
  updated: number
  reactivated: number
  skipped: number
}

export interface ImportError {
  index: number
  id: string
  error: string
}

export interface ImportResult {
  fileName: string
  created: number
  updated: number
  reactivated: number
  skipped: number
  errors: ImportError[]
  /** Classes auto-created from Noor grade+section columns. */
  classesCreated?: number
  /** Existing classes reused during Noor import. */
  classesReused?: number
  academicYear?: string
  /** Shared initial password for newly created teacher accounts (Noor teacher import). */
  defaultPassword?: string | null
}

export interface NotificationLogItem {
  id: number
  eventType: NotificationEventType
  studentName: string
  parentPhone: string
  status: NotificationStatus
  templateName: string
  sentAt: string | null
  errorMessage: string | null
}

export interface StudentInput {
  id: string
  nameAr: string
  nameEn: string
  /** Null creates/keeps the student unassigned ("بدون فصل"). */
  classId: number | null
  parentPhone: string
  parentEmail?: string | null
  waOptedIn?: boolean
}

export interface StaffInput {
  name: string
  email: string
  password?: string
  role: StaffRole
  langPref?: LangPref
  phone?: string | null
}

export interface ClassInput {
  name: string
  gradeLevel: string
  section?: string | null
  academicYear: string
}

export interface SubjectInput {
  nameAr: string
  nameEn: string
}

export interface AssignmentInput {
  teacherId: number
  classId: number
  subjectId: number
}

/** Sync many class×subject pairs for one teacher in a single save. */
export interface AssignmentSyncInput {
  teacherId: number
  classIds: number[]
  items: Array<{ classId: number; subjectId: number }>
}

export interface SchoolAdministrationProps {
  overviewStats: OverviewStats
  /** School profile shown in the settings tab and stamped on print headers. */
  schoolSettings: SchoolSettings
  staff: Staff[]
  classes: ClassItem[]
  subjects: Subject[]
  assignments: TeacherAssignment[]
  students: Student[]
  enrollments: ClassEnrollment[]
  importBatches: ImportBatch[]
  importResult: ImportResult | null
  notifications: NotificationLogItem[]
  /** Active tab for controlled preview */
  activeTab?: AdminTab
  academicYearFilter?: string

  /** Switch dashboard tab */
  onTabChange?: (tab: AdminTab) => void
  /** Search students by name, national ID, or parent phone */
  onSearchStudents?: (query: string) => void
  /** Open student detail (enrollment history) */
  onSelectStudent?: (studentId: string) => void
  /** Create or update a student */
  onSaveStudent?: (student: StudentInput) => void
  /** Soft-remove a student from the active roster */
  onSoftRemoveStudent?: (studentId: string) => void
  /** Promote / move student to another class */
  onPromoteStudent?: (studentId: string, classId: number) => void
  /**
   * Remove a student from their current class without assigning a new one
   * ("إزالة من الفصل" — distinct from "استبعاد", which soft-removes a student
   * from the active roster entirely). Closes the student's open class
   * enrollment (if any) and sets their classId to null; the student then
   * falls into the "بدون فصل" (unassigned) bucket until re-assigned via
   * promote. Mirrors the backend's `POST /students/:id/unassign`.
   */
  onUnassignStudent?: (studentId: string) => void
  /** Create or update a class */
  onSaveClass?: (classItem: ClassInput & { id?: number }) => void
  /** Permanently delete a class (backend blocks this if the class has students or any academic records — attendance, homework, late reports, weekly plans, or enrollments) */
  onRemoveClass?: (classId: number) => void
  /**
   * Bulk-unassign every student currently in this class (sets each student's
   * classId to null and closes their open class enrollment) without deleting
   * any student or their history. Mirrors the backend's
   * `POST /classes/:id/remove-all-students`. Useful before retrying a class
   * delete that's blocked by students, or to reset a roster.
   */
  onRemoveAllStudentsFromClass?: (classId: number) => void
  /** Create or update a subject */
  onSaveSubject?: (subject: SubjectInput & { id?: number }) => void
  /** Permanently delete a subject (backend blocks this if the subject has homework or weekly plans; any teacher assignments using the subject are removed automatically) */
  onRemoveSubject?: (subjectId: number) => void
  /** Create staff account — return a Promise so the modal can wait before closing */
  onCreateStaff?: (staff: StaffInput) => void | Promise<void>
  /** Update staff fields / role */
  onUpdateStaff?: (staffId: number, patch: Partial<StaffInput>) => void
  /** Deactivate staff account */
  onDeactivateStaff?: (staffId: number) => void
  /** Reactivate staff account */
  onActivateStaff?: (staffId: number) => void
  /** Assign teacher to class+subject */
  onAddAssignment?: (assignment: AssignmentInput) => void
  /** Sync multiple class×subject pairs for one teacher (matrix editor) */
  onSyncAssignments?: (input: AssignmentSyncInput) => void | Promise<void>
  /** Remove a teacher assignment */
  onRemoveAssignment?: (assignmentId: number) => void
  /** Upload Noor StudentGuidance spreadsheet — classes are created automatically from the file */
  onImportStudents?: (file: File) => void | Promise<void>
  /** Upload Noor GetSchoolTeachersDataReport — creates/updates TEACHER staff accounts */
  onImportTeachers?: (file: File) => void | Promise<void>
  /** Last teachers-import result (separate from student importResult) */
  teacherImportResult?: ImportResult | null
  /** Filter notification log */
  onFilterNotifications?: (filters: {
    status?: NotificationStatus | 'ALL'
    eventType?: NotificationEventType | 'ALL'
  }) => void
  /** Trigger browser print for current printable view */
  onPrint?: (view: 'roster' | 'overview') => void
  /** Save school profile fields (name, academic year, principal, address). Logo is uploaded separately via onUploadSchoolLogo. */
  onSaveSchoolSettings?: (settings: Omit<SchoolSettings, 'logoUrl'>) => void | Promise<void>
  /** Upload a new school logo file; backend stores it under /uploads and returns the new logo URL/path */
  onUploadSchoolLogo?: (file: File) => void | Promise<string>
}
