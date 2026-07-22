import { useMemo, useState, type ChangeEvent } from 'react'
import {
  Printer,
  Search,
  Upload,
  UserPlus,
  Users,
  Building2,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Ban,
  GraduationCap,
  Bell,
  BookOpen,
} from 'lucide-react'
import type {
  AdminTab,
  AssignmentSyncInput,
  ClassInput,
  ClassItem,
  SchoolAdministrationProps,
  StaffInput,
  Student,
  StudentInput,
  Subject,
  SubjectInput,
  NotificationStatus,
  NotificationEventType,
  StaffRole,
} from './types'
import { cn } from '../../shared/utils'
import { buttonVariants } from '../../shared/buttonVariants'
import { TONE_CLASSES, type Tone } from '../../shared/colors'
import { Modal } from '../../shared/Modal'
import { fontArabic, fontMono } from '../../shared/fonts'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'students', label: 'الطلاب' },
  { id: 'classes', label: 'الفصول والمواد' },
  { id: 'staff', label: 'الموظفون' },
  { id: 'assignments', label: 'توزيع المعلمين' },
  { id: 'import', label: 'استيراد نور' },
  { id: 'notifications', label: 'سجل واتساب' },
  { id: 'settings', label: 'إعدادات المدرسة' },
]

const ROLE_AR: Record<StaffRole, string> = {
  ADMIN: 'إدارة',
  TEACHER: 'معلم',
  COUNSELOR: 'مرشد طلابي',
}

const STATUS_AR: Record<NotificationStatus, string> = {
  QUEUED: 'في الانتظار',
  SENT: 'تم الإرسال',
  DELIVERED: 'تم التسليم',
  READ: 'تمت القراءة',
  FAILED: 'فشل الإرسال',
}

const EVENT_AR: Record<NotificationEventType, string> = {
  ABSENCE: 'غياب',
  LATE: 'تأخر',
  HOMEWORK_DIGEST: 'ملخص الواجبات',
  WEEKLY_PLAN: 'الخطة الأسبوعية',
}

const EMPTY_STUDENT_FORM: StudentInput = {
  id: '',
  nameAr: '',
  nameEn: '',
  classId: null,
  parentPhone: '',
  parentEmail: null,
  waOptedIn: false,
}

const EMPTY_CLASS_FORM: ClassInput = { name: '', gradeLevel: '', section: '', academicYear: '' }
const EMPTY_SUBJECT_FORM: SubjectInput = { nameAr: '', nameEn: '' }
const EMPTY_STAFF_FORM: StaffInput = {
  name: '',
  email: '',
  password: 'Password123!',
  role: 'TEACHER',
  langPref: 'AR',
  phone: '',
}

