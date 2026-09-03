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

/** Compact day headers so the grid fits phone width. */
const DAY_LABELS_SHORT: Record<string, string> = {
  SUN: 'أحد',
  MON: 'إثن',
  TUE: 'ثلا',
  WED: 'أرب',
  THU: 'خميس',
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
  const frame =
    'flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white sm:size-16 print:size-16'
  if (!src || failed) {
    return (
      <div className={cn(frame, 'border border-dashed border-slate-300 text-[8px] text-slate-500')} aria-hidden={!src}>
        {placeholder}
      </div>
    )
  }
  return (
    <div className={cn(frame, 'border border-slate-200 p-1.5')}>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain object-center"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function MetaCell({
  label,
  value,
  wrap = false,
}: {
  label: string
  value: string
  wrap?: boolean
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[9px] font-medium tracking-wide text-slate-500 sm:text-[10px] print:text-[10px]">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-[11px] font-bold text-slate-900 sm:text-sm print:text-sm',
          wrap ? 'whitespace-normal leading-snug' : 'truncate',
        )}
      >
        {value}
      </p>
    </div>
  )
}

/** ISO date YYYY-MM-DD → DD/MM for compact week range on mobile. */
function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return iso
  return `${m[3]}/${m[2]}`
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
  const weekLabel =
    timetable?.weekStart && timetable?.weekEnd
      ? `${formatShortDate(timetable.weekStart)} – ${formatShortDate(timetable.weekEnd)}`
      : '—'

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
            className: 'inline-flex min-h-11 cursor-pointer items-center gap-1.5',
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
        className="parent-class-timetable-sheet overflow-hidden border border-slate-800/90 bg-[#faf8f2] text-slate-900 shadow-sm print:break-after-page print:border print:shadow-none"
        style={{ fontFamily: '"Noto Naskh Arabic", "Amiri", "Times New Roman", serif' }}
      >
        {/* Official header — logos row, then identity, then meta strip */}
        <header className="border-b border-slate-800/80 bg-gradient-to-b from-white to-[#faf8f2]">
          <div className="grid grid-cols-2 items-center justify-items-center gap-3 px-3 pt-3 sm:px-5 sm:pt-4 print:px-5 print:pt-4">
            <LogoBox src={MINISTRY_LOGO_SRC} alt="شعار وزارة التعليم" placeholder="الوزارة" />
            <LogoBox src={timetable?.logoUrl} alt={schoolName} placeholder="المدرسة" />
          </div>

          <div className="space-y-1 px-3 pb-3 pt-2.5 text-center sm:px-5 print:px-5">
            <p className="text-[10px] font-medium leading-relaxed text-slate-500 sm:text-xs print:text-xs">
              {adminLabel}
            </p>
            <h3 className="mx-auto max-w-[18rem] text-balance text-[13px] font-bold leading-snug text-slate-900 sm:max-w-lg sm:text-lg print:max-w-none print:text-lg">
              {schoolName.startsWith('مدرسة') ? schoolName : `مدرسة ${schoolName}`}
            </h3>
            {timetable?.academicYear ? (
              <p className="text-[10px] text-slate-600 sm:text-xs print:text-xs">
                العام الدراسي {timetable.academicYear}
              </p>
            ) : null}
          </div>

          <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:mx-5 print:mx-5">
            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-200">
              <div className="px-2 py-2.5 sm:px-3">
                <MetaCell label="الفصل" value={className} />
              </div>
              <div className="px-2 py-2.5 sm:px-3">
                <div className="min-w-0 text-center">
                  <p className="text-[9px] font-medium tracking-wide text-slate-500 sm:text-[10px] print:text-[10px]">
                    الطالب
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] font-bold leading-snug text-slate-900 sm:text-sm print:text-sm">
                    {timetable?.studentNameAr?.trim() || '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 px-3 py-2" dir="ltr">
              <MetaCell label="الأسبوع" value={weekLabel} wrap />
            </div>
          </div>
        </header>

        <div className="bg-[color:var(--pp-ink,#0F2744)] px-2 py-2 text-center text-xs font-bold text-white sm:px-3 sm:text-base print:px-3 print:text-base">
          الجدول الأسبوعي — {className}
        </div>

        <div className="p-1 sm:p-3 print:p-3">
          {!hasAnySlot ? (
            <p className="py-8 text-center text-sm text-slate-500">لا يوجد جدول لهذا الفصل بعد</p>
          ) : (
            <table className="w-full table-fixed border-collapse border border-slate-800 text-[8px] leading-tight sm:text-xs sm:leading-normal print:text-[11px] print:leading-snug">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[14.333%]" />
                <col className="w-[14.333%]" />
                <col className="w-[14.333%]" />
                <col className="w-[14.333%]" />
                <col className="w-[14.333%]" />
                <col className="w-[14.333%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-200">
                  <th className="border border-slate-800 px-0.5 py-1 font-bold sm:px-1 sm:py-2 print:px-1 print:py-2">
                    اليوم
                  </th>
                  {PERIODS.map((period) => (
                    <th
                      key={period}
                      className="border border-slate-800 px-0.5 py-1 font-bold tabular-nums sm:px-1 sm:py-2 print:px-1 print:py-2"
                    >
                      ح{period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_ORDER.map((d) => {
                  const isToday =
                    !!today && timetable?.days.find((x) => x.dayOfWeek === d)?.date === today
                  return (
                    <tr key={d} className={isToday ? 'bg-amber-50/80 print:bg-slate-50' : 'bg-[#faf8f2]'}>
                      <th
                        className={cn(
                          'border border-slate-800 px-0.5 py-1.5 text-center font-bold sm:px-1 sm:py-2 print:px-1 print:py-2',
                          isToday ? 'bg-slate-300' : 'bg-slate-100',
                        )}
                      >
                        <span className="sm:hidden print:hidden">{DAY_LABELS_SHORT[d]}</span>
                        <span className="hidden sm:inline print:inline">{DAY_LABELS[d]}</span>
                      </th>
                      {PERIODS.map((period) => {
                        const subject = cellMap.get(`${d}|${period}`) ?? ''
                        return (
                          <td
                            key={`${d}-${period}`}
                            className="break-words border border-slate-800 px-0.5 py-1.5 text-center align-middle font-medium text-slate-900 sm:px-1 sm:py-2 print:px-1 print:py-2"
                          >
                            {subject || '\u00a0'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-stretch gap-1.5 border-t-2 border-slate-800 px-1.5 py-2 sm:gap-3 sm:px-4 sm:py-3 print:gap-3 print:px-4 print:py-3">
          <p className="text-[10px] font-bold text-slate-800 sm:text-sm print:text-sm">ملاحظات:</p>
          <div className="min-w-0 flex-1 border border-slate-700 bg-white px-2 py-1.5 text-[9px] leading-5 text-slate-700 sm:min-w-[10rem] sm:px-3 sm:py-2 sm:text-sm sm:leading-7 print:px-3 print:py-2 print:text-sm print:leading-7">
            {PARENT_NOTE}
          </div>
          <div className="flex w-full flex-col justify-center border border-slate-700 bg-white px-2 py-1.5 text-center text-[9px] sm:w-auto sm:min-w-[10rem] sm:px-3 sm:py-2 sm:text-sm print:min-w-[10rem] print:px-3 print:py-2 print:text-sm">
            <p className="font-bold text-slate-800">قائد المدرسة</p>
            <p className="mt-0.5 text-slate-600 sm:mt-2 print:mt-2">
              {timetable?.principalName?.trim() || 'اسم القائد'}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ParentClassTimetable
