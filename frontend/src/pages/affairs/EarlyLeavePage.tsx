import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { listEarlyLeave, reviewEarlyLeave } from '../../api/earlyLeave'
import { todayDateStr } from '../../api/teacher'
import { ApiError } from '../../api/client'
import { EarlyLeaveReview } from '../../sections/early-leave/EarlyLeaveReview'
import type { EarlyLeaveStatus, StaffEarlyLeaveItem } from '../../sections/early-leave/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

export function EarlyLeavePage() {
  const [date, setDate] = useState(() => todayDateStr())
  const [statusFilter, setStatusFilter] = useState<EarlyLeaveStatus | 'ALL'>('PENDING')
  const [items, setItems] = useState<StaffEarlyLeaveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const data = await listEarlyLeave({
      date,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    })
    setItems(data.items)
  }, [date, statusFilter])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!bootstrapped) setLoading(true)
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل طلبات الاستئذان')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setBootstrapped(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrapped only for first paint
  }, [load])

  if (!bootstrapped && loading && !error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (error && !bootstrapped) {
    return (
      <EmptyState
        icon={AlertTriangle}
        tone="error"
        title="تعذّر التحميل"
        description={error}
        actionLabel="إعادة المحاولة"
        onAction={() => {
          setLoading(true)
          load()
            .then(() => setBootstrapped(true))
            .catch((err) => setError(err instanceof ApiError ? err.message : 'فشل'))
            .finally(() => setLoading(false))
        }}
      />
    )
  }

  return (
    <EarlyLeaveReview
      date={date}
      items={items}
      statusFilter={statusFilter}
      reviewingId={reviewingId}
      loading={loading && bootstrapped}
      onDateChange={setDate}
      onStatusFilterChange={setStatusFilter}
      onApprove={async (id) => {
        setReviewingId(id)
        try {
          await reviewEarlyLeave(id, 'APPROVED')
          try {
            await load()
          } catch {
            window.alert('تم الاعتماد لكن فشل تحديث القائمة')
          }
        } catch (err) {
          window.alert(err instanceof ApiError ? err.message : 'فشل الاعتماد')
        } finally {
          setReviewingId(null)
        }
      }}
      onReject={async (id, note) => {
        setReviewingId(id)
        try {
          await reviewEarlyLeave(id, 'REJECTED', note)
          try {
            await load()
          } catch {
            window.alert('تم الرفض لكن فشل تحديث القائمة')
          }
        } catch (err) {
          window.alert(err instanceof ApiError ? err.message : 'فشل الرفض')
        } finally {
          setReviewingId(null)
        }
      }}
      onPrint={() => window.print()}
    />
  )
}
