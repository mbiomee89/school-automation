import { useEffect, useMemo, useState } from 'react'
import {
  Printer,
  Search,
  Paperclip,
  FileBarChart2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Download,
  Eye,
  X,
} from 'lucide-react'
import type {
  AbsenceReasonItem,
  AbsenceReasonStatus,
  CounselorReviewProps,
  CounselorTab,
} from './types'
import { cn } from '../../shared/utils'
import { Modal } from '../../shared/Modal'
import { GregorianDateField } from '../../shared/GregorianDateField'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

const TABS: { id: CounselorTab; label: string; status: AbsenceReasonStatus }[] = [
  { id: 'pending', label: 'قيد المراجعة', status: 'PENDING_REVIEW' },
  { id: 'approved', label: 'مقبولة', status: 'APPROVED' },
  { id: 'rejected', label: 'مرفوضة', status: 'REJECTED' },
]

const fontSerif = { fontFamily: '"Amiri", "Times New Roman", serif' } as const
const fontMono = { fontFamily: '"IBM Plex Mono", ui-monospace, monospace' } as const

function statusBadgeClass(status: AbsenceReasonStatus) {
  const styles: Record<AbsenceReasonStatus, string> = {
    PENDING_REVIEW: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    APPROVED: 'bg-lime-500/15 text-lime-800 dark:text-lime-300',
    REJECTED: 'bg-red-500/15 text-red-800 dark:text-red-300',
  }
  return styles[status]
}

function isImageMime(mime: string) {
  return mime.startsWith('image/')
}

function isPdfMime(mime: string) {
  return mime === 'application/pdf' || mime.includes('pdf')
}

type LightboxState = {
  objectUrl: string
  mime: string
  fileName: string
  apiPath: string
}

