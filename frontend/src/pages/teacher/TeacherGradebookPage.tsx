import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Printer, Save } from 'lucide-react'
import {
  getGradebookMe,
  getGradebookReport,
  listGradebookAssignments,
  saveGradebookFinal,
  saveGradebookPeriod,
  type GradebookAssignment,
  type GradebookRow,
  type GradeReport,
} from '../../api/gradebook'
import { ApiError } from '../../api/client'
import { EmptyState } from '../../shared/EmptyState'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { useStaffToast } from '../../shared/StaffToast'
import { cn } from '../../shared/utils'

type DraftRow = {
  studentId: string
  studentNameAr: string
  assessment: string
  exams: string
  finalExam: string
}

function toDraft(rows: GradebookRow[]): DraftRow[] {
  return rows.map((r) => ({
    studentId: r.studentId,
    studentNameAr: r.studentNameAr,
    assessment: r.assessment == null ? '' : String(r.assessment),
    exams: r.exams == null ? '' : String(r.exams),
    finalExam: r.finalExam == null ? '' : String(r.finalExam),
  }))
}

function parseIntOrZero(v: string) {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

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

export function TeacherGradebookPage() {
  const showToast = useStaffToast()
  const [assignments, setAssignments] = useState<GradebookAssignment[]>([])
  const [assignmentId, setAssignmentId] = useState<number | null>(null)
  const [term, setTerm] = useState(1)
  const [period, setPeriod] = useState(1)
  const [draft, setDraft] = useState<DraftRow[]>([])
  const [shape, setShape] = useState<GradebookAssignment | null>(null)
  const [meta, setMeta] = useState<{ className: string; subjectNameAr: string; academicYear: string } | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [termHints, setTermHints] = useState<
    Record<string, { termReady: boolean; termTotal: number | null }>
  >({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await listGradebookAssignments()
        if (cancelled) return
        setAssignments(data.assignments)
        if (data.assignments.length && assignmentId == null) {
          setAssignmentId(data.assignments[0].id)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل التكليفات')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    if (!assignmentId) return
    setError(null)
    const data = await getGradebookMe({ assignmentId, term, period })
    setDraft(toDraft(data.rows))
    setShape({
      id: data.assignment.id,
      classId: data.assignment.classId,
      className: data.assignment.className,
      gradeLevel: data.assignment.gradeLevel,
      subjectId: data.assignment.subjectId,
      subjectNameAr: data.assignment.subjectNameAr,
      academicYear: data.academicYear,
      shape: data.shape.shape,
      assessmentMax: data.shape.assessmentMax,
      examsMax: data.shape.examsMax,
      periodMax: data.shape.periodMax,
      finalMax: data.shape.finalMax,
    })
    setMeta({
      className: data.assignment.className,
      subjectNameAr: data.assignment.subjectNameAr,
      academicYear: data.academicYear,
    })
    const hints: Record<string, { termReady: boolean; termTotal: number | null }> = {}
    for (const r of data.rows) {
      hints[r.studentId] = { termReady: r.termReady, termTotal: r.termTotal }
    }
    setTermHints(hints)
  }, [assignmentId, term, period])

  useEffect(() => {
    if (!assignmentId) return
    let cancelled = false
    ;(async () => {
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل السجل')
          setDraft([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assignmentId, term, period, load])

  async function onSavePeriod() {
    if (!assignmentId || !shape) return
    setBusy(true)
    setError(null)
    try {
      await saveGradebookPeriod({
        assignmentId,
        term,
        period,
        rows: draft.map((r) => ({
          studentId: r.studentId,
          assessment: Math.min(shape.assessmentMax, Math.max(0, parseIntOrZero(r.assessment))),
          exams: Math.min(shape.examsMax, Math.max(0, parseIntOrZero(r.exams))),
        })),
      })
      await load()
      showToast('تم حفظ الدرجات')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر الحفظ')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveFinal() {
    if (!assignmentId || !shape || shape.finalMax <= 0) return
    setBusy(true)
    setError(null)
    try {
      await saveGradebookFinal({
        assignmentId,
        term,
        rows: draft.map((r) => ({
          studentId: r.studentId,
          finalExam: Math.min(40, Math.max(0, parseIntOrZero(r.finalExam))),
        })),
      })
      await load()
      showToast('تم حفظ الدرجات')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر حفظ نهاية الفصل')
    } finally {
      setBusy(false)
    }
  }

  async function onPrintPeriod() {
    if (!assignmentId) return
    try {
      const report = await getGradebookReport({ assignmentId, term, period })
      printReport(report)
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'تعذّر التقرير')
    }
  }

  async function onPrintTerm() {
    if (!assignmentId) return
    try {
      const report = await getGradebookReport({ assignmentId, term })
      printReport(report)
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'تعذّر التقرير النهائي')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (!assignments.length) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="لا توجد مواد لسجل المتابعة"
        description="لا تظهر إلا المواد الابتدائية المدعومة (رياضيات، عربي، علوم، إنجليزي، اجتماعيات، رقمية، دين) ضمن تكليفاتك."
      />
    )
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-emerald-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-emerald-950/30 print:hidden">
        <p className="text-sm font-medium text-slate-500">المعلم</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">سجل المتابعة</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          اختر التكليف والفصل الدراسي والفترة، ثم ارصد التقييم والاختبارات. التقرير النهائي يظهر بعد اكتمال الفترتين.
        </p>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 print:hidden">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">المادة / الفصل</span>
            <select
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={assignmentId ?? ''}
              onChange={(e) => setAssignmentId(Number(e.target.value))}
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.subjectNameAr} — {a.className}
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
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">الفترة</span>
            <select
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              <option value={1}>الفترة 1</option>
              <option value={2}>الفترة 2</option>
            </select>
          </label>
          {shape ? (
            <div className="flex items-end">
              <span
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-semibold',
                  shape.shape === 'KHITAMI'
                    ? 'bg-sky-500/15 text-sky-800'
                    : 'bg-emerald-500/15 text-emerald-800'
                )}
              >
                {shape.shape === 'KHITAMI'
                  ? `ختامي · تقييم ${shape.assessmentMax} + اختبارات ${shape.examsMax} (+ نهاية فصل ${shape.finalMax})`
                  : `تكويني · تقييم ${shape.assessmentMax} + اختبارات ${shape.examsMax}`}
              </span>
            </div>
          ) : null}
        </div>

        {meta ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {meta.subjectNameAr} · {meta.className} · {meta.academicYear}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-3 py-2 text-start">الطالب</th>
                <th className="px-3 py-2 text-start">تقييم (/{shape?.assessmentMax ?? 40})</th>
                <th className="px-3 py-2 text-start">اختبارات (/{shape?.examsMax ?? 20})</th>
                <th className="px-3 py-2 text-start">مجموع الفترة</th>
                {shape && shape.finalMax > 0 ? (
                  <th className="px-3 py-2 text-start">نهاية الفصل (/40)</th>
                ) : null}
                <th className="px-3 py-2 text-start">نهائي الفصل</th>
              </tr>
            </thead>
            <tbody>
              {draft.map((row, idx) => {
                const a = parseIntOrZero(row.assessment)
                const e = parseIntOrZero(row.exams)
                const periodSum =
                  row.assessment === '' && row.exams === ''
                    ? null
                    : Math.min(shape?.assessmentMax ?? 40, a) + Math.min(shape?.examsMax ?? 20, e)
                const hint = termHints[row.studentId]
                return (
                  <tr key={row.studentId} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-medium">{row.studentNameAr}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={shape?.assessmentMax ?? 40}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                        value={row.assessment}
                        onChange={(ev) => {
                          const next = [...draft]
                          next[idx] = { ...row, assessment: ev.target.value }
                          setDraft(next)
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={shape?.examsMax ?? 20}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                        value={row.exams}
                        onChange={(ev) => {
                          const next = [...draft]
                          next[idx] = { ...row, exams: ev.target.value }
                          setDraft(next)
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {periodSum == null ? '—' : `${periodSum}/${shape?.periodMax ?? 100}`}
                    </td>
                    {shape && shape.finalMax > 0 ? (
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={40}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                          value={row.finalExam}
                          onChange={(ev) => {
                            const next = [...draft]
                            next[idx] = { ...row, finalExam: ev.target.value }
                            setDraft(next)
                          }}
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-2 tabular-nums text-slate-600">
                      {hint?.termReady ? `${hint.termTotal}/100` : 'بانتظار الفترتين'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            disabled={busy}
            className={buttonVariants({ variant: 'primary' })}
            onClick={onSavePeriod}
          >
            <Save className="size-4" aria-hidden />
            حفظ درجات الفترة
          </button>
          {shape && shape.finalMax > 0 ? (
            <button
              type="button"
              disabled={busy}
              className={buttonVariants({ variant: 'secondary' })}
              onClick={onSaveFinal}
            >
              حفظ نهاية الفصل
            </button>
          ) : null}
          <button
            type="button"
            className={buttonVariants({ variant: 'secondary' })}
            onClick={onPrintPeriod}
          >
            <Printer className="size-4" aria-hidden />
            طباعة تقرير الفترة
          </button>
          <button
            type="button"
            className={buttonVariants({ variant: 'secondary' })}
            onClick={onPrintTerm}
          >
            <Printer className="size-4" aria-hidden />
            طباعة التقرير النهائي
          </button>
        </div>
      </div>
    </div>
  )
}
