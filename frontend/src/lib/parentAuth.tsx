import { createContext, useContext } from 'react'
import type { ParentChild } from '../api/parent'

export interface ParentAuthContextValue {
  token: string | null
  phone: string | null
  students: ParentChild[]
  bootstrapping: boolean
  isAuthenticated: boolean
  login: (phone: string, password: string) => Promise<void>
  register: (phone: string, password: string, studentId: string) => Promise<void>
  resetPassword: (phone: string, password: string, studentId: string) => Promise<void>
  logout: () => void
  refreshStudents: () => Promise<void>
  setStudents: (students: ParentChild[]) => void
}

export const ParentAuthContext = createContext<ParentAuthContextValue | null>(null)

export function useParentAuth(): ParentAuthContextValue {
  const ctx = useContext(ParentAuthContext)
  if (!ctx) throw new Error('useParentAuth must be used within ParentAuthProvider')
  return ctx
}
