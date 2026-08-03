import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { listAbsenceReasons, reviewAbsenceReason } from '../../api/counselor'
import { ApiError, getToken } from '../../api/client'
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

async function fetchAttachment(apiPath: string, download: boolean) {
  const token = getToken()
  const url = download
    ? `${apiPath}${apiPath.includes('?') ? '&' : '?'}download=1`
    : apiPath
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    let message = `تعذّر الوصول للمرفق (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const mime = res.headers.get('Content-Type') || 'application/octet-stream'
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = /filename="([^"]+)"/i.exec(disposition)
  const fileName = match?.[1] || `attachment-${Date.now()}`
  const blob = await res.blob()
  return { blob, mime, fileName }
}

export function CounselorReviewPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<CounselorTab>('pending')
  const [items, setItems] = useState<AbsenceReasonItem[]>([])
  const [loading, setLoading] = useState(true)
  const [bootstrapped, setBootstrapped] = useState(false)
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
      // Full-page spinner only on first paint — never unmount the form while
      // refining search/date filters (that was closing the calendar mid-pick).
      if (!bootstrapped) setLoading(true)
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل قائمة الأعذار')
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
    // bootstrapped intentionally omitted: including it would re-fetch right after first paint
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
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
      onResolveAttachment={async (apiPath) => {
        const { blob, mime, fileName } = await fetchAttachment(apiPath, false)
        return { objectUrl: URL.createObjectURL(blob), mime, fileName }
      }}
      onDownloadAttachment={async (apiPath) => {
        try {
          const { blob, fileName } = await fetchAttachment(apiPath, true)
          const objectUrl = URL.createObjectURL(blob)
          try {
            const a = document.createElement('a')
            a.href = objectUrl
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            a.remove()
          } finally {
            URL.revokeObjectURL(objectUrl)
          }
        } catch (err) {
          window.alert(err instanceof Error ? err.message : 'فشل تنزيل المرفق')
        }
      }}
      onPrint={() => window.print()}
      onOpenReportsHub={() => navigate('/reports')}
    />
  )
}
