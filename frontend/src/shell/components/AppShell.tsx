import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Menu, PanelLeftClose, PanelLeft, Bell } from 'lucide-react'
import { MainNav, type NavItem } from './MainNav'
import { UserMenu, type UserMenuUser } from './UserMenu'
import { Drawer } from '../../shared/Drawer'
import { fontArabic } from '../../shared/fonts'
import { iconButtonVariants } from '../../shared/buttonVariants'
import { filterStaffNavByRole } from '../../shared/accessControl'
import { cn } from '../../shared/utils'

export interface AppShellProps {
  children: ReactNode
  navigationItems: NavItem[]
  user?: UserMenuUser
  productName?: string
  onNavigate?: (href: string) => void
  onLogout?: () => void
  /** When true, force dark class on mount. Defaults to false — the product's
   * visual system (slate-50 background, white surfaces) is designed light-first. */
  defaultDark?: boolean
  /** Document direction — Arabic product defaults to RTL. */
  dir?: 'rtl' | 'ltr'
  lang?: string
  /** Unread notification count shown on the header bell. Bell only renders when `onOpenNotifications` is provided. */
  notificationCount?: number
  /** Open the notifications panel/page. Optional — omit to hide the header notification button entirely. */
  onOpenNotifications?: () => void
  /**
   * When set, navigation is filtered to that staff role only (admin / teacher /
   * counselor). Parents never use AppShell. See product/access-control.md.
   */
  role?: 'ADMIN' | 'TEACHER' | 'COUNSELOR' | 'STUDENT_AFFAIRS'
}

export function AppShell({
  children,
  navigationItems,
  user,
  productName = 'منصة إدارة المدرسة',
  onNavigate,
  onLogout,
  defaultDark = false,
  dir = 'rtl',
  lang = 'ar',
  notificationCount,
  onOpenNotifications,
  role,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return defaultDark
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'dark') return true
      if (stored === 'light') return false
    } catch {
      /* ignore */
    }
    return document.documentElement.classList.contains('dark') || defaultDark
  })

  const visibleNav = useMemo(
    () => (role ? filterStaffNavByRole(navigationItems, role) : navigationItems),
    [navigationItems, role]
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [isDark])

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', lang)
    return () => {
      document.documentElement.setAttribute('dir', 'ltr')
      document.documentElement.setAttribute('lang', 'en')
    }
  }, [dir, lang])

  const toggleDark = () => setIsDark((d) => !d)
  const activeLabel = visibleNav.find((i) => i.isActive)?.label ?? 'الرئيسية'

  return (
    <div
      dir={dir}
      lang={lang}
      className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50"
      style={fontArabic}
    >
      {/* Desktop / tablet sidebar — sits on the inline-start side (right in RTL). Always a dark surface. */}
      <aside
        className={cn(
          'hidden border-e border-slate-700/60 bg-slate-800 transition-[width] duration-200 md:flex md:flex-col dark:bg-slate-900 dark:border-slate-800 print:hidden',
          sidebarOpen ? 'w-64' : 'w-[4.5rem]'
        )}
      >
        <div
          className={cn(
            'flex h-[72px] items-center border-b border-slate-700/60 px-4 dark:border-slate-800',
            !sidebarOpen && 'justify-center px-2'
          )}
        >
          {sidebarOpen ? (
            <span className="truncate text-sm font-semibold tracking-tight text-white">
              {productName}
            </span>
          ) : (
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              م
            </span>
          )}
        </div>
        <MainNav
          navigationItems={visibleNav}
          onNavigate={onNavigate}
          collapsed={!sidebarOpen}
        />
        <div className="mt-auto border-t border-slate-700/60 p-2 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-slate-300 transition-colors duration-150 hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 motion-reduce:transition-none"
            aria-label={sidebarOpen ? 'طي الشريط الجانبي' : 'توسيع الشريط الجانبي'}
            title={sidebarOpen ? 'طي الشريط الجانبي' : 'توسيع الشريط الجانبي'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-5 rtl:-scale-x-100" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <PanelLeft className="size-5 rtl:-scale-x-100" strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer — focus trap / Escape / scroll lock / focus-return via Radix Dialog */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title={`القائمة الرئيسية — ${productName}`}
        widthClassName="max-w-72"
        className="border-slate-700/60 bg-slate-800 dark:bg-slate-900"
      >
        <div className="flex h-[72px] items-center border-b border-slate-700/60 px-4 dark:border-slate-800">
          <span className="truncate text-sm font-semibold text-white">{productName}</span>
        </div>
        <MainNav
          navigationItems={visibleNav}
          onNavigate={(href) => {
            onNavigate?.(href)
            setMobileOpen(false)
          }}
        />
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col print:min-h-screen">
        <header className="flex h-[72px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-6 dark:border-slate-700 dark:bg-slate-800 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className={cn(iconButtonVariants(), 'md:hidden')}
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة الرئيسية"
            >
              <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <span className="truncate text-sm font-medium text-slate-500 md:hidden dark:text-slate-400">
              {activeLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className={cn(iconButtonVariants(), 'relative')}
                aria-label={
                  notificationCount && notificationCount > 0
                    ? `الإشعارات، ${notificationCount} غير مقروءة`
                    : 'الإشعارات'
                }
              >
                <Bell className="size-5" strokeWidth={1.5} aria-hidden="true" />
                {!!notificationCount && notificationCount > 0 && (
                  <span
                    className="absolute end-1.5 top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold leading-none text-white"
                    aria-hidden="true"
                  >
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>
            )}
            <UserMenu user={user} onLogout={onLogout} isDark={isDark} onToggleDark={toggleDark} />
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

export default AppShell
