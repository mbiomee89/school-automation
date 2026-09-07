import { apiRequest } from './client'

export type FollowUpAssignment = {
  id: number
  classId: number
  className: string
  gradeLevel: string
  subjectId: number
  subjectNameAr: string
  academicYear: string
}

export type FollowUpRow = {
  studentId: string
  studentNameAr: string
  participation: number | null
  homeworkScore: number | null
  understanding: number | null
  discipline: number | null
  interaction: number | null
  progress: number | null
  notes: string | null
  total: number | null
}

export type FollowUpSheet = {
  assignment: FollowUpAssignment
  weekStart: string
  weekEnd: string
  currentWeekStart: string
  rows: FollowUpRow[]
}

export async function listFollowUpAssignments() {
  return apiRequest<{ assignments: FollowUpAssignment[]; currentWeekStart: string }>(
    '/weekly-follow-up/me/assignments'
  )
}

export async function getFollowUpMe(assignmentId: number, weekStart: string) {
  const q = new URLSearchParams({
    assignmentId: String(assignmentId),
    weekStart,
  })
  return apiRequest<FollowUpSheet>(`/weekly-follow-up/me?${q}`)
}

export async function saveFollowUpMe(body: {
  assignmentId: number
  weekStart: string
  rows: Array<
    Omit<FollowUpRow, 'studentNameAr' | 'total'> & { total?: number | null }
  >
}) {
  return apiRequest<{ ok: boolean; saved: number; deleted: number; rows: FollowUpRow[] }>(
    '/weekly-follow-up/me',
    { method: 'PUT', body }
  )
}

export type ParentFollowUpSubject = {
  subjectId: number
  subjectNameAr: string
  participation: number | null
  homeworkScore: number | null
  understanding: number | null
  discipline: number | null
  interaction: number | null
  progress: number | null
  notes: string | null
  total: number | null
}

export type ParentFollowUpSheet = {
  schoolName: string
  academicYear: string
  studentId: string
  studentNameAr: string
  className: string
  weekStart: string
  weekEnd: string
  subjects: ParentFollowUpSubject[]
}

export async function getParentWeeklyFollowUp(studentId: string) {
  return apiRequest<ParentFollowUpSheet>(`/parent/students/${studentId}/weekly-follow-up`, {
    auth: 'parent',
  })
}

export type AdminFollowUpClassOption = {
  id: number
  name: string
  academicYear: string
  gradeLevel: string
  subjects: Array<{ id: number; nameAr: string }>
}

export type AdminFollowUpOptions = {
  classes: AdminFollowUpClassOption[]
  currentWeekStart: string
}

export type AdminFollowUpReport = {
  schoolName: string
  academicYear: string
  educationAdminName?: string | null
  logoUrl?: string | null
  principalName?: string | null
  classId: number
  className: string
  subjectId: number
  subjectNameAr: string
  weekStart: string
  weekEnd: string
  rows: FollowUpRow[]
}

export async function getAdminFollowUpOptions() {
  return apiRequest<AdminFollowUpOptions>('/reports/weekly-follow-up/options')
}

export async function getAdminFollowUpReport(params: {
  classId: number
  subjectId: number
  weekStart: string
}) {
  const q = new URLSearchParams({
    classId: String(params.classId),
    subjectId: String(params.subjectId),
    weekStart: params.weekStart,
  })
  return apiRequest<AdminFollowUpReport>(`/reports/weekly-follow-up?${q}`)
}
