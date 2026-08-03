import { apiRequest } from './client'
import type {
  AttendanceMark,
  HomeworkEntry,
  LateReportEntry,
  RosterStudent,
  TeacherAssignmentOption,
  WeeklyPlanDays,
  WeeklyPlanEntry,
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

export async function getHomework(classId: number, subjectId: number, date: string) {
  const qs = new URLSearchParams({
    classId: String(classId),
    subjectId: String(subjectId),
    date,
  })
  const data = await apiRequest<{ homework: HomeworkEntry[] }>(`/homework?${qs}`)
  return data.homework
}

export async function addHomework(input: {
  classId: number
  subjectId: number
  date: string
  description: string
  dueDate?: string | null
}) {
  const data = await apiRequest<{ homework: HomeworkEntry }>('/homework', {
    method: 'POST',
    body: input,
  })
  return data.homework
}

export async function updateHomework(
  id: number,
  patch: { description?: string; dueDate?: string | null }
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

export async function getWeeklyPlan(classId: number, subjectId: number, weekStart: string) {
  const qs = new URLSearchParams({
    classId: String(classId),
    subjectId: String(subjectId),
    weekStart,
  })
  const data = await apiRequest<{ weeklyPlan: WeeklyPlanEntry | null }>(`/weekly-plans?${qs}`)
  return data.weeklyPlan
}

export async function saveWeeklyPlan(input: {
  classId: number
  subjectId: number
  weekStart: string
  days: WeeklyPlanDays
}) {
  const data = await apiRequest<{ weeklyPlan: WeeklyPlanEntry }>('/weekly-plans', {
    method: 'POST',
    body: input,
  })
  return data.weeklyPlan
}
