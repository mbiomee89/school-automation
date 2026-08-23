import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import {
  getStaffProfileCampaign,
  listProfileSubmissions,
  linkProfileSubmission,
  patchStaffProfileCampaign,
  type StudentProfileSubmission,
} from '../../api/studentProfile'
import { getSchoolSettings, listClasses, listStudents } from '../../api/admin'
import { ApiError } from '../../api/client'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic } from '../../shared/fonts'
import { cn } from '../../shared/utils'
import {
  StudentProfilePrintSheet,
  type SchoolPrintHeader,
} from './StudentProfilePrintSheet'

function whatsappOf(payload: StudentProfileSubmission['payload']) {
  if (payload.guardianWhatsapp?.trim()) return payload.guardianWhatsapp.trim()
  return payload.guardianMobile || '—'
}

export function StudentAffairsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [campaign, setCampaign] = useState<{
    token: string
    title: string
    isActive: boolean
    publicPath: string
    submissionCount?: number
  } | null>(null)
  const [submissions, setSubmissions] = useState<StudentProfileSubmission[]>([])
  const [classes, setClasses] = useState<Array<{ id: number; name: string }>>([])
  const [schoolHeader, setSchoolHeader] = useState<SchoolPrintHeader>({
    schoolName: 'المدرسة',
    academicYear: '',
  })
  const [classFilter, setClassFilter] = useState<string>('ALL')
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const [medicalOnly, setMedicalOnly] = useState(false)
  const [selected, setSelected] = useState<StudentProfileSubmission | null>(null)
  const [linkStudentId, setLinkStudentId] = useState('')
  const [studentOptions, setStudentOptions] = useState<Array<{ id: string; nameAr: string }>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyHint, setCopyHint] = useState<string | null>(null)
  /** When set, print CSS shows only this submission sheet. */
  const [printOnlyId, setPrintOnlyId] = useState<number | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    const [camp, subs, cls, settings] = await Promise.all([
      getStaffProfileCampaign(),
      listProfileSubmissions({
        classId: classFilter !== 'ALL' ? Number(classFilter) : undefined,
        unlinkedOnly,
        medicalOnly,
      }),
      listClasses(),
      getSchoolSettings(),
    ])
    setCampaign(camp.campaign)
    setSubmissions(subs)
    setClasses(cls.map((c) => ({ id: c.id, name: c.name })))
    setSchoolHeader({
      schoolName: settings.name || 'المدرسة',
      academicYear: settings.academicYear || '',
      educationAdminName: settings.educationAdminName,
      logoUrl: settings.logoUrl,
      principalName: settings.principalName,
    })
  }, [classFilter, unlinkedOnly, medicalOnly])

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

  function printAll() {
    setPrintOnlyId(null)
    window.setTimeout(() => window.print(), 50)
  }

  function printOne(id: number) {
    setPrintOnlyId(id)
    window.setTimeout(() => window.print(), 80)
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
            {refreshing ? ' · جارٍ التحديث…' : ''}
          </p>
        </section>
      )}

      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
          {error}
        </p>
      )}

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

      {/* Screen preview of printable sheets (scrollable); also used for browser print */}
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

      {/* Print-only area: one PDF page per student */}
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
    </div>
  )
}

export default StudentAffairsPage
