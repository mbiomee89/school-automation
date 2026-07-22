/**
 * Role → home route and allowed section navigation.
 * Host apps should use these after login and when building the shell nav.
 * Hiding UI is not enough — APIs must enforce the same rules server-side.
 */

export type AppRole = 'ADMIN' | 'TEACHER' | 'COUNSELOR' | 'PARENT'

export interface RoleHome {
  role: AppRole
  /** Suggested path after successful login. */
  homeHref: string
  /** Arabic label of the home section. */
  homeLabelAr: string
}

/** Post-login landing for each authenticated role. */
export const ROLE_HOME: Record<AppRole, RoleHome> = {
  ADMIN: {
    role: 'ADMIN',
    homeHref: '/administration',
    homeLabelAr: 'الإدارة المدرسية',
  },
  TEACHER: {
    role: 'TEACHER',
    homeHref: '/teacher-daily',
    homeLabelAr: 'أعمال المعلم اليومية',
  },
  COUNSELOR: {
    role: 'COUNSELOR',
    homeHref: '/counselor-review',
    homeLabelAr: 'مراجعة الأعذار',
  },
  PARENT: {
    role: 'PARENT',
    homeHref: '/parent-portal',
    homeLabelAr: 'بوابة ولي الأمر',
  },
}

/**
 * Arabic nav labels allowed per staff role (must match shell MainNav labels).
 * Parents never use this list — they use Parent Portal bottom tabs only.
 */
export const STAFF_NAV_BY_ROLE: Record<'ADMIN' | 'TEACHER' | 'COUNSELOR', string[]> = {
  ADMIN: ['الإدارة المدرسية', 'التقارير'],
  TEACHER: ['أعمال المعلم اليومية'],
  COUNSELOR: ['مراجعة الأعذار', 'التقارير'],
}

export function filterStaffNavByRole<T extends { label: string }>(
  items: T[],
  role: 'ADMIN' | 'TEACHER' | 'COUNSELOR'
): T[] {
  const allowed = new Set(STAFF_NAV_BY_ROLE[role])
  return items.filter((item) => allowed.has(item.label))
}

/** Map Design OS section id → roles that may view that section screen. */
export const SECTION_ALLOWED_ROLES: Record<string, AppRole[]> = {
  'school-administration': ['ADMIN'],
  'teacher-daily-workflow': ['TEACHER'],
  'counselor-review': ['COUNSELOR'],
  reports: ['ADMIN', 'COUNSELOR'],
  'parent-portal': ['PARENT'],
  'staff-login': ['ADMIN', 'TEACHER', 'COUNSELOR', 'PARENT'], // public auth surfaces
}

export function roleMayAccessSection(role: AppRole, sectionId: string): boolean {
  const allowed = SECTION_ALLOWED_ROLES[sectionId]
  if (!allowed) return false
  // Login screens are public — any visitor may open them (not "authenticated as")
  if (sectionId === 'staff-login') return true
  return allowed.includes(role)
}
