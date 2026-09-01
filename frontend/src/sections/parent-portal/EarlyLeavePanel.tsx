import { useState, type FormEvent } from 'react'

import { DoorOpen, Inbox, AlertCircle } from 'lucide-react'

import type { EarlyLeaveRequest, EarlyLeaveSubmitInput } from './types'

import { Badge } from '../../shared/Badge'

import { EmptyState } from '../../shared/EmptyState'

import { PhoneText } from '../../shared/PhoneText'

import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'

import { DayChipStrip } from './DayChipStrip'

import { EARLY_LEAVE_STATUS_META, formatLongDate, formatDateTime } from './statusMeta'

import { schoolTodayIso, addDaysIso } from './theme'



function leaveTimeHm(isoOrHm: string): string {

  if (/^\d{1,2}:\d{2}$/.test(isoOrHm.trim())) return isoOrHm.trim()

  try {

    const d = new Date(isoOrHm)

    if (Number.isNaN(d.getTime())) return isoOrHm

    const h = String(d.getUTCHours()).padStart(2, '0')

    const m = String(d.getUTCMinutes()).padStart(2, '0')

    return `${h}:${m}`

  } catch {

    return isoOrHm

  }

}



export interface EarlyLeavePanelProps {

  today: string

  requests: EarlyLeaveRequest[]

  onSubmit?: (input: EarlyLeaveSubmitInput) => void | Promise<void>

  onCancel?: (requestId: number) => void | Promise<void>

  onToast?: (message: string) => void

}



