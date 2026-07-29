import { apiRequest } from './client'
import type {
  AssignmentInput,
  ClassEnrollment,
  ClassInput,
  ClassItem,
  ImportBatch,
  ImportResult,
  SchoolSettings,
  Staff,
  StaffInput,
  Student,
  StudentInput,
  Subject,
  SubjectInput,
  TeacherAssignment,
} from '../sections/school-administration/types'

type ApiStudent = {
  id: string
  nameAr: string
  nameEn: string
  classId: number | null
  parentPhone: string
  parentEmail: string | null
  waOptedIn: boolean
  isActive: boolean
  class: { id: number; name: string; academicYear: string } | null
}

type ApiClass = {
  id: number
  name: string
  gradeLevel: string
  section: string | null
  academicYear: string
  _count?: {
    students: number
    assignments?: number
    attendance?: number
    homework?: number
    lateReports?: number
    weeklyPlans?: number
    enrollments?: number
  }
}

type ApiUser = {
  id: number
  name: string
  email: string
  phone: string | null
  role: Staff['role']
  langPref: Staff['langPref']
  isActive: boolean
}

type ApiAssignment = {
  id: number
  teacherId: number
  classId: number
  subjectId: number
  teacher: { id: number; name: string }
  class: { id: number; name: string }
  subject: { id: number; nameAr: string; nameEn: string }
}

type ApiEnrollment = {
  id: number
  studentId: string
  academicYear: string
  startDate: string
  endDate: string | null
  class: { name: string }
  changer: { name: string } | null
}

type ApiBatch = {
  id: number
  fileName: string | null
  rowCount: number
  importedAt: string
  importer: { name: string }
  _count: { students: number }
}

function mapStudent(s: ApiStudent): Student {
  return {
    id: s.id,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    classId: s.classId,
    className: s.class?.name ?? null,
    parentPhone: s.parentPhone,
    parentEmail: s.parentEmail,
    waOptedIn: s.waOptedIn,
    isActive: s.isActive,
  }
}

function mapClass(c: ApiClass): ClassItem {
  const students = c._count?.students ?? 0
  const history =
    (c._count?.attendance ?? 0) +
    (c._count?.homework ?? 0) +
    (c._count?.lateReports ?? 0) +
    (c._count?.weeklyPlans ?? 0) +
    (c._count?.enrollments ?? 0)
  return {
    id: c.id,
    name: c.name,
    gradeLevel: c.gradeLevel,
    section: c.section,
    academicYear: c.academicYear,
    studentCount: students,
    canDelete: students === 0 && history === 0,
  }
}

function mapStaff(u: ApiUser): Staff {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    langPref: u.langPref,
    isActive: u.isActive,
  }
}

function mapAssignment(a: ApiAssignment): TeacherAssignment {
  return {
    id: a.id,
    teacherId: a.teacherId,
    teacherName: a.teacher.name,
    classId: a.classId,
    className: a.class.name,
    subjectId: a.subjectId,
    subjectNameEn: a.subject.nameEn,
    subjectNameAr: a.subject.nameAr,
  }
}

function mapEnrollment(e: ApiEnrollment): ClassEnrollment {
  return {
    id: e.id,
    studentId: e.studentId,
    className: e.class.name,
    academicYear: e.academicYear,
    startDate: e.startDate,
    endDate: e.endDate,
    changedByName: e.changer?.name ?? null,
  }
}

function mapBatch(b: ApiBatch): ImportBatch {
  return {
    id: b.id,
    fileName: b.fileName,
    rowCount: b.rowCount,
    importedAt: b.importedAt,
    importerName: b.importer.name,
    created: b._count.students,
    updated: 0,
    reactivated: 0,
    skipped: 0,
  }
}

export async function getSchoolSettings() {
  const data = await apiRequest<{ schoolSettings: SchoolSettings | null }>('/school-settings')
  return (
    data.schoolSettings ?? {
      name: 'منصة إدارة المدرسة',
      logoUrl: null,
      academicYear: '2026-2027',
      principalName: null,
      educationAdminName: null,
      address: null,
    }
  )
}

export async function saveSchoolSettings(settings: Omit<SchoolSettings, 'logoUrl'>) {
  const data = await apiRequest<{ schoolSettings: SchoolSettings }>('/school-settings', {
    method: 'PATCH',
    body: settings,
  })
  return data.schoolSettings
}

export async function uploadSchoolLogo(file: File) {
  const form = new FormData()
  form.append('logo', file)
  const data = await apiRequest<{ logoUrl: string }>('/school-settings/logo', {
    method: 'POST',
    body: form,
  })
  return data.logoUrl
}

export async function listUsers() {
  const data = await apiRequest<{ users: ApiUser[] }>('/users')
  return data.users.map(mapStaff)
}

export async function createUser(input: StaffInput) {
  const password = input.password?.trim() || 'Password123!'
  const data = await apiRequest<{ user: ApiUser }>('/users', {
    method: 'POST',
    body: {
      name: input.name,
      email: input.email,
      password,
      role: input.role,
      langPref: input.langPref ?? 'AR',
      phone: input.phone || null,
    },
  })
  return mapStaff(data.user)
}

