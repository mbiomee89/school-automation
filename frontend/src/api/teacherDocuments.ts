import { apiRequest, getToken, ApiError } from './client'

export const TEACHER_DOC_TYPES = [
  'NOMINATION_FORM',
  'NATIONAL_ID',
  'CRIMINAL_CLEARANCE',
  'MEDICAL_EXAM',
  'ACADEMIC_QUALIFICATION',
  'TRAINING_COURSES',
  'PREVIOUS_EXPERIENCE',
  'PROFESSIONAL_LICENSE',
  'UNIFIED_CONTRACT',
  'PERFORMANCE_2Y',
] as const

export type TeacherDocType = (typeof TEACHER_DOC_TYPES)[number]

export const TEACHER_DOC_LABELS_AR: Record<TeacherDocType, string> = {
  NOMINATION_FORM: 'نموذج ترشيح معلم',
  NATIONAL_ID: 'الهوية الوطنية',
  CRIMINAL_CLEARANCE: 'شهادة خلو سوابق',
  MEDICAL_EXAM: 'الكشف الطبي',
  ACADEMIC_QUALIFICATION: 'المؤهل العلمي',
  TRAINING_COURSES: 'الدورات التدريبية',
  PREVIOUS_EXPERIENCE: 'الخبرات السابقة',
  PROFESSIONAL_LICENSE: 'الرخصة المهنية',
  UNIFIED_CONTRACT: 'العقد الموحد الوظيفي',
  PERFORMANCE_2Y: 'الأداء الوظيفي لآخر عامين',
}

export type TeacherDocumentSlot = {
  docType: TeacherDocType
  labelAr: string
  uploaded: boolean
  uploadedAt: string | null
  updatedAt: string | null
  fileName: string | null
}

export type TeacherDocumentsMeResponse = {
  documents: TeacherDocumentSlot[]
  uploadedCount: number
  totalCount: number
}

export type TeacherDocumentsAdminRow = {
  id: number
  name: string
  email: string
  uploadedCount: number
  totalCount: number
  documents: TeacherDocumentSlot[]
}

export type TeacherDocumentsAdminDetail = TeacherDocumentsAdminRow & {
  isActive: boolean
}

export async function listMyTeacherDocuments() {
  return apiRequest<TeacherDocumentsMeResponse>('/teacher-documents/me')
}

export async function uploadMyTeacherDocument(docType: TeacherDocType, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<TeacherDocumentSlot>(`/teacher-documents/me/${docType}`, {
    method: 'POST',
    body: form,
    timeoutMs: 60_000,
  })
}

export async function deleteMyTeacherDocument(docType: TeacherDocType) {
  return apiRequest<TeacherDocumentSlot>(`/teacher-documents/me/${docType}`, {
    method: 'DELETE',
  })
}

export async function listAdminTeacherDocuments() {
  return apiRequest<{ teachers: TeacherDocumentsAdminRow[]; totalCount: number }>(
    '/teacher-documents/admin'
  )
}

export async function getAdminTeacherDocuments(teacherId: number) {
  return apiRequest<TeacherDocumentsAdminDetail>(`/teacher-documents/admin/${teacherId}`)
}

async function downloadAuthenticatedPdf(apiPath: string, fallbackName: string) {
  const token = getToken()
  const res = await fetch(`/api${apiPath}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    let message = `تعذّر تنزيل الملف (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message)
  }
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = /filename="([^"]+)"/i.exec(disposition)
  const fileName = match?.[1] || fallbackName
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadMyTeacherDocument(docType: TeacherDocType, fileName?: string | null) {
  return downloadAuthenticatedPdf(
    `/teacher-documents/me/${docType}/file`,
    fileName || `${docType}.pdf`
  )
}

export async function downloadAdminTeacherDocument(
  teacherId: number,
  docType: TeacherDocType,
  fileName?: string | null
) {
  return downloadAuthenticatedPdf(
    `/teacher-documents/admin/${teacherId}/${docType}/file`,
    fileName || `${docType}.pdf`
  )
}
