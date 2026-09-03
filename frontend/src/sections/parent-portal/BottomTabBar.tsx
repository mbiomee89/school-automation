import { Home, CalendarCheck, BookOpenCheck, Settings2, DoorOpen, type LucideIcon } from 'lucide-react'
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
  { id: 'early-leave', label: 'استئذان', icon: DoorOpen },
  { id: 'settings', label: 'الإعدادات', icon: Settings2 },
]

export interface BottomTabBarProps {
  activeTab: ParentTab
  onSelect: (tab: ParentTab) => void
  /** @deprecated Kept for API compatibility; notifications tab is hidden. */
  hasNewAlerts?: boolean
}

export function BottomTabBar({ activeTab, onSelect }: BottomTabBarProps) {
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="z-20 shrink-0 border-t border-[color:var(--pp-ink)]/15 bg-[color:var(--pp-sand)]/95 shadow-[0_-4px_16px_rgba(15,39,68,0.08)] backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 gap-0.5 px-1 py-1.5">
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
                'relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-[10px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none',
                isActive
                  ? 'bg-[color:var(--pp-primary)] text-white'
                  : 'text-[color:var(--pp-ink)]/55 hover:bg-[color:var(--pp-sky)] hover:text-[color:var(--pp-ink)]'
              )}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
              <span className="line-clamp-2 text-center leading-[1.15] break-words">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomTabBar
