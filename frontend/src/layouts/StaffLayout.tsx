import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '../shell/components'
import { ROLE_HOME, roleMayAccessSection } from '../shared/accessControl'
import { STAFF_NAV_ITEMS, SECTION_BY_HREF } from '../lib/navigation'
import { roleLabelAr, useAuth } from '../lib/auth'
import { SPINNER_CLASS } from '../shared/buttonVariants'

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
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!user || !role) {
    return <Navigate to="/login" replace />
  }

  const sectionId = SECTION_BY_HREF[location.pathname]
  if (sectionId && !roleMayAccessSection(role, sectionId)) {
    return <Navigate to={ROLE_HOME[role].homeHref} replace />
  }

  const navigationItems = STAFF_NAV_ITEMS.map((item) => ({
    ...item,
    isActive: location.pathname === item.href,
  }))

  return (
    <AppShell
      navigationItems={navigationItems}
      user={{ name: user.name, role: roleLabelAr(role) }}
      role={role}
      onNavigate={(href) => navigate(href)}
      onLogout={() => {
        logout()
        navigate('/login', { replace: true })
      }}
    >
      <Outlet />
    </AppShell>
  )
}
