export const SCORE_FIELDS = [
  'participation',
  'homeworkScore',
  'understanding',
  'discipline',
  'interaction',
  'progress',
] as const

export type ScoreField = (typeof SCORE_FIELDS)[number]

export const SCORE_LABELS: Record<ScoreField, string> = {
  participation: 'المشاركة',
  homeworkScore: 'الواجبات',
  understanding: 'الفهم',
  discipline: 'الانضباط',
  interaction: 'التفاعل',
  progress: 'التطور',
}

export const FOLLOW_UP_SCALE = [
  { value: 5, label: 'ممتاز' },
  { value: 4, label: 'جيد جداً' },
  { value: 3, label: 'جيد' },
  { value: 2, label: 'يحتاج متابعة' },
  { value: 1, label: 'يحتاج تدخل' },
] as const

export type FollowUpScores = Record<ScoreField, number | null> & { notes: string | null }

/** Sum integers 1–5 only. Empty is skipped (not 0). Keep in sync with backend followUpTotal. */
export function followUpTotal(scores: Partial<FollowUpScores> | null | undefined): number | null {
  let sum = 0
  let any = false
  for (const key of SCORE_FIELDS) {
    const v = scores?.[key]
    if (v == null || (v as unknown) === '') continue
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1 || n > 5) continue
    sum += n
    any = true
  }
  return any ? sum : null
}

export function formatFollowUpCell(value: number | null | undefined): string {
  return value == null ? '—' : String(value)
}

export function weekStartSunday(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay())
  return utc.toISOString().slice(0, 10)
}

export function addDaysIso(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return utc.toISOString().slice(0, 10)
}
