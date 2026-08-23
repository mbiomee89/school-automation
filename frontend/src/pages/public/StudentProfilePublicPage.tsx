import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getPublicProfileMeta,
  lookupPublicStudent,
  submitPublicStudentProfile,
  type StudentProfilePayload,
} from '../../api/studentProfile'
import { ApiError } from '../../api/client'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic } from '../../shared/fonts'
import {
  SAUDI_MOBILE_HINT,
  tryNormalizeSaudiMobile,
} from '../../shared/saudiPhone'
import { countrySelectOptions } from '../../shared/countriesAr'

type ClassOpt = { id: number; name: string }

const EMPTY: StudentProfilePayload = {
  nameAr: '',
  nameEnFirst: '',
  nameEnFather: '',
  nameEnGrand: '',
  nameEnFamily: '',
  nationality: '',
  civilId: '',
  idIssueDate: '',
  passportNumber: '',
  birthDate: '',
  birthCountry: '',
  birthCity: '',
  bloodType: 'UNKNOWN',
  housing: 'OTHER',
  adminRegion: '',
  city: '',
  district: '',
  streetMain: '',
  streetSub: '',
  houseNumber: '',
  email: '',
  postalCode: '',
  poBox: '',
  guardianName: '',
  guardianNationality: '',
  guardianRelation: 'FATHER',
  guardianIdType: 'NATIONAL',
  guardianIdNumber: '',
  guardianIdIssueDate: '',
  guardianIdSource: '',
  guardianIdExpiry: '',
  guardianHomePhone: '',
  guardianMobile: '',
  guardianWhatsappSame: true,
  guardianWhatsapp: '',
  guardianWorkPhone: '',
  relativeName: '',
  relativePhone: '',
  relativeAddress: '',
  hasMedicalConditions: false,
  medicalDetails: '',
  attested: true,
  classId: null,
  stage: 'الابتدائية',
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

export function StudentProfilePublicPage() {
  const { token = '' } = useParams()
  const [title, setTitle] = useState('استمارة البيانات الشخصية للطالب')
  const [classes, setClasses] = useState<ClassOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'gate' | 'form' | 'done'>('gate')
  const [studentId, setStudentId] = useState('')
  const [matched, setMatched] = useState(false)
  const [lookupNote, setLookupNote] = useState<string | null>(null)
  const [form, setForm] = useState<StudentProfilePayload>(EMPTY)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const meta = await getPublicProfileMeta(token)
        if (cancelled) return
        setTitle(meta.title)
        setClasses(meta.classes.map((c) => ({ id: c.id, name: c.name })))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'الاستمارة غير متاحة')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function continueFromGate() {
    const id = studentId.trim()
    if (!id) {
      setLookupNote('أدخل معرّف الطالب للمتابعة، أو أكمل يدوياً بعد إدخال أي رقم مرجعي.')
      return
    }
    setBusy(true)
    setLookupNote(null)
    try {
      const data = await lookupPublicStudent(token, id)
      if (data.submission?.payload) {
        const prior = data.submission.payload
        const same = prior.guardianWhatsappSame !== false
        setForm({
          ...EMPTY,
          ...prior,
          guardianWhatsappSame: same,
          guardianWhatsapp: prior.guardianWhatsapp || prior.guardianMobile || '',
          attested: true,
        })
        setMatched(Boolean(data.found))
        setLookupNote('تم تحميل بيانات سابقة — يمكنك التعديل والحفظ.')
      } else if (data.found && data.student) {
        setForm({
          ...EMPTY,
          nameAr: data.student.nameAr,
          classId: data.student.classId,
          className: data.student.className ?? '',
          civilId: id,
          attested: true,
        })
        setMatched(true)
        setLookupNote(null)
      } else {
        setForm({ ...EMPTY, civilId: id, attested: true })
        setMatched(false)
        setLookupNote('لم يُعثر على المعرّف في السجل — أكمل البيانات يدوياً.')
      }
      setStep('form')
    } catch (err) {
      setLookupNote(err instanceof ApiError ? err.message : 'تعذّر البحث')
    } finally {
      setBusy(false)
    }
  }

  function patch<K extends keyof StudentProfilePayload>(key: K, value: StudentProfilePayload[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'guardianMobile' && prev.guardianWhatsappSame) {
        next.guardianWhatsapp = String(value ?? '')
      }
      if (key === 'guardianWhatsappSame' && value === true) {
        next.guardianWhatsapp = prev.guardianMobile
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.attested) return
    if (form.hasMedicalConditions && !form.medicalDetails?.trim()) {
      window.alert('يرجى كتابة تفاصيل الحالات المرضية')
      return
    }
    if (!matched && !form.classId) {
      window.alert('اختر الصف / الفصل')
      return
    }
    const whatsappSame = form.guardianWhatsappSame !== false
    const whatsappRaw = whatsappSame ? form.guardianMobile : (form.guardianWhatsapp ?? '').trim()
    if (!whatsappSame && !whatsappRaw) {
      window.alert('يرجى إدخال رقم واتساب')
      return
    }

    const mobile = tryNormalizeSaudiMobile(form.guardianMobile)
    if (!mobile) {
      window.alert(`الجوال: ${SAUDI_MOBILE_HINT}`)
      return
    }
    const whatsapp = tryNormalizeSaudiMobile(whatsappRaw)
    if (!whatsapp) {
      window.alert(`واتساب: ${SAUDI_MOBILE_HINT}`)
      return
    }
    const relative = tryNormalizeSaudiMobile(form.relativePhone)
    if (!relative) {
      window.alert(`هاتف القريب: ${SAUDI_MOBILE_HINT}`)
      return
    }

    let homePhone: string | null = form.guardianHomePhone?.trim() || null
    if (homePhone) {
      const n = tryNormalizeSaudiMobile(homePhone)
      if (!n) {
        window.alert(`هاتف المنزل: ${SAUDI_MOBILE_HINT}`)
        return
      }
      homePhone = n
    }
    let workPhone: string | null = form.guardianWorkPhone?.trim() || null
    if (workPhone) {
      const n = tryNormalizeSaudiMobile(workPhone)
      if (!n) {
        window.alert(`هاتف العمل: ${SAUDI_MOBILE_HINT}`)
        return
      }
      workPhone = n
    }

    setBusy(true)
    try {
      await submitPublicStudentProfile(token, {
        enteredStudentId: studentId.trim(),
        payload: {
          ...form,
          stage: 'الابتدائية',
          attested: true,
          medicalDetails: form.hasMedicalConditions ? form.medicalDetails : null,
          guardianMobile: mobile,
          guardianWhatsappSame: whatsappSame,
          guardianWhatsapp: whatsapp,
          guardianHomePhone: homePhone,
          guardianWorkPhone: workPhone,
          relativePhone: relative,
        },
      })
      setStep('done')
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'فشل الحفظ')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={fontArabic}>
        <span className={SPINNER_CLASS} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" dir="rtl" style={fontArabic}>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-slate-50 text-slate-900" style={fontArabic}>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">المرحلة الابتدائية</p>

        {step === 'gate' && (
          <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <Field label="معرّف الطالب (رقم الهوية / الإقامة)" required>
              <input
                className={inputClass}
                dir="ltr"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="أدخل رقم هوية الطالب"
              />
            </Field>
            {lookupNote && <p className="text-sm text-amber-800">{lookupNote}</p>}
            <button
              type="button"
              disabled={busy}
              className={buttonVariants({ variant: 'primary', className: 'w-full' })}
              onClick={() => void continueFromGate()}
            >
              {busy ? 'جارٍ التحقق…' : 'متابعة'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-lg font-bold text-emerald-900">تم حفظ الاستمارة بنجاح</p>
            <p className="mt-2 text-sm text-emerald-800">شكراً لكم. يمكنكم إعادة فتح الرابط بنفس المعرّف للتعديل لاحقاً.</p>
          </div>
        )}

        {step === 'form' && (
          <form className="mt-6 space-y-6" onSubmit={(e) => void handleSubmit(e)}>
            {lookupNote && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {lookupNote}
              </p>
            )}

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold">البيانات الشخصية</h2>
              <Field label="الاسم العربي" required>
                <input
                  className={inputClass}
                  required
                  value={form.nameAr}
                  disabled={matched}
                  onChange={(e) => patch('nameAr', e.target.value)}
                />
              </Field>
              {!matched ? (
                <Field label="الصف / الفصل" required>
                  <select
                    className={inputClass}
                    required
                    value={form.classId ?? ''}
                    onChange={(e) =>
                      patch('classId', e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">اختر…</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-sm text-slate-600">الفصل: {form.className || '—'}</p>
              )}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">الاسم الإنجليزي</p>
                  <p className="text-xs text-slate-500" dir="ltr">
                    English name
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name" required>
                    <input
                      className={inputClass}
                      required
                      dir="ltr"
                      value={form.nameEnFirst}
                      onChange={(e) => patch('nameEnFirst', e.target.value)}
                    />
                  </Field>
                  <Field label="FATHER" required>
                    <input
                      className={inputClass}
                      required
                      dir="ltr"
                      value={form.nameEnFather}
                      onChange={(e) => patch('nameEnFather', e.target.value)}
                    />
                  </Field>
                  <Field label="Grand Father" required>
                    <input
                      className={inputClass}
                      required
                      dir="ltr"
                      value={form.nameEnGrand}
                      onChange={(e) => patch('nameEnGrand', e.target.value)}
                    />
                  </Field>
                  <Field label="FAMILY" required>
                    <input
                      className={inputClass}
                      required
                      dir="ltr"
                      value={form.nameEnFamily}
                      onChange={(e) => patch('nameEnFamily', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <Field label="الجنسية" required>
                <select
                  className={inputClass}
                  required
                  value={form.nationality}
                  onChange={(e) => patch('nationality', e.target.value)}
                >
                  <option value="">اختر…</option>
                  {countrySelectOptions(form.nationality).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="رقم السجل المدني / الإقامة" required>
                <input className={inputClass} required dir="ltr" value={form.civilId} onChange={(e) => patch('civilId', e.target.value)} />
              </Field>
              <Field label="تاريخ الهوية">
                <input className={inputClass} type="date" dir="ltr" value={form.idIssueDate ?? ''} onChange={(e) => patch('idIssueDate', e.target.value)} />
              </Field>
              <Field label="رقم جواز السفر">
                <input className={inputClass} dir="ltr" value={form.passportNumber ?? ''} onChange={(e) => patch('passportNumber', e.target.value)} />
              </Field>
              <Field label="تاريخ الميلاد" required>
                <input className={inputClass} type="date" required dir="ltr" value={form.birthDate} onChange={(e) => patch('birthDate', e.target.value)} />
              </Field>
              <Field label="مكان الولادة — الدولة" required>
                <select
                  className={inputClass}
                  required
                  value={form.birthCountry}
                  onChange={(e) => patch('birthCountry', e.target.value)}
                >
                  <option value="">اختر…</option>
                  {countrySelectOptions(form.birthCountry).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="مكان الميلاد / المدينة" required>
                <input className={inputClass} required value={form.birthCity} onChange={(e) => patch('birthCity', e.target.value)} />
              </Field>
              <Field label="فئة الدم">
                <select className={inputClass} value={form.bloodType ?? 'UNKNOWN'} onChange={(e) => patch('bloodType', e.target.value)}>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'].map((b) => (
                    <option key={b} value={b}>
                      {b === 'UNKNOWN' ? 'لا أعرف' : b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ملكية السكن">
                <select className={inputClass} value={form.housing ?? 'OTHER'} onChange={(e) => patch('housing', e.target.value)}>
                  <option value="OWNED">ملك</option>
                  <option value="RENT">إيجار</option>
                  <option value="OTHER">أخرى</option>
                </select>
              </Field>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold">بيانات الاتصال</h2>
              <Field label="المنطقة الإدارية" required>
                <input className={inputClass} required value={form.adminRegion} onChange={(e) => patch('adminRegion', e.target.value)} />
              </Field>
              <Field label="المدينة" required>
                <input className={inputClass} required value={form.city} onChange={(e) => patch('city', e.target.value)} />
              </Field>
              <Field label="الحي" required>
                <input className={inputClass} required value={form.district} onChange={(e) => patch('district', e.target.value)} />
              </Field>
              <Field label="الشارع الرئيسي" required>
                <input className={inputClass} required value={form.streetMain} onChange={(e) => patch('streetMain', e.target.value)} />
              </Field>
              <Field label="الشارع الفرعي">
                <input className={inputClass} value={form.streetSub ?? ''} onChange={(e) => patch('streetSub', e.target.value)} />
              </Field>
              <Field label="رقم المنزل" required>
                <input className={inputClass} required value={form.houseNumber} onChange={(e) => patch('houseNumber', e.target.value)} />
              </Field>
              <Field label="البريد الإلكتروني" required>
                <input className={inputClass} type="email" required dir="ltr" value={form.email} onChange={(e) => patch('email', e.target.value)} />
              </Field>
              <Field label="الرمز البريدي">
                <input className={inputClass} dir="ltr" value={form.postalCode ?? ''} onChange={(e) => patch('postalCode', e.target.value)} />
              </Field>
              <Field label="صندوق البريد">
                <input className={inputClass} value={form.poBox ?? ''} onChange={(e) => patch('poBox', e.target.value)} />
              </Field>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold">بيانات ولي الأمر</h2>
              <Field label="اسم ولي الأمر" required>
                <input className={inputClass} required value={form.guardianName} onChange={(e) => patch('guardianName', e.target.value)} />
              </Field>
              <Field label="جنسية ولي الأمر" required>
                <input className={inputClass} required value={form.guardianNationality} onChange={(e) => patch('guardianNationality', e.target.value)} />
              </Field>
              <Field label="صلة القرابة" required>
                <select className={inputClass} required value={form.guardianRelation} onChange={(e) => patch('guardianRelation', e.target.value)}>
                  <option value="FATHER">أب</option>
                  <option value="MOTHER">أم</option>
                  <option value="BROTHER">أخ</option>
                  <option value="SISTER">أخت</option>
                  <option value="UNCLE_P">عم</option>
                  <option value="UNCLE_M">خال</option>
                  <option value="GUARDIAN">وصي</option>
                  <option value="OTHER">أخرى</option>
                </select>
              </Field>
              <Field label="نوع الهوية" required>
                <select className={inputClass} required value={form.guardianIdType} onChange={(e) => patch('guardianIdType', e.target.value)}>
                  <option value="NATIONAL">هوية وطنية</option>
                  <option value="IQAMA">إقامة</option>
                  <option value="VISIT">زيارة</option>
                </select>
              </Field>
              <Field label="رقم الهوية" required>
                <input className={inputClass} required dir="ltr" value={form.guardianIdNumber} onChange={(e) => patch('guardianIdNumber', e.target.value)} />
              </Field>
              <Field label="تاريخها" required>
                <input className={inputClass} type="date" required dir="ltr" value={form.guardianIdIssueDate} onChange={(e) => patch('guardianIdIssueDate', e.target.value)} />
              </Field>
              <Field label="مصدرها" required>
                <input className={inputClass} required value={form.guardianIdSource} onChange={(e) => patch('guardianIdSource', e.target.value)} />
              </Field>
              <Field label="نهايتها" required>
                <input className={inputClass} type="date" required dir="ltr" value={form.guardianIdExpiry} onChange={(e) => patch('guardianIdExpiry', e.target.value)} />
              </Field>
              <Field label="هاتف المنزل">
                <input
                  className={inputClass}
                  dir="ltr"
                  inputMode="tel"
                  placeholder="+9665XXXXXXXX"
                  value={form.guardianHomePhone ?? ''}
                  onChange={(e) => patch('guardianHomePhone', e.target.value)}
                />
              </Field>
              <Field label="الجوال" required>
                <input
                  className={inputClass}
                  required
                  dir="ltr"
                  inputMode="tel"
                  placeholder="+9665XXXXXXXX"
                  value={form.guardianMobile}
                  onChange={(e) => patch('guardianMobile', e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">{SAUDI_MOBILE_HINT}</p>
              </Field>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  هل رقم الجوال عليه واتساب؟ <span className="text-red-600">*</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={buttonVariants({
                      variant: form.guardianWhatsappSame !== false ? 'primary' : 'secondary',
                      className: 'flex-1',
                    })}
                    onClick={() => patch('guardianWhatsappSame', true)}
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    className={buttonVariants({
                      variant: form.guardianWhatsappSame === false ? 'primary' : 'secondary',
                      className: 'flex-1',
                    })}
                    onClick={() => patch('guardianWhatsappSame', false)}
                  >
                    لا
                  </button>
                </div>
              </div>
              {form.guardianWhatsappSame === false && (
                <Field label="رقم واتساب" required>
                  <input
                    className={inputClass}
                    required
                    dir="ltr"
                    inputMode="tel"
                    placeholder="+9665XXXXXXXX"
                    value={form.guardianWhatsapp ?? ''}
                    onChange={(e) => patch('guardianWhatsapp', e.target.value)}
                  />
                </Field>
              )}
              <Field label="هاتف العمل">
                <input
                  className={inputClass}
                  dir="ltr"
                  inputMode="tel"
                  placeholder="+9665XXXXXXXX"
                  value={form.guardianWorkPhone ?? ''}
                  onChange={(e) => patch('guardianWorkPhone', e.target.value)}
                />
              </Field>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold">قريب للطوارئ</h2>
              <Field label="اسم القريب" required>
                <input className={inputClass} required value={form.relativeName} onChange={(e) => patch('relativeName', e.target.value)} />
              </Field>
              <Field label="الهاتف" required>
                <input
                  className={inputClass}
                  required
                  dir="ltr"
                  inputMode="tel"
                  placeholder="+9665XXXXXXXX"
                  value={form.relativePhone}
                  onChange={(e) => patch('relativePhone', e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">{SAUDI_MOBILE_HINT}</p>
              </Field>
              <Field label="العنوان">
                <input className={inputClass} value={form.relativeAddress ?? ''} onChange={(e) => patch('relativeAddress', e.target.value)} />
              </Field>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold">الحالات المرضية إن وجدت</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={buttonVariants({
                    variant: !form.hasMedicalConditions ? 'primary' : 'secondary',
                    className: 'flex-1',
                  })}
                  onClick={() => patch('hasMedicalConditions', false)}
                >
                  لا
                </button>
                <button
                  type="button"
                  className={buttonVariants({
                    variant: form.hasMedicalConditions ? 'primary' : 'secondary',
                    className: 'flex-1',
                  })}
                  onClick={() => patch('hasMedicalConditions', true)}
                >
                  نعم
                </button>
              </div>
              {form.hasMedicalConditions && (
                <Field label="التفاصيل" required>
                  <textarea
                    className={inputClass}
                    required
                    rows={3}
                    value={form.medicalDetails ?? ''}
                    onChange={(e) => patch('medicalDetails', e.target.value)}
                  />
                </Field>
              )}
            </section>

            <label className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.attested}
                onChange={(e) => patch('attested', e.target.checked ? true : (false as unknown as true))}
                required
              />
              <span>أقر أنا ولي الأمر بصحة البيانات المدخلة في هذه الاستمارة.</span>
            </label>

            <button
              type="submit"
              disabled={busy || !form.attested}
              className={buttonVariants({ variant: 'primary', className: 'w-full disabled:opacity-50' })}
            >
              {busy ? 'جارٍ الحفظ…' : 'حفظ الاستمارة'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default StudentProfilePublicPage
