import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, Trash2, Download } from 'lucide-react'
import {
  deleteMyTeacherDocument,
  downloadMyTeacherDocument,
  listMyTeacherDocuments,
  uploadMyTeacherDocument,
  type TeacherDocType,
  type TeacherDocumentSlot,
} from '../../api/teacherDocuments'
import { ApiError } from '../../api/client'
import { EmptyState } from '../../shared/EmptyState'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { cn } from '../../shared/utils'

function formatWhen(iso: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function TeacherDocumentsPage() {
  const [documents, setDocuments] = useState<TeacherDocumentSlot[]>([])
  const [uploadedCount, setUploadedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyType, setBusyType] = useState<TeacherDocType | null>(null)
  const fileRefs = useRef<Partial<Record<TeacherDocType, HTMLInputElement | null>>>({})

  const load = useCallback(async () => {
    const data = await listMyTeacherDocuments()
    setDocuments(data.documents)
    setUploadedCount(data.uploadedCount)
    setTotalCount(data.totalCount)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل مستندات التوظيف')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  async function onPick(docType: TeacherDocType, file: File | undefined) {
    if (!file) return
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      window.alert('يُسمح بملفات PDF فقط')
      return
    }
    setBusyType(docType)
    setError(null)
    try {
      await uploadMyTeacherDocument(docType, file)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر رفع الملف')
    } finally {
      setBusyType(null)
      const input = fileRefs.current[docType]
      if (input) input.value = ''
    }
  }

  async function onDownload(doc: TeacherDocumentSlot) {
    setBusyType(doc.docType)
    try {
      await downloadMyTeacherDocument(doc.docType, doc.fileName)
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'تعذّر تنزيل الملف')
    } finally {
      setBusyType(null)
    }
  }

  async function onDelete(doc: TeacherDocumentSlot) {
    if (!window.confirm(`حذف ملف «${doc.labelAr}»؟`)) return
    setBusyType(doc.docType)
    setError(null)
    try {
      await deleteMyTeacherDocument(doc.docType)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر حذف الملف')
    } finally {
      setBusyType(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (error && documents.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="تعذّر تحميل المستندات"
        description={error}
      />
    )
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-sky-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-sky-950/30">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">ملف التوظيف</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">مستندات المعلم</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          ارفع ملفات PDF المطلوبة (حد أقصى 5 ميجابايت لكل ملف). إعادة الرفع تستبدل الملف السابق.
        </p>
        <p className="mt-3 text-sm font-semibold tabular-nums text-sky-800 dark:text-sky-300">
          المكتمل: {uploadedCount} / {totalCount}
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6 sm:px-6">
        {error ? (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <ul className="space-y-3">
          {documents.map((doc) => {
            const busy = busyType === doc.docType
            return (
              <li
                key={doc.docType}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                        {doc.labelAr}
                      </h2>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                          doc.uploaded
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                        )}
                      >
                        {doc.uploaded ? (
                          <>
                            <CheckCircle2 className="size-3.5" aria-hidden />
                            مرفوع
                          </>
                        ) : (
                          'ناقص'
                        )}
                      </span>
                    </div>
                    {doc.uploaded ? (
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {doc.fileName}
                        {doc.uploadedAt ? ` · ${formatWhen(doc.uploadedAt)}` : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">لم يُرفع بعد</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={(el) => {
                        fileRefs.current[doc.docType] = el
                      }}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={busy}
                      onChange={(e) => onPick(doc.docType, e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      className={buttonVariants({ variant: 'primary', size: 'sm' })}
                      onClick={() => fileRefs.current[doc.docType]?.click()}
                    >
                      <FileUp className="size-4" aria-hidden />
                      {doc.uploaded ? 'استبدال PDF' : 'رفع PDF'}
                    </button>
                    {doc.uploaded ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                          onClick={() => onDownload(doc)}
                        >
                          <Download className="size-4" aria-hidden />
                          تنزيل
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={buttonVariants({ variant: 'outline-danger', size: 'sm' })}
                          onClick={() => onDelete(doc)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          حذف
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
