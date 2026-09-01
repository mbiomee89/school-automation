import type { ReactNode } from 'react'

const PARENT_NOTE =
  'عزيزي ولي الأمر: أنت شريك في نجاح العملية التعليمية وتحقيق الانضباط المدرسي، فكن عوناً لنا.'

export interface FormalBrandProps {
  schoolName: string
  academicYear: string
  educationAdminName?: string | null
  logoUrl?: string | null
  principalName?: string | null
  metaLines: string[]
  title: string
  children: ReactNode
}

/** Official school report sheet (header / title / table slot / footer) — shared by staff reports and parent portal. */
export function FormalClassSheet({
  schoolName,
  academicYear,
  educationAdminName,
  logoUrl,
  principalName,
  metaLines,
  title,
  children,
}: FormalBrandProps) {
  const adminLabel = educationAdminName?.trim() || 'الإدارة العامة للتعليم'
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm print:break-after-page print:shadow-none"
      style={{ fontFamily: '"Noto Naskh Arabic", "Amiri", "Times New Roman", serif' }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-b border-slate-100 px-3 py-3 sm:px-6 sm:py-4">
        <div className="text-xs leading-relaxed text-slate-600 sm:text-sm">
          <p className="font-semibold text-slate-800">{adminLabel}</p>
          <p className="mt-1 font-semibold text-slate-800">مدرسة {schoolName}</p>
          {academicYear ? (
            <p className="mt-1 text-[10px] text-slate-500 sm:text-xs">العام الدراسي {academicYear}</p>
          ) : null}
        </div>
        <div className="flex justify-center self-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={schoolName}
              className="h-14 w-14 object-contain sm:h-24 sm:w-24"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400 sm:h-24 sm:w-24">
              الشعار
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <div className="min-w-[7rem] rounded-xl bg-emerald-600 px-2 py-2 text-center text-[10px] font-semibold text-white shadow-sm sm:min-w-[10rem] sm:px-4 sm:py-3 sm:text-sm">
            {metaLines.map((line) => (
              <p key={line} className="leading-5 sm:leading-6">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#1e3a5f] px-3 py-2.5 text-center text-sm font-bold text-white sm:px-4 sm:py-3 sm:text-lg">
        {title}
      </div>

      <div className="p-3 sm:p-5">{children}</div>

      <div className="flex flex-wrap items-stretch gap-2 border-t border-slate-100 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
        <p className="text-xs font-bold text-teal-700 sm:text-sm">ملاحظات:</p>
        <div className="min-w-[10rem] flex-1 rounded-xl border-2 border-teal-500/70 px-3 py-2 text-xs leading-6 text-slate-700 sm:px-4 sm:py-3 sm:text-sm sm:leading-7">
          {PARENT_NOTE}
        </div>
        <div className="flex min-w-[8rem] flex-col justify-center rounded-xl border-2 border-teal-500/70 px-3 py-2 text-center text-xs sm:min-w-[10rem] sm:px-4 sm:py-3 sm:text-sm">
          <p className="font-bold text-slate-800">قائد المدرسة</p>
          <p className="mt-1 text-slate-600 sm:mt-2">{principalName?.trim() || 'اسم القائد'}</p>
        </div>
      </div>
    </section>
  )
}

export function FormalTable({
  headers,
  rows,
  empty,
  colWidths,
}: {
  headers: string[]
  rows: string[][]
  empty: string
  colWidths?: string[]
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-teal-600/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-xs sm:min-w-[36rem] sm:text-sm">
          <thead>
            <tr className="bg-teal-600 text-white">
              {headers.map((h, i) => (
                <th
                  key={h}
                  className="border border-teal-700 px-1.5 py-2 font-bold sm:px-2 sm:py-2.5"
                  style={colWidths?.[i] ? { width: colWidths[i] } : undefined}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cols, i) => (
              <tr key={i} className="bg-white">
                {cols.map((c, j) => (
                  <td
                    key={j}
                    className="border border-slate-200 px-1.5 py-1.5 align-top text-slate-800 sm:px-2 sm:py-2"
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{empty}</p>}
    </div>
  )
}

export interface WeeklyPlanFormalRow {
  planId: number
  dayKey: string
  dayLabel: string
  subjectName: string
  lessonTopic: string
  notes: string | null
}

export function WeeklyPlanFormalTable({ rows }: { rows: WeeklyPlanFormalRow[] }) {
  const spans: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].dayKey === rows[i - 1].dayKey) {
      spans[i] = 0
      continue
    }
    let span = 1
    while (i + span < rows.length && rows[i + span].dayKey === rows[i].dayKey) span++
    spans[i] = span
  }

  return (
    <div className="overflow-hidden rounded-xl border border-teal-600/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-xs sm:min-w-[40rem] sm:text-sm">
          <thead>
            <tr className="bg-teal-600 text-white">
              <th className="w-[12%] border border-teal-700 px-1.5 py-2 font-bold sm:px-2 sm:py-2.5">اليوم</th>
              <th className="w-[18%] border border-teal-700 px-1.5 py-2 font-bold sm:px-2 sm:py-2.5">المادة</th>
              <th className="w-[30%] border border-teal-700 px-1.5 py-2 font-bold sm:px-2 sm:py-2.5">موضوع الدرس</th>
              <th className="w-[40%] border border-teal-700 px-1.5 py-2 font-bold sm:px-2 sm:py-2.5">
                ملاحظات / الواجب
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.planId}-${r.dayKey}-${r.subjectName}-${i}`} className="bg-white">
                {spans[i] > 0 && (
                  <td
                    rowSpan={spans[i]}
                    className="border border-slate-200 px-1.5 py-1.5 text-center font-bold align-middle text-slate-800 sm:px-2 sm:py-2"
                  >
                    {r.dayLabel}
                  </td>
                )}
                <td className="border border-slate-200 px-1.5 py-1.5 align-top text-slate-800 sm:px-2 sm:py-2">
                  {r.subjectName}
                </td>
                <td className="border border-slate-200 px-1.5 py-1.5 align-top text-slate-800 sm:px-2 sm:py-2">
                  {r.lessonTopic}
                </td>
                <td className="border border-slate-200 px-1.5 py-1.5 align-top text-slate-800 sm:px-2 sm:py-2">
                  {r.notes?.trim() || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-500">لا توجد خطة أسبوعية لهذا الأسبوع.</p>
      )}
    </div>
  )
}
