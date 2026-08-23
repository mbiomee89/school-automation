import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  listParentStudents,
  loginParent,
  registerParent,
  type ParentChild,
} from '../api/parent'
import { getParentToken, setParentToken } from '../api/client'
import { ParentAuthContext, type ParentAuthContextValue } from './parentAuth'

export function ParentAuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getParentToken())
  const [phone, setPhone] = useState<string | null>(null)
  const [students, setStudents] = useState<ParentChild[]>([])
  const [bootstrapping, setBootstrapping] = useState(true)

  const refreshStudents = useCallback(async () => {
    const current = getParentToken()
    if (!current) {
      setTokenState(null)
      setPhone(null)
      setStudents([])
      return
    }
    const data = await listParentStudents()
    setTokenState(current)
    setPhone(data.phone)
    setStudents(data.students)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (getParentToken()) await refreshStudents()
      } catch {
        if (!cancelled) {
          setParentToken(null)
          setTokenState(null)
          setPhone(null)
          setStudents([])
        }
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshStudents])

  const applySession = useCallback(
    async (nextToken: string, nextPhone: string) => {
      setParentToken(nextToken)
      setTokenState(nextToken)
      setPhone(nextPhone)
      await refreshStudents()
    },
    [refreshStudents]
  )

  const login = useCallback(
    async (rawPhone: string, password: string) => {
      const result = await loginParent(rawPhone, password)
      await applySession(result.token, result.phone)
    },
    [applySession]
  )

  const register = useCallback(
    async (rawPhone: string, password: string, studentId: string) => {
      const result = await registerParent(rawPhone, password, studentId)
      await applySession(result.token, result.phone)
    },
    [applySession]
  )

  const logout = useCallback(() => {
    setParentToken(null)
    setTokenState(null)
    setPhone(null)
    setStudents([])
  }, [])

  const value = useMemo<ParentAuthContextValue>(
    () => ({
      token,
      phone,
      students,
      bootstrapping,
      isAuthenticated: !!token && !!phone,
      login,
      register,
      logout,
      refreshStudents,
      setStudents,
    }),
    [token, phone, students, bootstrapping, login, register, logout, refreshStudents]
  )

  return <ParentAuthContext.Provider value={value}>{children}</ParentAuthContext.Provider>
}
