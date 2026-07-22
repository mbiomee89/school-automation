import { Home, CalendarCheck, BookOpenCheck, Bell, Settings2, type LucideIcon } from 'lucide-react'
import type { ParentTab } from './types'
import { cn } from '../../shared/utils'

interface TabDef {
  id: ParentTab
  label: string
  icon: LucideIcon
}

const TABS: TabDef[] = [
  { id: 'home', label: 'الرئيسية', icon: Home },
  { id: 'attendance', label: 'الحضور', icon: CalendarCheck },
  { id: 'homework', label: 'الواجبات', icon: BookOpenCheck },
  { id: 'notifications', label: 'الإشعارات', icon: Bell },
  { id: 'settings', label: 'الإعدادات', icon: Settings2 },
]

export interface BottomTabBarProps {
  activeTab: ParentTab
  onSelect: (tab: ParentTab) => void
  /** Small red dot shown on the notifications icon when there are unseen alerts. */
  hasNewAlerts?: boolean
}

/**
 * Standalone-app bottom navigation — this section renders with `shell: false`,
 * so it owns its own persistent nav instead of relying on the admin sidebar/header.
 */
export function BottomTabBar({ activeTab, onSelect, hasNewAlerts }: BottomTabBarProps) {
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="sticky bottom-0 z-20 shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] dark:border-slate-700 dark:bg-slate-800/95"
    >
      <div className="grid grid-cols-5 gap-1 px-1.5 py-1.5">
        {TABS.map((t) => {
          const isActive = t.id === activeTab
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-[10.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 motion-reduce:transition-none',
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200'
              )}
            >
              <span className="relative">
                <Icon className="size-5" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                {t.id === 'notifications' && hasNewAlerts && (
                  <span
                    className="absolute -end-0.5 -top-0.5 inline-flex size-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="line-clamp-2 text-center leading-[1.15] break-words">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomTabBar
