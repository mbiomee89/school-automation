import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchMe, loginStaff, type StaffUser } from '../api/auth'
import { ApiError, getToken, setToken } from '../api/client'
import { AuthContext, type AuthContextValue } from './auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<StaffUser | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  const refreshUser = useCallback(async () => {
    const current = getToken()
    if (!current) {
      setUser(null)
      setTokenState(null)
      return
    }
    const { user: me } = await fetchMe()
    setUser(me)
    setTokenState(current)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (getToken()) await refreshUser()
      } catch {
        if (!cancelled) {
          setToken(null)
          setTokenState(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { token: nextToken, user: nextUser } = await loginStaff(email, password)
      setToken(nextToken)
      setTokenState(nextToken)
      setUser(nextUser)
      return nextUser
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        throw err
      }
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      token,
      bootstrapping,
      isAuthenticated: !!user && !!token,
      login,
      logout,
      refreshUser,
    }),
    [user, token, bootstrapping, login, logout, refreshUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
