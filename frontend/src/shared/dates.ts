/**
 * Display helpers for report/print dates.
 * Keep API and <input type="date"> values as YYYY-MM-DD; format only for UI.
 */

/** Format a date-only or ISO string as dd/mm/yy. */
export function formatReportDate(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const trimmed = String(value).trim()
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const [, yyyy, mm, dd] = m
    return `${dd}/${mm}/${yyyy.slice(-2)}`
  }
  // Non-date labels (student names, Arabic hints) stay unchanged.
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed) && Number.isNaN(Date.parse(trimmed))) {
    return trimmed
  }
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return trimmed
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yy = String(d.getUTCFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}

/** Inclusive range display, e.g. "من 01/08/26 إلى 06/08/26". */
export function formatReportDateRange(
  from: string | null | undefined,
  to: string | null | undefined
): string {
  return `من ${formatReportDate(from)} إلى ${formatReportDate(to)}`
}
