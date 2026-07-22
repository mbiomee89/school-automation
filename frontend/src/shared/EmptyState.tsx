import type { LucideIcon } from 'lucide-react'
import { cn } from './utils'
import { buttonVariants } from './buttonVariants'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  /** Use for error states to swap the icon tint from neutral to a warning tone. */
  tone?: 'neutral' | 'error'
  className?: string
}

/**
 * Shared empty / "no results" / error state pattern: icon + Arabic title +
 * supporting text + optional retry/primary CTA. Used wherever a list/table
 * has no rows to show, replacing bare "لا توجد بيانات" text.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-12 text-center', className)}>
      <span
        className={cn(
          'inline-flex size-12 items-center justify-center rounded-full',
          tone === 'error'
            ? 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-700/60 dark:text-slate-400'
        )}
      >
        <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={buttonVariants({ variant: tone === 'error' ? 'danger' : 'secondary', size: 'sm' })}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default EmptyState
