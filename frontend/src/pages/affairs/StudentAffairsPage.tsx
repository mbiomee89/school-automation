import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import {
  getStaffProfileCampaign,
  listProfileSubmissions,
  linkProfileSubmission,
  patchStaffProfileCampaign,
  type StudentProfileSubmission,
} from '../../api/studentProfile'
import { listClasses, listStudents } from '../../api/admin'
import { ApiError } from '../../api/client'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic } from '../../shared/fonts'
import { cn } from '../../shared/utils'

export function StudentAffairsPage() {
  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<{
    token: string
    title: string
    isActive: boolean
    publicPath: string
    submissionCount?: number
  } | null>(null)
  const [submissions, setSubmissions] = useState<StudentProfileSubmission[]>([])
  const [classes, setClasses] = useState<Array<{ id: number; name: string }>>([])
  const [classFilter, setClassFilter] = useState<string>('ALL')
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const [medicalOnly, setMedicalOnly] = useState(false)
  const [selected, setSelected] = useState<StudentProfileSubmission | null>(null)
  const [linkStudentId, setLinkStudentId] = useState('')
  const [studentOptions, setStudentOptions] = useState<Array<{ id: string; nameAr: string }>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    const [camp, subs, cls] = await Promise.all([
      getStaffProfileCampaign(),
      listProfileSubmissions({
        classId: classFilter !== 'ALL' ? Number(classFilter) : undefined,
        unlinkedOnly,
        medicalOnly,
      }),
      listClasses(),
    ])
    setCampaign(camp.campaign)
    setSubmissions(subs)
    setClasses(cls.map((c) => ({ id: c.id, name: c.name })))
  }, [classFilter, unlinkedOnly, medicalOnly])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await reload()
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'تعذّر التحميل')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  const publicUrl = useMemo(() => {
    if (!campaign) return ''
    return `${window.location.origin}${campaign.publicPath}`
  }, [campaign])

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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className={SPINNER_CLASS} />
      </div>
    )
  }

  if (error) {
    return <p className="p-6 text-red-700">{error}</p>
  }

  const classLabel =
    classFilter === 'ALL'
      ? 'كل الفصول'
      : classes.find((c) => String(c.id) === classFilter)?.name || 'فصل'

  return (
    <div dir="rtl" lang="ar" className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6" style={fontArabic}>
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">شؤون الطلاب</h1>
        <p className="mt-1 text-sm text-slate-500">استمارات البيانات الشخصية — تصفية حسب الفصل</p>
      </div>

      {campaign && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 print:hidden dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">{campaign.title}</p>
              <p className="mt-1 break-all text-xs text-slate-500" dir="ltr">
                {publicUrl}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                onClick={() => void navigator.clipboard.writeText(publicUrl)}
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
            الحالة: {campaign.isActive ? 'مفتوحة' : 'مغلقة'} · عدد المرسل:{' '}
            {campaign.submissionCount ?? submissions.length}
          </p>
        </section>
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
          className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'ms-auto' })}
          onClick={() => window.print()}
        >
          <Printer className="size-4" strokeWidth={1.5} />
          طباعة التقرير
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white print:hidden dark:border-slate-700 dark:bg-slate-900">
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
                    <button
                      type="button"
                      className="text-xs text-blue-700 underline"
                      onClick={() => void openLink(s)}
                    >
                      عرض / ربط
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Formal printable sheet (homework-style) */}
      <section
        className="hidden print:block report-print-area overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900"
        style={{ fontFamily: '"Noto Naskh Arabic", "Amiri", "Times New Roman", serif' }}
      >
        <div className="border-b border-slate-100 px-4 py-4 text-center">
          <p className="text-lg font-bold">استمارة البيانات الشخصية للطالب — تقرير الاستمارات</p>
          <p className="mt-1 text-sm text-slate-600">
            {classLabel}
            {unlinkedOnly ? ' · غير مربوط' : ''}
            {medicalOnly ? ' · حالات مرضية' : ''}
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-teal-600/40 m-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-teal-600 text-white">
                <th className="border border-teal-700 px-2 py-2.5 font-bold">المعرّف</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">الاسم</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">الفصل</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">ولي الأمر</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">الجوال</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">الربط</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">طبية</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td className="border border-slate-200 px-2 py-2" dir="ltr">
                    {s.enteredStudentId}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 font-semibold">
                    {s.studentNameAr || s.payload.nameAr}
                  </td>
                  <td className="border border-slate-200 px-2 py-2">
                    {s.className || s.payload.className || '—'}
                  </td>
                  <td className="border border-slate-200 px-2 py-2">{s.payload.guardianName}</td>
                  <td className="border border-slate-200 px-2 py-2" dir="ltr">
                    {s.payload.guardianMobile}
                  </td>
                  <td className="border border-slate-200 px-2 py-2">
                    {s.linked ? 'مربوط' : 'غير مربوط'}
                  </td>
                  <td className="border border-slate-200 px-2 py-2">
                    {s.hasMedical ? 'نعم' : 'لا'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {submissions.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">لا توجد استمارات ضمن الفلتر الحالي.</p>
          )}
        </div>
      </section>

      {/* Screen preview of formal table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 print:hidden dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">التقرير الرسمي</h2>
          <span className="text-xs text-slate-500">{submissions.length} سجل</span>
        </div>
        <div className="overflow-x-auto overflow-hidden rounded-xl border border-teal-600/40">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="bg-teal-600 text-white">
                <th className="border border-teal-700 px-2 py-2.5 font-bold">المعرّف</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">الاسم</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">الفصل</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">ولي الأمر</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">الجوال</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">الربط</th>
                <th className="border border-teal-700 px-2 py-2.5 font-bold">طبية</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={`formal-${s.id}`} className="bg-white dark:bg-slate-950">
                  <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" dir="ltr">
                    {s.enteredStudentId}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 font-semibold dark:border-slate-700">
                    {s.studentNameAr || s.payload.nameAr}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 dark:border-slate-700">
                    {s.className || s.payload.className || '—'}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 dark:border-slate-700">
                    {s.payload.guardianName}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" dir="ltr">
                    {s.payload.guardianMobile}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 dark:border-slate-700">
                    {s.linked ? 'مربوط' : 'غير مربوط'}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 dark:border-slate-700">
                    {s.hasMedical ? 'نعم' : 'لا'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {submissions.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">لا توجد استمارات ضمن الفلتر الحالي.</p>
          )}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 print:hidden sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold">تفاصيل الاستمارة</h2>
            <dl className="mt-3 space-y-1 text-sm">
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
              <div>ولي الأمر: {selected.payload.guardianName}</div>
              <div>الجوال: {selected.payload.guardianMobile}</div>
              <div>
                قريب الطوارئ: {selected.payload.relativeName} — {selected.payload.relativePhone}
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
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
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
