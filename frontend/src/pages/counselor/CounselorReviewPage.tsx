import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { listAbsenceReasons, reviewAbsenceReason } from '../../api/counselor'
import { ApiError } from '../../api/client'
import { CounselorReview } from '../../sections/counselor-review/CounselorReview'
import type {
  AbsenceReasonItem,
  CounselorTab,
  DateRangeFilter,
} from '../../sections/counselor-review/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

const TAB_STATUS = {
  pending: 'PENDING_REVIEW',
  approved: 'APPROVED',
  rejected: 'REJECTED',
} as const

export function CounselorReviewPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<CounselorTab>('pending')
  const [items, setItems] = useState<AbsenceReasonItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<DateRangeFilter>({ from: null, to: null })

  const load = useCallback(async () => {
    setError(null)
    const list = await listAbsenceReasons({
      status: TAB_STATUS[tab],
      q: query || undefined,
      from: range.from,
      to: range.to,
    })
    setItems(list)
  }, [tab, query, range])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل قائمة الأعذار')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  if (loading && items.length === 0 && !error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (error) {
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
            .catch((err) => setError(err instanceof ApiError ? err.message : 'فشل'))
            .finally(() => setLoading(false))
        }}
      />
    )
  }

  return (
    <CounselorReview
      items={items}
      activeTab={tab}
      onTabChange={setTab}
      onSearchStudents={setQuery}
      onFilterDateRange={setRange}
      onApprove={async (itemId) => {
        try {
          await reviewAbsenceReason(itemId, 'APPROVED')
          await load()
        } catch (err) {
          window.alert(err instanceof ApiError ? err.message : 'فشل الاعتماد')
        }
      }}
      onReject={async (itemId, note) => {
        try {
          await reviewAbsenceReason(itemId, 'REJECTED', note)
          await load()
        } catch (err) {
          window.alert(err instanceof ApiError ? err.message : 'فشل الرفض')
        }
      }}
      onViewAttachment={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
      onDownloadAttachment={(url) => {
        const a = document.createElement('a')
        a.href = url
        a.download = ''
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.click()
      }}
      onPrint={() => window.print()}
      onOpenReportsHub={() => navigate('/reports')}
    />
  )
}
