import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '../shell/components'
import { ROLE_HOME, roleMayAccessSection } from '../shared/accessControl'
import { STAFF_NAV_ITEMS, SECTION_BY_HREF, isStaffNavActive } from '../lib/navigation'
import { roleLabelAr, useAuth } from '../lib/auth'
import { changeStaffPassword } from '../api/auth'
import { getEarlyLeavePendingCount } from '../api/earlyLeave'
import { ApiError } from '../api/client'
import { SPINNER_CLASS, buttonVariants } from '../shared/buttonVariants'
import { StaffToastProvider } from '../shared/StaffToast'

const EARLY_LEAVE_ROLES = new Set(['ADMIN', 'STUDENT_AFFAIRS', 'COUNSELOR'])

export function RequireAuth() {
  const { isAuthenticated, bootstrapping } = useAuth()
  const location = useLocation()

  if (bootstrapping) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function StaffLayout() {
  const { user, role, logout, refreshUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)
  const [earlyLeavePending, setEarlyLeavePending] = useState(0)

  const refreshEarlyLeaveBadge = useCallback(async () => {
    if (!role || !EARLY_LEAVE_ROLES.has(role)) {
      setEarlyLeavePending(0)
      return
    }
    try {
      const count = await getEarlyLeavePendingCount()
      setEarlyLeavePending(count)
    } catch {
      /* keep last known count */
    }
  }, [role])

  useEffect(() => {
    void refreshEarlyLeaveBadge()
    if (!role || !EARLY_LEAVE_ROLES.has(role)) return
    const id = window.setInterval(() => {
      void refreshEarlyLeaveBadge()
    }, 60_000)
    return () => window.clearInterval(id)
  }, [role, refreshEarlyLeaveBadge, location.pathname])

  if (!user || !role) {
    return <Navigate to="/login" replace />
  }

  const mustChange = !!user.mustChangePassword

  const sectionId = SECTION_BY_HREF[location.pathname]
  if (!mustChange && sectionId && !roleMayAccessSection(role, sectionId)) {
    return <Navigate to={ROLE_HOME[role].homeHref} replace />
  }

  const navigationItems = STAFF_NAV_ITEMS.map((item) => ({
    ...item,
    isActive: isStaffNavActive(item.href, location.pathname, location.search),
    badgeCount: item.href === '/early-leave' ? earlyLeavePending : undefined,
  }))

  async function submitPasswordChange() {
    setPwError(null)
    if (newPassword.length < 8) {
      setPwError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('تأكيد كلمة المرور غير مطابق')
      return
    }
    setPwBusy(true)
    try {
      await changeStaffPassword(currentPassword, newPassword)
      await refreshUser()
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'فشل تغيير كلمة المرور')
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <StaffToastProvider>
    <AppShell
      navigationItems={navigationItems}
      user={{ name: user.name, role: roleLabelAr(role) }}
      role={role}
      notificationCount={EARLY_LEAVE_ROLES.has(role) ? earlyLeavePending : undefined}
      onOpenNotifications={
        EARLY_LEAVE_ROLES.has(role)
          ? () => {
              if (mustChange) return
              navigate('/early-leave')
            }
          : undefined
      }
      onNavigate={(href) => {
        if (mustChange) return
        navigate(href)
      }}
      onLogout={() => {
        logout()
        navigate('/login', { replace: true })
      }}
    >
      {mustChange ? (
        <div className="flex min-h-[50vh] items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900 dark:bg-slate-900">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              يجب تغيير كلمة المرور
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              تم تعيين كلمة مرور مؤقتة لحسابك. اختر كلمة مرور جديدة للمتابعة.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">كلمة المرور الحالية</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  dir="ltr"
                  autoComplete="current-password"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">كلمة المرور الجديدة</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  dir="ltr"
                  autoComplete="new-password"
                  minLength={8}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">تأكيد كلمة المرور</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  dir="ltr"
                  autoComplete="new-password"
                  minLength={8}
                />
              </label>
              {pwError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {pwError}
                </p>
              )}
              <button
                type="button"
                disabled={pwBusy}
                onClick={() => void submitPasswordChange()}
                className={buttonVariants({ variant: 'primary', className: 'w-full' })}
              >
                {pwBusy ? 'جارٍ الحفظ…' : 'حفظ ومتابعة'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Outlet />
      )}
    </AppShell>
    </StaffToastProvider>
  )
}
