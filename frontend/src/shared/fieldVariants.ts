import { cn } from './utils'

/**
 * Shared text-field / select / textarea surface.
 * Light: white fill. Dark: slate-800 (not slate-950) so values stay visible
 * against slate-950 page backgrounds.
 */
export function fieldVariants({ className }: { className?: string } = {}) {
  return cn(
    'rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400',
    className
  )
}
