import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import {
  approveProfileChangeRequest,
  applyParentPhoneSync,
  getStaffProfileCampaign,
  listProfileChangeRequests,
  listProfileSubmissions,
  linkProfileSubmission,
  patchStaffProfileCampaign,
  previewParentPhoneSync,
  rejectProfileChangeRequest,
  type ParentPhoneSyncDiff,
  type StudentProfileChangeRequest,
  type StudentProfilePayload,
  type StudentProfileSubmission,
} from '../../api/studentProfile'
import { getSchoolSettings, listClasses, listStudents, resetParentPasswordForStudent } from '../../api/admin'
import { ApiError } from '../../api/client'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic } from '../../shared/fonts'
import { useStaffToast } from '../../shared/StaffToast'
import { cn } from '../../shared/utils'
import {
  StudentProfilePrintSheet,
  type SchoolPrintHeader,
} from './StudentProfilePrintSheet'

type InboxMode = 'submissions' | 'changes'

function whatsappOf(payload: StudentProfilePayload) {
  if (payload.guardianWhatsapp?.trim()) return payload.guardianWhatsapp.trim()
  return payload.guardianMobile || '—'
}

function PayloadCompare({
  label,
  payload,
  hasMedical,
}: {
  label: string
  payload: StudentProfilePayload
  hasMedical?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
      <p className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">{label}</p>
      <dl className="space-y-1 text-sm">
        <div>الاسم: {payload.nameAr || '—'}</div>
        <div>ولي الأمر: {payload.guardianName || '—'}</div>
        <div dir="ltr">الجوال: {payload.guardianMobile || '—'}</div>
        <div dir="ltr">واتساب: {whatsappOf(payload)}</div>
        <div>
          العنوان: {[payload.city, payload.district, payload.streetMain, payload.houseNumber]
            .filter(Boolean)
            .join(' — ') || '—'}
        </div>
        <div>
          قريب الطوارئ: {payload.relativeName || '—'} —{' '}
          <span dir="ltr">{payload.relativePhone || '—'}</span>
        </div>
        {(hasMedical || payload.hasMedicalConditions) && (
          <div className="rounded-lg bg-rose-50 p-2 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            حالات مرضية: {payload.medicalDetails || '—'}
          </div>
        )}
      </dl>
    </div>
  )
}