/** Matches the backend's accepted Saudi mobile shapes; used for a soft inline hint only. */
function looksLikeSaudiPhone(value: string) {
  const digits = value.trim().replace(/[\s()-]/g, '').replace(/^\+/, '')
  if (!/^\d+$/.test(digits)) return false
  return (
    (digits.startsWith('9665') && digits.length === 12) ||
    (digits.startsWith('05') && digits.length === 10) ||
    (digits.startsWith('5') && digits.length === 9)
  )
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function roleBadge(role: string) {
  const styles: Record<string, string> = {
    ADMIN: 'bg-blue-500/15 text-blue-800 dark:text-blue-300',
    TEACHER: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
    COUNSELOR: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  }
  return styles[role] ?? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
}

function statusBadge(status: NotificationStatus) {
  const styles: Record<NotificationStatus, string> = {
    QUEUED: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    SENT: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
    DELIVERED: 'bg-blue-500/15 text-blue-800 dark:text-blue-300',
    READ: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
    FAILED: 'bg-red-500/15 text-red-800 dark:text-red-300',
  }
  return styles[status]
}

export function AdminDashboard({
  overviewStats,
  schoolSettings,
  staff,
  classes,
  subjects,
  assignments,
  students,
  enrollments,
  importBatches,
  importResult,
  notifications,
  activeTab: controlledTab,
  academicYearFilter,
  onTabChange,
  onSearchStudents,
  onSelectStudent,
  onSaveStudent,
  onSoftRemoveStudent,
  onPromoteStudent,
  onUnassignStudent,
  onSaveClass,
  onRemoveClass,
  onRemoveAllStudentsFromClass,
  onSaveSubject,
  onRemoveSubject,
  onCreateStaff,
  onDeactivateStaff,
  onActivateStaff,
  onSyncAssignments,
  onRemoveAssignment,
  onImportStudents,
  onImportTeachers,
  teacherImportResult = null,
  onFilterNotifications,
  onPrint,
  onSaveSchoolSettings,
  onUploadSchoolLogo,
}: SchoolAdministrationProps) {
  const [tab, setTab] = useState<AdminTab>(controlledTab ?? 'overview')
  const [query, setQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [promoteFor, setPromoteFor] = useState<Student | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<Student | null>(null)
  const [studentClassFilter, setStudentClassFilter] = useState<'ALL' | 'UNASSIGNED' | number>('ALL')

  const [studentForm, setStudentForm] = useState<StudentInput>(EMPTY_STUDENT_FORM)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [studentFormError, setStudentFormError] = useState<string | null>(null)

  const [classForm, setClassForm] = useState<ClassInput>(EMPTY_CLASS_FORM)
  const [editingClassId, setEditingClassId] = useState<number | null>(null)
  const [showClassModal, setShowClassModal] = useState(false)
  const [deleteClassTarget, setDeleteClassTarget] = useState<ClassItem | null>(null)
  const [removeAllStudentsTarget, setRemoveAllStudentsTarget] = useState<ClassItem | null>(null)

  const [subjectForm, setSubjectForm] = useState<SubjectInput>(EMPTY_SUBJECT_FORM)
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<Subject | null>(null)

  const [staffForm, setStaffForm] = useState<StaffInput>(EMPTY_STAFF_FORM)
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [staffFormError, setStaffFormError] = useState<string | null>(null)

  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [assignmentTeacherId, setAssignmentTeacherId] = useState<number>(0)
  /** Checked classId:subjectId keys in the matrix editor */
  const [assignmentChecks, setAssignmentChecks] = useState<Set<string>>(() => new Set())
  const [assignmentSaving, setAssignmentSaving] = useState(false)

  const [yearFilter, setYearFilter] = useState(academicYearFilter ?? overviewStats.academicYear)
  const [importBusy, setImportBusy] = useState(false)
  const [teacherImportBusy, setTeacherImportBusy] = useState(false)
  const [notifStatus, setNotifStatus] = useState<NotificationStatus | 'ALL'>('ALL')
  const [notifEvent, setNotifEvent] = useState<NotificationEventType | 'ALL'>('ALL')

  const [settingsForm, setSettingsForm] = useState({
    name: schoolSettings.name,
    academicYear: schoolSettings.academicYear,
    principalName: schoolSettings.principalName ?? '',
    address: schoolSettings.address ?? '',
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(schoolSettings.logoUrl)

  const currentTab = controlledTab ?? tab

  const switchTab = (next: AdminTab) => {
    setTab(next)
    onTabChange?.(next)
  }

  const filteredStudents = useMemo(() => {
    let list = students
    if (studentClassFilter === 'UNASSIGNED') {
      list = list.filter((s) => s.classId == null)
    } else if (studentClassFilter !== 'ALL') {
      list = list.filter((s) => s.classId === studentClassFilter)
    }

    const q = query.trim().toLowerCase()
    if (!q) return list
    const qDigits = digitsOnly(query)
    return list.filter(
      (s) =>
        s.nameAr.includes(query.trim()) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.id.includes(query.trim()) ||
        s.parentPhone.includes(query.trim()) ||
        (qDigits.length >= 3 && digitsOnly(s.parentPhone).includes(qDigits))
    )
  }, [students, query, studentClassFilter])

  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? null
  const studentEnrollments = enrollments.filter((e) => e.studentId === selectedStudentId)
  const filteredClasses = classes.filter((c) => c.academicYear === yearFilter)
  const currentYearClasses = classes.filter((c) => c.academicYear === overviewStats.academicYear)
  const academicYears = [...new Set(classes.map((c) => c.academicYear))]
  const activeTeachers = staff.filter((u) => u.role === 'TEACHER' && u.isActive)

  const filteredNotifications = notifications.filter((n) => {
    if (notifStatus !== 'ALL' && n.status !== notifStatus) return false
    if (notifEvent !== 'ALL' && n.eventType !== notifEvent) return false
    return true
  })

  function openAddStudent() {
    setStudentFormError(null)
    setEditingStudentId(null)
    setStudentForm({
      ...EMPTY_STUDENT_FORM,
      classId: currentYearClasses[0]?.id ?? classes[0]?.id ?? 0,
    })
    setShowStudentModal(true)
  }

  function openEditStudent(s: Student) {
    setStudentFormError(null)
    setEditingStudentId(s.id)
    setStudentForm({
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      classId: s.classId,
      parentPhone: s.parentPhone,
      parentEmail: s.parentEmail,
      waOptedIn: s.waOptedIn,
    })
    setShowStudentModal(true)
  }

  function submitStudentForm() {
    if (!studentForm.id.trim() || !studentForm.nameAr.trim() || !studentForm.parentPhone.trim()) {
      setStudentFormError('يرجى تعبئة رقم الهوية والاسم بالعربية وجوال ولي الأمر.')
      return
    }
    if (!looksLikeSaudiPhone(studentForm.parentPhone)) {
      setStudentFormError('صيغة الجوال غير معروفة. الصيغة المتوقعة: +9665XXXXXXXX')
      return
    }
    onSaveStudent?.({
      ...studentForm,
      id: studentForm.id.trim(),
      nameAr: studentForm.nameAr.trim(),
      nameEn: studentForm.nameEn.trim() || studentForm.nameAr.trim(),
      parentPhone: studentForm.parentPhone.trim(),
      parentEmail: studentForm.parentEmail?.trim() || null,
    })
    setShowStudentModal(false)
  }

  function openAddClass() {
    setEditingClassId(null)
    setClassForm({ ...EMPTY_CLASS_FORM, academicYear: overviewStats.academicYear })
    setShowClassModal(true)
  }

  function openEditClass(c: (typeof classes)[number]) {
    setEditingClassId(c.id)
    setClassForm({
      name: c.name,
      gradeLevel: c.gradeLevel,
      section: c.section,
      academicYear: c.academicYear,
    })
    setShowClassModal(true)
  }

  function submitClassForm() {
    if (!classForm.name.trim() || !classForm.gradeLevel.trim() || !classForm.academicYear.trim()) return
    onSaveClass?.({
      ...classForm,
      id: editingClassId ?? undefined,
      name: classForm.name.trim(),
      gradeLevel: classForm.gradeLevel.trim(),
      section: classForm.section?.trim() || null,
    })
    setShowClassModal(false)
  }

  function openAddSubject() {
    setEditingSubjectId(null)
    setSubjectForm(EMPTY_SUBJECT_FORM)
    setShowSubjectModal(true)
  }

  function openEditSubject(s: (typeof subjects)[number]) {
    setEditingSubjectId(s.id)
    setSubjectForm({ nameAr: s.nameAr, nameEn: s.nameEn })
    setShowSubjectModal(true)
  }

  function assignmentCountForSubject(subjectId: number) {
    return assignments.filter((a) => a.subjectId === subjectId).length
  }

  function submitSubjectForm() {
    if (!subjectForm.nameAr.trim() || !subjectForm.nameEn.trim()) return
    onSaveSubject?.({
      ...subjectForm,
      id: editingSubjectId ?? undefined,
      nameAr: subjectForm.nameAr.trim(),
      nameEn: subjectForm.nameEn.trim(),
    })
    setShowSubjectModal(false)
  }

  function openAddStaff() {
    setStaffFormError(null)
    setStaffForm({ ...EMPTY_STAFF_FORM })
    setShowStaffModal(true)
  }

  async function submitStaffForm() {
    if (!staffForm.name.trim() || !staffForm.email.trim()) {
      setStaffFormError('الاسم والبريد مطلوبان.')
      return
    }
    const password = staffForm.password?.trim() ?? ''
    if (password.length < 8) {
      setStaffFormError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
      return
    }
    setStaffFormError(null)
    try {
      await onCreateStaff?.({
        ...staffForm,
        name: staffForm.name.trim(),
        email: staffForm.email.trim(),
        password,
        phone: staffForm.phone?.trim() || null,
      })
      setShowStaffModal(false)
    } catch {
      setStaffFormError('تعذّر حفظ الموظف — راجع البيانات أو جرّب بريداً آخر.')
    }
  }

  function pairKey(classId: number, subjectId: number) {
    return `${classId}:${subjectId}`
  }

  const assignmentOwnerByPair = useMemo(() => {
    const map = new Map<string, { teacherId: number; teacherName: string }>()
    for (const a of assignments) {
      map.set(pairKey(a.classId, a.subjectId), {
        teacherId: a.teacherId,
        teacherName: a.teacherName,
      })
    }
    return map
  }, [assignments])

  function loadChecksForTeacher(teacherId: number) {
    const next = new Set<string>()
    for (const a of assignments) {
      if (a.teacherId === teacherId && currentYearClasses.some((c) => c.id === a.classId)) {
        next.add(pairKey(a.classId, a.subjectId))
      }
    }
    setAssignmentChecks(next)
  }

  function openAddAssignment(teacherId?: number) {
    const tid = teacherId ?? activeTeachers[0]?.id ?? 0
    setAssignmentTeacherId(tid)
    loadChecksForTeacher(tid)
    setShowAssignmentModal(true)
  }

  function toggleAssignmentCell(classId: number, subjectId: number) {
    const key = pairKey(classId, subjectId)
    setAssignmentChecks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function submitAssignmentForm() {
    if (!assignmentTeacherId || currentYearClasses.length === 0) return
    const items: AssignmentSyncInput['items'] = []
    for (const key of assignmentChecks) {
      const [classId, subjectId] = key.split(':').map(Number)
      if (currentYearClasses.some((c) => c.id === classId)) {
        items.push({ classId, subjectId })
      }
    }
    setAssignmentSaving(true)
    try {
      await onSyncAssignments?.({
        teacherId: assignmentTeacherId,
        classIds: currentYearClasses.map((c) => c.id),
        items,
      })
      setShowAssignmentModal(false)
    } finally {
      setAssignmentSaving(false)
    }
  }

  function submitSettingsForm() {
    if (!settingsForm.name.trim() || !settingsForm.academicYear.trim()) return
    onSaveSchoolSettings?.({
      name: settingsForm.name.trim(),
      academicYear: settingsForm.academicYear.trim(),
      principalName: settingsForm.principalName.trim() || null,
      address: settingsForm.address.trim() || null,
    })
  }

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    onUploadSchoolLogo?.(file)
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
      style={fontArabic}
    >
      <div className="hidden border-b border-slate-300 px-4 py-6 print:block">
        <div className="flex items-center gap-4">
          {schoolSettings.logoUrl ? (
            <img
              src={schoolSettings.logoUrl}
              alt={schoolSettings.name}
              className="size-16 shrink-0 rounded object-contain"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded bg-slate-100">
              <Building2 className="size-8 text-slate-400" strokeWidth={1.5} />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{schoolSettings.name}</h1>
            {schoolSettings.principalName && (
              <p className="text-sm text-slate-700">مدير المدرسة: {schoolSettings.principalName}</p>
            )}
            {schoolSettings.address && <p className="text-sm text-slate-700">{schoolSettings.address}</p>}
            <p className="text-sm text-slate-700">العام الدراسي {schoolSettings.academicYear}</p>
          </div>
        </div>
      </div>

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
            <p className="text-xs text-slate-500 dark:text-slate-400">
              منصة إدارة المدرسة
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
              الإدارة المدرسية
            </h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              العام الدراسي {overviewStats.academicYear} · الطلاب والموظفون والهيكل وسجل الإرسال
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPrint?.(currentTab === 'students' ? 'roster' : 'overview')}
            className={buttonVariants({ variant: 'secondary', className: 'print:hidden' })}
          >
            <Printer className="size-4" strokeWidth={1.5} aria-hidden="true" />
            طباعة
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100/90 print:hidden">
        <div className="flex gap-1 overflow-x-auto px-2 sm:px-4" role="tablist" aria-label="أقسام الإدارة">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={currentTab === t.id}
              onClick={() => switchTab(t.id)}
              className={cn(
                'shrink-0 border-b-2 px-3 py-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none',
                currentTab === t.id
                  ? 'border-blue-600 font-semibold text-blue-700 dark:text-blue-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {currentTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  {
                    label: 'الطلاب النشطون',
                    value: overviewStats.activeStudents,
                    tone: 'blue' as Tone,
                    icon: GraduationCap,
                  },
                  {
                    label: 'الموظفون',
                    value: overviewStats.staffCount,
                    tone: 'emerald' as Tone,
                    icon: Users,
                  },
                  {
                    label: 'فصول العام الحالي',
                    value: overviewStats.classesThisYear,
                    tone: 'purple' as Tone,
                    icon: BookOpen,
                  },
                  {
                    label: 'رسائل فاشلة اليوم',
                    value: overviewStats.notificationsFailedToday,
                    tone: 'red' as Tone,
                    icon: Bell,
                    alert: overviewStats.notificationsFailedToday > 0,
                  },
                ] as const
              ).map((stat) => {
                const tone = TONE_CLASSES[stat.tone]
                const Icon = stat.icon
                const accentBorder =
                  'alert' in stat && stat.alert
                    ? 'border-s-red-500'
                    : stat.tone === 'blue'
                      ? 'border-s-blue-600'
                      : stat.tone === 'emerald'
                        ? 'border-s-emerald-600'
                        : stat.tone === 'purple'
                          ? 'border-s-purple-600'
                          : 'border-s-red-500'
                return (
                  <div
                    key={stat.label}
                    className={cn(
                      'rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 sm:p-6',
                      'border-s-4',
                      accentBorder
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                        <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-50" style={fontMono}>
                          {stat.value}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex size-11 shrink-0 items-center justify-center rounded-xl',
                          tone.bg,
                          tone.text
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="size-5" strokeWidth={1.75} />
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100/40 dark:text-slate-400">
              استخدم التبويبات أعلاه لإدارة الطلاب والفصول والموظفين وتوزيع المعلمين واستيراد نور
              وسجل رسائل واتساب. يمكنك الطباعة من «نظرة عامة» أو «الطلاب».
            </div>
          </div>
        )}

        {currentTab === 'students' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    onSearchStudents?.(e.target.value)
                  }}
                  placeholder="ابحث بالاسم أو رقم الهوية/الإقامة أو جوال ولي الأمر…"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pe-3 ps-10 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      onSearchStudents?.('')
                    }}
                    aria-label="مسح البحث"
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <select
                value={studentClassFilter === 'ALL' ? 'ALL' : studentClassFilter === 'UNASSIGNED' ? 'UNASSIGNED' : String(studentClassFilter)}
                onChange={(e) => {
                  const v = e.target.value
                  setStudentClassFilter(v === 'ALL' ? 'ALL' : v === 'UNASSIGNED' ? 'UNASSIGNED' : Number(v))
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="ALL">كل الفصول</option>
                <option value="UNASSIGNED">بدون فصل</option>
                {currentYearClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openAddStudent}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800"
              >
                <UserPlus className="size-4" strokeWidth={1.5} />
                إضافة طالب
              </button>
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 md:block">
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">الطالب</th>
                    <th className="px-3 py-2 font-medium">رقم الهوية/الإقامة</th>
                    <th className="px-3 py-2 font-medium">الفصل</th>
                    <th className="px-3 py-2 font-medium">ولي الأمر</th>
                    <th className="px-3 py-2 font-medium">واتساب</th>
                    <th className="px-3 py-2 font-medium">الحالة</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-start hover:text-blue-700 dark:hover:text-blue-300"
                          onClick={() => {
                            setSelectedStudentId(s.id)
                            onSelectStudent?.(s.id)
                          }}
                        >
                          <div className="font-semibold">{s.nameAr}</div>
                          <div className="text-xs text-slate-500">{s.nameEn}</div>
                        </button>
                      </td>
                      <td className="px-3 py-2" style={fontMono}>
                        {s.id}
                      </td>
                      <td className="px-3 py-2">
                        {s.className ?? <span className="text-slate-400">بدون فصل</span>}
                      </td>
                      <td className="px-3 py-2" style={fontMono}>
                        {s.parentPhone}
                      </td>
                      <td className="px-3 py-2">
                        {s.waOptedIn ? (
                          <CheckCircle2 className="size-4 text-blue-600" />
                        ) : (
                          <Ban className="size-4 text-slate-400" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            s.isActive
                              ? 'bg-blue-500/15 text-blue-800 dark:text-blue-300'
                              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          )}
                        >
                          {s.isActive ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-end">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="text-xs text-slate-600 underline hover:text-slate-900 dark:text-slate-300"
                            onClick={() => openEditStudent(s)}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="text-xs text-slate-600 underline hover:text-slate-900 dark:text-slate-300"
                            onClick={() => setPromoteFor(s)}
                          >
                            نقل
                          </button>
                          {s.classId != null && (
                            <button
                              type="button"
                              className="text-xs text-slate-600 underline hover:text-slate-900 dark:text-slate-300"
                              onClick={() => onUnassignStudent?.(s.id)}
                            >
                              إزالة من الفصل
                            </button>
                          )}
                          {s.isActive && (
                            <button
                              type="button"
                              className="text-xs text-red-600 underline"
                              onClick={() => setConfirmRemove(s)}
                            >
                              استبعاد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStudents.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">لا يوجد طلاب مطابقون لبحثك.</p>
              )}
            </div>

            <div className="space-y-3 md:hidden">
              {filteredStudents.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                >
                  <button
                    type="button"
                    className="w-full text-start"
                    onClick={() => {
                      setSelectedStudentId(s.id)
                      onSelectStudent?.(s.id)
                    }}
                  >
                    <div className="text-lg font-bold">{s.nameAr}</div>
                    <div className="text-sm text-slate-500">{s.nameEn}</div>
                    <div className="mt-2 text-xs text-slate-500" style={fontMono}>
                      {s.id} · {s.parentPhone}
                    </div>
                    <div className="mt-1 text-sm">
                      {s.className ?? <span className="text-slate-400">بدون فصل</span>}
                    </div>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button type="button" className="text-xs underline" onClick={() => openEditStudent(s)}>
                      تعديل
                    </button>
                    <button type="button" className="text-xs underline" onClick={() => setPromoteFor(s)}>
                      نقل
                    </button>
                    {s.classId != null && (
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => onUnassignStudent?.(s.id)}
                      >
                        إزالة من الفصل
                      </button>
                    )}
                    {s.isActive && (
                      <button
                        type="button"
                        className="text-xs text-red-600 underline"
                        onClick={() => setConfirmRemove(s)}
                      >
                        استبعاد
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">لا يوجد طلاب مطابقون لبحثك.</p>
              )}
            </div>
          </div>
        )}

        {currentTab === 'classes' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h2 className="text-lg font-bold">الفصول</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {academicYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={openAddClass}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus className="size-3.5" strokeWidth={2} />
                    فصل جديد
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredClasses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-slate-500">
                        الصف {c.gradeLevel}
                        {c.section ? ` · شعبة ${c.section}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-slate-500" style={fontMono}>
                        {c.studentCount} طالباً
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditClass(c)}
                        aria-label={`تعديل ${c.name}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Pencil className="size-4" strokeWidth={1.5} />
                      </button>
                      {c.studentCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setRemoveAllStudentsTarget(c)}
                          aria-label={`إزالة جميع طلاب ${c.name} من الفصل`}
                          className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40 dark:hover:text-amber-400"
                        >
                          <Users className="size-4" strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteClassTarget(c)}
                        aria-label={`حذف ${c.name}`}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Trash2 className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </li>
                ))}
                {filteredClasses.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-slate-500">
                    لا توجد فصول لهذا العام الدراسي.
                  </li>
                )}
              </ul>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h2 className="text-lg font-bold">المواد</h2>
                <button
                  type="button"
                  onClick={openAddSubject}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="size-3.5" strokeWidth={2} />
                  مادة جديدة
                </button>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {subjects.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <span className="font-semibold">{s.nameAr}</span>
                      <span className="ms-2 text-slate-500">{s.nameEn}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditSubject(s)}
                        aria-label={`تعديل ${s.nameAr}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Pencil className="size-4" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteSubjectTarget(s)}
                        aria-label={`حذف ${s.nameAr}`}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Trash2 className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </li>
                ))}
                {subjects.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-slate-500">لا توجد مواد بعد.</li>
                )}
              </ul>
            </section>
          </div>
        )}

        {currentTab === 'staff' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={openAddStaff}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <UserPlus className="size-4" strokeWidth={1.5} />
                إضافة موظف
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">الاسم</th>
                    <th className="hidden px-3 py-2 text-start font-medium sm:table-cell">
                      البريد الإلكتروني
                    </th>
                    <th className="px-3 py-2 text-start font-medium">الدور</th>
                    <th className="px-3 py-2 text-start font-medium">الحالة</th>
                    <th className="px-3 py-2 text-end font-medium">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 font-semibold">{u.name}</td>
                      <td className="hidden px-3 py-2 text-slate-500 sm:table-cell">{u.email}</td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', roleBadge(u.role))}>
                          {ROLE_AR[u.role]}
                        </span>
                      </td>
                      <td className="px-3 py-2">{u.isActive ? 'نشط' : 'معطّل'}</td>
                      <td className="px-3 py-2 text-end">
                        {u.isActive ? (
                          <button
                            type="button"
                            className="text-xs text-red-600 underline"
                            onClick={() => onDeactivateStaff?.(u.id)}
                          >
                            تعطيل
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-blue-700 underline dark:text-blue-300"
                            onClick={() => onActivateStaff?.(u.id)}
                          >
                            إعادة تفعيل
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentTab === 'assignments' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                عيّن للمعلم عدة فصول ومواد دفعة واحدة من شبكة التوزيع.
              </p>
              <button
                type="button"
                onClick={() => openAddAssignment()}
                disabled={activeTeachers.length === 0 || subjects.length === 0 || currentYearClasses.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" strokeWidth={2} />
                توزيع معلم (متعدد)
              </button>
            </div>
            {assignments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                لا يوجد توزيع معلمين بعد.
              </p>
            ) : (
              (() => {
                const byTeacher = new Map<
                  number,
                  { teacherId: number; teacherName: string; items: typeof assignments }
                >()
                for (const a of assignments) {
                  if (!byTeacher.has(a.teacherId)) {
                    byTeacher.set(a.teacherId, {
                      teacherId: a.teacherId,
                      teacherName: a.teacherName,
                      items: [],
                    })
                  }
                  byTeacher.get(a.teacherId)!.items.push(a)
                }
                return [...byTeacher.values()].map((group) => (
                  <div
                    key={group.teacherId}
                    className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                      <div>
                        <div className="font-semibold">{group.teacherName}</div>
                        <div className="text-xs text-slate-500">
                          {group.items.length} توزيعًا
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                        onClick={() => openAddAssignment(group.teacherId)}
                      >
                        تعديل التوزيع
                      </button>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                      {group.items.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                        >
                          <div className="text-sm">
                            {a.className} · {a.subjectNameAr}
                          </div>
                          <button
                            type="button"
                            className="text-xs text-red-600 underline"
                            onClick={() => onRemoveAssignment?.(a.id)}
                          >
                            إزالة
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              })()
            )}
          </div>
        )}

        {currentTab === 'import' && (
          <div className="space-y-6">
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <Upload className="mx-auto size-8 text-blue-600" strokeWidth={1.5} />
              <p className="mt-3 font-semibold">استيراد الطلاب من نور</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                ملف StudentGuidance / إرشاد الطلاب (.xlsx) — يُنشئ الفصول تلقائيًا من عمودي
                «رقم الصف» و«الفصل» ويعين الطلاب عليها
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs text-slate-400 dark:text-slate-500">
                الأعمدة: رقم الطالب · اسم الطالب · الجوال · رقم الصف · الفصل · العام:{' '}
                {overviewStats.academicYear}
              </p>

              <label
                className={cn(
                  'mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700',
                  importBusy && 'cursor-not-allowed opacity-50'
                )}
              >
                {importBusy ? 'جارٍ الاستيراد…' : 'اختيار ملف الطلاب'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={importBusy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file || !onImportStudents) return
                    setImportBusy(true)
                    try {
                      await onImportStudents(file)
                    } finally {
                      setImportBusy(false)
                    }
                  }}
                />
              </label>
            </div>

            {importResult && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
                <h3 className="font-bold">آخر استيراد طلاب: {importResult.fileName}</h3>
                {importResult.academicYear && (
                  <p className="mt-1 text-xs text-slate-500">
                    العام الدراسي: {importResult.academicYear}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['أُضيف طلاب', importResult.created],
                    ['حُدّث', importResult.updated],
                    ['أُعيد تفعيله', importResult.reactivated],
                    ['تم تجاوزه', importResult.skipped],
                    ['فصول جديدة', importResult.classesCreated ?? 0],
                    ['فصول موجودة', importResult.classesReused ?? 0],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded bg-slate-100 p-3 dark:bg-slate-900">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="text-xl font-bold" style={fontMono}>
                        {value as number}
                      </div>
                    </div>
                  ))}
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                    {importResult.errors.map((err) => (
                      <li
                        key={`${err.index}-${err.id}`}
                        className="flex gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <span>
                          السطر {err.index + 1} ({err.id}): {err.error}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <Upload className="mx-auto size-8 text-emerald-600" strokeWidth={1.5} />
              <p className="mt-3 font-semibold">استيراد المعلمين من نور</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                ملف GetSchoolTeachersDataReport (.xlsx) — يُنشئ حسابات معلّمين من الاسم والبريد
                والجوال فقط
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs text-slate-400 dark:text-slate-500">
                لا يُستورد عنوان السكن أو بيانات الأسرة. الحسابات الجديدة تستخدم كلمة المرور
                الافتراضية المعروضة بعد الاستيراد.
              </p>

              <label
                className={cn(
                  'mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700',
                  teacherImportBusy && 'cursor-not-allowed opacity-50'
                )}
              >
                {teacherImportBusy ? 'جارٍ الاستيراد…' : 'اختيار ملف المعلمين'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={teacherImportBusy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file || !onImportTeachers) return
                    setTeacherImportBusy(true)
                    try {
                      await onImportTeachers(file)
                    } finally {
                      setTeacherImportBusy(false)
                    }
                  }}
                />
              </label>
            </div>

            {teacherImportResult && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
                <h3 className="font-bold">آخر استيراد معلمين: {teacherImportResult.fileName}</h3>
                {teacherImportResult.defaultPassword && (
                  <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    كلمة المرور للحسابات الجديدة:{' '}
                    <span className="font-mono font-bold">{teacherImportResult.defaultPassword}</span>
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ['أُضيف معلمون', teacherImportResult.created],
                    ['حُدّث', teacherImportResult.updated],
                    ['أُعيد تفعيله', teacherImportResult.reactivated],
                    ['تم تجاوزه', teacherImportResult.skipped],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded bg-slate-100 p-3 dark:bg-slate-900">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="text-xl font-bold" style={fontMono}>
                        {value as number}
                      </div>
                    </div>
                  ))}
                </div>
                {teacherImportResult.errors.length > 0 && (
                  <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                    {teacherImportResult.errors.map((err) => (
                      <li
                        key={`t-${err.index}-${err.id}`}
                        className="flex gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <span>
                          السطر {err.index + 1} ({err.id}): {err.error}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <h3 className="mb-2 font-bold">عمليات استيراد الطلاب السابقة</h3>
              <ul className="space-y-2">
                {importBatches.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <div className="font-semibold">{b.fileName}</div>
                    <div className="text-slate-500">
                      {b.importerName} · {new Date(b.importedAt).toLocaleString('ar-SA')} ·{' '}
                      {b.rowCount} سطراً
                    </div>
                  </li>
                ))}
                {importBatches.length === 0 && (
                  <li className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
                    لا توجد عمليات استيراد سابقة.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {currentTab === 'notifications' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <select
                value={notifStatus}
                onChange={(e) => {
                  const v = e.target.value as NotificationStatus | 'ALL'
                  setNotifStatus(v)
                  onFilterNotifications?.({ status: v, eventType: notifEvent })
                }}
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="ALL">كل الحالات</option>
                {(['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'] as const).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_AR[s]}
                  </option>
                ))}
              </select>
              <select
                value={notifEvent}
                onChange={(e) => {
                  const v = e.target.value as NotificationEventType | 'ALL'
                  setNotifEvent(v)
                  onFilterNotifications?.({ status: notifStatus, eventType: v })
                }}
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="ALL">كل الأحداث</option>
                {(['ABSENCE', 'LATE', 'HOMEWORK_DIGEST', 'WEEKLY_PLAN'] as const).map((s) => (
                  <option key={s} value={s}>
                    {EVENT_AR[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredNotifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      'px-4 py-3 text-sm',
                      n.status === 'FAILED' && 'bg-red-50/80 dark:bg-red-950/30'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold">{n.studentName}</span>
                        <span className="mx-2 text-slate-400">·</span>
                        <span className="text-slate-500">{EVENT_AR[n.eventType]}</span>
                      </div>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs', statusBadge(n.status))}>
                        {STATUS_AR[n.status]}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500" style={fontMono}>
                      {n.parentPhone}
                      {n.sentAt
                        ? ` · ${new Date(n.sentAt).toLocaleString('ar-SA')}`
                        : ' · لم يُرسل'}
                    </div>
                    {n.errorMessage && (
                      <p className="mt-1 text-xs text-red-700 dark:text-red-300">{n.errorMessage}</p>
                    )}
                  </li>
                ))}
                {filteredNotifications.length === 0 && (
                  <li className="px-4 py-8 text-center text-slate-500">
                    لا توجد رسائل مطابقة للتصفية.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {currentTab === 'settings' && (
          <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
            <h2 className="text-lg font-bold">بيانات المدرسة</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              تظهر هذه البيانات في رأس التقارير المطبوعة (كشوف الطلاب، النظرة العامة، وغيرها).
            </p>

            <div className="mt-4 flex items-center gap-4">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="شعار المدرسة"
                  className="size-16 shrink-0 rounded-md border border-slate-200 object-contain dark:border-slate-700"
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                  <Building2 className="size-7 text-slate-400" strokeWidth={1.5} />
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800">
                <Upload className="size-4" strokeWidth={1.5} />
                تحميل شعار جديد
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
            </div>

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                submitSettingsForm()
              }}
            >
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">اسم المدرسة</span>
                <input
                  required
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, name: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">العام الدراسي</span>
                <input
                  required
                  value={settingsForm.academicYear}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, academicYear: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  style={fontMono}
                  placeholder="2026-2027"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">اسم مدير المدرسة (اختياري)</span>
                <input
                  value={settingsForm.principalName}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, principalName: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">عنوان المدرسة (اختياري)</span>
                <input
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, address: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 z-40 flex justify-start print:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="إغلاق"
            onClick={() => setSelectedStudentId(null)}
          />
          <aside className="relative z-50 flex h-full w-full max-w-md flex-col border-e border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <div className="flex items-start justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-2xl font-bold">{selectedStudent.nameAr}</h2>
                <p className="text-slate-500">{selectedStudent.nameEn}</p>
                <p className="mt-1 text-xs" style={fontMono}>
                  {selectedStudent.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="إغلاق"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedStudent.classId == null ? 'بدون فصل' : selectedStudent.className} · ولي
                  الأمر {selectedStudent.parentPhone}
                </p>
                <button
                  type="button"
                  className="shrink-0 text-xs text-blue-700 underline dark:text-blue-300"
                  onClick={() => {
                    setSelectedStudentId(null)
                    openEditStudent(selectedStudent)
                  }}
                >
                  تعديل البيانات
                </button>
              </div>
              <h3 className="mt-6 mb-2 font-bold">سجل الالتحاق بالفصول</h3>
              <ul className="space-y-2">
                {studentEnrollments.map((e) => (
                  <li
                    key={e.id}
                    className="rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                  >
                    <div className="font-semibold">{e.className}</div>
                    <div className="text-xs text-slate-500">
                      {e.academicYear} · من {e.startDate} {e.endDate ? `إلى ${e.endDate}` : '— الحالي'}
                    </div>
                  </li>
                ))}
                {studentEnrollments.length === 0 && (
                  <li className="text-sm text-slate-500">لا يوجد سجل التحاق لهذا الطالب في العينة.</li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      )}

      <Modal
        open={showStudentModal}
        onClose={() => setShowStudentModal(false)}
        title={editingStudentId ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
        description="أدخل بيانات الطالب وولي الأمر"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            submitStudentForm()
          }}
        >
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">رقم الهوية/الإقامة</span>
            <input
              required
              disabled={!!editingStudentId}
              value={studentForm.id}
              onChange={(e) => setStudentForm((s) => ({ ...s, id: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800"
              style={fontMono}
              placeholder="1099…"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">الاسم بالعربية</span>
            <input
              required
              value={studentForm.nameAr}
              onChange={(e) => setStudentForm((s) => ({ ...s, nameAr: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">الاسم بالإنجليزية</span>
            <input
              value={studentForm.nameEn}
              onChange={(e) => setStudentForm((s) => ({ ...s, nameEn: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">الفصل</span>
            <select
              value={studentForm.classId ?? ''}
              onChange={(e) =>
                setStudentForm((s) => ({
                  ...s,
                  classId: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">بدون فصل</option>
              {currentYearClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">جوال ولي الأمر</span>
            <input
              required
              value={studentForm.parentPhone}
              onChange={(e) => setStudentForm((s) => ({ ...s, parentPhone: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              style={fontMono}
              placeholder="+9665…"
              dir="ltr"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!studentForm.waOptedIn}
              onChange={(e) => setStudentForm((s) => ({ ...s, waOptedIn: e.target.checked }))}
              className="size-4 rounded border-slate-300 text-blue-600"
            />
            <span>الموافقة على رسائل واتساب</span>
          </label>
          {studentFormError && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {studentFormError}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              حفظ الطالب
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
              onClick={() => setShowStudentModal(false)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showClassModal}
        onClose={() => setShowClassModal(false)}
        title={editingClassId ? 'تعديل الفصل' : 'إضافة فصل جديد'}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            submitClassForm()
          }}
        >
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">اسم الفصل</span>
            <input
              required
              value={classForm.name}
              onChange={(e) => setClassForm((s) => ({ ...s, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="الصف الخامس - ج"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-400">الصف</span>
              <input
                required
                value={classForm.gradeLevel}
                onChange={(e) => setClassForm((s) => ({ ...s, gradeLevel: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="5"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-400">الشعبة (اختياري)</span>
              <input
                value={classForm.section ?? ''}
                onChange={(e) => setClassForm((s) => ({ ...s, section: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="ج"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">العام الدراسي</span>
            <input
              required
              value={classForm.academicYear}
              onChange={(e) => setClassForm((s) => ({ ...s, academicYear: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              style={fontMono}
              placeholder="2026-2027"
            />
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              حفظ الفصل
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
              onClick={() => setShowClassModal(false)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        title={editingSubjectId ? 'تعديل المادة' : 'إضافة مادة جديدة'}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            submitSubjectForm()
          }}
        >
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">اسم المادة بالعربية</span>
            <input
              required
              value={subjectForm.nameAr}
              onChange={(e) => setSubjectForm((s) => ({ ...s, nameAr: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">اسم المادة بالإنجليزية</span>
            <input
              required
              value={subjectForm.nameEn}
              onChange={(e) => setSubjectForm((s) => ({ ...s, nameEn: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              dir="ltr"
            />
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              حفظ المادة
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
              onClick={() => setShowSubjectModal(false)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteClassTarget}
        onClose={() => setDeleteClassTarget(null)}
        title="حذف الفصل؟"
        maxWidthClassName="max-w-sm"
      >
        {deleteClassTarget && (
          <>
            {deleteClassTarget.studentCount > 0 ? (
              <>
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  لا يمكن حذف <strong>{deleteClassTarget.name}</strong> لوجود{' '}
                  {deleteClassTarget.studentCount} طالباً فيه حالياً. يجب نقل جميع الطلاب إلى فصل آخر
                  من تبويب «الطلاب»، أو إزالتهم جميعاً من هذا الفصل، ثم إعادة المحاولة.
                </p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-800 underline dark:text-amber-300"
                  onClick={() => {
                    setRemoveAllStudentsTarget(deleteClassTarget)
                    setDeleteClassTarget(null)
                  }}
                >
                  <Users className="size-3.5" strokeWidth={1.5} />
                  إزالة جميع الطلاب من هذا الفصل بدلاً من حذفه
                </button>
              </>
            ) : !deleteClassTarget.canDelete ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                لا يمكن حذف <strong>{deleteClassTarget.name}</strong> رغم عدم وجود طلاب حالياً، لأن
                لديه سجلات تاريخية (التحاق سابق أو حضور أو واجبات أو خطط). الفصول ذات السجل تُحفظ
                عمداً ولا تُحذف.
              </p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                سيتم حذف <strong>{deleteClassTarget.name}</strong> نهائياً. لن يمكن التراجع عن هذا
                الإجراء.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!deleteClassTarget.canDelete}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  onRemoveClass?.(deleteClassTarget.id)
                  setDeleteClassTarget(null)
                }}
              >
                حذف الفصل
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
                onClick={() => setDeleteClassTarget(null)}
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!removeAllStudentsTarget}
        onClose={() => setRemoveAllStudentsTarget(null)}
        title="إزالة جميع الطلاب من الفصل؟"
        maxWidthClassName="max-w-sm"
      >
        {removeAllStudentsTarget && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              سيتم إزالة جميع طلاب <strong>{removeAllStudentsTarget.name}</strong> (
              {removeAllStudentsTarget.studentCount} طالباً) من هذا الفصل. هذا إجراء «إزالة من
              الفصل» فقط — <strong>لن يتم حذف أي طالب</strong>، وسيبقى سجلهم التاريخي كما هو. سينتقل
              جميع هؤلاء الطلاب إلى قائمة «بدون فصل» حتى تُعيد توزيعهم على فصول أخرى.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                onClick={() => {
                  onRemoveAllStudentsFromClass?.(removeAllStudentsTarget.id)
                  setRemoveAllStudentsTarget(null)
                }}
              >
                تأكيد الإزالة
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
                onClick={() => setRemoveAllStudentsTarget(null)}
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!deleteSubjectTarget}
        onClose={() => setDeleteSubjectTarget(null)}
        title="حذف المادة؟"
        maxWidthClassName="max-w-sm"
      >
        {deleteSubjectTarget && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              سيتم حذف <strong>{deleteSubjectTarget.nameAr}</strong> نهائياً. إذا كانت هذه المادة
              مرتبطة بواجبات أو خطط أسبوعية مسجلة، سيرفض النظام الحذف تلقائياً حفاظاً على السجلات
              التاريخية.
            </p>
            {assignmentCountForSubject(deleteSubjectTarget.id) > 0 && (
              <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                هذه المادة مستخدمة حالياً في {assignmentCountForSubject(deleteSubjectTarget.id)} من
                توزيعات المعلمين. حذفها سيؤدي إلى إزالة تلك التوزيعات تلقائياً من تبويب «توزيع
                المعلمين».
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  onRemoveSubject?.(deleteSubjectTarget.id)
                  setDeleteSubjectTarget(null)
                }}
              >
                حذف المادة
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
                onClick={() => setDeleteSubjectTarget(null)}
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        title="إضافة موظف جديد"
        description="المعلم أو المرشد أو الإدارة — كلمة المرور مطلوبة لتسجيل الدخول"
        maxWidthClassName="max-w-lg"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            submitStaffForm()
          }}
        >
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">الاسم الكامل</span>
            <input
              required
              value={staffForm.name}
              onChange={(e) => setStaffForm((s) => ({ ...s, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">البريد الإلكتروني</span>
            <input
              required
              type="email"
              value={staffForm.email}
              onChange={(e) => setStaffForm((s) => ({ ...s, email: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              dir="ltr"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">الدور</span>
            <select
              value={staffForm.role}
              onChange={(e) => setStaffForm((s) => ({ ...s, role: e.target.value as StaffRole }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {(['TEACHER', 'COUNSELOR', 'ADMIN'] as StaffRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_AR[r]}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50/80 p-3 dark:border-blue-800 dark:bg-blue-950/40">
            <label className="block text-sm">
              <span className="font-bold text-blue-900 dark:text-blue-100">
                كلمة المرور <span className="text-red-600">*</span>
              </span>
              <input
                required
                type="text"
                minLength={8}
                value={staffForm.password ?? ''}
                onChange={(e) => {
                  setStaffFormError(null)
                  setStaffForm((s) => ({ ...s, password: e.target.value }))
                }}
                className="mt-1 w-full rounded-md border border-blue-300 bg-white px-3 py-2.5 text-sm font-medium dark:border-blue-700 dark:bg-slate-900 dark:text-slate-100"
                dir="ltr"
                autoComplete="new-password"
                placeholder="Password123!"
              />
              <span className="mt-1 block text-xs text-blue-800/80 dark:text-blue-200/80">
                مطلوبة — 8 أحرف على الأقل (الافتراضي: Password123!)
              </span>
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              جوال الموظف (اختياري)
            </span>
            <input
              value={staffForm.phone ?? ''}
              onChange={(e) => setStaffForm((s) => ({ ...s, phone: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              style={fontMono}
              placeholder="+9665…"
              dir="ltr"
            />
          </label>
          {staffFormError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {staffFormError}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              حفظ الموظف
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
              onClick={() => setShowStaffModal(false)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        title="توزيع معلم على فصول ومواد"
        description="كل فصل×مادة لمعلم واحد فقط. الخلية المسندة لمعلم آخر تظهر اسمه — تحديدها يعيد التعيين عند الحفظ."
        maxWidthClassName="max-w-5xl"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submitAssignmentForm()
          }}
        >
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">المعلم</span>
            <select
              value={assignmentTeacherId}
              onChange={(e) => {
                const tid = Number(e.target.value)
                setAssignmentTeacherId(tid)
                loadChecksForTeacher(tid)
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {activeTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
                  <tr>
                    <th className="sticky end-0 bg-slate-100 px-3 py-2 text-start font-semibold dark:bg-slate-900">
                      الفصل
                    </th>
                    {subjects.map((s) => (
                      <th
                        key={s.id}
                        className="min-w-[5.5rem] px-2 py-2 text-center font-medium"
                        title={s.nameEn}
                      >
                        {s.nameAr}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentYearClasses.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="sticky end-0 bg-white px-3 py-2 font-medium dark:bg-slate-800">
                        {c.name}
                      </td>
                      {subjects.map((s) => {
                        const key = pairKey(c.id, s.id)
                        const checked = assignmentChecks.has(key)
                        const owner = assignmentOwnerByPair.get(key)
                        const ownedByOther =
                          !!owner && owner.teacherId !== assignmentTeacherId && !checked
                        const willReassign =
                          checked && !!owner && owner.teacherId !== assignmentTeacherId
                        return (
                          <td
                            key={s.id}
                            className={cn(
                              'px-2 py-2 text-center align-middle',
                              ownedByOther && 'bg-amber-50 dark:bg-amber-950/30',
                              willReassign && 'bg-sky-50 dark:bg-sky-950/30'
                            )}
                          >
                            <label className="inline-flex flex-col items-center gap-0.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleAssignmentCell(c.id, s.id)}
                                className="size-4 accent-blue-600"
                                aria-label={`${c.name} — ${s.nameAr}`}
                              />
                              {ownedByOther && (
                                <span
                                  className="max-w-[5.5rem] truncate text-[10px] leading-tight text-amber-800 dark:text-amber-200"
                                  title={`مسندة إلى ${owner.teacherName}`}
                                >
                                  {owner.teacherName}
                                </span>
                              )}
                              {willReassign && (
                                <span className="text-[10px] leading-tight text-sky-700 dark:text-sky-300">
                                  إعادة تعيين
                                </span>
                              )}
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            المحدّد: {assignmentChecks.size} · الخلية الصفراء = معلم آخر · تحديدها ثم الحفظ ينقل
            المادة لهذا المعلم. إلغاء التحديد يحذف توزيع هذا المعلم فقط.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={assignmentSaving || !assignmentTeacherId}
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {assignmentSaving ? 'جارٍ الحفظ…' : 'حفظ التوزيع'}
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
              onClick={() => setShowAssignmentModal(false)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!promoteFor}
        onClose={() => setPromoteFor(null)}
        title="نقل الطالب إلى فصل آخر"
        description={promoteFor ? `اختر الفصل الجديد للطالب: ${promoteFor.nameAr}` : undefined}
        maxWidthClassName="max-w-sm"
      >
        <div className="space-y-2">
          {promoteFor &&
            classes
              .filter((c) => c.academicYear === overviewStats.academicYear && c.id !== promoteFor.classId)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-blue-950/30"
                  onClick={() => {
                    onPromoteStudent?.(promoteFor.id, c.id)
                    setPromoteFor(null)
                  }}
                >
                  {c.name}
                </button>
              ))}
          {promoteFor &&
            classes.filter(
              (c) => c.academicYear === overviewStats.academicYear && c.id !== promoteFor.classId
            ).length === 0 && (
              <p className="text-sm text-slate-500">لا توجد فصول أخرى متاحة لهذا العام الدراسي.</p>
            )}
        </div>
        <button
          type="button"
          className="mt-4 w-full text-sm text-slate-500 underline"
          onClick={() => setPromoteFor(null)}
        >
          إلغاء
        </button>
      </Modal>

      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="استبعاد من القائمة النشطة؟"
        maxWidthClassName="max-w-sm"
      >
        {confirmRemove && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              سيتم استبعاد <strong>{confirmRemove.nameAr}</strong> من القائمة النشطة مع الإبقاء على
              سجله التاريخي في النظام.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  onSoftRemoveStudent?.(confirmRemove.id)
                  setConfirmRemove(null)
                }}
              >
                تأكيد الاستبعاد
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
                onClick={() => setConfirmRemove(null)}
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default AdminDashboard
