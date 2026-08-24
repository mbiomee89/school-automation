import { apiRequest } from './client'

export type GradeShapeKind = 'KHITAMI' | 'TAKWINI'

export type GradeShapeMeta = {
  shape: GradeShapeKind
  assessmentMax: number
  examsMax: number
  periodMax: number
  finalMax: number
  key?: string
}

export type GradebookAssignment = {
  id: number
  classId: number
  className: string
  gradeLevel: string
  subjectId: number
  subjectNameAr: string
  academicYear: string
  shape: GradeShapeKind
  assessmentMax: number
  examsMax: number
  periodMax: number
  finalMax: number
}

export type GradebookRow = {
  studentId: string
  studentNameAr: string
  assessment: number | null
  exams: number | null
  periodTotal: number | null
  periodMax: number
  finalExam: number | null
  termReady: boolean
  avgAssessment: number | null
  avgExams: number | null
  termTotal: number | null
}

export type GradebookMeResponse = {
  assignment: {
    id: number
    classId: number
    className: string
    gradeLevel: string
    subjectId: number
    subjectNameAr: string
  }
  academicYear: string
  term: number
  period: number
  shape: GradeShapeMeta
  rows: GradebookRow[]
}

export type GradeReport =
  | {
      type: 'period'
      academicYear: string
      term: number
      period: number
      className: string
      subjectNameAr: string
      shape: GradeShapeMeta
      rows: Array<{
        studentId: string
        studentNameAr: string
        assessment: number | null
        exams: number | null
        periodTotal: number | null
        periodMax: number
      }>
    }
  | {
      type: 'term'
      academicYear: string
      term: number
      className: string
      subjectNameAr: string
      shape: GradeShapeMeta
      rows: Array<{
        studentId: string
        studentNameAr: string
        period1: { assessment: number; exams: number; total: number } | null
        period2: { assessment: number; exams: number; total: number } | null
        avgAssessment: number | null
        avgExams: number | null
        finalExam: number | null
        termReady: boolean
        termTotal: number | null
        termMax: number
      }>
    }

export async function listGradebookAssignments() {
  return apiRequest<{ assignments: GradebookAssignment[] }>('/gradebook/me/assignments')
}

export async function getGradebookMe(params: {
  assignmentId: number
  term: number
  period: number
  academicYear?: string
}) {
  const q = new URLSearchParams({
    assignmentId: String(params.assignmentId),
    term: String(params.term),
    period: String(params.period),
  })
  if (params.academicYear) q.set('academicYear', params.academicYear)
  return apiRequest<GradebookMeResponse>(`/gradebook/me?${q}`)
}

export async function saveGradebookPeriod(body: {
  assignmentId: number
  term: number
  period: number
  academicYear?: string
  rows: Array<{ studentId: string; assessment: number; exams: number }>
}) {
  return apiRequest<{ ok: boolean; saved: number }>('/gradebook/me/period', {
    method: 'PUT',
    body,
  })
}

export async function saveGradebookFinal(body: {
  assignmentId: number
  term: number
  academicYear?: string
  rows: Array<{ studentId: string; finalExam: number }>
}) {
  return apiRequest<{ ok: boolean; saved: number }>('/gradebook/me/final', {
    method: 'PUT',
    body,
  })
}

export async function getGradebookReport(params: {
  assignmentId: number
  term: number
  period?: number
  academicYear?: string
}) {
  const q = new URLSearchParams({
    assignmentId: String(params.assignmentId),
    term: String(params.term),
  })
  if (params.period != null) q.set('period', String(params.period))
  if (params.academicYear) q.set('academicYear', params.academicYear)
  return apiRequest<GradeReport>(`/gradebook/me/report?${q}`)
}

export async function listAdminGradebookOptions() {
  return apiRequest<{
    classes: Array<{
      id: number
      name: string
      gradeLevel: string
      section: string | null
      academicYear: string
    }>
    subjects: Array<{ id: number; nameAr: string; nameEn: string }>
  }>('/gradebook/admin/options')
}

export async function getAdminGradebookReport(params: {
  classId: number
  subjectId: number
  term: number
  period?: number
  academicYear?: string
}) {
  const q = new URLSearchParams({
    classId: String(params.classId),
    subjectId: String(params.subjectId),
    term: String(params.term),
  })
  if (params.period != null) q.set('period', String(params.period))
  if (params.academicYear) q.set('academicYear', params.academicYear)
  return apiRequest<GradeReport>(`/gradebook/admin/report?${q}`)
}
