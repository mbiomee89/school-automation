import { cn } from '../../shared/utils'

export interface SegmentedTabOption<T extends string> {
  id: T
  label: string
  count?: number
}

export interface SegmentedTabsProps<T extends string> {
  options: SegmentedTabOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}

export function SegmentedTabs<T extends string>({ options, value, onChange, label }: SegmentedTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex w-full gap-1 rounded-xl bg-[color:var(--pp-sand)] p-1"
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
              'flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)] motion-reduce:transition-none',
              isActive
                ? 'bg-[color:var(--pp-primary)] text-white shadow-sm'
                : 'text-[color:var(--pp-ink)]/55 hover:text-[color:var(--pp-ink)]'
            )}
          >
            {opt.label}
            {!!opt.count && (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                  isActive ? 'bg-white/25 text-white' : 'bg-[color:var(--pp-sky)] text-[color:var(--pp-ink)]'
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