export async function deactivateUser(id: number) {
  const data = await apiRequest<{ user: ApiUser }>(`/users/${id}/deactivate`, { method: 'PATCH' })
  return mapStaff(data.user)
}

export async function activateUser(id: number) {
  const data = await apiRequest<{ user: ApiUser }>(`/users/${id}/activate`, { method: 'PATCH' })
  return mapStaff(data.user)
}

export async function listClasses(academicYear?: string) {
  const qs = academicYear ? `?academicYear=${encodeURIComponent(academicYear)}` : ''
  const data = await apiRequest<{ classes: ApiClass[] }>(`/classes${qs}`)
  return data.classes.map(mapClass)
}

export async function saveClass(input: ClassInput & { id?: number }) {
  if (input.id) {
    const data = await apiRequest<{ class: ApiClass }>(`/classes/${input.id}`, {
      method: 'PATCH',
      body: {
        name: input.name,
        gradeLevel: input.gradeLevel,
        section: input.section ?? null,
        academicYear: input.academicYear,
      },
    })
    return mapClass(data.class)
  }
  const data = await apiRequest<{ class: ApiClass }>('/classes', {
    method: 'POST',
    body: {
      name: input.name,
      gradeLevel: input.gradeLevel,
      section: input.section ?? null,
      academicYear: input.academicYear,
    },
  })
  return mapClass(data.class)
}

export async function deleteClass(id: number) {
  await apiRequest(`/classes/${id}`, { method: 'DELETE' })
}

export async function removeAllStudentsFromClass(id: number) {
  await apiRequest(`/classes/${id}/remove-all-students`, { method: 'POST' })
}

export async function listSubjects() {
  const data = await apiRequest<{ subjects: Subject[] }>('/subjects')
  return data.subjects
}

export async function saveSubject(input: SubjectInput & { id?: number }) {
  if (input.id) {
    const data = await apiRequest<{ subject: Subject }>(`/subjects/${input.id}`, {
      method: 'PATCH',
      body: { nameAr: input.nameAr, nameEn: input.nameEn },
    })
    return data.subject
  }
  const data = await apiRequest<{ subject: Subject }>('/subjects', {
    method: 'POST',
    body: { nameAr: input.nameAr, nameEn: input.nameEn },
  })
  return data.subject
}

export async function deleteSubject(id: number) {
  await apiRequest(`/subjects/${id}`, { method: 'DELETE' })
}

export async function listAssignments() {
  const data = await apiRequest<{ assignments: ApiAssignment[] }>('/teacher-assignments')
  return data.assignments.map(mapAssignment)
}

export async function addAssignment(input: AssignmentInput) {
  const data = await apiRequest<{ assignment: ApiAssignment }>('/teacher-assignments', {
    method: 'POST',
    body: input,
  })
  return mapAssignment(data.assignment)
}

export async function syncTeacherAssignments(input: {
  teacherId: number
  classIds: number[]
  items: Array<{ classId: number; subjectId: number }>
}) {
  const data = await apiRequest<{
    created: number
    removed: number
    assignments: ApiAssignment[]
  }>('/teacher-assignments/sync', {
    method: 'POST',
    body: input,
  })
  return {
    created: data.created,
    removed: data.removed,
    assignments: data.assignments.map(mapAssignment),
  }
}

export async function removeAssignment(id: number) {
  await apiRequest(`/teacher-assignments/${id}`, { method: 'DELETE' })
}

export async function listStudents(params?: { q?: string; classId?: number; unassigned?: boolean }) {
  const search = new URLSearchParams()
  if (params?.q) search.set('q', params.q)
  if (params?.classId) search.set('classId', String(params.classId))
  if (params?.unassigned) search.set('unassigned', 'true')
  const qs = search.toString() ? `?${search}` : ''
  const data = await apiRequest<{ students: ApiStudent[] }>(`/students${qs}`)
  return data.students.map(mapStudent)
}

export async function createStudent(input: StudentInput) {
  const classId = input.classId && input.classId > 0 ? input.classId : null
  const data = await apiRequest<{ student: ApiStudent }>('/students', {
    method: 'POST',
    body: {
      id: input.id,
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      classId,
      parentPhone: input.parentPhone,
      parentEmail: input.parentEmail ?? null,
      waOptedIn: input.waOptedIn ?? false,
    },
  })
  return mapStudent(data.student)
}

export async function updateStudent(id: string, input: Omit<StudentInput, 'id' | 'classId'>) {
  const data = await apiRequest<{ student: ApiStudent }>(`/students/${id}`, {
    method: 'PATCH',
    body: {
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      parentPhone: input.parentPhone,
      parentEmail: input.parentEmail ?? null,
      waOptedIn: input.waOptedIn ?? false,
    },
  })
  return mapStudent(data.student)
}

export async function softRemoveStudent(id: string) {
  const data = await apiRequest<{ student: ApiStudent }>(`/students/${id}`, { method: 'DELETE' })
  return mapStudent(data.student)
}

