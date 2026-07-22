import type { LucideIcon } from 'lucide-react'
import { cn } from './utils'
import { TONE_CLASSES, type Tone } from './colors'

export interface BadgeProps {
  tone: Tone
  label: string
  icon?: LucideIcon
  className?: string
}

/**
 * Single status/category badge primitive shared by every section (staff
 * active/inactive, notification delivery status, absence reason status,
 * import error severity, etc). Pairs a soft tint with an icon so meaning
 * never relies on color alone.
 */
export function Badge({ tone, label, icon: Icon, className }: BadgeProps) {
  const t = TONE_CLASSES[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        t.bg,
        t.text,
        className
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  )
}

export default Badge
