import { BookOpenCheck } from 'lucide-react'
import type { HomeworkItem } from './types'
import { EmptyState } from '../../shared/EmptyState'
import { cn } from '../../shared/utils'
import { formatShortDate } from './statusMeta'

export interface HomeworkListProps {
  items: HomeworkItem[]
  compact?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

export function HomeworkList({
  items,
  compact,
  emptyTitle = 'لا توجد واجبات لهذا اليوم',
  emptyDescription = 'جرّب يوماً آخر، أو انتظر حتى يُسجّل المعلمون الواجبات.',
}: HomeworkListProps) {
  if (items.length === 0) {
    return <EmptyState icon={BookOpenCheck} title={emptyTitle} description={emptyDescription} />
  }

  const sorted = [...items].sort((a, b) => Number(a.period ?? 99) - Number(b.period ?? 99))

  return (
    <ul className="space-y-2.5">
      {sorted.map((item, i) => (
        <li
          key={item.id}
          className={cn(
            'rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-[color:var(--pp-ink)]/8 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none',
            item.noHomework && 'bg-[color:var(--pp-sand)] shadow-none'
          )}
          style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[color:var(--pp-ink)]">{item.subjectNameAr}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {item.period ? (
                <span className="shrink-0 whitespace-nowrap rounded-lg bg-[color:var(--pp-sky)] px-2 py-0.5 text-xs font-semibold text-[color:var(--pp-primary)]">
                  ح{item.period}
                </span>
              ) : null}
              {!compact && (
                <span className="shrink-0 whitespace-nowrap text-xs text-[color:var(--pp-ink)]/45">
                  {formatShortDate(item.date)}
                </span>
              )}
            </div>
          </div>
          <p
            className={cn(
              'mt-1.5 text-sm leading-relaxed text-[color:var(--pp-ink)]/75',
              compact && 'line-clamp-2',
              item.noHomework && 'font-medium text-[color:var(--pp-ink)]/50'
            )}
          >
            {item.description}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default HomeworkList
