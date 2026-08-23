import { createContext, useContext } from 'react'
import type { StaffUser, StaffRole } from '../api/auth'

export type { StaffRole }

const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'إداري',
  TEACHER: 'معلم',
  COUNSELOR: 'مرشد',
  STUDENT_AFFAIRS: 'وكيل شؤون طلاب',
}

export function roleLabelAr(role: StaffRole) {
  return ROLE_LABELS[role]
}

export interface AuthContextValue {
  user: StaffUser | null
  role: StaffRole | null
  token: string | null
  /** True until the first /auth/me (or token-less) check finishes. */
  bootstrapping: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<StaffUser>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
