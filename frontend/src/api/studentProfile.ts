import { apiRequest } from './client'

export type StudentProfilePayload = {
  stage?: string
  classId?: number | null
  className?: string
  nameAr: string
  nameEnFirst: string
  nameEnFather: string
  nameEnGrand: string
  nameEnFamily: string
  nationality: string
  civilId: string
  idIssueDate?: string | null
  passportNumber?: string | null
  birthDate: string
  birthCountry: string
  birthCity: string
  bloodType?: string | null
  housing?: string | null
  adminRegion: string
  city: string
  district: string
  streetMain: string
  streetSub?: string | null
  houseNumber: string
  email: string
  postalCode?: string | null
  poBox?: string | null
  guardianName: string
  guardianNationality: string
  guardianRelation: string
  guardianIdType: string
  guardianIdNumber: string
  guardianIdIssueDate: string
  guardianIdSource: string
  guardianIdExpiry: string
  guardianHomePhone?: string | null
  guardianMobile: string
  /** When true, WhatsApp = guardianMobile (auto). */
  guardianWhatsappSame?: boolean
  guardianWhatsapp?: string
  guardianWorkPhone?: string | null
  relativeName: string
  relativePhone: string
  relativeAddress?: string | null
  hasMedicalConditions: boolean
  medicalDetails?: string | null
  attested: boolean
}

export type StudentProfileSubmission = {
  id: number
  campaignId: number
  enteredStudentId: string
  studentId: string | null
  classId: number | null
  className: string | null
  studentNameAr: string | null
  hasMedical: boolean
  linked: boolean
  payload: StudentProfilePayload
  submittedAt: string
  updatedAt: string
}

export type StudentProfileChangeRequest = {
  id: number
  campaignId: number
  submissionId: number
  enteredStudentId: string
  hasMedical: boolean
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewNote: string | null
  reviewedBy: number | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  proposedPayload: StudentProfilePayload
  liveSubmission: StudentProfileSubmission | null
  studentNameAr: string | null
  className: string | null
}

export async function getPublicProfileMeta(token: string) {
  return apiRequest<{
    title: string
    token: string
    classes: Array<{ id: number; name: string; gradeLevel: string; section: string | null }>
  }>(`/student-profile/public/${token}/meta`, { auth: false })
}

export async function lookupPublicStudent(token: string, studentId: string) {
  const qs = new URLSearchParams({ studentId })
  return apiRequest<{
    found: boolean
    student: {
      id: string
      nameAr: string
      classId: number | null
      className: string | null
    } | null
    /** True if a prior row exists; payload is never returned to anonymous clients. */
    hasPriorSubmission: boolean
    hasPendingChangeRequest: boolean
  }>(`/student-profile/public/${token}/lookup?${qs}`, { auth: false })
}

export async function submitPublicStudentProfile(
  token: string,
  body: { enteredStudentId: string; payload: StudentProfilePayload }
) {
  return apiRequest<{
    ok: true
    submissionId: number
    pending: boolean
    changeRequestId?: number
  }>(`/student-profile/public/${token}/submit`, {
    method: 'POST',
    body,
    auth: false,
  })
}

export async function getStaffProfileCampaign() {
  return apiRequest<{
    campaign: {
      id: number
      token: string
      title: string
      isActive: boolean
      publicPath: string
      submissionCount?: number
      pendingChangeCount?: number
    }
  }>('/student-profile/staff/campaign')
}

export async function patchStaffProfileCampaign(patch: { isActive?: boolean; title?: string }) {
  return apiRequest<{
    campaign: {
      id: number
      token: string
      title: string
      isActive: boolean
      publicPath: string
    }
  }>('/student-profile/staff/campaign', { method: 'PATCH', body: patch })
}

export async function listProfileSubmissions(opts?: {
  classId?: number
  unlinkedOnly?: boolean
  medicalOnly?: boolean
}) {
  const qs = new URLSearchParams()
  if (opts?.classId) qs.set('classId', String(opts.classId))
  if (opts?.unlinkedOnly) qs.set('unlinkedOnly', '1')
  if (opts?.medicalOnly) qs.set('medicalOnly', '1')
  const q = qs.toString()
  const data = await apiRequest<{ submissions: StudentProfileSubmission[] }>(
    `/student-profile/staff/submissions${q ? `?${q}` : ''}`
  )
  return data.submissions
}

export async function linkProfileSubmission(id: number, studentId: string) {
  const data = await apiRequest<{ submission: StudentProfileSubmission }>(
    `/student-profile/staff/submissions/${id}/link`,
    { method: 'PATCH', body: { studentId } }
  )
  return data.submission
}

export async function listProfileChangeRequests(status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' = 'PENDING') {
  const qs = new URLSearchParams({ status })
  const data = await apiRequest<{ changeRequests: StudentProfileChangeRequest[] }>(
    `/student-profile/staff/change-requests?${qs}`
  )
  return data.changeRequests
}

export async function approveProfileChangeRequest(id: number) {
  const data = await apiRequest<{ changeRequest: StudentProfileChangeRequest }>(
    `/student-profile/staff/change-requests/${id}/approve`,
    { method: 'POST', body: {} }
  )
  return data.changeRequest
}

export async function rejectProfileChangeRequest(id: number, note?: string) {
  const data = await apiRequest<{ changeRequest: StudentProfileChangeRequest }>(
    `/student-profile/staff/change-requests/${id}/reject`,
    { method: 'POST', body: { note: note ?? null } }
  )
  return data.changeRequest
}
