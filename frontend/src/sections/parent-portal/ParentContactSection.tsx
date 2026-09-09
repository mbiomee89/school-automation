import { useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { ApiError } from '../../api/client'
import { Modal } from '../../shared/Modal'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { cn } from '../../shared/utils'
import type { ParentContactKind, ParentContactMessage } from './types'

const KIND_OPTIONS: Array<{ value: ParentContactKind; label: string }> = [
  { value: 'SUGGESTION', label: 'اقتراح' },
  { value: 'COMPLAINT', label: 'شكوى' },
  { value: 'OTHER', label: 'أخرى' },
]

const KIND_LABEL: Record<ParentContactKind, string> = {
  SUGGESTION: 'اقتراح',
  COMPLAINT: 'شكوى',
  OTHER: 'أخرى',
}

const STATUS_LABEL: Record<ParentContactMessage['status'], string> = {
  OPEN: 'مفتوحة',
  CLOSED: 'مغلقة',
  CANCELLED: 'ملغاة',
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

export interface ParentContactSectionProps {
  messages: ParentContactMessage[]
  submitting?: boolean
  onSubmit: (input: { kind: ParentContactKind; body: string }) => void | Promise<void>
  onCancel: (messageId: number) => void | Promise<void>
  showToast?: (message: string) => void
}

export function ParentContactSection({
  messages,
  submitting,
  onSubmit,
  onCancel,
  showToast,
}: ParentContactSectionProps) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ParentContactKind | null>(null)
  const [body, setBody] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busyCancelId, setBusyCancelId] = useState<number | null>(null)

  const hasOpen = messages.some((m) => m.status === 'OPEN')

  function resetForm() {
    setKind(null)
    setBody('')
    setFormError(null)
  }

  async function handleSubmit() {
    if (submitting) return
    if (!kind) {
      setFormError('اختر نوع الرسالة')
      return
    }
    const text = body.trim()
    if (!text) {
      setFormError('اكتب نص الرسالة')
      return
    }
    try {
      await onSubmit({ kind, body: text })
      setOpen(false)
      resetForm()
      showToast?.('تم إرسال رسالتك إلى الإدارة')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'تعذّر إرسال الرسالة')
    }
  }

  async function handleCancel(id: number) {
    if (busyCancelId != null) return
    if (!window.confirm('إلغاء هذه الرسالة؟')) return
    setBusyCancelId(id)
    try {
      await onCancel(id)
      showToast?.('تم إلغاء الرسالة')
    } catch (err) {
      showToast?.(err instanceof ApiError ? err.message : 'تعذّر الإلغاء')
    } finally {
      setBusyCancelId(null)
    }
  }

  return (
    <section className="print:hidden space-y-3">
      <button
        type="button"
        disabled={hasOpen}
        onClick={() => {
          resetForm()
          setOpen(true)
        }}
        title={hasOpen ? 'يوجد رسالة مفتوحة بانتظار رد الإدارة' : undefined}
        className={cn(
          buttonVariants({
            variant: 'secondary',
            className:
              'min-h-12 w-full cursor-pointer justify-center gap-2 border-[color:var(--pp-primary)]/30 bg-white text-[color:var(--pp-ink)] shadow-sm hover:bg-[color:var(--pp-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60',
          })
        )}
      >
        <MessageSquareText className="size-4 shrink-0 text-[color:var(--pp-primary)]" strokeWidth={1.75} />
        تواصل مع الإدارة
      </button>
      {hasOpen ? (
        <p className="text-center text-xs text-[color:var(--pp-warn)]">
          لديك رسالة مفتوحة — يمكنك إلغاؤها من القائمة بالأسفل أو انتظار رد الإدارة.
        </p>
      ) : null}

      {messages.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-[color:var(--pp-ink)]">رسائلي</h2>
          <ul className="space-y-2">
            {messages.slice(0, 8).map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[color:var(--pp-ink)]">
                    {KIND_LABEL[m.kind]}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      m.status === 'OPEN' && 'bg-[color:var(--pp-warn-soft)] text-[color:var(--pp-warn)]',
                      m.status === 'CLOSED' && 'bg-[color:var(--pp-ok-soft)] text-[color:var(--pp-ok)]',
                      m.status === 'CANCELLED' && 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatWhen(m.createdAt)}</p>
                <p className="mt-2 whitespace-pre-wrap text-[color:var(--pp-ink)]">{m.body}</p>
                {m.status === 'CLOSED' && m.replyBody ? (
                  <div className="mt-3 rounded-lg bg-[color:var(--pp-sky)] px-3 py-2">
                    <p className="text-xs font-semibold text-[color:var(--pp-primary)]">رد الإدارة</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--pp-ink)]">
                      {m.replyBody}
                    </p>
                  </div>
                ) : null}
                {m.status === 'OPEN' ? (
                  <button
                    type="button"
                    disabled={busyCancelId === m.id}
                    onClick={() => void handleCancel(m.id)}
                    className="mt-3 text-xs font-semibold text-[color:var(--pp-danger)] underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {busyCancelId === m.id ? 'جارٍ الإلغاء…' : 'إلغاء الرسالة'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Modal
        open={open}
        onClose={() => {
          if (submitting) return
          setOpen(false)
          resetForm()
        }}
        title="تواصل مع الإدارة"
        description="أرسل اقتراحاً أو شكوى أو ملاحظة — سترد الإدارة على الرسالة المفتوحة."
      >
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">نوع الرسالة</legend>
            <div className="flex flex-wrap gap-2">
              {KIND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setKind(opt.value)}
                  className={cn(
                    'min-h-10 rounded-full border px-3 text-sm font-medium transition',
                    kind === opt.value
                      ? 'border-[color:var(--pp-primary)] bg-[color:var(--pp-primary-soft)] text-[color:var(--pp-primary)]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">نص الرسالة</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="اكتب رسالتك هنا…"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[color:var(--pp-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--pp-primary)]/30"
            />
          </label>
          {formError ? (
            <p className="rounded-md bg-[color:var(--pp-danger-soft)] px-3 py-2 text-sm text-[color:var(--pp-danger)]" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!!submitting || !kind || !body.trim()}
            onClick={() => void handleSubmit()}
            className={buttonVariants({ variant: 'primary', className: 'min-h-11 w-full' })}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className={SPINNER_CLASS} />
                جارٍ الإرسال…
              </span>
            ) : (
              'إرسال'
            )}
          </button>
        </div>
      </Modal>
    </section>
  )
}
