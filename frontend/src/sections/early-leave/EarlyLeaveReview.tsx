import { useState } from 'react'

import { CheckCircle2, Inbox, Printer, XCircle } from 'lucide-react'

import type { EarlyLeaveReviewProps, EarlyLeaveStatus, StaffEarlyLeaveItem } from './types'

import { Modal } from '../../shared/Modal'

import { EmptyState } from '../../shared/EmptyState'

import { PhoneText } from '../../shared/PhoneText'

import { GregorianDateField } from '../../shared/GregorianDateField'

import { fontArabic } from '../../shared/fonts'

import { SPINNER_CLASS, buttonVariants } from '../../shared/buttonVariants'

import { cn } from '../../shared/utils'

import { EARLY_LEAVE_STATUS_META } from '../parent-portal/statusMeta'

import { formatReportDate } from '../../shared/dates'



const STATUS_FILTERS: Array<{ id: EarlyLeaveStatus | 'ALL'; label: string }> = [

  { id: 'ALL', label: 'الكل' },

  { id: 'PENDING', label: 'قيد المراجعة' },

  { id: 'APPROVED', label: 'معتمدة' },

  { id: 'REJECTED', label: 'مرفوضة' },

  { id: 'CANCELLED', label: 'ملغاة' },

]



function leaveTimeHm(iso: string): string {

  try {

    const d = new Date(iso)

    if (Number.isNaN(d.getTime())) return iso

    return d.toLocaleTimeString('ar-SA', {

      hour: '2-digit',

      minute: '2-digit',

      timeZone: 'UTC',

    })

  } catch {

    return iso

  }

}



function statusBadgeClass(status: EarlyLeaveStatus) {

  const styles: Record<EarlyLeaveStatus, string> = {

    PENDING: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',

    APPROVED: 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300',

    REJECTED: 'bg-red-500/15 text-red-800 dark:text-red-300',

    CANCELLED: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',

  }

  return styles[status]

}



