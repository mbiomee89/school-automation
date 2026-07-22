import { apiRequest } from './client'
import type {
  AttendanceDay,
  Child,
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

export async function registerParent(phone: string, password: string) {
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
    body: { phone, password },
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

export async function getParentHomework(studentId: string) {
  const data = await apiRequest<{ homework: HomeworkItem[] }>(
    `/parent/students/${studentId}/homework`,
    { auth: 'parent' }
  )
  return data.homework
}

export async function getParentWeeklyPlans(studentId: string) {
  const data = await apiRequest<{ weeklyPlans: WeeklyPlanItem[] }>(
    `/parent/students/${studentId}/weekly-plans`,
    { auth: 'parent' }
  )
  return data.weeklyPlans
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
