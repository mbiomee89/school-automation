import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  createStaffEarlyLeave,
  listEarlyLeave,
  reviewEarlyLeave,
  type StaffEarlyLeaveItem,
} from '../../api/earlyLeave'
import { todayDateStr } from '../../api/teacher'
import { ApiError } from '../../api/client'
import { useAuth } from '../../lib/auth'
import { EarlyLeaveReview } from '../../sections/early-leave/EarlyLeaveReview'
import { StaffEarlyLeaveCreateForm } from '../../sections/early-leave/StaffEarlyLeaveCreateForm'
import type { EarlyLeaveStatus } from '../../sections/early-leave/types'
import { EARLY_LEAVE_STATUS_META } from '../../sections/parent-portal/statusMeta'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'
import { useStaffToast } from '../../shared/StaffToast'

const CREATE_ROLES = new Set(['ADMIN', 'STUDENT_AFFAIRS', 'SECURITY_GUARD'])
const REVIEW_ROLES = new Set(['ADMIN', 'STUDENT_AFFAIRS', 'COUNSELOR'])

export function EarlyLeavePage() {
  const { role } = useAuth()
  const showToast = useStaffToast()
  const canCreate = !!role && CREATE_ROLES.has(role)
  const canReview = !!role && REVIEW_ROLES.has(role)
  const isGuard = role === 'SECURITY_GUARD'

  const [date, setDate] = useState(() => todayDateStr())
  const [statusFilter, setStatusFilter] = useState<EarlyLeaveStatus | 'ALL'>(() =>
    isGuard ? 'APPROVED' : 'PENDING'
  )
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

  const headings = useMemo(() => {
    if (isGuard) {
      return {
        eyebrow: 'حارس الأمن',
        title: 'استئذان طالب',
        subtitle: 'تسجيل خروج معتمد عند البوابة وعرض طلبات اليوم',
      }
    }
    return {
      eyebrow: 'شؤون الطلاب · الإدارة',
      title: 'طلبات الاستئذان',
      subtitle: canCreate
        ? 'تسجيل استئذان من المدرسة ومراجعة طلبات أولياء الأمور'
        : 'مراجعة طلبات الخروج المبكر والموافقة عليها أو رفضها',
    }
  }, [canCreate, isGuard])

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
      canReview={canReview}
      eyebrow={headings.eyebrow}
      title={headings.title}
      subtitle={headings.subtitle}
      createSlot={
        canCreate ? (
          <StaffEarlyLeaveCreateForm
            listDate={date}
            onCreate={createStaffEarlyLeave}
            onSuccess={async () => {
              showToast('تم الحفظ')
              try {
                await load()
              } catch {
                /* list refresh best-effort */
              }
            }}
            onConflict={(item, message) => {
              const statusLabel = EARLY_LEAVE_STATUS_META[item.status]?.label ?? item.status
              const source = item.createdByStaff ? 'من المدرسة' : 'من ولي الأمر'
              showToast(`يوجد طلب ${source} — ${item.studentName ?? 'الطالب'} (${statusLabel})`, 'error')
              window.alert(`${message}\nالمصدر: ${source}\nالحالة: ${statusLabel}`)
              void load().catch(() => {})
            }}
            onError={(msg) => {
              showToast(msg, 'error')
            }}
          />
        ) : null
      }
      onDateChange={setDate}
      onStatusFilterChange={setStatusFilter}
      onApprove={
        canReview
          ? async (id) => {
              setReviewingId(id)
              try {
                await reviewEarlyLeave(id, 'APPROVED')
                showToast('تم الاعتماد')
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
            }
          : undefined
      }
      onReject={
        canReview
          ? async (id, note) => {
              setReviewingId(id)
              try {
                await reviewEarlyLeave(id, 'REJECTED', note)
                showToast('تم الرفض')
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
            }
          : undefined
      }
      onPrint={() => window.print()}
    />
  )
}