export function EarlyLeaveReview({

  date,

  items,

  statusFilter,

  reviewingId = null,

  loading = false,

  onDateChange,

  onStatusFilterChange,

  onApprove,

  onReject,

  onPrint,

}: EarlyLeaveReviewProps) {

  const [rejectTarget, setRejectTarget] = useState<StaffEarlyLeaveItem | null>(null)

  const [rejectNote, setRejectNote] = useState('')



  function submitReject() {

    if (!rejectTarget) return

    const note = rejectNote.trim()

    if (!note) {

      window.alert('سبب الرفض مطلوب')

      return

    }

    void onReject?.(rejectTarget.id, note)

    setRejectTarget(null)

    setRejectNote('')

  }



  const pendingCount = items.filter((i) => i.status === 'PENDING').length



  return (

    <div

      dir="rtl"

      lang="ar"

      className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50"

      style={fontArabic}

    >

      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-sky-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-sky-950/40 print:hidden">

        <div className="relative flex flex-wrap items-end justify-between gap-4">

          <div>

            <p className="text-xs text-slate-500 dark:text-slate-400">شؤون الطلاب · الإدارة</p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">

              طلبات الاستئذان

            </h1>

            <p className="mt-1 text-slate-600 dark:text-slate-400">

              مراجعة طلبات الخروج المبكر والموافقة عليها أو رفضها

              {pendingCount > 0 ? ` · ${pendingCount} بانتظار المراجعة` : ''}

            </p>

          </div>

          <button

            type="button"

            onClick={() => onPrint?.()}

            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"

          >

            <Printer className="size-4" strokeWidth={1.5} />

            طباعة اليوم

          </button>

        </div>

      </div>



      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">

        <div className="flex flex-wrap items-end gap-3 print:hidden">

          <div className="min-w-[12rem] flex-1">

            <GregorianDateField

              label="التاريخ"

              value={date}

              onChange={(next) => onDateChange?.(next)}

            />

          </div>

        </div>



        <div

          role="tablist"

          aria-label="تصفية الحالة"

          className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 print:hidden dark:border-slate-700 dark:bg-slate-900"

        >

          {STATUS_FILTERS.map((f) => {

            const active = statusFilter === f.id

            return (

              <button

                key={f.id}

                type="button"

                role="tab"

                aria-selected={active}

                onClick={() => onStatusFilterChange?.(f.id)}

                className={cn(

                  'min-h-10 flex-1 rounded-lg px-2.5 text-sm font-medium transition-colors',

                  active

                    ? 'bg-blue-600 text-white'

                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'

                )}

              >

                {f.label}

              </button>

            )

          })}

        </div>



        {loading ? (

          <div className="flex min-h-[20vh] items-center justify-center">

            <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />

          </div>

        ) : items.length === 0 ? (

          <EmptyState
            icon={Inbox}
            title="لا توجد طلبات لهذا اليوم"
            description="جرّب تاريخاً أو حالة أخرى."
          />

        ) : (

          <ul className="space-y-3 report-print-area">

            <li className="mb-2 hidden print:block">

              <h2 className="text-lg font-bold">طلبات الاستئذان — {formatReportDate(date)}</h2>

            </li>

            {items.map((item) => {

              const meta = EARLY_LEAVE_STATUS_META[item.status]

              const busy = reviewingId === item.id

              return (

                <li

                  key={item.id}

                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"

                >

                  <div className="flex flex-wrap items-start justify-between gap-2">

                    <div>

                      <p className="text-base font-bold text-slate-900 dark:text-slate-50">

                        {item.studentName ?? '—'}

                      </p>

                      <p className="mt-0.5 text-sm text-slate-500">

                        {item.className ?? '—'} · خروج {leaveTimeHm(item.leaveTime)}

                      </p>

                    </div>

                    <span

                      className={cn(

                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',

                        statusBadgeClass(item.status)

                      )}

                    >

                      {meta.label}

                    </span>

                  </div>



                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">{item.reason}</p>



                  <p className="mt-2 text-xs text-slate-500">

                    المستلم: {item.pickupName} ({item.pickupRelation}) ·{' '}

                    <PhoneText value={item.pickupPhone} className="text-xs" />

                  </p>



                  {item.reviewNote ? (

                    <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">

                      ملاحظة: {item.reviewNote}

                      {item.reviewerName ? ` · ${item.reviewerName}` : ''}

                    </p>

                  ) : null}



                  {item.status === 'PENDING' ? (

                    <div className="mt-3 flex flex-wrap gap-2 print:hidden">

                      <button

                        type="button"

                        disabled={busy}

                        onClick={() => void onApprove?.(item.id)}

                        className={buttonVariants({

                          variant: 'primary',

                          className: 'min-h-10 cursor-pointer',

                        })}

                      >

                        {busy ? <span className={SPINNER_CLASS} aria-hidden="true" /> : null}

                        <CheckCircle2 className="size-4" strokeWidth={1.75} aria-hidden="true" />

                        اعتماد

                      </button>

                      <button

                        type="button"

                        disabled={busy}

                        onClick={() => {

                          setRejectTarget(item)

                          setRejectNote('')

                        }}

                        className={buttonVariants({

                          variant: 'danger',

                          className: 'min-h-10 cursor-pointer',

                        })}

                      >

                        <XCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />

                        رفض

                      </button>

                    </div>

                  ) : null}

                </li>

              )

            })}

          </ul>

        )}

      </div>



      <Modal

        open={!!rejectTarget}

        onClose={() => {

          if (reviewingId) return

          setRejectTarget(null)

          setRejectNote('')

        }}

        title="رفض طلب الاستئذان"

        description="أدخل سبب الرفض ليظهر لولي الأمر."

        maxWidthClassName="max-w-sm"

      >

        <label className="mt-2 block text-sm">

          <span className="mb-1 block text-slate-600 dark:text-slate-300">سبب الرفض</span>

          <textarea

            rows={3}

            value={rejectNote}

            onChange={(e) => setRejectNote(e.target.value)}

            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"

            placeholder="مطلوب"

          />

        </label>

        <div className="mt-3 flex gap-2">

          <button

            type="button"

            onClick={submitReject}

            className={buttonVariants({ variant: 'danger', className: 'min-h-11 flex-1 cursor-pointer' })}

          >

            تأكيد الرفض

          </button>

          <button

            type="button"

            onClick={() => {

              setRejectTarget(null)

              setRejectNote('')

            }}

            className={buttonVariants({

              variant: 'secondary',

              className: 'min-h-11 flex-1 cursor-pointer',

            })}

          >

            إلغاء

          </button>

        </div>

      </Modal>

    </div>

  )

}



export default EarlyLeaveReview


