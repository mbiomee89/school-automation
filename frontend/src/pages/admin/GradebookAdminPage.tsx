import { useEffect, useState } from 'react'
import { AlertTriangle, Printer } from 'lucide-react'
import {
  getAdminGradebookReport,
  listAdminGradebookOptions,
  type GradeReport,
} from '../../api/gradebook'
import { ApiError } from '../../api/client'
import { EmptyState } from '../../shared/EmptyState'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'

function printReport(report: GradeReport) {
  const w = window.open('', '_blank')
  if (!w) return
  const title =
    report.type === 'period'
      ? `تقرير الفترة ${report.period} — الفصل ${report.term}`
      : `التقرير النهائي — الفصل ${report.term}`
  const head = `<h1>${title}</h1><p>${report.className} · ${report.subjectNameAr} · ${report.academicYear}</p>`
  let table = ''
  if (report.type === 'period') {
    table = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
      <thead><tr><th>الطالب</th><th>تقييم</th><th>اختبارات</th><th>المجموع</th></tr></thead>
      <tbody>${report.rows
        .map(
          (r) =>
            `<tr><td>${r.studentNameAr}</td><td>${r.assessment ?? '—'}</td><td>${r.exams ?? '—'}</td><td>${r.periodTotal ?? '—'}/${r.periodMax}</td></tr>`
        )
        .join('')}</tbody></table>`
  } else {
    const showFinal = report.shape.finalMax > 0
    table = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
      <thead><tr><th>الطالب</th><th>ف1</th><th>ف2</th><th>متوسط تقييم</th><th>متوسط اختبارات</th>${showFinal ? '<th>نهاية فصل</th>' : ''}<th>المجموع</th></tr></thead>
      <tbody>${report.rows
        .map((r) => {
          const p1 = r.period1 ? r.period1.total : '—'
          const p2 = r.period2 ? r.period2.total : '—'
          const total = r.termReady ? `${r.termTotal}/100` : 'بانتظار الفترتين'
          return `<tr><td>${r.studentNameAr}</td><td>${p1}</td><td>${p2}</td><td>${r.avgAssessment ?? '—'}</td><td>${r.avgExams ?? '—'}</td>${showFinal ? `<td>${r.finalExam ?? '—'}</td>` : ''}<td>${total}</td></tr>`
        })
        .join('')}</tbody></table>`
  }
  w.document.write(
    `<html dir="rtl" lang="ar"><head><title>${title}</title></head><body style="font-family:Tahoma,sans-serif">${head}${table}<script>window.print()</script></body></html>`
  )
  w.document.close()
}

export function GradebookAdminPage() {
  const [classes, setClasses] = useState<
    Array<{ id: number; name: string; gradeLevel: string; academicYear: string }>
  >([])
  const [subjects, setSubjects] = useState<Array<{ id: number; nameAr: string }>>([])
  const [classId, setClassId] = useState<number | null>(null)
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [term, setTerm] = useState(1)
  const [report, setReport] = useState<GradeReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await listAdminGradebookOptions()
        if (cancelled) return
        setClasses(data.classes)
        setSubjects(data.subjects)
        if (data.classes[0]) setClassId(data.classes[0].id)
        if (data.subjects[0]) setSubjectId(data.subjects[0].id)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر التحميل')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadReport(period?: number) {
    if (!classId || !subjectId) return
    setBusy(true)
    setError(null)
    try {
      const data = await getAdminGradebookReport({
        classId,
        subjectId,
        term,
        period,
      })
      setReport(data)
    } catch (err) {
      setReport(null)
      setError(err instanceof ApiError ? err.message : 'تعذّر تحميل التقرير')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (!classes.length || !subjects.length) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="لا توجد فصول أو مواد"
        description="أضف فصولاً ومواداً مدعومة في سجل المتابعة أولاً."
      />
    )
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-blue-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/40 print:hidden">
        <p className="text-sm font-medium text-slate-500">الإدارة</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">تقارير سجل المتابعة</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          اختر الفصل والمادة لعرض وطباعة تقرير فترة أو التقرير النهائي (بعد اكتمال الفترتين).
        </p>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm" role="alert">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 print:hidden">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">الفصل</span>
            <select
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
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
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">المادة</span>
            <select
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={subjectId ?? ''}
              onChange={(e) => setSubjectId(Number(e.target.value))}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameAr}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">الفصل الدراسي</span>
            <select
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
            >
              <option value={1}>الأول</option>
              <option value={2}>الثاني</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              disabled={busy}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              onClick={() => loadReport(1)}
            >
              فترة 1
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              onClick={() => loadReport(2)}
            >
              فترة 2
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonVariants({ variant: 'primary', size: 'sm' })}
              onClick={() => loadReport(undefined)}
            >
              التقرير النهائي
            </button>
            {report ? (
              <button
                type="button"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                onClick={() => printReport(report)}
              >
                <Printer className="size-4" aria-hidden />
                طباعة
              </button>
            ) : null}
          </div>
        </div>

        {!report ? (
          <p className="text-sm text-slate-500">اختر تقريراً للعرض.</p>
        ) : report.type === 'period' ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">
              تقرير الفترة {report.period} — {report.className} — {report.subjectNameAr}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950">
                <tr>
                  <th className="px-3 py-2 text-start">الطالب</th>
                  <th className="px-3 py-2 text-start">تقييم</th>
                  <th className="px-3 py-2 text-start">اختبارات</th>
                  <th className="px-3 py-2 text-start">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.studentId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">{r.studentNameAr}</td>
                    <td className="px-3 py-2 tabular-nums">{r.assessment ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{r.exams ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.periodTotal == null ? '—' : `${r.periodTotal}/${r.periodMax}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">
              التقرير النهائي — {report.className} — {report.subjectNameAr}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950">
                <tr>
                  <th className="px-3 py-2 text-start">الطالب</th>
                  <th className="px-3 py-2 text-start">ف1</th>
                  <th className="px-3 py-2 text-start">ف2</th>
                  <th className="px-3 py-2 text-start">متوسط تقييم</th>
                  <th className="px-3 py-2 text-start">متوسط اختبارات</th>
                  {report.shape.finalMax > 0 ? (
                    <th className="px-3 py-2 text-start">نهاية فصل</th>
                  ) : null}
                  <th className="px-3 py-2 text-start">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.studentId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">{r.studentNameAr}</td>
                    <td className="px-3 py-2 tabular-nums">{r.period1?.total ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{r.period2?.total ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{r.avgAssessment ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{r.avgExams ?? '—'}</td>
                    {report.shape.finalMax > 0 ? (
                      <td className="px-3 py-2 tabular-nums">{r.finalExam ?? '—'}</td>
                    ) : null}
                    <td className="px-3 py-2 tabular-nums">
                      {r.termReady ? `${r.termTotal}/100` : 'بانتظار الفترتين'}
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