export function CounselorReview({
  items,
  activeTab: controlledTab,
  onTabChange,
  onSearchStudents,
  onFilterDateRange,
  onSelectItem,
  onResolveAttachment,
  onDownloadAttachment,
  onApprove,
  onReject,
  onPrint,
  onOpenReportsHub,
}: CounselorReviewProps) {
  const [tab, setTab] = useState<CounselorTab>(controlledTab ?? 'pending')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [attachmentBusy, setAttachmentBusy] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AbsenceReasonItem | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  useEffect(() => {
    return () => {
      if (lightbox?.objectUrl.startsWith('blob:')) URL.revokeObjectURL(lightbox.objectUrl)
    }
  }, [lightbox])

  async function openAttachment(apiPath: string) {
    if (!onResolveAttachment) return
    setAttachmentBusy(apiPath)
    try {
      const resolved = await onResolveAttachment(apiPath)
      setLightbox((prev) => {
        if (prev?.objectUrl.startsWith('blob:')) URL.revokeObjectURL(prev.objectUrl)
        return { ...resolved, apiPath }
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'تعذّر عرض المرفق')
    } finally {
      setAttachmentBusy(null)
    }
  }

  const currentTab = controlledTab ?? tab
  const currentStatus = TABS.find((t) => t.id === currentTab)?.status ?? 'PENDING_REVIEW'

  const switchTab = (next: CounselorTab) => {
    setTab(next)
    onTabChange?.(next)
  }

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (item.status !== currentStatus) return false
      if (q && !item.studentName.toLowerCase().includes(q) && !item.studentName.includes(query.trim())) {
        return false
      }
      if (dateFrom && item.absenceDate < dateFrom) return false
      if (dateTo && item.absenceDate > dateTo) return false
      return true
    })
  }, [items, currentStatus, query, dateFrom, dateTo])

  const pendingCount = items.filter((i) => i.status === 'PENDING_REVIEW').length
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null

  function openCase(item: AbsenceReasonItem) {
    setSelectedItemId(item.id)
    onSelectItem?.(item.id)
  }

  function submitReject() {
    if (!rejectTarget) return
    onReject?.(rejectTarget.id, rejectNote.trim() || undefined)
    setRejectTarget(null)
    setRejectNote('')
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-full bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-50"
      style={fontSerif}
    >
      <div className="relative overflow-hidden border-b border-stone-200 bg-gradient-to-bl from-stone-100 via-white to-lime-50 px-4 py-6 sm:px-6 dark:border-stone-800 dark:from-stone-900 dark:via-stone-950 dark:to-lime-950/40 print:hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">منصة إدارة المدرسة</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
              مراجعة الأعذار
            </h1>
            <p className="mt-1 text-stone-600 dark:text-stone-400">
              مراجعة أعذار الغياب المقدّمة من أولياء الأمور والموافقة عليها أو رفضها
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenReportsHub?.()}
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
            >
              <FileBarChart2 className="size-4" strokeWidth={1.5} />
              التقارير
            </button>
            <button
              type="button"
              onClick={() => onPrint?.(selectedItemId != null ? 'case' : 'list', selectedItemId ?? undefined)}
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
            >
              <Printer className="size-4" strokeWidth={1.5} />
              طباعة
            </button>
          </div>
        </div>
      </div>

      {selectedItem ? (
        <div className="mx-auto max-w-3xl p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setSelectedItemId(null)}
            className="mb-4 inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50 print:hidden"
          >
            <ArrowRight className="size-4" strokeWidth={1.5} />
            رجوع إلى القائمة
          </button>

          <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{selectedItem.studentName}</h2>
                <p className="text-stone-500">
                  {selectedItem.className} · رقم الهوية/الإقامة{' '}
                  <span style={fontMono}>{selectedItem.studentId}</span>
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  statusBadgeClass(selectedItem.status)
                )}
              >
                {TABS.find((t) => t.status === selectedItem.status)?.label}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-stone-500 dark:text-stone-400">تاريخ الغياب</dt>
                <dd className="mt-0.5 font-semibold" style={fontMono}>
                  {selectedItem.absenceDate}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500 dark:text-stone-400">تاريخ التقديم</dt>
                <dd className="mt-0.5" style={fontMono}>
                  {new Date(selectedItem.submittedAt).toLocaleString('ar-SA')}
                </dd>
              </div>
              {selectedItem.reviewedAt && (
                <>
                  <div>
                    <dt className="text-stone-500 dark:text-stone-400">تاريخ المراجعة</dt>
                    <dd className="mt-0.5" style={fontMono}>
                      {new Date(selectedItem.reviewedAt).toLocaleString('ar-SA')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-500 dark:text-stone-400">المرشد المراجع</dt>
                    <dd className="mt-0.5">{selectedItem.reviewerName}</dd>
                  </div>
                </>
              )}
            </dl>

            <h3 className="mt-5 mb-1 text-sm font-bold text-stone-700 dark:text-stone-300">
              السبب المقدّم
            </h3>
            <p className="whitespace-pre-wrap text-sm text-stone-800 dark:text-stone-200">
              {selectedItem.reasonText}
            </p>

            {selectedItem.attachments.length > 0 && (
              <div className="mt-4 print:hidden">
                <h3 className="mb-2 text-sm font-bold text-stone-700 dark:text-stone-300">
                  المرفقات
                </h3>
                <ul className="space-y-2">
                  {selectedItem.attachments.map((url) => (
                    <li
                      key={url}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                    >
                      <div className="flex min-w-0 items-center gap-2 text-xs text-stone-700 dark:text-stone-200">
                        <Paperclip className="size-3.5 shrink-0" strokeWidth={1.5} />
                        <span className="truncate">مرفق العذر</span>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          disabled={attachmentBusy === url}
                          onClick={() => void openAttachment(url)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-lime-50 disabled:opacity-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-lime-950/30"
                        >
                          {attachmentBusy === url ? (
                            <span className={SPINNER_CLASS} aria-hidden="true" />
                          ) : (
                            <Eye className="size-3.5" strokeWidth={1.5} />
                          )}
                          عرض
                        </button>
                        <button
                          type="button"
                          disabled={attachmentBusy === url}
                          onClick={() => void onDownloadAttachment?.(url)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-lime-500 px-2.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-lime-400 disabled:opacity-50"
                        >
                          <Download className="size-3.5" strokeWidth={1.5} />
                          تنزيل
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedItem.counselorNote && (
              <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                <span className="font-semibold">ملاحظة الرفض: </span>
                {selectedItem.counselorNote}
              </div>
            )}

            {selectedItem.status === 'PENDING_REVIEW' && (
              <div className="mt-6 flex gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onApprove?.(selectedItem.id)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-lime-500 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-lime-400"
                >
                  <CheckCircle2 className="size-4" strokeWidth={1.5} />
                  قبول العذر
                </button>
                <button
                  type="button"
                  onClick={() => setRejectTarget(selectedItem)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  <XCircle className="size-4" strokeWidth={1.5} />
                  رفض العذر
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur dark:border-stone-800 dark:bg-stone-900/90 print:hidden">
            <div className="flex gap-1 overflow-x-auto px-2 sm:px-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => switchTab(t.id)}
                  className={cn(
                    'shrink-0 border-b-2 px-3 py-3 text-sm transition-colors',
                    currentTab === t.id
                      ? 'border-lime-500 font-semibold text-lime-800 dark:text-lime-300'
                      : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                  )}
                >
                  {t.label}
                  {t.id === 'pending' && pendingCount > 0 && (
                    <span className="ms-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-5xl p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    onSearchStudents?.(e.target.value)
                  }}
                  placeholder="ابحث باسم الطالب…"
                  className="w-full rounded-md border border-stone-300 bg-white py-2 pe-3 ps-10 text-sm dark:border-stone-700 dark:bg-stone-900"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <GregorianDateField
                  label="من"
                  value={dateFrom}
                  placeholder="من تاريخ"
                  onChange={(next) => {
                    setDateFrom(next)
                    onFilterDateRange?.({ from: next || null, to: dateTo || null })
                  }}
                />
                <GregorianDateField
                  label="إلى"
                  value={dateTo}
                  placeholder="إلى تاريخ"
                  onChange={(next) => {
                    setDateTo(next)
                    onFilterDateRange?.({ from: dateFrom || null, to: next || null })
                  }}
                />
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom('')
                      setDateTo('')
                      onFilterDateRange?.({ from: null, to: null })
                    }}
                    aria-label="مسح تصفية التاريخ"
                    className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 md:block">
              <table className="w-full text-start text-sm">
                <thead className="bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">الطالب</th>
                    <th className="px-3 py-2 font-medium">تاريخ الغياب</th>
                    <th className="px-3 py-2 font-medium">السبب</th>
                    <th className="px-3 py-2 font-medium print:hidden" />
                    {currentTab !== 'pending' && (
                      <th className="px-3 py-2 font-medium">المراجعة</th>
                    )}
                    <th className="px-3 py-2 font-medium print:hidden" />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-stone-100 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/50"
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-start hover:text-lime-700 dark:hover:text-lime-300"
                          onClick={() => openCase(item)}
                        >
                          <div className="font-semibold">{item.studentName}</div>
                          <div className="text-xs text-stone-500">{item.className}</div>
                        </button>
                      </td>
                      <td className="px-3 py-2" style={fontMono}>
                        {item.absenceDate}
                      </td>
                      <td className="max-w-xs px-3 py-2">
                        <span className="line-clamp-2 text-stone-700 dark:text-stone-300">
                          {item.reasonText}
                        </span>
                      </td>
                      <td className="px-3 py-2 print:hidden">
                        {item.attachments.length > 0 && (
                          <Paperclip className="size-4 text-stone-400" strokeWidth={1.5} />
                        )}
                      </td>
                      {currentTab !== 'pending' && (
                        <td className="px-3 py-2 text-stone-500">
                          {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString('ar-SA') : ''}
                        </td>
                      )}
                      <td className="px-3 py-2 text-end print:hidden">
                        {item.status === 'PENDING_REVIEW' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-lime-700 underline hover:text-lime-900 dark:text-lime-300"
                              onClick={() => onApprove?.(item.id)}
                            >
                              قبول
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-red-600 underline hover:text-red-800"
                              onClick={() => setRejectTarget(item)}
                            >
                              رفض
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-stone-600 underline hover:text-stone-900 dark:text-stone-300"
                            onClick={() => openCase(item)}
                          >
                            عرض
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredItems.length === 0 && (
                <p className="p-6 text-center text-sm text-stone-500">لا توجد حالات مطابقة.</p>
              )}
            </div>

            <div className="space-y-3 md:hidden">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
                >
                  <button type="button" className="w-full text-start" onClick={() => openCase(item)}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-lg font-bold">{item.studentName}</div>
                        <div className="text-sm text-stone-500">{item.className}</div>
                      </div>
                      {item.attachments.length > 0 && (
                        <Paperclip className="mt-1 size-4 shrink-0 text-stone-400" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="mt-2 text-xs text-stone-500" style={fontMono}>
                      {item.absenceDate}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-stone-700 dark:text-stone-300">
                      {item.reasonText}
                    </p>
                  </button>
                  {item.status === 'PENDING_REVIEW' ? (
                    <div className="mt-3 flex gap-3 border-t border-stone-100 pt-3 dark:border-stone-800">
                      <button
                        type="button"
                        className="text-xs font-medium text-lime-700 underline dark:text-lime-300"
                        onClick={() => onApprove?.(item.id)}
                      >
                        قبول
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-red-600 underline"
                        onClick={() => setRejectTarget(item)}
                      >
                        رفض
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500 dark:border-stone-800">
                      {item.reviewedAt && new Date(item.reviewedAt).toLocaleDateString('ar-SA')}
                    </div>
                  )}
                </div>
              ))}
              {filteredItems.length === 0 && (
                <p className="p-6 text-center text-sm text-stone-500">لا توجد حالات مطابقة.</p>
              )}
            </div>
          </div>
        </>
      )}

      <Modal
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null)
          setRejectNote('')
        }}
        title="رفض العذر"
        description={rejectTarget ? `الطالب: ${rejectTarget.studentName}` : undefined}
        maxWidthClassName="max-w-sm"
      >
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-stone-600 dark:text-stone-400">ملاحظة (اختياري)</span>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="اذكر سبب الرفض لولي الأمر…"
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={submitReject}
              className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              تأكيد الرفض
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm dark:border-stone-600"
              onClick={() => {
                setRejectTarget(null)
                setRejectNote('')
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!lightbox}
        onClose={() => {
          setLightbox((prev) => {
            if (prev?.objectUrl.startsWith('blob:')) URL.revokeObjectURL(prev.objectUrl)
            return null
          })
        }}
        title="المرفق"
        maxWidthClassName="max-w-lg"
      >
        {lightbox && (
          <div className="flex flex-col items-center gap-3">
            {isImageMime(lightbox.mime) ? (
              <img
                src={lightbox.objectUrl}
                alt="مرفق العذر"
                className="max-h-[60vh] w-full rounded-md border border-stone-200 object-contain dark:border-stone-700"
              />
            ) : isPdfMime(lightbox.mime) ? (
              <iframe
                title={lightbox.fileName}
                src={lightbox.objectUrl}
                className="h-[60vh] w-full rounded-md border border-stone-200 bg-white dark:border-stone-700"
              />
            ) : (
              <div className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-stone-300 bg-stone-50 p-8 text-stone-500 dark:border-stone-700 dark:bg-stone-900">
                <Paperclip className="size-8" strokeWidth={1.5} />
                <span className="text-sm" style={fontMono}>
                  {lightbox.fileName}
                </span>
                <p className="text-xs">معاينة هذا النوع غير متاحة — استخدم التنزيل</p>
              </div>
            )}
            <div className="flex w-full gap-2 print:hidden">
              <a
                href={lightbox.objectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
              >
                <Eye className="size-4" strokeWidth={1.5} />
                فتح في تبويب جديد
              </a>
              <button
                type="button"
                onClick={() => void onDownloadAttachment?.(lightbox.apiPath)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-lime-500 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-lime-400"
              >
                <Download className="size-4" strokeWidth={1.5} />
                تنزيل المرفق
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default CounselorReview
