import {
  ClipboardCheck,
  Building2,
  ShieldCheck,
  FileBarChart2,
  DoorOpen,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../shared/utils'

export interface NavItem {
  label: string
  href: string
  isActive?: boolean
  /** Optional count badge (e.g. pending early-leave requests). */
  badgeCount?: number
}

export interface MainNavProps {
  navigationItems: NavItem[]
  onNavigate?: (href: string) => void
  collapsed?: boolean
}

const iconMap: Record<string, LucideIcon> = {
  'teacher daily': ClipboardCheck,
  'أعمال المعلم اليومية': ClipboardCheck,
  'يوم المعلم': ClipboardCheck,
  administration: Building2,
  'الإدارة المدرسية': Building2,
  'counselor review': ShieldCheck,
  'مراجعة الأعذار': ShieldCheck,
  'مراجعة المرشد': ShieldCheck,
  reports: FileBarChart2,
  'التقارير': FileBarChart2,
  'طلبات الاستئذان': DoorOpen,
}

function iconFor(label: string): LucideIcon {
  return iconMap[label.toLowerCase()] ?? iconMap[label] ?? ClipboardCheck
}

/**
 * Persistent role-filtered navigation list rendered inside both the desktop
 * sidebar and the mobile drawer. Always sits on a dark (slate-800/900)
 * surface regardless of the app's light/dark mode — see `AppShell`.
 */
export function MainNav({ navigationItems, onNavigate, collapsed = false }: MainNavProps) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="القائمة الرئيسية">
      {navigationItems.map((item) => {
        const Icon = iconFor(item.label)
        const badge = item.badgeCount && item.badgeCount > 0 ? item.badgeCount : 0
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => onNavigate?.(item.href)}
            title={item.label}
            aria-label={
              badge > 0 ? `${item.label}، ${badge} بانتظار المراجعة` : item.label
            }
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 motion-reduce:transition-none',
              collapsed && 'justify-center px-2',
              item.isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            )}
          >
            <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {badge > 0 && (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white',
                  collapsed ? 'absolute end-1 top-1' : 'ms-auto'
                )}
                aria-hidden="true"
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

export default MainNav
