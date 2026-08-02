/**
 * Display helpers for report/print dates.
 * Keep API and <input type="date"> values as YYYY-MM-DD; format only for UI.
 */

/** English abbreviated months for dd mmm yyyy display. */
export const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
] as const

/** Local today as YYYY-MM-DD. */
export function todayDateOnly(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Add/subtract whole days from a date-only (YYYY-MM-DD), UTC-anchored. */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const base = /^\d{4}-\d{2}-\d{2}/.test(dateOnly) ? dateOnly.slice(0, 10) : todayDateOnly()
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

export function parseDateOnly(value: string | null | undefined): {
  year: number
  month: number
  day: number
} | null {
  if (!value) return null
  const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

export function toDateOnly(year: number, month1to12: number, day: number): string {
  const maxDay = daysInMonth(year, month1to12)
  const safeDay = Math.min(Math.max(1, day), maxDay)
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

/** Year options around the selected/current year for report filters. */
export function yearOptionsAround(centerYear: number, before = 4, after = 2): number[] {
  const years: number[] = []
  for (let y = centerYear - before; y <= centerYear + after; y++) years.push(y)
  return years
}

/** Format a date-only or ISO string as dd mmm yyyy (e.g. 02 Aug 2026). */
export function formatReportDate(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const trimmed = String(value).trim()
  const parsed = parseDateOnly(trimmed)
  if (parsed) {
    const month = MONTH_OPTIONS[parsed.month - 1]?.label ?? String(parsed.month)
    return `${String(parsed.day).padStart(2, '0')} ${month} ${parsed.year}`
  }
  // Non-date labels (student names, Arabic hints) stay unchanged.
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed) && Number.isNaN(Date.parse(trimmed))) {
    return trimmed
  }
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return trimmed
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = MONTH_OPTIONS[d.getUTCMonth()]?.label ?? ''
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

/** Inclusive range display, e.g. "من 01 Aug 2026 إلى 06 Aug 2026". */
export function formatReportDateRange(
  from: string | null | undefined,
  to: string | null | undefined
): string {
  return `من ${formatReportDate(from)} إلى ${formatReportDate(to)}`
}
