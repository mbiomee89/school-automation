import { useEffect, useState, type FormEvent } from 'react'
import { listClasses } from '../../api/admin'
import { listRoster, todayDateStr } from '../../api/teacher'
import { ApiError } from '../../api/client'
import type { RosterStudent } from '../teacher-daily-workflow/types'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import type { StaffEarlyLeaveCreateInput, StaffEarlyLeaveItem } from '../../api/earlyLeave'

function nowHmRiyadh(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = parts.find((p) => p.type === 'hour')?.value ?? '10'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}

const fieldClass =
  'mt-1 w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900'

type Props = {
  /** List filter date — create is only enabled when this equals school today. */
  listDate: string
  onCreate: (input: StaffEarlyLeaveCreateInput) => Promise<StaffEarlyLeaveItem>
  onConflict?: (item: StaffEarlyLeaveItem, message: string) => void
  onSuccess?: (item: StaffEarlyLeaveItem) => void
  onError?: (message: string) => void
}

export function StaffEarlyLeaveCreateForm({
  listDate,
  onCreate,
  onConflict,
  onSuccess,
  onError,
}: Props) {
  const today = todayDateStr()
  const createEnabled = listDate === today
  const [classes, setClasses] = useState<Array<{ id: number; name: string; academicYear: string }>>(
    []
  )
  const [classId, setClassId] = useState<number | null>(null)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [studentId, setStudentId] = useState('')
  const [leaveTime, setLeaveTime] = useState(nowHmRiyadh)
  const [reason, setReason] = useState('')
  const [pickupName, setPickupName] = useState('')
  const [pickupRelation, setPickupRelation] = useState('')
  const [pickupPhone, setPickupPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)

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
          setBootError(err instanceof ApiError ? err.message : 'تعذّر تحميل الفصول')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!classId) return
    let cancelled = false
    ;(async () => {
      try {
        const students = await listRoster(classId)
        if (cancelled) return
        setRoster(students)
        setStudentId(students[0]?.id ?? '')
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof ApiError ? err.message : 'تعذّر تحميل الطلاب')
          setRoster([])
          setStudentId('')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [classId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!studentId || busy || !createEnabled) return
    setBusy(true)
    try {
      const item = await onCreate({
        studentId,
        leaveTime,
        reason: reason.trim(),
        pickupName: pickupName.trim(),
        pickupRelation: pickupRelation.trim(),
        pickupPhone: pickupPhone.trim(),
      })
      setReason('')
      setPickupName('')
      setPickupRelation('')
      setPickupPhone('')
      setLeaveTime(nowHmRiyadh())
      onSuccess?.(item)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const details = err.details as { item?: StaffEarlyLeaveItem } | undefined
        if (details?.item) {
          onConflict?.(details.item, err.message)
          return
        }
      }
      onError?.(err instanceof ApiError ? err.message : 'تعذّر تسجيل الاستئذان')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">تسجيل استئذان</h2>
      <p className="mt-1 text-sm text-slate-500">
        لليوم الحالي فقط — إذا وُجد طلب نشط لنفس الطالب يظهر بدلاً من إنشاء طلب جديد.
      </p>

      {!createEnabled ? (
        <p
          className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
          role="status"
        >
          التسجيل لليوم الحالي فقط — غيّر التاريخ إلى اليوم ({today}) لتسجيل استئذان.
        </p>
      ) : null}

      {bootError ? (
        <p
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="alert"
        >
          {bootError}
        </p>
      ) : null}

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => void handleSubmit(e)}
        aria-disabled={!createEnabled}
      >
        <label className="block text-sm sm:col-span-1">
          <span className="text-slate-600 dark:text-slate-300">الفصل</span>
          <select
            className={fieldClass}
            value={classId ?? ''}
            onChange={(e) => setClassId(Number(e.target.value))}
            required
            disabled={!createEnabled}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYear})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm sm:col-span-1">
          <span className="text-slate-600 dark:text-slate-300">الطالب</span>
          <select
            className={fieldClass}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            disabled={!createEnabled || !roster.length}
          >
            {!roster.length ? <option value="">لا يوجد طلاب</option> : null}
            {roster.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">وقت الخروج</span>
          <input
            type="time"
            className={fieldClass}
            value={leaveTime}
            onChange={(e) => setLeaveTime(e.target.value)}
            required
            dir="ltr"
            disabled={!createEnabled}
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">سبب الاستئذان</span>
          <input
            className={fieldClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            maxLength={500}
            disabled={!createEnabled}
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">اسم المستلم</span>
          <input
            className={fieldClass}
            value={pickupName}
            onChange={(e) => setPickupName(e.target.value)}
            required
            disabled={!createEnabled}
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">صلة القرابة</span>
          <input
            className={fieldClass}
            value={pickupRelation}
            onChange={(e) => setPickupRelation(e.target.value)}
            required
            placeholder="أب / أم / …"
            disabled={!createEnabled}
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-300">جوال المستلم</span>
          <input
            className={fieldClass}
            value={pickupPhone}
            onChange={(e) => setPickupPhone(e.target.value)}
            required
            dir="ltr"
            inputMode="tel"
            placeholder="05xxxxxxxx"
            disabled={!createEnabled}
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !studentId || !createEnabled}
            className={buttonVariants({ variant: 'success', className: 'min-h-11 w-full sm:w-auto' })}
          >
            {busy ? <span className={SPINNER_CLASS} aria-hidden /> : null}
            تسجيل معتمد
          </button>
        </div>
      </form>
    </section>
  )
}
