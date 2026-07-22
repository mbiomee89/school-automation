import { cn } from '../../shared/utils'

export interface SegmentedTabOption<T extends string> {
  id: T
  label: string
  /** Small numeric badge, e.g. a pending-review count. */
  count?: number
}

export interface SegmentedTabsProps<T extends string> {
  options: SegmentedTabOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}

/**
 * Compact in-page sub-navigation (e.g. history vs. submitted excuses) — not
 * the main bottom tab bar. Deliberately plain toggle-buttons (`aria-pressed`)
 * rather than a `role="tablist"`/`role="tab"` pattern: we don't implement the
 * roving-tabindex + arrow-key navigation the ARIA APG requires for a real
 * tablist, so claiming that role would be a worse a11y story than this
 * simpler, fully-standard-keyboard-operable button group.
 */
export function SegmentedTabs<T extends string>({ options, value, onChange, label }: SegmentedTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex w-full gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900/60"
    >
      {options.map((opt) => {
        const isActive = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none',
              isActive
                ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {opt.label}
            {!!opt.count && (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                  isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default SegmentedTabs
