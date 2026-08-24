import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { listClasses } from '../../api/admin'
import {
  addLateReport,
  deleteLateReport,
  getLateReports,
  listRoster,
  todayDateStr,
  updateLateReport,
} from '../../api/teacher'
import { ApiError } from '../../api/client'
import { LateReportForm } from '../../sections/teacher-daily-workflow/LateReportForm'
import { LateReportRow } from '../../sections/teacher-daily-workflow/LateReportRow'
import type { LateReportEntry, RosterStudent } from '../../sections/teacher-daily-workflow/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic } from '../../shared/fonts'

export function LateReportsPage() {
  const today = todayDateStr()
  const [classes, setClasses] = useState<Array<{ id: number; name: string; academicYear: string }>>([])
  const [classId, setClassId] = useState<number | null>(null)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [lateReports, setLateReports] = useState<LateReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listClasses()
        if (cancelled) return
        setClasses(list.map((c) => ({ id: c.id, name: c.name, academicYear: c.academicYear })))
        if (list[0]) setClassId(list[0].id)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل الفصول')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadClass = useCallback(
    async (id: number) => {
      const [students, late] = await Promise.all([listRoster(id), getLateReports(id, today)])
      setRoster(students)
      setLateReports(late)
    },
    [today]
  )

  useEffect(() => {
    if (!classId) return
    let cancelled = false
    ;(async () => {
      try {
        await loadClass(classId)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل التأخير')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [classId, loadClass])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (error && !classes.length) {
    return <EmptyState icon={AlertTriangle} tone="error" title="تعذّر التحميل" description={error} />
  }

  return (
    <div dir="rtl" lang="ar" className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50" style={fontArabic}>
      <div className="border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-amber-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-amber-950/30">
        <p className="text-sm font-medium text-slate-500">شؤون الطلاب</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">التأخير</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          تسجيل تأخر الطلاب حسب الفصل — متاح لشؤون الطلاب والإدارة فقط.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm" role="alert">
            {error}
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">الفصل</span>
          <select
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
            value={classId ?? ''}
            onChange={(e) => setClassId(Number(e.target.value))}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYear})
              </option>
            ))}
          </select>
        </label>

        {classId ? (
          <>
            <LateReportForm
              roster={roster}
              todayDate={today}
              onSubmit={async (entry) => {
                try {
                  const row = await addLateReport({
                    studentId: entry.studentId,
                    classId,
                    date: today,
                    time: entry.time,
                    reason: entry.reason,
                  })
                  setLateReports((prev) => [...prev, row])
                } catch (err) {
                  window.alert(err instanceof ApiError ? err.message : 'فشل تسجيل التأخر')
                }
              }}
            />

            {lateReports.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="لا توجد سجلات تأخير اليوم"
                description="ستظهر هنا سجلات تأخر الطلاب فور إضافتها."
              />
            ) : (
              <ul className="space-y-2.5">
                {lateReports.map((entry) => (
                  <LateReportRow
                    key={entry.id}
                    entry={entry}
                    todayDate={today}
                    onUpdate={async (id, patch) => {
                      try {
                        const row = await updateLateReport(id, patch)
                        setLateReports((prev) => prev.map((r) => (r.id === id ? row : r)))
                      } catch (err) {
                        window.alert(err instanceof ApiError ? err.message : 'فشل التعديل')
                      }
                    }}
                    onDelete={async (id) => {
                      try {
                        await deleteLateReport(id)
                        setLateReports((prev) => prev.filter((r) => r.id !== id))
                      } catch (err) {
                        window.alert(err instanceof ApiError ? err.message : 'فشل الحذف')
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
