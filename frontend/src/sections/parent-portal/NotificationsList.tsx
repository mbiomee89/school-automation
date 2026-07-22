import { BellOff } from 'lucide-react'
import type { NotificationItem } from './types'
import { Badge } from '../../shared/Badge'
import { EmptyState } from '../../shared/EmptyState'
import { TONE_CLASSES } from '../../shared/colors'
import { NOTIFICATION_EVENT_META, NOTIFICATION_STATUS_META, formatDateTime } from './statusMeta'

export interface NotificationsListProps {
  notifications: NotificationItem[]
}

/** In-app log mirroring what was (or wasn't) sent to the parent over WhatsApp — view-only, no push here. */
export function NotificationsList({ notifications }: NotificationsListProps) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="لا توجد إشعارات"
        description="ستظهر هنا رسائل الغياب والتأخر وملخصات الواجبات والخطة الأسبوعية."
      />
    )
  }

  // "قائمة مرتّبة زمنياً" — sort by sentAt descending (most recent first). Items
  // with no sentAt yet (QUEUED, or FAILED before a timestamp was recorded) are
  // surfaced at the top since they're the most current, unresolved concern.
  const sorted = [...notifications].sort((a, b) => {
    const aKey = a.sentAt ?? '9999-12-31'
    const bKey = b.sentAt ?? '9999-12-31'
    if (aKey === bKey) return 0
    return aKey < bKey ? 1 : -1
  })

  return (
    <ul className="space-y-3">
      {sorted.map((n) => {
        const eventMeta = NOTIFICATION_EVENT_META[n.eventType]
        const statusMeta = NOTIFICATION_STATUS_META[n.status]
        const EventIcon = eventMeta.icon
        const eventTone = TONE_CLASSES[n.status === 'FAILED' ? 'red' : 'blue']
        return (
          <li
            key={n.id}
            className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <span
              className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${eventTone.bg} ${eventTone.text}`}
              aria-hidden="true"
            >
              <EventIcon className="size-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{eventMeta.label}</p>
                <Badge tone={statusMeta.tone} label={statusMeta.label} icon={statusMeta.icon} />
              </div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{n.summary}</p>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                {n.sentAt ? formatDateTime(n.sentAt) : 'لم يُرسل بعد'}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default NotificationsList
