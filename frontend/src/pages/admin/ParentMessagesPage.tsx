import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, MessageSquareText } from 'lucide-react'
import {
  getParentContactPendingCount,
  listParentContactMessages,
  replyParentContactMessage,
} from '../../api/parentContact'
import { ApiError } from '../../api/client'
import type { ParentContactAdminItem, ParentContactKind } from '../../sections/parent-portal/types'
import { EmptyState } from '../../shared/EmptyState'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic, fontMono } from '../../shared/fonts'
import { useStaffToast } from '../../shared/StaffToast'
import { cn } from '../../shared/utils'

type StatusFilter = 'OPEN' | 'CLOSED' | 'all'

const KIND_AR: Record<ParentContactKind, string> = {
  SUGGESTION: 'اقتراح',
  COMPLAINT: 'شكوى',
  OTHER: 'أخرى',
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

export function ParentMessagesPage() {
  const showToast = useStaffToast()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN')
  const [items, setItems] = useState<ParentContactAdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, count] = await Promise.all([
        listParentContactMessages(statusFilter),
        getParentContactPendingCount(),
      ])
      setItems(list)
      setPendingCount(count)
      setSelectedId((prev) => {
        if (prev != null && list.some((i) => i.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تحميل الرسائل')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const selected = selectedId != null ? items.find((i) => i.id === selectedId) ?? null : null

  useEffect(() => {
    setReplyBody('')
  }, [selectedId])

  async function submitReply() {
    if (!selected || selected.status !== 'OPEN') return
    const text = replyBody.trim()
    if (!text) {
      showToast('اكتب نص الرد قبل الإرسال')
      return
    }
    setReplyBusy(true)
    try {
      const updated = await replyParentContactMessage(selected.id, text)
      showToast('تم إرسال الرد وإغلاق الحالة')
      setItems((prev) => {
        if (statusFilter === 'OPEN') return prev.filter((i) => i.id !== updated.id)
        return prev.map((i) => (i.id === updated.id ? updated : i))
      })
      setPendingCount((c) => Math.max(0, c - 1))
      window.dispatchEvent(new CustomEvent('parent-contact-pending-changed'))
      if (statusFilter === 'OPEN') {
        setSelectedId(null)
      } else {
        setSelectedId(updated.id)
      }
      setReplyBody('')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'تعذّر إرسال الرد')
    } finally {
      setReplyBusy(false)
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (error && items.length === 0) {
    return <EmptyState icon={AlertTriangle} tone="error" title="تعذّر التحميل" description={error} />
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
      style={fontArabic}
    >
      <div className="border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-sky-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-sky-950/30">
        <p className="text-sm font-medium text-slate-500">الإدارة المدرسية</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">رسائل أولياء الأمور</h1>
          {pendingCount > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
              {pendingCount} مفتوحة
            </span>
          ) : null}
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          ردّ الإدارة يغلق الحالة. الرسائل الملغاة من ولي الأمر لا تظهر هنا.
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] sm:px-6">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'OPEN' as const, label: 'مفتوحة' },
                { id: 'CLOSED' as const, label: 'مغلقة' },
                { id: 'all' as const, label: 'الكل' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'min-h-10 rounded-full border px-3 text-sm font-medium',
                  statusFilter === f.id
                    ? 'border-sky-600 bg-sky-50 text-sky-900 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-100'
                    : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                )}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-10 rounded-full border border-slate-300 px-3 text-sm dark:border-slate-600"
            >
              تحديث
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm" role="alert">
              {error}
            </div>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              icon={MessageSquareText}
              title="لا رسائل في هذا العرض"
              description={
                statusFilter === 'OPEN'
                  ? 'لا توجد حالات مفتوحة حالياً.'
                  : 'جرّب فلترًا آخر.'
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'w-full px-4 py-3 text-start hover:bg-slate-50 dark:hover:bg-slate-800/60',
                      selectedId === item.id && 'bg-sky-50/80 dark:bg-sky-950/30'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-50">
                        {item.studentNameAr ?? item.studentId}
                      </p>
                      <span className="text-xs text-slate-500">{formatWhen(item.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.gradeLevel ? `صف ${item.gradeLevel}` : 'بدون فصل'}
                      {item.className ? ` · ${item.className}` : ''}
                      {' · '}
                      {KIND_AR[item.kind]}
                      {' · '}
                      {item.status === 'OPEN'
                        ? 'مفتوحة'
                        : item.status === 'CLOSED'
                          ? 'مغلقة'
                          : 'ملغاة'}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">
                      {item.body}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {!selected ? (
            <p className="text-sm text-slate-500">اختر رسالة من القائمة.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">{selected.studentNameAr}</h2>
                <p className="text-xs text-slate-500" style={fontMono}>
                  {selected.studentId}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {selected.gradeLevel ? `صف ${selected.gradeLevel}` : 'بدون فصل'}
                  {selected.className ? ` · ${selected.className}` : ''}
                </p>
                <p className="mt-2 text-xs font-medium text-sky-800 dark:text-sky-200">
                  {KIND_AR[selected.kind]} ·{' '}
                  {selected.status === 'OPEN'
                    ? 'مفتوحة'
                    : selected.status === 'CLOSED'
                      ? 'مغلقة'
                      : 'ملغاة'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">الرسالة</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{selected.body}</p>
                <p className="mt-2 text-xs text-slate-400">{formatWhen(selected.createdAt)}</p>
              </div>

              {selected.status === 'CLOSED' ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    رد الإدارة
                    {selected.repliedByName ? ` · ${selected.repliedByName}` : ''}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{selected.replyBody}</p>
                  {selected.repliedAt ? (
                    <p className="mt-2 text-xs text-slate-500">{formatWhen(selected.repliedAt)}</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">الرد</span>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={5}
                      maxLength={2000}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                      placeholder="اكتب رد الإدارة…"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={replyBusy || !replyBody.trim()}
                    onClick={() => void submitReply()}
                    className={buttonVariants({ variant: 'primary', className: 'min-h-11 w-full' })}
                  >
                    {replyBusy ? 'جارٍ الإرسال…' : 'إرسال الرد وإغلاق الحالة'}
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