export function EarlyLeavePanel({

  today,

  requests,

  onSubmit,

  onCancel,

  onToast,

}: EarlyLeavePanelProps) {

  const [date, setDate] = useState(today || schoolTodayIso())

  const [leaveTime, setLeaveTime] = useState('10:00')

  const [reason, setReason] = useState('')

  const [pickupName, setPickupName] = useState('')

  const [pickupRelation, setPickupRelation] = useState('')

  const [pickupPhone, setPickupPhone] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const [cancellingId, setCancellingId] = useState<number | null>(null)



  const fieldClass =

    'mt-1 w-full min-h-11 rounded-xl border border-[color:var(--pp-ink)]/15 bg-white px-3 text-sm text-[color:var(--pp-ink)] placeholder:text-[color:var(--pp-ink)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]'



  async function handleSubmit(e: FormEvent) {

    e.preventDefault()

    if (!onSubmit) return

    const payload: EarlyLeaveSubmitInput = {

      date,

      leaveTime,

      reason: reason.trim(),

      pickupName: pickupName.trim(),

      pickupRelation: pickupRelation.trim(),

      pickupPhone: pickupPhone.trim(),

    }

    if (!payload.reason || !payload.pickupName || !payload.pickupRelation || !payload.pickupPhone) {

      onToast?.('أكمل جميع الحقول المطلوبة')

      return

    }

    setSubmitting(true)

    try {

      await onSubmit(payload)

      setReason('')

      setPickupName('')

      setPickupRelation('')

      setPickupPhone('')

      onToast?.('تم إرسال طلب الاستئذان')

    } catch (err) {

      onToast?.(err instanceof Error ? err.message : 'فشل إرسال الطلب')

    } finally {

      setSubmitting(false)

    }

  }



  async function handleCancel(id: number) {

    if (!onCancel) return

    setCancellingId(id)

    try {

      await onCancel(id)

      onToast?.('تم إلغاء الطلب')

    } catch (err) {

      onToast?.(err instanceof Error ? err.message : 'فشل إلغاء الطلب')

    } finally {

      setCancellingId(null)

    }

  }



  const sorted = [...requests].sort((a, b) => {

    if (a.date !== b.date) return a.date < b.date ? 1 : -1

    return a.requestedAt < b.requestedAt ? 1 : -1

  })



  return (

    <div className="space-y-5 animate-in fade-in-0 duration-300 motion-reduce:animate-none">

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[color:var(--pp-ink)]/8">

        <div className="mb-3 flex items-center gap-2">

          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[color:var(--pp-primary-soft)] text-[color:var(--pp-primary)]">

            <DoorOpen className="size-5" strokeWidth={1.75} aria-hidden="true" />

          </span>

          <div>

            <h2 className="text-base font-bold text-[color:var(--pp-ink)]">طلب استئذان</h2>

            <p className="text-xs text-[color:var(--pp-ink)]/50">خروج مبكر خلال أيام الدوام</p>

          </div>

        </div>



        <form onSubmit={handleSubmit} className="space-y-3">

          <DayChipStrip
            value={date}
            today={today}
            onChange={setDate}
            label="يوم الاستئذان"
            minDate={today}
            maxDate={addDaysIso(today, 7)}
          />



          <label className="block text-sm">

            <span className="font-medium text-[color:var(--pp-ink)]/70">وقت الخروج</span>

            <input

              type="time"

              required

              value={leaveTime}

              onChange={(e) => setLeaveTime(e.target.value)}

              className={fieldClass}

              dir="ltr"

            />

          </label>



          <label className="block text-sm">

            <span className="font-medium text-[color:var(--pp-ink)]/70">سبب الاستئذان</span>

            <textarea

              required

              rows={2}

              value={reason}

              onChange={(e) => setReason(e.target.value)}

              placeholder="مثال: موعد طبي"

              className={`${fieldClass} py-2.5`}

            />

          </label>



          <label className="block text-sm">

            <span className="font-medium text-[color:var(--pp-ink)]/70">اسم المستلم</span>

            <input

              type="text"

              required

              value={pickupName}

              onChange={(e) => setPickupName(e.target.value)}

              className={fieldClass}

              autoComplete="name"

            />

          </label>



          <label className="block text-sm">

            <span className="font-medium text-[color:var(--pp-ink)]/70">صلة القرابة</span>

            <input

              type="text"

              required

              value={pickupRelation}

              onChange={(e) => setPickupRelation(e.target.value)}

              placeholder="أب / أم / ولي أمر…"

              className={fieldClass}

            />

          </label>



          <label className="block text-sm">

            <span className="font-medium text-[color:var(--pp-ink)]/70">جوال المستلم</span>

            <input

              type="tel"

              required

              value={pickupPhone}

              onChange={(e) => setPickupPhone(e.target.value)}

              placeholder="+9665XXXXXXXX"

              className={fieldClass}

              dir="ltr"

            />

          </label>



          <button

            type="submit"

            disabled={submitting}

            className={buttonVariants({

              variant: 'primary',

              className: 'mt-1 w-full min-h-11 cursor-pointer',

            })}

          >

            {submitting ? <span className={SPINNER_CLASS} aria-hidden="true" /> : null}

            إرسال الطلب

          </button>

        </form>

      </section>



      <section className="space-y-2.5">

        <h2 className="text-sm font-bold text-[color:var(--pp-ink)]">طلباتي</h2>

        {sorted.length === 0 ? (

          <EmptyState

            icon={Inbox}

            title="لا توجد طلبات استئذان"

            description="عند إرسال طلب، ستظهر حالته هنا."

          />

        ) : (

          <ul className="space-y-3">

            {sorted.map((req) => {

              const meta = EARLY_LEAVE_STATUS_META[req.status]

              const canCancel = req.status === 'PENDING' || req.status === 'APPROVED'

              return (

                <li

                  key={req.id}

                  className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[color:var(--pp-ink)]/8"

                >

                  <div className="flex flex-wrap items-start justify-between gap-2">

                    <div>

                      <p className="text-sm font-bold text-[color:var(--pp-ink)]">

                        {formatLongDate(req.date)} · {leaveTimeHm(req.leaveTime)}

                      </p>

                      <p className="mt-0.5 text-xs text-[color:var(--pp-ink)]/50">

                        {req.className ?? '—'}

                      </p>

                    </div>

                    <Badge tone={meta.tone} label={meta.label} icon={meta.icon} />

                  </div>



                  <p className="mt-2 text-sm text-[color:var(--pp-ink)]/75">{req.reason}</p>



                  <p className="mt-2 text-xs text-[color:var(--pp-ink)]/55">

                    المستلم: {req.pickupName} ({req.pickupRelation}) ·{' '}

                    <PhoneText value={req.pickupPhone} className="text-xs" />

                  </p>



                  {req.status === 'REJECTED' && req.reviewNote ? (

                    <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[color:var(--pp-danger-soft)] px-3 py-2 text-xs text-[color:var(--pp-danger)]">

                      <AlertCircle

                        className="mt-0.5 size-3.5 shrink-0"

                        strokeWidth={1.75}

                        aria-hidden="true"

                      />

                      <span>

                        <span className="font-semibold">ملاحظة المراجعة: </span>

                        {req.reviewNote}

                      </span>

                    </p>

                  ) : null}



                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">

                    <p className="text-xs text-[color:var(--pp-ink)]/40">

                      أُرسل {formatDateTime(req.requestedAt)}

                    </p>

                    {canCancel ? (

                      <button

                        type="button"

                        disabled={cancellingId === req.id}

                        onClick={() => void handleCancel(req.id)}

                        className={buttonVariants({

                          variant: 'secondary',

                          className: 'min-h-10 cursor-pointer text-xs',

                        })}

                      >

                        {cancellingId === req.id ? (

                          <span className={SPINNER_CLASS} aria-hidden="true" />

                        ) : null}

                        إلغاء الطلب

                      </button>

                    ) : null}

                  </div>

                </li>

              )

            })}

          </ul>

        )}

      </section>

    </div>

  )

}



export default EarlyLeavePanel