export function StudentAffairsPage() {
  const showToast = useStaffToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [inboxMode, setInboxMode] = useState<InboxMode>('submissions')
  const [campaign, setCampaign] = useState<{
    token: string
    title: string
    isActive: boolean
    publicPath: string
    submissionCount?: number
    pendingChangeCount?: number
  } | null>(null)
  const [submissions, setSubmissions] = useState<StudentProfileSubmission[]>([])
  const [changeRequests, setChangeRequests] = useState<StudentProfileChangeRequest[]>([])
  const [classes, setClasses] = useState<Array<{ id: number; name: string }>>([])
  const [schoolHeader, setSchoolHeader] = useState<SchoolPrintHeader>({
    schoolName: 'المدرسة',
    academicYear: '',
  })
  const [classFilter, setClassFilter] = useState<string>('ALL')
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const [medicalOnly, setMedicalOnly] = useState(false)
  const [selected, setSelected] = useState<StudentProfileSubmission | null>(null)
  const [selectedChange, setSelectedChange] = useState<StudentProfileChangeRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [linkStudentId, setLinkStudentId] = useState('')
  const [studentOptions, setStudentOptions] = useState<Array<{ id: string; nameAr: string }>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const [printOnlyId, setPrintOnlyId] = useState<number | null>(null)
  const [phoneSyncOpen, setPhoneSyncOpen] = useState(false)
  const [phoneSyncLoading, setPhoneSyncLoading] = useState(false)
  const [phoneSyncApplying, setPhoneSyncApplying] = useState(false)
  const [phoneSyncDiffs, setPhoneSyncDiffs] = useState<ParentPhoneSyncDiff[]>([])
  const [phoneSyncSelected, setPhoneSyncSelected] = useState<Record<string, boolean>>({})
  const [phoneSyncError, setPhoneSyncError] = useState<string | null>(null)
  const [parentResetOpen, setParentResetOpen] = useState(false)
  const [parentResetStudentId, setParentResetStudentId] = useState('')
  const [parentResetBusy, setParentResetBusy] = useState(false)
  const [parentResetError, setParentResetError] = useState<string | null>(null)
  const [parentResetResult, setParentResetResult] = useState<{
    phone: string
    studentNameAr: string
    temporaryPassword: string
  } | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    const [camp, cls, settings] = await Promise.all([
      getStaffProfileCampaign(),
      listClasses(),
      getSchoolSettings(),
    ])
    setCampaign(camp.campaign)
    setClasses(cls.map((c) => ({ id: c.id, name: c.name })))
    setSchoolHeader({
      schoolName: settings.name || 'المدرسة',
      academicYear: settings.academicYear || '',
      educationAdminName: settings.educationAdminName,
      logoUrl: settings.logoUrl,
      principalName: settings.principalName,
    })

    if (inboxMode === 'submissions') {
      const subs = await listProfileSubmissions({
        classId: classFilter !== 'ALL' ? Number(classFilter) : undefined,
        unlinkedOnly,
        medicalOnly,
      })
      setSubmissions(subs)
    } else {
      const reqs = await listProfileChangeRequests('PENDING')
      setChangeRequests(reqs)
    }
  }, [classFilter, unlinkedOnly, medicalOnly, inboxMode])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const firstLoad = loading && !campaign
      if (firstLoad) setLoading(true)
      else setRefreshing(true)
      try {
        await reload()
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'تعذّر التحميل')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first-load flag uses campaign presence
  }, [reload])

  useEffect(() => {
    function onAfterPrint() {
      setPrintOnlyId(null)
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [])

  const publicUrl = useMemo(() => {
    if (!campaign) return ''
    return `${window.location.origin}${campaign.publicPath}`
  }, [campaign])

  const sheetsToPrint = useMemo(() => {
    if (printOnlyId == null) return submissions
    return submissions.filter((s) => s.id === printOnlyId)
  }, [submissions, printOnlyId])

  const pendingBadge = campaign?.pendingChangeCount ?? changeRequests.length

  async function copyLink() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopyHint('تم نسخ الرابط')
    } catch {
      setCopyHint('تعذّر النسخ — انسخ الرابط يدوياً')
    }
    window.setTimeout(() => setCopyHint(null), 2500)
  }

  async function toggleActive() {
    if (!campaign) return
    setBusy(true)
    try {
      const data = await patchStaffProfileCampaign({ isActive: !campaign.isActive })
      setCampaign({ ...campaign, ...data.campaign })
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'فشل التحديث')
    } finally {
      setBusy(false)
    }
  }

  async function openLink(sub: StudentProfileSubmission) {
    setSelected(sub)
    setLinkStudentId(sub.studentId ?? sub.enteredStudentId)
    try {
      const students = await listStudents({ active: 'true' })
      setStudentOptions(students.map((s) => ({ id: s.id, nameAr: s.nameAr })))
    } catch {
      setStudentOptions([])
    }
  }

  async function confirmLink() {
    if (!selected || !linkStudentId.trim()) return
    setBusy(true)
    try {
      await linkProfileSubmission(selected.id, linkStudentId.trim())
      setSelected(null)
      await reload()
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'فشل الربط')
    } finally {
      setBusy(false)
    }
  }

  async function confirmApprove() {
    if (!selectedChange) return
    setBusy(true)
    try {
      await approveProfileChangeRequest(selectedChange.id)
      setSelectedChange(null)
      await reload()
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'فشل الاعتماد')
    } finally {
      setBusy(false)
    }
  }

  async function confirmReject() {
    if (!selectedChange) return
    setBusy(true)
    try {
      await rejectProfileChangeRequest(selectedChange.id, rejectNote.trim() || undefined)
      setSelectedChange(null)
      setRejectNote('')
      await reload()
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'فشل الرفض')
    } finally {
      setBusy(false)
    }
  }

  function printAll() {
    setPrintOnlyId(null)
    window.setTimeout(() => window.print(), 150)
  }

  function printOne(id: number) {
    setPrintOnlyId(id)
    window.setTimeout(() => window.print(), 150)
  }

  async function openPhoneSync() {
    setPhoneSyncOpen(true)
    setPhoneSyncLoading(true)
    setPhoneSyncError(null)
    setPhoneSyncDiffs([])
    setPhoneSyncSelected({})
    try {
      const data = await previewParentPhoneSync()
      setPhoneSyncDiffs(data.diffs)
      const next: Record<string, boolean> = {}
      for (const d of data.diffs) next[d.studentId] = false
      setPhoneSyncSelected(next)
    } catch (err) {
      setPhoneSyncError(err instanceof ApiError ? err.message : 'تعذّر مقارنة الجوالات')
    } finally {
      setPhoneSyncLoading(false)
    }
  }

  const phoneSyncSelectedIds = useMemo(
    () => phoneSyncDiffs.filter((d) => phoneSyncSelected[d.studentId]).map((d) => d.studentId),
    [phoneSyncDiffs, phoneSyncSelected]
  )

  async function applySelectedPhoneSync() {
    if (phoneSyncSelectedIds.length === 0) return
    setPhoneSyncApplying(true)
    setPhoneSyncError(null)
    try {
      const result = await applyParentPhoneSync(phoneSyncSelectedIds)
      const failCount = result.failed.length
      if (failCount === 0) {
        showToast(`تم تحديث ${result.updated} جوال`)
      } else {
        showToast(
          `تم تحديث ${result.updated} · تخطي ${result.skipped} · فشل ${failCount}`,
          failCount && result.updated === 0 ? 'error' : 'ok'
        )
        if (result.failed[0]) {
          setPhoneSyncError(`${result.failed[0].studentId}: ${result.failed[0].error}`)
        }
      }
      const data = await previewParentPhoneSync()
      setPhoneSyncDiffs(data.diffs)
      const next: Record<string, boolean> = {}
      for (const d of data.diffs) next[d.studentId] = false
      setPhoneSyncSelected(next)
    } catch (err) {
      setPhoneSyncError(err instanceof ApiError ? err.message : 'فشل تطبيق التحديث')
    } finally {
      setPhoneSyncApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className={SPINNER_CLASS} />
      </div>
    )
  }

  if (error && !campaign) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-red-700">{error}</p>
        <button
          type="button"
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          onClick={() => {
            setLoading(true)
            void reload().finally(() => setLoading(false))
          }}
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }

  return (
    <div dir="rtl" lang="ar" className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6" style={fontArabic}>
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">شؤون الطلاب</h1>
        <p className="mt-1 text-sm text-slate-500">
          استمارات البيانات الشخصية — طباعة صفحة لكل طالب بنفس تصميم الاستمارة
        </p>
      </div>

      {campaign && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 print:hidden dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold">{campaign.title}</p>
              <p className="mt-1 break-all text-xs text-slate-500" dir="ltr">
                {publicUrl}
              </p>
              {copyHint && <p className="mt-1 text-xs text-emerald-700">{copyHint}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                onClick={() => void copyLink()}
              >
                نسخ الرابط
              </button>
              <button
                type="button"
                disabled={busy || phoneSyncLoading}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                onClick={() => void openPhoneSync()}
              >
                مزامنة جوال البطاقات
              </button>
              <button
                type="button"
                disabled={busy}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                onClick={() => {
                  setParentResetOpen(true)
                  setParentResetStudentId('')
                  setParentResetError(null)
                  setParentResetResult(null)
                }}
              >
                كلمة مرور ولي الأمر
              </button>
              <button
                type="button"
                disabled={busy}
                className={buttonVariants({
                  variant: campaign.isActive ? 'danger' : 'primary',
                  size: 'sm',
                })}
                onClick={() => void toggleActive()}
              >
                {campaign.isActive ? 'إيقاف الاستمارة' : 'تفعيل الاستمارة'}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            الحالة: {campaign.isActive ? 'مفتوحة للولي' : 'مغلقة — الرابط لا يقبل إرسالًا جديدًا'} · عدد
            المرسل: {campaign.submissionCount ?? submissions.length}
            {typeof campaign.pendingChangeCount === 'number'
              ? ` · طلبات تعديل معلّقة: ${campaign.pendingChangeCount}`
              : ''}
            {refreshing ? ' · جارٍ التحديث…' : ''}
          </p>
        </section>
      )}

      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 print:hidden dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setInboxMode('submissions')}
          className={cn(
            'rounded-lg py-2 text-sm font-semibold transition-colors',
            inboxMode === 'submissions'
              ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-400'
          )}
        >
          المرسلات
        </button>
        <button
          type="button"
          onClick={() => setInboxMode('changes')}
          className={cn(
            'rounded-lg py-2 text-sm font-semibold transition-colors',
            inboxMode === 'changes'
              ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-400'
          )}
        >
          طلبات التعديل
          {pendingBadge > 0 && (
            <span className="ms-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
              {pendingBadge}
            </span>
          )}
        </button>
      </div>

      {inboxMode === 'submissions' && (
        <>
          <div className="flex flex-wrap items-end gap-3 print:hidden">
            <label className="text-sm">
              <span className="text-slate-600">الفصل</span>
              <select
                className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="ALL">الكل</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={unlinkedOnly}
                onChange={(e) => setUnlinkedOnly(e.target.checked)}
              />
              غير مربوط فقط
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={medicalOnly}
                onChange={(e) => setMedicalOnly(e.target.checked)}
              />
              حالات مرضية
            </label>
            <button
              type="button"
              disabled={submissions.length === 0}
              className={buttonVariants({ variant: 'primary', size: 'sm', className: 'ms-auto' })}
              onClick={printAll}
            >
              <Printer className="size-4" strokeWidth={1.5} />
              طباعة الاستمارات (صفحة لكل طالب)
            </button>
          </div>

          <div
            className={cn(
              'overflow-hidden rounded-xl border border-slate-200 bg-white print:hidden dark:border-slate-700 dark:bg-slate-900',
              refreshing && 'opacity-70'
            )}
          >
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-start">الطالب</th>
                  <th className="px-3 py-2 text-start">الفصل</th>
                  <th className="px-3 py-2 text-start">الحالة</th>
                  <th className="px-3 py-2 text-end">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                      لا توجد استمارات بعد
                    </td>
                  </tr>
                ) : (
                  submissions.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{s.studentNameAr || s.payload.nameAr}</div>
                        <div className="text-xs text-slate-500" dir="ltr">
                          {s.enteredStudentId}
                        </div>
                      </td>
                      <td className="px-3 py-2">{s.className || s.payload.className || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              s.linked
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            )}
                          >
                            {s.linked ? 'مربوط' : 'غير مربوط'}
                          </span>
                          {s.hasMedical && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                              حالات مرضية
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-end">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className="text-xs text-slate-700 underline"
                            onClick={() => printOne(s.id)}
                          >
                            طباعة
                          </button>
                          <button
                            type="button"
                            className="text-xs text-blue-700 underline"
                            onClick={() => void openLink(s)}
                          >
                            عرض / ربط
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <section className="space-y-4 print:hidden">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">معاينة الطباعة</h2>
              <span className="text-xs text-slate-500">{submissions.length} صفحة</span>
            </div>
            {submissions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                لا توجد استمارات للطباعة ضمن الفلتر الحالي.
              </p>
            ) : (
              submissions.map((s) => (
                <StudentProfilePrintSheet key={`preview-${s.id}`} submission={s} header={schoolHeader} />
              ))
            )}
          </section>
        </>
      )}

      {inboxMode === 'changes' && (
        <div
          className={cn(
            'overflow-hidden rounded-xl border border-slate-200 bg-white print:hidden dark:border-slate-700 dark:bg-slate-900',
            refreshing && 'opacity-70'
          )}
        >
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-start">الطالب</th>
                <th className="px-3 py-2 text-start">الفصل</th>
                <th className="px-3 py-2 text-start">وقت الطلب</th>
                <th className="px-3 py-2 text-end">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {changeRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    لا توجد طلبات تعديل معلّقة
                  </td>
                </tr>
              ) : (
                changeRequests.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">
                      <div className="font-semibold">
                        {r.studentNameAr || r.proposedPayload.nameAr || '—'}
                      </div>
                      <div className="text-xs text-slate-500" dir="ltr">
                        {r.enteredStudentId}
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.className || r.proposedPayload.className || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {new Date(r.createdAt).toLocaleString('ar-SA')}
                      {r.hasMedical && (
                        <span className="ms-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">
                          حالات مرضية
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-end">
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-700 underline"
                        onClick={() => {
                          setRejectNote('')
                          setSelectedChange(r)
                        }}
                      >
                        مراجعة
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="hidden print:block report-print-area">
        {sheetsToPrint.map((s) => (
          <StudentProfilePrintSheet key={`print-${s.id}`} submission={s} header={schoolHeader} />
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 print:hidden sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold">تفاصيل الاستمارة</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div>الاسم: {selected.payload.nameAr}</div>
              <div dir="ltr">
                EN:{' '}
                {[
                  selected.payload.nameEnFirst,
                  selected.payload.nameEnFather,
                  selected.payload.nameEnGrand,
                  selected.payload.nameEnFamily,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </div>
              <div>الجنسية: {selected.payload.nationality || '—'}</div>
              <div>
                الميلاد: {selected.payload.birthCountry || '—'} / {selected.payload.birthCity || '—'}
              </div>
              <div>ولي الأمر: {selected.payload.guardianName}</div>
              <div dir="ltr">الجوال: {selected.payload.guardianMobile}</div>
              <div dir="ltr">
                واتساب: {whatsappOf(selected.payload)}
                {selected.payload.guardianWhatsappSame === false ? ' (رقم مختلف)' : ' (نفس الجوال)'}
              </div>
              <div>
                قريب الطوارئ: {selected.payload.relativeName} —{' '}
                <span dir="ltr">{selected.payload.relativePhone}</span>
              </div>
              {selected.hasMedical && (
                <div className="rounded-lg bg-rose-50 p-2 text-rose-900">
                  حالات مرضية: {selected.payload.medicalDetails}
                </div>
              )}
            </dl>
            <label className="mt-4 block text-sm">
              <span className="font-medium">ربط بالطالب (معرّف)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
                dir="ltr"
                list="student-link-options"
                value={linkStudentId}
                onChange={(e) => setLinkStudentId(e.target.value)}
              />
              <datalist id="student-link-options">
                {studentOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameAr}
                  </option>
                ))}
              </datalist>
              {studentOptions.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">تعذّر تحميل قائمة الطلاب — أدخل المعرّف يدوياً.</p>
              )}
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonVariants({ variant: 'secondary', className: 'flex-1' })}
                onClick={() => printOne(selected.id)}
              >
                طباعة الاستمارة
              </button>
              <button
                type="button"
                disabled={busy || !linkStudentId.trim()}
                className={buttonVariants({ variant: 'primary', className: 'flex-1' })}
                onClick={() => void confirmLink()}
              >
                حفظ الربط
              </button>
              <button
                type="button"
                className={buttonVariants({ variant: 'secondary', className: 'flex-1' })}
                onClick={() => setSelected(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedChange && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 print:hidden sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold">مراجعة طلب التعديل</h2>
            <p className="mt-1 text-xs text-slate-500" dir="ltr">
              {selectedChange.enteredStudentId} · {new Date(selectedChange.createdAt).toLocaleString('ar-SA')}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PayloadCompare
                label="الحالي (المعتمد)"
                payload={selectedChange.liveSubmission?.payload ?? ({} as StudentProfilePayload)}
                hasMedical={selectedChange.liveSubmission?.hasMedical}
              />
              <PayloadCompare
                label="المقترح (من ولي الأمر)"
                payload={selectedChange.proposedPayload}
                hasMedical={selectedChange.hasMedical}
              />
            </div>
            <label className="mt-4 block text-sm">
              <span className="font-medium">ملاحظة الرفض (اختياري)</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                rows={2}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="تظهر في سجل الطلب عند الرفض"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className={buttonVariants({ variant: 'primary', className: 'flex-1' })}
                onClick={() => void confirmApprove()}
              >
                اعتماد التعديل
              </button>
              <button
                type="button"
                disabled={busy}
                className={buttonVariants({ variant: 'danger', className: 'flex-1' })}
                onClick={() => void confirmReject()}
              >
                رفض
              </button>
              <button
                type="button"
                className={buttonVariants({ variant: 'secondary', className: 'flex-1' })}
                onClick={() => {
                  setSelectedChange(null)
                  setRejectNote('')
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {parentResetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 print:hidden sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold">إعادة تعيين كلمة مرور ولي الأمر</h2>
            <p className="mt-1 text-xs text-slate-500">
              أدخل رقم هوية الطالب المرتبط بالحساب. تُعرض كلمة المرور المؤقتة مرة واحدة فقط.
            </p>
            {parentResetResult ? (
              <div className="mt-4 space-y-3 text-sm">
                <p>
                  الطالب: <span className="font-semibold">{parentResetResult.studentNameAr}</span>
                </p>
                <p dir="ltr">الجوال: {parentResetResult.phone}</p>
                <div className="rounded-xl bg-slate-100 px-3 py-3 dark:bg-slate-950">
                  <p className="text-xs text-slate-500">كلمة المرور المؤقتة</p>
                  <p className="mt-1 text-lg font-bold tracking-wide" dir="ltr">
                    {parentResetResult.temporaryPassword}
                  </p>
                </div>
                <button
                  type="button"
                  className={buttonVariants({ variant: 'primary', className: 'w-full' })}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(parentResetResult.temporaryPassword)
                      showToast('تم النسخ')
                    } catch {
                      /* ignore */
                    }
                    setParentResetOpen(false)
                    setParentResetResult(null)
                  }}
                >
                  نسخ وإغلاق
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-sm">
                  <span className="font-medium">رقم هوية الطالب</span>
                  <input
                    value={parentResetStudentId}
                    onChange={(e) => setParentResetStudentId(e.target.value)}
                    dir="ltr"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    placeholder="1099…"
                  />
                </label>
                {parentResetError && (
                  <p className="text-sm text-rose-600" role="alert">
                    {parentResetError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={parentResetBusy || !parentResetStudentId.trim()}
                    className={buttonVariants({ variant: 'primary', className: 'flex-1' })}
                    onClick={async () => {
                      setParentResetBusy(true)
                      setParentResetError(null)
                      try {
                        const result = await resetParentPasswordForStudent(
                          parentResetStudentId.trim()
                        )
                        setParentResetResult({
                          phone: result.phone,
                          studentNameAr: result.studentNameAr,
                          temporaryPassword: result.temporaryPassword,
                        })
                      } catch (err) {
                        setParentResetError(
                          err instanceof ApiError ? err.message : 'فشل إعادة التعيين'
                        )
                      } finally {
                        setParentResetBusy(false)
                      }
                    }}
                  >
                    {parentResetBusy ? 'جارٍ…' : 'تعيين كلمة مرور مؤقتة'}
                  </button>
                  <button
                    type="button"
                    className={buttonVariants({ variant: 'secondary' })}
                    onClick={() => setParentResetOpen(false)}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phoneSyncOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 print:hidden sm:items-center">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="text-lg font-bold">مزامنة جوال البطاقات</h2>
              <p className="mt-1 text-xs text-slate-500">
                مقارنة جوال البطاقة المرتبطة مع جوال الطالب في السجل — اختر من تريد تحديثه ثم طبّق.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {phoneSyncLoading ? (
                <div className="flex justify-center py-10">
                  <span className={SPINNER_CLASS} />
                </div>
              ) : phoneSyncDiffs.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  لا توجد اختلافات — جميع الجوالات متطابقة أو لا توجد بطاقات مرتبطة نشطة.
                </p>
              ) : (
                <ul className="space-y-2">
                  {phoneSyncDiffs.map((d) => (
                    <li
                      key={d.studentId}
                      className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 size-4"
                          checked={Boolean(phoneSyncSelected[d.studentId])}
                          onChange={(e) =>
                            setPhoneSyncSelected((prev) => ({
                              ...prev,
                              [d.studentId]: e.target.checked,
                            }))
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-slate-900 dark:text-slate-50">
                            {d.nameAr}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500" dir="ltr">
                            {d.studentId}
                          </span>
                          <span className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                            <span>
                              الحالي:{' '}
                              <span dir="ltr" className="font-medium text-slate-700 dark:text-slate-200">
                                {d.currentPhone}
                              </span>
                            </span>
                            <span>
                              البطاقة:{' '}
                              <span dir="ltr" className="font-medium text-blue-700 dark:text-blue-300">
                                {d.cardPhone}
                              </span>
                            </span>
                          </span>
                          {d.warning && (
                            <span className="mt-2 block rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                              {d.warning}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {phoneSyncError && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {phoneSyncError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={phoneSyncLoading || phoneSyncDiffs.length === 0}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  onClick={() => {
                    const next: Record<string, boolean> = {}
                    for (const d of phoneSyncDiffs) next[d.studentId] = true
                    setPhoneSyncSelected(next)
                  }}
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  disabled={phoneSyncLoading || phoneSyncDiffs.length === 0}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  onClick={() => {
                    const next: Record<string, boolean> = {}
                    for (const d of phoneSyncDiffs) next[d.studentId] = false
                    setPhoneSyncSelected(next)
                  }}
                >
                  إلغاء التحديد
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  onClick={() => setPhoneSyncOpen(false)}
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  disabled={phoneSyncApplying || phoneSyncSelectedIds.length === 0}
                  className={buttonVariants({ variant: 'primary', size: 'sm' })}
                  onClick={() => void applySelectedPhoneSync()}
                >
                  {phoneSyncApplying
                    ? 'جارٍ التطبيق…'
                    : `تطبيق المحدد (${phoneSyncSelectedIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentAffairsPage
