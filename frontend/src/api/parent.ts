import { apiRequest } from './client'
import type {
  AttendanceDay,
  Child,
  EarlyLeaveRequest,
  EarlyLeaveSubmitInput,
  ExcuseSubmission,
  HomeworkItem,
  NotificationItem,
  TodaySummary,
  WeeklyPlanItem,
} from '../sections/parent-portal/types'

export interface ParentChild extends Child {
  waOptedIn: boolean
  classId: number | null
}

export async function loginParent(phone: string, password: string) {
  return apiRequest<{
    token: string
    phone: string
    students: Array<{
      id: string
      nameAr: string
      nameEn: string
      classId: number | null
      class: { id: number; name: string; academicYear: string } | null
    }>
  }>('/auth/parent/login', {
    method: 'POST',
    auth: false,
    body: { phone, password },
  })
}

export async function registerParent(phone: string, password: string, studentId: string) {
  return apiRequest<{
    token: string
    phone: string
    students: Array<{
      id: string
      nameAr: string
      nameEn: string
      classId: number | null
      class: { id: number; name: string; academicYear: string } | null
    }>
  }>('/auth/parent/register', {
    method: 'POST',
    auth: false,
    body: { phone, password, studentId },
  })
}

export async function listParentStudents() {
  const data = await apiRequest<{ students: ParentChild[]; phone: string }>('/parent/students', {
    auth: 'parent',
  })
  return data
}

export async function getParentSummary(studentId: string) {
  return apiRequest<TodaySummary & { waOptedIn: boolean }>(
    `/parent/students/${studentId}/summary`,
    { auth: 'parent' }
  )
}

export async function getParentAttendance(studentId: string) {
  const data = await apiRequest<{ attendance: AttendanceDay[] }>(
    `/parent/students/${studentId}/attendance`,
    { auth: 'parent' }
  )
  return data.attendance
}

export async function getParentHomework(
  studentId: string,
  opts?: { from?: string; to?: string; date?: string }
) {
  const qs = new URLSearchParams()
  if (opts?.date) {
    qs.set('from', opts.date)
    qs.set('to', opts.date)
  } else {
    if (opts?.from) qs.set('from', opts.from)
    if (opts?.to) qs.set('to', opts.to)
  }
  const q = qs.toString()
  const data = await apiRequest<{
    homework: HomeworkItem[]
    schoolName?: string
    academicYear?: string
    educationAdminName?: string | null
    logoUrl?: string | null
    principalName?: string | null
    className?: string
  }>(`/parent/students/${studentId}/homework${q ? `?${q}` : ''}`, { auth: 'parent' })
  return data
}

export async function getParentWeeklyPlans(studentId: string, opts?: { date?: string }) {
  const qs = new URLSearchParams()
  if (opts?.date) qs.set('date', opts.date)
  const q = qs.toString()
  const data = await apiRequest<{
    weeklyPlans: WeeklyPlanItem[]
    rows?: Array<{
      planId: number
      dayKey: string
      dayLabel: string
      subjectName: string
      lessonTopic: string
      notes: string | null
      period?: string | null
      teacherName?: string
    }>
    weekStart?: string | null
    weekEnd?: string | null
    schoolName?: string
    academicYear?: string
    educationAdminName?: string | null
    logoUrl?: string | null
    principalName?: string | null
    className?: string
  }>(`/parent/students/${studentId}/weekly-plans${q ? `?${q}` : ''}`, { auth: 'parent' })
  return data
}

export async function getParentNotifications(studentId: string) {
  const data = await apiRequest<{ notifications: NotificationItem[] }>(
    `/parent/students/${studentId}/notifications`,
    { auth: 'parent' }
  )
  return data.notifications
}

export async function getParentExcuses(studentId: string) {
  const data = await apiRequest<{ excuses: ExcuseSubmission[] }>(
    `/parent/students/${studentId}/excuses`,
    { auth: 'parent' }
  )
  return data.excuses
}

export async function submitExcuse(attendanceId: number, reasonText: string, file: File) {
  const form = new FormData()
  form.append('reason', reasonText)
  form.append('attachment', file)
  const data = await apiRequest<{ excuse: ExcuseSubmission }>(
    `/parent/attendance/${attendanceId}/reason`,
    { method: 'POST', auth: 'parent', body: form }
  )
  return data.excuse
}

export async function setParentWaOptIn(waOptedIn: boolean, studentId?: string) {
  const data = await apiRequest<{ students: ParentChild[] }>('/parent/wa-opt-in', {
    method: 'PATCH',
    auth: 'parent',
    body: { waOptedIn, ...(studentId ? { studentId } : {}) },
  })
  return data.students
}

export async function getParentEarlyLeave(studentId: string) {
  const data = await apiRequest<{ earlyLeaveRequests: EarlyLeaveRequest[] }>(
    `/parent/students/${studentId}/early-leave`,
    { auth: 'parent' }
  )
  return data.earlyLeaveRequests
}

export async function createParentEarlyLeave(studentId: string, input: EarlyLeaveSubmitInput) {
  const data = await apiRequest<{ earlyLeaveRequest: EarlyLeaveRequest }>(
    `/parent/students/${studentId}/early-leave`,
    {
      method: 'POST',
      auth: 'parent',
      body: {
        date: input.date,
        leaveTime: input.leaveTime,
        reason: input.reason,
        pickupName: input.pickupName,
        pickupRelation: input.pickupRelation,
        pickupPhone: input.pickupPhone,
      },
    }
  )
  return data.earlyLeaveRequest
}

export async function cancelParentEarlyLeave(requestId: number) {
  const data = await apiRequest<{ earlyLeaveRequest: EarlyLeaveRequest }>(
    `/parent/early-leave/${requestId}/cancel`,
    { method: 'POST', auth: 'parent' }
  )
  return data.earlyLeaveRequest
}
