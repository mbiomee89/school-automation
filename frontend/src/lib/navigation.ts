import type { NavItem } from '../shell/components'

/** Full staff nav catalog — AppShell filters by role. */
export const STAFF_NAV_ITEMS: Omit<NavItem, 'isActive'>[] = [
  { label: 'أعمال المعلم اليومية', href: '/teacher-daily' },
  { label: 'الواجبات', href: '/teacher-daily?tab=homework' },
  { label: 'سجل المتابعة', href: '/gradebook' },
  { label: 'مستندات التوظيف', href: '/teacher-documents' },
  { label: 'الإدارة المدرسية', href: '/administration' },
  { label: 'ملفات المعلمين', href: '/teacher-files' },
  { label: 'تقارير الدرجات', href: '/gradebook-reports' },
  { label: 'مراجعة الأعذار', href: '/counselor-review' },
  { label: 'شؤون الطلاب', href: '/student-affairs' },
  { label: 'التقارير', href: '/reports' },
]

export const SECTION_BY_HREF: Record<string, string> = {
  '/teacher-daily': 'teacher-daily-workflow',
  '/gradebook': 'gradebook',
  '/teacher-documents': 'teacher-documents',
  '/administration': 'school-administration',
  '/teacher-files': 'teacher-files',
  '/gradebook-reports': 'gradebook-reports',
  '/counselor-review': 'counselor-review',
  '/student-affairs': 'student-affairs',
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
