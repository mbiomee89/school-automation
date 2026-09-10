import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Printer, Save } from 'lucide-react'
import {
  getFollowUpMe,
  listFollowUpAssignments,
  saveFollowUpMe,
  type FollowUpAssignment,
  type FollowUpRow,
} from '../../api/weeklyFollowUp'
import { getSchoolSettings } from '../../api/admin'
import { todayDateStr } from '../../api/teacher'
import { ApiError } from '../../api/client'
import { useAuth } from '../../lib/auth'
import { addDaysIso, followUpTotal, type ScoreField, weekStartSunday } from '../../lib/weeklyFollowUp'
import { EmptyState } from '../../shared/EmptyState'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { useStaffToast } from '../../shared/StaffToast'
import {
  WeeklyFollowUpLegend,
  WeeklyFollowUpPrintChrome,
  WeeklyFollowUpStudentTable,
} from '../../shared/WeeklyFollowUpSheet'
import type { SchoolSettings } from '../../sections/school-administration/types'

function rowsEqual(a: FollowUpRow[], b: FollowUpRow[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function rowHasAnyScore(row: {
  participation: number | null
  homeworkScore: number | null
  understanding: number | null
  discipline: number | null
  interaction: number | null
  progress: number | null
  notes: string | null
}) {
  return (
    row.participation != null ||
    row.homeworkScore != null ||
    row.understanding != null ||
    row.discipline != null ||
    row.interaction != null ||
    row.progress != null ||
    Boolean(row.notes?.trim())
  )
}

export function TeacherWeeklyFollowUpPage() {
  const { user } = useAuth()
  const showToast = useStaffToast()
  const today = todayDateStr()
  const [assignments, setAssignments] = useState<FollowUpAssignment[]>([])
  const [assignmentId, setAssignmentId] = useState<number | null>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => weekStartSunday(today))
  const [weekStart, setWeekStart] = useState(() => weekStartSunday(today))
  const [savedRows, setSavedRows] = useState<FollowUpRow[]>([])
  const [draft, setDraft] = useState<FollowUpRow[]>([])
  const [meta, setMeta] = useState<{
    className: string
    subjectNameAr: string
    academicYear: string
    weekEnd: string
  } | null>(null)
  const [brand, setBrand] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const sheetGen = useRef(0)
  /** Week label shown in chrome — frozen until sheet GET finishes so old scores never sit under a new week. */
  const [displayWeekStart, setDisplayWeekStart] = useState(() => weekStartSunday(today))

  const dirty = useMemo(() => !rowsEqual(draft, savedRows), [draft, savedRows])
  const nextDisabled = weekStart >= currentWeekStart
  const controlsLocked = busy || sheetLoading
  /** Keep selects mounted while saving; only leave edit mode during sheet reload. */
  const sheetEditable = !sheetLoading

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [asg, settings] = await Promise.all([listFollowUpAssignments(), getSchoolSettings()])
        if (cancelled) return
        setAssignments(asg.assignments)
        setCurrentWeekStart(asg.currentWeekStart)
        setWeekStart(asg.currentWeekStart)
        setDisplayWeekStart(asg.currentWeekStart)
        setBrand(settings)
        if (asg.assignments.length) setAssignmentId(asg.assignments[0].id)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'تعذّر التحميل')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!assignmentId) return
    const gen = ++sheetGen.current
    setSheetLoading(true)
    setError(null)
    setSavedFlash(false)
    setDraft([])
    setSavedRows([])
    setMeta(null)
    ;(async () => {
      try {
        const data = await getFollowUpMe(assignmentId, weekStart)
        if (gen !== sheetGen.current) return
        setDraft(data.rows)
        setSavedRows(data.rows)
        setDisplayWeekStart(data.weekStart)
        if (data.weekStart !== weekStart) setWeekStart(data.weekStart)
        setCurrentWeekStart(data.currentWeekStart)
        setMeta({
          className: data.assignment.className,
          subjectNameAr: data.assignment.subjectNameAr,
          academicYear: data.assignment.academicYear,
          weekEnd: data.weekEnd,
        })
      } catch (err) {
        if (gen !== sheetGen.current) return
        setError(err instanceof ApiError ? err.message : 'تعذّر تحميل المتابعة')
        setDraft([])
        setSavedRows([])
      } finally {
        if (gen === sheetGen.current) setSheetLoading(false)
      }
    })()
  }, [assignmentId, weekStart])

  function confirmDiscardUnsaved() {
    if (!dirty) return true
    return window.confirm('لديك تغييرات غير محفوظة. هل تريد المتابعة دون حفظ؟')
  }

  async function persist() {
    if (!assignmentId || sheetLoading) return false
    const gen = ++sheetGen.current
    setSheetLoading(false)
    setBusy(true)
    setError(null)
    setSavedFlash(false)
    const payloadRows = draft.map((r) => ({
      studentId: r.studentId,
      participation: r.participation,
      homeworkScore: r.homeworkScore,
      understanding: r.understanding,
      discipline: r.discipline,
      interaction: r.interaction,
      progress: r.progress,
      notes: r.notes,
    }))
    const hadScores = draft.some(rowHasAnyScore)
    try {
      const data = await saveFollowUpMe({
        assignmentId,
        weekStart,
        rows: payloadRows,
      })
      if (gen !== sheetGen.current) return false
      const saved = data.saved ?? 0
      const deleted = data.deleted ?? 0
      // Only flag a false success when nothing was written or removed but we sent scores.
      if (hadScores && saved === 0 && deleted === 0) {
        const msg = 'تعذّر تأكيد الحفظ — أعد المحاولة'
        setError(msg)
        showToast(msg, 'error')
        return false
      }
      setDraft(data.rows)
      setSavedRows(data.rows)
      setSavedFlash(true)
      showToast('تم الحفظ')
      return true
    } catch (err) {
      if (gen !== sheetGen.current) return false
      const msg = err instanceof ApiError ? err.message : 'تعذّر الحفظ'
      setError(msg)
      setSavedFlash(false)
      showToast(msg, 'error')
      return false
    } finally {
      if (gen === sheetGen.current) setBusy(false)
    }
  }

  async function onPrint() {
    if (dirty) {
      const ok = await persist()
      if (!ok) return
    }
    window.print()
  }

  function patchScore(studentId: string, field: ScoreField, value: number | null) {
    setSavedFlash(false)
    setDraft((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r
        const next = { ...r, [field]: value }
        return { ...next, total: followUpTotal(next) }
      })
    )
  }

  function fillColumn(field: ScoreField, value: number | null) {
    setSavedFlash(false)
    setDraft((prev) =>
      prev.map((r) => {
        const next = { ...r, [field]: value }
        return { ...next, total: followUpTotal(next) }
      })
    )
  }

  function patchNotes(studentId: string, notes: string) {
    setSavedFlash(false)
    setDraft((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, notes } : r)))
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
        title="لا توجد مواد للمتابعة الأسبوعية"
        description="تظهر هنا مواد تكليفاتك ما عدا التربية البدنية."
      />
    )
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-sky-50 px-4 py-6 sm:px-6 print:hidden dark:border-slate-800">
        <p className="text-sm font-medium text-slate-500">المعلم</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">المتابعة الأسبوعية</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          اختر المادة والفصل والأسبوع، ثم ارصد الدرجات من 1 إلى 5. يمكن تعديل الأسابيع السابقة والحالية فقط.
          استخدم القائمة أعلى كل عمود لتعبئة كل الطلاب دفعة واحدة.
        </p>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden" role="alert">
            {error}
          </div>
        ) : savedFlash ? (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 print:hidden dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
            role="status"
          >
            تم الحفظ
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">المادة / الفصل</span>
            <select
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={assignmentId ?? ''}
              disabled={controlsLocked}
              onChange={(e) => {
                const next = Number(e.target.value)
                if (next === assignmentId) return
                if (!confirmDiscardUnsaved()) return
                setSavedFlash(false)
                setAssignmentId(next)
              }}
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.subjectNameAr} — {a.className}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              disabled={controlsLocked}
              onClick={() => {
                const next = addDaysIso(weekStart, -7)
                if (!confirmDiscardUnsaved()) return
                setSavedFlash(false)
                setWeekStart(next)
              }}
              aria-label="الأسبوع السابق"
            >
              <ChevronRight className="size-4" />
            </button>
            <p className="min-w-[11rem] text-center text-sm font-medium">
              {displayWeekStart}
              {meta && !sheetLoading ? ` — ${meta.weekEnd}` : ''}
              {sheetLoading ? ' …' : ''}
            </p>
            <button
              type="button"
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              disabled={controlsLocked || nextDisabled}
              onClick={() => {
                const next = addDaysIso(weekStart, 7)
                if (next > currentWeekStart) return
                if (!confirmDiscardUnsaved()) return
                setSavedFlash(false)
                setWeekStart(next)
              }}
              aria-label="الأسبوع التالي"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
          <button
            type="button"
            disabled={controlsLocked || !dirty}
            className={buttonVariants({ variant: 'success' })}
            onClick={() => void persist()}
          >
            {busy ? <span className={SPINNER_CLASS} /> : <Save className="size-4" />}
            {busy ? 'جارٍ الحفظ…' : savedFlash && !dirty ? 'تم الحفظ' : 'حفظ'}
          </button>
          <button
            type="button"
            disabled={controlsLocked}
            className={buttonVariants({ variant: 'secondary' })}
            onClick={() => void onPrint()}
          >
            <Printer className="size-4" />
            طباعة
          </button>
        </div>

        {sheetLoading ? (
          <p className="text-sm text-slate-500 print:hidden" role="status">
            جارٍ تحميل المتابعة…
          </p>
        ) : null}

        <WeeklyFollowUpPrintChrome
          brand={{
            schoolName: brand?.name ?? 'المدرسة',
            educationAdminName: brand?.educationAdminName,
            logoUrl: brand?.logoUrl,
            principalName: brand?.principalName,
          }}
          title={brand?.name ? `مدرسة ${brand.name}` : 'المدرسة'}
          metaLines={[
            meta ? `${meta.subjectNameAr} — ${meta.className}` : '',
            meta ? `الأسبوع ${displayWeekStart} إلى ${meta.weekEnd}` : '',
            meta?.academicYear ? `العام الدراسي ${meta.academicYear}` : '',
          ].filter(Boolean)}
          teacherName={user?.name ?? ''}
          dateLabel={today}
        >
          <WeeklyFollowUpStudentTable
            rows={draft}
            editable={sheetEditable}
            disabled={busy}
            onChangeScore={patchScore}
            onChangeNotes={patchNotes}
            onFillColumn={fillColumn}
          />
          <div className="mt-3">
            <WeeklyFollowUpLegend />
          </div>
        </WeeklyFollowUpPrintChrome>
      </div>
    </div>
  )
}
