import type { NavItem } from '../shell/components'

/** Full staff nav catalog — AppShell filters by role. */
export const STAFF_NAV_ITEMS: Omit<NavItem, 'isActive'>[] = [
  { label: 'أعمال المعلم اليومية', href: '/teacher-daily' },
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