export async function promoteStudent(id: string, classId: number) {
  const data = await apiRequest<{ student: ApiStudent }>(`/students/${id}/promote`, {
    method: 'POST',
    body: { classId },
  })
  return mapStudent(data.student)
}

export async function unassignStudent(id: string) {
  const data = await apiRequest<{ student: ApiStudent }>(`/students/${id}/unassign`, {
    method: 'POST',
  })
  return mapStudent(data.student)
}

export async function listEnrollments(studentId: string) {
  const data = await apiRequest<{ enrollments: ApiEnrollment[] }>(
    `/students/${studentId}/enrollments`
  )
  return data.enrollments.map(mapEnrollment)
}

export async function listImportBatches() {
  const data = await apiRequest<{ batches: ApiBatch[] }>('/students/import-batches')
  return data.batches.map(mapBatch)
}

export async function importNoorFile(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const data = await apiRequest<{
    fileName: string
    created: number
    updated: number
    reactivated: number
    skipped: number
    classesCreated?: number
    classesReused?: number
    academicYear?: string
    errors: ImportResult['errors']
  }>('/students/import-noor', {
    method: 'POST',
    body: form,
  })
  return {
    fileName: data.fileName || file.name,
    created: data.created,
    updated: data.updated,
    reactivated: data.reactivated,
    skipped: data.skipped,
    classesCreated: data.classesCreated ?? 0,
    classesReused: data.classesReused ?? 0,
    academicYear: data.academicYear,
    errors: data.errors ?? [],
  }
}

export async function importNoorTeachersFile(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const data = await apiRequest<{
    fileName: string
    created: number
    updated: number
    reactivated: number
    skipped: number
    defaultPassword?: string | null
    errors: ImportResult['errors']
  }>('/users/import-noor', {
    method: 'POST',
    body: form,
  })
  return {
    fileName: data.fileName || file.name,
    created: data.created,
    updated: data.updated,
    reactivated: data.reactivated,
    skipped: data.skipped,
    defaultPassword: data.defaultPassword ?? null,
    errors: data.errors ?? [],
  }
}

export async function importStudents(
  classId: number,
  fileName: string,
  rows: Array<{
    id: string
    nameAr: string
    nameEn: string
    parentPhone: string
    parentEmail?: string | null
  }>
): Promise<ImportResult> {
  const data = await apiRequest<{
    created: number
    updated: number
    reactivated: number
    skipped: number
    errors: ImportResult['errors']
  }>('/students/import', {
    method: 'POST',
    body: { classId, fileName, rows },
  })
  return {
    fileName,
    created: data.created,
    updated: data.updated,
    reactivated: data.reactivated,
    skipped: data.skipped,
    errors: data.errors ?? [],
  }
}

/** Parse a simple CSV: id,nameAr,nameEn,parentPhone[,parentEmail] */
export async function parseStudentImportFile(file: File) {
  const text = await file.text()
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const split = (line: string) => {
    // Minimal CSV splitter (handles quoted commas)
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes) {
        cells.push(cur.trim())
        cur = ''
        continue
      }
      cur += ch
    }
    cells.push(cur.trim())
    return cells
  }

  let start = 0
  const header = split(lines[0]).map((h) => h.toLowerCase())
  if (header.includes('id') || header.includes('namear') || header.includes('name')) {
    start = 1
  }

  const rows = []
  for (let i = start; i < lines.length; i++) {
    const cols = split(lines[i])
    if (cols.length < 4) continue
    rows.push({
      id: cols[0],
      nameAr: cols[1],
      nameEn: cols[2] || cols[1],
      parentPhone: cols[3],
      parentEmail: cols[4] || null,
    })
  }
  return rows
}

export type BackupDataResult = {
  ok: boolean
  counts: Record<string, unknown>
  backupFileName: string
  backupDownloadUrl: string
  backupZipBase64: string
}

/** Download a ZIP backup of all operational data without wiping. */
export async function backupDataOnly() {
  return apiRequest<BackupDataResult>('/users/backup-data', {
    method: 'POST',
    body: {},
  })
}

export type ResetDataResult = {
  ok: boolean
  summary: Record<string, unknown>
  backupFileName: string
  backupDownloadUrl: string
  backupZipBase64: string
}

/** Backup all operational data then wipe everything except ADMIN accounts + school settings. */
export async function resetAllDataWithBackup() {
  return apiRequest<ResetDataResult>('/users/reset-data', {
    method: 'POST',
    body: { confirm: 'DELETE_ALL_EXCEPT_ADMIN' },
  })
}

export type RestoreDataResult = {
  ok: boolean
  wipeSummary: Record<string, unknown>
  restored: Record<string, unknown>
  defaultPassword: string
}

/** Upload a previously downloaded backup ZIP/JSON and restore it. */
export async function restoreDataFromBackupFile(file: File) {
  const form = new FormData()
  form.append('backup', file)
  form.append('confirm', 'RESTORE_FROM_BACKUP')
  return apiRequest<RestoreDataResult>('/users/restore-data', {
    method: 'POST',
    body: form,
  })
}

/** Decode base64 ZIP from reset response and trigger a browser download. */
export function downloadBackupZip(fileName: string, base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || `school-backup-${Date.now()}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
