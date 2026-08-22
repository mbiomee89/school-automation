import type { NavItem } from '../shell/components'

/** Full staff nav catalog — AppShell filters by role. */
export const STAFF_NAV_ITEMS: Omit<NavItem, 'isActive'>[] = [
  { label: 'أعمال المعلم اليومية', href: '/teacher-daily' },
  { label: 'الواجبات', href: '/teacher-daily?tab=homework' },
  { label: 'الإدارة المدرسية', href: '/administration' },
  { label: 'مراجعة الأعذار', href: '/counselor-review' },
  { label: 'التقارير', href: '/reports' },
]

export const SECTION_BY_HREF: Record<string, string> = {
  '/teacher-daily': 'teacher-daily-workflow',
  '/administration': 'school-administration',
  '/counselor-review': 'counselor-review',
  '/reports': 'reports',
}

/** Active nav match — supports ?tab= on teacher-daily. */
export function isStaffNavActive(href: string, pathname: string, search: string): boolean {
  const url = new URL(href, 'http://local.invalid')
  if (pathname !== url.pathname) return false
  const wantTab = url.searchParams.get('tab')
  const haveTab = new URLSearchParams(search).get('tab')
  if (wantTab) return haveTab === wantTab
  // Default daily link: active when no tab or attendance
  return !haveTab || haveTab === 'attendance'
}
