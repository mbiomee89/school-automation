import { useEffect, useState, type ChangeEvent } from 'react'
import { Camera, FolderOpen, FileText, X } from 'lucide-react'
import { Modal } from '../../shared/Modal'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontMono } from '../../shared/fonts'
import { formatLongDate } from './statusMeta'

export interface ExcuseUploadModalProps {
  open: boolean
  /** The attendance date this excuse is being submitted for (already known — the parent only picks evidence + a note). */
  attendanceDate: string | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (input: { reasonText: string; file: File }) => void
}

function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

/**
 * Two-path evidence upload for an absence excuse: live camera capture or a
 * file/photo picker, plus a required reason note and a preview before sending.
 */
export function ExcuseUploadModal({ open, attendanceDate, submitting, onClose, onSubmit }: ExcuseUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [reasonText, setReasonText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Clear the form the moment the modal closes — adjusted during render (per
  // https://react.dev/learn/you-might-not-need-an-effect) rather than in an
  // effect, so it can't trigger an extra cascading render.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setFile(null)
      setPreviewUrl(null)
      setReasonText('')
      setFormError(null)
    }
  }

  // Revoke the object URL whenever it's replaced (previous value) or the component unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    setPreviewUrl(isImageFile(picked) ? URL.createObjectURL(picked) : null)
    setFile(picked)
  }

  function clearFile() {
    setPreviewUrl(null)
    setFile(null)
  }

  function handleSubmit() {
    if (submitting) return
    const reason = reasonText.trim()
    if (!reason) {
      setFormError('نص سبب الغياب مطلوب')
      return
    }
    if (!file) {
      setFormError('يرجى إرفاق صورة أو ملف للعذر')
      return
    }
    setFormError(null)
    onSubmit({ reasonText: reason, file })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose()
      }}
      title="رفع عذر الغياب"
      description={attendanceDate ? `الغياب بتاريخ ${formatLongDate(attendanceDate)}` : undefined}
    >
      <div className="space-y-4">
        {!file ? (
          <div className="grid grid-cols-2 gap-3">
            <label
              className={buttonVariants({
                variant: 'secondary',
                className: 'h-auto min-h-24 cursor-pointer flex-col gap-2 text-center',
              })}
            >
              <Camera className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span>تصوير بالكاميرا</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={pickFile}
              />
            </label>
            <label
              className={buttonVariants({
                variant: 'secondary',
                className: 'h-auto min-h-24 cursor-pointer flex-col gap-2 text-center',
              })}
            >
              <FolderOpen className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span>اختيار ملف</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={pickFile}
              />
            </label>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
            <button
              type="button"
              onClick={clearFile}
              disabled={submitting}
              aria-label="إزالة الملف المحدد"
              className="absolute end-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
            {previewUrl ? (
              <img src={previewUrl} alt="معاينة صورة العذر" className="max-h-64 w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 p-8 text-slate-500 dark:text-slate-400">
                <FileText className="size-8" strokeWidth={1.5} aria-hidden="true" />
                <span className="max-w-[85%] truncate text-sm" style={fontMono}>
                  {file.name}
                </span>
              </div>
            )}
          </div>
        )}

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">سبب الغياب</span>
          <textarea
            value={reasonText}
            onChange={(e) => {
              setReasonText(e.target.value)
              if (formError) setFormError(null)
            }}
            rows={3}
            required
            placeholder="مثال: زيارة طبية، وسيتم إرفاق التقرير…"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>

        {formError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {formError}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={buttonVariants({ variant: 'primary', className: 'flex-1' })}
          >
            {submitting && <span className={SPINNER_CLASS} aria-hidden="true" />}
            {submitting ? 'جارٍ الإرسال…' : 'إرسال العذر'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={buttonVariants({ variant: 'secondary', className: 'flex-1' })}
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ExcuseUploadModal
