import { Moon, Sun, LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { iconButtonVariants } from '../../shared/buttonVariants'
import { cn } from '../../shared/utils'

export interface UserMenuUser {
  name: string
  avatarUrl?: string
  role?: string
}

export interface UserMenuProps {
  user?: UserMenuUser
  onLogout?: () => void
  isDark?: boolean
  onToggleDark?: () => void
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function UserMenu({ user, onLogout, isDark, onToggleDark }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (!user) return null

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {onToggleDark && (
        <button
          type="button"
          onClick={onToggleDark}
          className={iconButtonVariants()}
          title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
          aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
        >
          {isDark ? (
            <Sun className="size-5" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Moon className="size-5" strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      )}

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:text-slate-200 dark:hover:bg-slate-700"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`قائمة المستخدم: ${user.name}`}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {initials(user.name)}
            </span>
          )}
          <span className="hidden max-w-[10rem] truncate font-medium sm:inline">{user.name}</span>
          <ChevronDown className="size-4 opacity-60" strokeWidth={1.5} aria-hidden="true" />
        </button>

        {open && (
          <div
            role="menu"
            aria-label="قائمة المستخدم"
            className={cn(
              'absolute end-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-150 motion-reduce:transition-none motion-reduce:animate-none',
              'dark:border-slate-700 dark:bg-slate-800'
            )}
            data-state="open"
          >
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                {user.name}
              </p>
              {user.role && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.role}</p>
              )}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onLogout?.()
              }}
              className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500 motion-reduce:transition-none dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="size-4" strokeWidth={1.5} aria-hidden="true" />
              تسجيل الخروج
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default UserMenu
