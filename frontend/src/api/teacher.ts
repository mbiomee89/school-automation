import { apiRequest } from './client'
import type {
  AttendanceMark,
  HomeworkEntry,
  LateReportEntry,
  RosterStudent,
  TeacherAssignmentOption,
} from '../sections/teacher-daily-workflow/types'

export function todayDateStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Saturday on or before the given local date (YYYY-MM-DD), as UTC date-only. */
export function weekStartSaturday(dateStr?: string) {
  const base = dateStr ?? todayDateStr()
  const [y, m, d] = base.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  const day = utc.getUTCDay() // 0 Sun … 6 Sat
  const diff = day === 6 ? 0 : day + 1
  utc.setUTCDate(utc.getUTCDate() - diff)
  return utc.toISOString().slice(0, 10)
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

export async function listTeacherAssignments(): Promise<TeacherAssignmentOption[]> {
  const data = await apiRequest<{ assignments: ApiAssignment[] }>('/teacher-assignments')
  return data.assignments.map((a) => ({
    id: a.id,
    classId: a.classId,
    className: a.class.name,
    subjectId: a.subjectId,
    subjectNameAr: a.subject.nameAr,
    subjectNameEn: a.subject.nameEn,
  }))
}

export type TeacherDaySlot = {
  id: number
  period: string
  dayOfWeek: string
  classId: number
  className: string
  subjectId: number
  subjectNameAr: string
  subjectNameEn: string
  assignmentId: number | null
}

export type TeacherWeekSlot = TeacherDaySlot & {
  date: string
  homeworkId: number | null
  noHomework: boolean
  hasHomework: boolean
  handled: boolean
  description: string | null
  dueDate: string | null
  planId?: number | null
  planTitle?: string | null
  hasPlan?: boolean
}

export type TeacherWeekGrid = {
  weekStart: string
  weekEnd: string
  academicYear: string | null
  editable: boolean
  today?: string
  days: Array<{
    dayOfWeek: string
    date: string
    slots: TeacherWeekSlot[]
  }>
}

/** Today's timetable lessons for the logged-in teacher. */
export async function getTeacherToday(date?: string): Promise<{
  date: string
  dayOfWeek: string | null
  academicYear: string | null
  slots: TeacherDaySlot[]
}> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiRequest(`/teacher-assignments/today${qs}`)
}

/** Sunday on or before date (UTC date-only). */
export function weekStartSunday(dateStr?: string) {
  const base = dateStr ?? todayDateStr()
  const [y, m, d] = base.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay())
  return utc.toISOString().slice(0, 10)
}

/** Full Sun–Thu homework grid for the week containing date. */
export async function getTeacherWeek(date?: string): Promise<TeacherWeekGrid> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiRequest(`/teacher-assignments/week${qs}`)
}

export async function listRoster(classId: number): Promise<RosterStudent[]> {
  const data = await apiRequest<{
    students: Array<{ id: string; nameAr: string; nameEn: string }>
  }>(`/students?classId=${classId}`)
  return data.students.map((s) => ({
    id: s.id,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
  }))
}

export async function getAttendance(classId: number, date: string, period = 'DAY') {
  const qs = new URLSearchParams({
    classId: String(classId),
    date,
    period,
  })
  const data = await apiRequest<{
    savedAt?: string | null
    attendance: Array<{ studentId: string; status: AttendanceMark['status']; recordedAt: string }>
  }>(`/attendance?${qs}`)
  const marks: AttendanceMark[] = data.attendance.map((a) => ({
    studentId: a.studentId,
    status: a.status,
  }))
  const savedAt =
    data.savedAt ??
    data.attendance.reduce<string | null>((best, a) => {
      if (!best || a.recordedAt > best) return a.recordedAt
      return best
    }, null)
  return { marks, savedAt }
}

export async function saveAttendance(
  classId: number,
  date: string,
  marks: AttendanceMark[],
  period = 'DAY'
) {
  return apiRequest<{ savedAt: string }>('/attendance', {
    method: 'POST',
    body: { classId, date, period, marks },
  })
}

export async function getLateReports(classId: number, date: string) {
  const qs = new URLSearchParams({ classId: String(classId), date })
  const data = await apiRequest<{ lateReports: LateReportEntry[] }>(`/late-reports?${qs}`)
  return data.lateReports
}

export async function addLateReport(input: {
  studentId: string
  classId: number
  date: string
  time: string
  reason?: string | null
}) {
  const data = await apiRequest<{ lateReport: LateReportEntry }>('/late-reports', {
    method: 'POST',
    body: input,
  })
  return data.lateReport
}

export async function updateLateReport(
  id: number,
  patch: { time?: string; reason?: string | null }
) {
  const data = await apiRequest<{ lateReport: LateReportEntry }>(`/late-reports/${id}`, {
    method: 'PATCH',
    body: patch,
  })
  return data.lateReport
}

export async function deleteLateReport(id: number) {
  await apiRequest(`/late-reports/${id}`, { method: 'DELETE' })
}

export async function getHomework(
  classId: number,
  subjectId: number,
  date: string,
  period?: string
) {
  const qs = new URLSearchParams({
    classId: String(classId),
    subjectId: String(subjectId),
    date,
  })
  if (period) qs.set('period', period)
  const data = await apiRequest<{ homework: HomeworkEntry[] }>(`/homework?${qs}`)
  return data.homework
}

export async function addHomework(input: {
  classId: number
  subjectId: number
  date: string
  period?: string
  description?: string
  dueDate?: string | null
  noHomework?: boolean
}) {
  const data = await apiRequest<{ homework: HomeworkEntry }>('/homework', {
    method: 'POST',
    body: input,
  })
  return data.homework
}

export async function updateHomework(
  id: number,
  patch: { description?: string; dueDate?: string | null; noHomework?: boolean }
) {
  const data = await apiRequest<{ homework: HomeworkEntry }>(`/homework/${id}`, {
    method: 'PATCH',
    body: patch,
  })
  return data.homework
}

export async function deleteHomework(id: number) {
  await apiRequest(`/homework/${id}`, { method: 'DELETE' })
}

export async function saveWeeklyPlanCell(input: {
  classId: number
  subjectId: number
  date: string
  period: string
  title: string
}) {
  const data = await apiRequest<{
    weeklyPlan: {
      id: number
      classId: number
      subjectId: number
      date: string | null
      period: string | null
      title: string
      weekStart: string
    }
  }>('/weekly-plans', {
    method: 'POST',
    body: input,
  })
  return data.weeklyPlan
}

export async function deleteWeeklyPlan(id: number) {
  await apiRequest(`/weekly-plans/${id}`, { method: 'DELETE' })
}
