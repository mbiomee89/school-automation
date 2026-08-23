import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FolderOpen } from 'lucide-react'
import {
  downloadAdminTeacherDocument,
  getAdminTeacherDocuments,
  listAdminTeacherDocuments,
  type TeacherDocumentsAdminDetail,
  type TeacherDocumentsAdminRow,
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

export function TeacherFilesAdminPage() {
  const [teachers, setTeachers] = useState<TeacherDocumentsAdminRow[]>([])
  const [totalCount, setTotalCount] = useState(10)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TeacherDocumentsAdminDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    const data = await listAdminTeacherDocuments()
    setTeachers(data.teachers)
    setTotalCount(data.totalCount)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        await loadList()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل قائمة المعلمين')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadList])

  async function openTeacher(id: number) {
    setSelectedId(id)
    setDetailLoading(true)
    setError(null)
    try {
      const data = await getAdminTeacherDocuments(id)
      setDetail(data)
    } catch (err) {
      setDetail(null)
      setError(err instanceof ApiError ? err.message : 'تعذّر تحميل مستندات المعلم')
    } finally {
      setDetailLoading(false)
    }
  }

  function backToList() {
    setSelectedId(null)
    setDetail(null)
  }

  async function onDownload(doc: TeacherDocumentSlot) {
    if (!selectedId || !doc.uploaded) return
    const key = `${selectedId}:${doc.docType}`
    setBusyKey(key)
    try {
      await downloadAdminTeacherDocument(selectedId, doc.docType, doc.fileName)
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'تعذّر تنزيل الملف')
    } finally {
      setBusyKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (error && teachers.length === 0 && !selectedId) {
    return (
      <EmptyState icon={AlertTriangle} title="تعذّر التحميل" description={error} />
    )
  }

  if (selectedId !== null) {
    return (
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <div className="border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-blue-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/40">
          <button
            type="button"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mb-2 -ms-2' })}
            onClick={backToList}
          >
            <ArrowRight className="size-4" aria-hidden />
            العودة للقائمة
          </button>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {detail?.name ?? 'مستندات المعلم'}
          </h1>
          {detail ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {detail.email} · المكتمل {detail.uploadedCount}/{detail.totalCount}
            </p>
          ) : null}
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

          {detailLoading || !detail ? (
            <div className="flex justify-center py-12">
              <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
            </div>
          ) : (
            <ul className="space-y-3">
              {detail.documents.map((doc) => {
                const busy = busyKey === `${selectedId}:${doc.docType}`
                return (
                  <li
                    key={doc.docType}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{doc.labelAr}</h2>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                            doc.uploaded
                              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                              : 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
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
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {doc.fileName}
                          {doc.uploadedAt ? ` · ${formatWhen(doc.uploadedAt)}` : ''}
                        </p>
                      ) : null}
                    </div>
                    {doc.uploaded ? (
                      <button
                        type="button"
                        disabled={busy}
                        className={buttonVariants({ variant: 'primary', size: 'sm' })}
                        onClick={() => onDownload(doc)}
                      >
                        <Download className="size-4" aria-hidden />
                        تنزيل
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">لا يوجد ملف</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-blue-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/40">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">الإدارة</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">ملفات المعلمين</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          استعراض وتنزيل مستندات التوظيف المرفوعة من المعلمين (PDF فقط).
        </p>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {error ? (
          <div
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {teachers.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="لا يوجد معلمون نشطون"
            description="عند إضافة معلمين سيظهر هنا اكتمال ملفاتهم."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">المعلم</th>
                  <th className="px-4 py-3 text-start font-semibold">البريد</th>
                  <th className="px-4 py-3 text-start font-semibold">الاكتمال</th>
                  <th className="px-4 py-3 text-start font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.email}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                          t.uploadedCount === totalCount
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                        )}
                      >
                        {t.uploadedCount}/{totalCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                        onClick={() => openTeacher(t.id)}
                      >
                        عرض المستندات
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
