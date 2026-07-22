import { CheckCircle2, XCircle, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { AttendanceStatus } from './types'
import type { Tone } from '../../shared/colors'

interface StatusMeta {
  label: string
  tone: Tone
  icon: LucideIcon
}

/** Attendance status meta shared by the roster list, tab indicator, and summary bar. */
export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, StatusMeta> = {
  PRESENT: { label: 'حاضر', tone: 'emerald', icon: CheckCircle2 },
  ABSENT: { label: 'غائب', tone: 'red', icon: XCircle },
  EXCUSED: { label: 'معفى', tone: 'purple', icon: ShieldCheck },
}

/** Long Arabic weekday + day + month, e.g. "السبت، ١٩ سبتمبر" — used for the weekly plan header. */
export function formatLongDate(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Short Arabic day + month, e.g. "٢٠ سبتمبر" — used for compact due-date chips. */
export function formatShortDate(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' })
}

/** "HH:MM" in Western digits for `<input type="time">` binding and LTR display spans. */
export function timeToInputValue(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function nowTimeValue(): string {
  return timeToInputValue(new Date().toISOString())
}

/** Combines a date-only string with an `<input type="time">` value into a full ISO datetime. */
export function toIsoDateTime(dateOnly: string, timeValue: string): string {
  const [hours, minutes] = timeValue.split(':').map(Number)
  const d = new Date(`${dateOnly}T00:00:00`)
  d.setHours(hours || 0, minutes || 0, 0, 0)
  return d.toISOString()
}

/** Adds/subtracts whole days from a date-only (YYYY-MM-DD) string, staying date-only (UTC-anchored to avoid DST/offset drift). */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
