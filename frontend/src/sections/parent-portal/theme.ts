/** Parent portal “صباح المدرسة” design tokens — CSS variables on the portal root. */
export const PARENT_PORTAL_THEME = {
  ['--pp-ink']: '#0F2744',
  ['--pp-sky']: '#E8F3FB',
  ['--pp-primary']: '#1D6FA8',
  ['--pp-primary-soft']: '#D6EAF7',
  ['--pp-sand']: '#F7F3EC',
  ['--pp-warn']: '#B45309',
  ['--pp-warn-soft']: '#FEF3C7',
  ['--pp-danger']: '#B91C1C',
  ['--pp-danger-soft']: '#FEE2E2',
  ['--pp-ok']: '#047857',
  ['--pp-ok-soft']: '#D1FAE5',
} as const

/** School calendar day in Asia/Riyadh (not browser UTC/local). */
export function schoolTodayIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${y}-${m}-${day}`
}

/** Add/subtract whole days from YYYY-MM-DD (UTC-anchored). */
export function addDaysIso(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return utc.toISOString().slice(0, 10)
}

/** Sunday on or before dateStr. */
export function weekStartSundayIso(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay())
  return utc.toISOString().slice(0, 10)
}
