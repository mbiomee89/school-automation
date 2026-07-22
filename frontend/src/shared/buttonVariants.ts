import { cn } from './utils'

/**
 * Shared button styling for product screen designs. Kept as a className
 * helper (rather than a wrapping <Button> component) so existing native
 * <button>/<label> elements across sections can adopt one consistent visual
 * system with minimal structural change.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline-danger'
export type ButtonSize = 'sm' | 'md'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-xs',
  md: 'min-h-11 px-4 py-2.5 text-sm',
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-slate-900',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500 dark:focus-visible:ring-offset-slate-900',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500 dark:focus-visible:ring-offset-slate-900',
  'outline-danger':
    'border border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-500 dark:border-red-800 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/30 dark:focus-visible:ring-offset-slate-900',
  ghost:
    'text-slate-600 hover:bg-slate-100 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900',
}

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(BASE, SIZES[size], VARIANTS[variant], className)
}

/** Compact square icon-button (44px touch target) for toolbars/headers. */
export function iconButtonVariants({ className }: { className?: string } = {}) {
  return cn(
    'inline-flex size-11 items-center justify-center rounded-xl text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-900',
    className
  )
}

/** Small inline spinner for loading buttons — inherits currentColor. */
export const SPINNER_CLASS = 'size-4 shrink-0 animate-spin motion-reduce:animate-none'
