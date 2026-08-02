/**
 * Display helpers for report/print dates.
 * Keep API and <input type="date"> values as YYYY-MM-DD; format only for UI.
 */

/** Arabic Gregorian month names (index 0 = January). */
export const ARABIC_GREGORIAN_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const

/** Weekday headers, Sunday-first (matches common Arabic calendar UIs). */
export const ARABIC_WEEKDAYS_SUN_FIRST = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const

/** Short weekday headers for calendar grid. */
export const ARABIC_WEEKDAYS_SHORT_SUN_FIRST = [
  'أحد',
  'إثن',
  'ثلا',
  'أرب',
  'خمي',
  'جمع',
  'سبت',
] as const

/** Local today as YYYY-MM-DD. */
export function todayDateOnly(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD into parts; falls back to today if invalid. */
export function parseDateOnlyParts(dateOnly: string): { year: number; month: number; day: number } {
  const base = /^\d{4}-\d{2}-\d{2}/.test(dateOnly) ? dateOnly.slice(0, 10) : todayDateOnly()
  const [ys, ms, ds] = base.split('-')
  return { year: Number(ys), month: Number(ms), day: Number(ds) }
}

/** Build YYYY-MM-DD from calendar parts (month 1–12). */
export function toDateOnly(year: number, month: number, day: number): string {
  const y = String(year)
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Days in a Gregorian month (month 1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export type CalendarCell = {
  dateOnly: string
  day: number
  inMonth: boolean
}

/**
 * 6×7 Gregorian grid for a month, Sunday-first.
 * Leading/trailing cells from adjacent months have inMonth=false.
 */
export function getMonthCalendarCells(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay() // 0=Sun
  const dim = daysInMonth(year, month)
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const prevDim = daysInMonth(prevYear, prevMonth)
  const cells: CalendarCell[] = []

  for (let i = 0; i < 42; i++) {
    const dayNum = i - firstWeekday + 1
    if (dayNum < 1) {
      const d = prevDim + dayNum
      const py = month === 1 ? year - 1 : year
      const pm = month === 1 ? 12 : month - 1
      cells.push({ dateOnly: toDateOnly(py, pm, d), day: d, inMonth: false })
    } else if (dayNum > dim) {
      const d = dayNum - dim
      const ny = month === 12 ? year + 1 : year
      const nm = month === 12 ? 1 : month + 1
      cells.push({ dateOnly: toDateOnly(ny, nm, d), day: d, inMonth: false })
    } else {
      cells.push({ dateOnly: toDateOnly(year, month, dayNum), day: dayNum, inMonth: true })
    }
  }
  return cells
}

/** Add/subtract whole days from a date-only (YYYY-MM-DD), UTC-anchored. */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const base = /^\d{4}-\d{2}-\d{2}/.test(dateOnly) ? dateOnly.slice(0, 10) : todayDateOnly()
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Format a date-only or ISO string as dd/mm/yyyy. */
export function formatReportDate(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const trimmed = String(value).trim()
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const [, yyyy, mm, dd] = m
    return `${dd}/${mm}/${yyyy}`
  }
  // Non-date labels (student names, Arabic hints) stay unchanged.
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed) && Number.isNaN(Date.parse(trimmed))) {
    return trimmed
  }
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return trimmed
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getUTCFullYear())
  return `${dd}/${mm}/${yyyy}`
}

/** Inclusive range display, e.g. "من 01/08/2026 إلى 06/08/2026". */
export function formatReportDateRange(
  from: string | null | undefined,
  to: string | null | undefined
): string {
  return `من ${formatReportDate(from)} إلى ${formatReportDate(to)}`
}
