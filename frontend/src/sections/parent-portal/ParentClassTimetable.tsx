import { Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buttonVariants } from '../../shared/buttonVariants'
import { cn } from '../../shared/utils'
import type { ClassTimetable } from './types'

const PARENT_NOTE =
  'عزيزي ولي الأمر: أنت شريك في نجاح العملية التعليمية وتحقيق الانضباط المدرسي، فكن عوناً لنا.'

const DAY_LABELS: Record<string, string> = {
  SUN: 'الأحد',
  MON: 'الإثنين',
  TUE: 'الثلاثاء',
  WED: 'الأربعاء',
  THU: 'الخميس',
}

const DAY_ORDER = ['SUN', 'MON', 'TUE', 'WED', 'THU'] as const
const PERIODS = ['1', '2', '3', '4', '5', '6'] as const

const MINISTRY_LOGO_SRC = '/ministry-education-logo.png'

export interface ParentClassTimetableProps {
  timetable: ClassTimetable | null
  loading?: boolean
  error?: string | null
}

function LogoBox({
  src,
  alt,
  placeholder,
}: {
  src: string | null | undefined
  alt: string
  placeholder: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-400 text-[9px] text-slate-500 sm:h-20 sm:w-20 sm:text-[10px]">
        {placeholder}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-14 w-14 object-contain sm:h-20 sm:w-20"
      onError={() => setFailed(true)}
    />
  )
}

/**
 * Traditional paper class timetable for parent home — dual logos, ruled grid, print.
 */
export function ParentClassTimetable({ timetable, loading, error }: ParentClassTimetableProps) {
  const cellMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const day of timetable?.days ?? []) {
      for (const slot of day.slots) {
        map.set(`${day.dayOfWeek}|${slot.period}`, slot.subjectNameAr)
      }
    }
    return map
  }, [timetable])

  const hasAnySlot = (timetable?.days ?? []).some((d) => d.slots.length > 0)
  const adminLabel = timetable?.educationAdminName?.trim() || 'الإدارة العامة للتعليم'
  const schoolName = timetable?.schoolName || 'المدرسة'
  const className = timetable?.className || 'بدون فصل'
  const today = timetable?.today

  function handlePrint() {
    window.print()
  }

  if (loading && !timetable) {
    return (
      <section className="rounded-sm border border-slate-300 bg-[#faf8f2] p-6 text-center text-sm text-slate-500 print:hidden">
        جارٍ تحميل الجدول…
      </section>
    )
  }

  if (error && !timetable) {
    return (
      <section
        className="rounded-sm border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 print:hidden"
        role="alert"
      >
        {error}
      </section>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <h2 className="text-sm font-bold text-[color:var(--pp-ink)]">الجدول الأسبوعي</h2>
        <button
          type="button"
          onClick={handlePrint}
          className={buttonVariants({
            variant: 'secondary',
            size: 'sm',
            className: 'inline-flex cursor-pointer items-center gap-1.5',
          })}
        >
          <Printer className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          طباعة الجدول
        </button>
      </div>

      {error ? (
        <p className="text-xs text-rose-600 print:hidden" role="alert">
          {error}
        </p>
      ) : null}

      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      <section
        className="parent-class-timetable-sheet overflow-hidden border-2 border-slate-800 bg-[#faf8f2] text-slate-900 shadow-sm print:break-after-page print:border print:shadow-none"
        style={{ fontFamily: '"Noto Naskh Arabic", "Amiri", "Times New Roman", serif' }}
      >
        {/* Official header: ministry | school logo | meta */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 border-b-2 border-slate-800 px-2 py-3 sm:gap-3 sm:px-4">
          <div className="flex flex-col items-start gap-1.5">
            <LogoBox src={MINISTRY_LOGO_SRC} alt="شعار الوزارة" placeholder="شعار الوزارة" />
            <p className="text-[10px] font-semibold leading-snug text-slate-800 sm:text-xs">{adminLabel}</p>
          </div>

          <div className="flex flex-col items-center gap-1 self-center">
            <LogoBox src={timetable?.logoUrl} alt={schoolName} placeholder="الشعار" />
            <p className="text-center text-xs font-bold text-slate-900 sm:text-sm">مدرسة {schoolName}</p>
            {timetable?.academicYear ? (
              <p className="text-[10px] text-slate-600">العام الدراسي {timetable.academicYear}</p>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-1 text-end text-[10px] sm:text-xs">
            <p className="font-bold text-slate-900">الفصل: {className}</p>
            {timetable?.studentNameAr ? (
              <p className="text-slate-700">الطالب: {timetable.studentNameAr}</p>
            ) : null}
            {timetable?.weekStart && timetable?.weekEnd ? (
              <p className="text-slate-600" dir="ltr">
                {timetable.weekStart} — {timetable.weekEnd}
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-b-2 border-slate-800 bg-slate-800 px-3 py-2 text-center text-sm font-bold text-white sm:text-base">
          الجدول الأسبوعي — {className}
        </div>

        <div className="p-2 sm:p-3">
          {!hasAnySlot ? (
            <p className="py-8 text-center text-sm text-slate-500">لا يوجد جدول لهذا الفصل بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse border border-slate-800 text-[10px] sm:text-xs">
                <thead>
                  <tr className="bg-slate-200">
                    <th className="border border-slate-800 px-1 py-2 font-bold">الحصة</th>
                    {DAY_ORDER.map((d) => (
                      <th
                        key={d}
                        className={cn(
                          'border border-slate-800 px-1 py-2 font-bold',
                          today && timetable?.days.find((x) => x.dayOfWeek === d)?.date === today
                            ? 'bg-slate-300'
                            : ''
                        )}
                      >
                        {DAY_LABELS[d]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((period) => (
                    <tr key={period}>
                      <th className="border border-slate-800 bg-slate-100 px-1 py-2 font-bold tabular-nums">
                        ح{period}
                      </th>
                      {DAY_ORDER.map((d) => {
                        const isToday =
                          !!today && timetable?.days.find((x) => x.dayOfWeek === d)?.date === today
                        const subject = cellMap.get(`${d}|${period}`) ?? ''
                        return (
                          <td
                            key={`${d}-${period}`}
                            className={cn(
                              'border border-slate-800 px-1 py-2 text-center align-middle font-medium text-slate-900',
                              isToday ? 'bg-amber-50/80 print:bg-slate-50' : 'bg-[#faf8f2]'
                            )}
                          >
                            {subject || '\u00a0'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-stretch gap-2 border-t-2 border-slate-800 px-2 py-3 sm:gap-3 sm:px-4">
          <p className="text-xs font-bold text-slate-800 sm:text-sm">ملاحظات:</p>
          <div className="min-w-[10rem] flex-1 border border-slate-700 bg-white px-3 py-2 text-xs leading-6 text-slate-700 sm:text-sm sm:leading-7">
            {PARENT_NOTE}
          </div>
          <div className="flex min-w-[8rem] flex-col justify-center border border-slate-700 bg-white px-3 py-2 text-center text-xs sm:min-w-[10rem] sm:text-sm">
            <p className="font-bold text-slate-800">قائد المدرسة</p>
            <p className="mt-1 text-slate-600 sm:mt-2">
              {timetable?.principalName?.trim() || 'اسم القائد'}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ParentClassTimetable
