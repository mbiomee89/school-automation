import { useState, type ReactNode } from 'react'
import {
  FOLLOW_UP_SCALE,
  SCORE_FIELDS,
  SCORE_LABELS,
  formatFollowUpCell,
  followUpTotal,
  type ScoreField,
} from '../lib/weeklyFollowUp'
import { cn } from './utils'

export type FollowUpTableRow = {
  studentId: string
  studentNameAr: string
  participation: number | null
  homeworkScore: number | null
  understanding: number | null
  discipline: number | null
  interaction: number | null
  progress: number | null
  notes: string | null
  total?: number | null
}

type Brand = {
  schoolName: string
  educationAdminName?: string | null
  logoUrl?: string | null
  principalName?: string | null
}

export function WeeklyFollowUpLegend() {
  return (
    <p className="text-xs text-slate-600 sm:text-sm">
      درجة التقييم:{' '}
      {FOLLOW_UP_SCALE.map((s, i) => (
        <span key={s.value}>
          {i > 0 ? ' — ' : ''}
          {s.value} = {s.label}
        </span>
      ))}
    </p>
  )
}

export function WeeklyFollowUpPrintChrome({
  brand,
  title,
  metaLines,
  teacherName,
  dateLabel,
  children,
}: {
  brand: Brand
  title: string
  metaLines: string[]
  teacherName: string
  dateLabel: string
  children: ReactNode
}) {
  const adminLabel = brand.educationAdminName?.trim() || 'الإدارة العامة للتعليم'
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm print:border-slate-400 print:shadow-none"
      style={{ fontFamily: '"Noto Naskh Arabic", "Amiri", "Times New Roman", serif' }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-b border-slate-100 px-3 py-3 sm:px-6 sm:py-4">
        <div className="text-xs leading-relaxed text-slate-600 sm:text-sm">
          <p className="font-semibold text-slate-800">وزارة التعليم</p>
          <p className="mt-1 font-semibold text-slate-800">{adminLabel}</p>
          <p className="mt-1 font-semibold text-slate-800">المرحلة الابتدائية</p>
        </div>
        <div className="flex justify-center self-center">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="" className="h-14 w-14 object-contain sm:h-20 sm:w-20" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400 sm:h-20 sm:w-20">
              الشعار
            </div>
          )}
        </div>
        <div className="text-end text-xs leading-relaxed text-slate-600 sm:text-sm">
          {metaLines.map((line) => (
            <p key={line} className="font-semibold text-slate-800">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="bg-[#1e3a5f] px-3 py-2.5 text-center text-sm font-bold text-white sm:text-lg">
        {title}
      </div>
      <div className="p-3 sm:p-5">{children}</div>
      <div className="grid gap-3 border-t border-slate-100 px-3 py-3 sm:grid-cols-2 sm:px-6 sm:py-4">
        <div className="rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm">
          <p className="font-bold">اعتماد المعلم</p>
          <p className="mt-1">الاسم: {teacherName || '—'}</p>
          <p>التاريخ: {dateLabel}</p>
          <p className="mt-4 text-slate-500">التوقيع: ____________</p>
        </div>
        <div className="rounded-xl border border-slate-200 px-3 py-2 text-center text-xs sm:text-sm">
          <p className="font-bold">مدير المدرسة</p>
          <p className="mt-2">{brand.principalName?.trim() || 'اسم القائد'}</p>
          <p className="mt-4 text-slate-500">التوقيع: ____________</p>
        </div>
      </div>
    </section>
  )
}

export function WeeklyFollowUpStudentTable({
  rows,
  editable,
  disabled,
  onChangeScore,
  onChangeNotes,
  onFillColumn,
}: {
  rows: FollowUpTableRow[]
  editable?: boolean
  /** Keep selects visible but non-interactive (e.g. while saving). */
  disabled?: boolean
  onChangeScore?: (studentId: string, field: ScoreField, value: number | null) => void
  onChangeNotes?: (studentId: string, notes: string) => void
  onFillColumn?: (field: ScoreField, value: number | null) => void
}) {
  const [fillEpoch, setFillEpoch] = useState(0)
  const inputsDisabled = Boolean(disabled)
  const canFill = Boolean(editable && onFillColumn && rows.length > 0 && !inputsDisabled)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="bg-[#1e3a5f] text-white">
            <th className="border border-slate-400 px-1.5 py-2 w-10">م</th>
            <th className="border border-slate-400 px-1.5 py-2 text-start">اسم الطالب</th>
            {SCORE_FIELDS.map((f) => (
              <th key={f} className="border border-slate-400 px-1 py-2 align-bottom">
                <div className="flex flex-col items-center gap-1">
                  <span>{SCORE_LABELS[f]}</span>
                  {editable ? (
                    <select
                      key={`${f}-${fillEpoch}`}
                      className="h-8 w-full min-w-[3.5rem] rounded border border-white/40 bg-white px-1 text-slate-900 print:hidden"
                      defaultValue=""
                      disabled={!canFill}
                      aria-label={`تعبئة كل الطلاب — ${SCORE_LABELS[f]}`}
                      title="تعبئة العمود لكل الطلاب"
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '') return
                        onFillColumn?.(f, raw === 'clear' ? null : Number(raw))
                        setFillEpoch((n) => n + 1)
                      }}
                    >
                      <option value="" disabled>
                        الكل
                      </option>
                      <option value="clear">—</option>
                      {FOLLOW_UP_SCALE.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.value}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </th>
            ))}
            <th className="border border-slate-400 px-1.5 py-2">المجموع</th>
            <th className="border border-slate-400 px-1.5 py-2 text-start">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const total = followUpTotal(row)
            return (
              <tr key={row.studentId} className="bg-white">
                <td className="border border-slate-300 px-1.5 py-1.5 text-center">{idx + 1}</td>
                <td className="border border-slate-300 px-1.5 py-1.5 font-medium">{row.studentNameAr}</td>
                {SCORE_FIELDS.map((f) => (
                  <td key={f} className="border border-slate-300 px-1 py-1 text-center">
                    {editable ? (
                      <select
                        className="h-8 w-full min-w-[3.5rem] rounded border border-slate-300 bg-white px-1 print:border-0 disabled:opacity-60"
                        value={row[f] == null ? '' : String(row[f])}
                        disabled={inputsDisabled}
                        onChange={(e) => {
                          const raw = e.target.value
                          onChangeScore?.(row.studentId, f, raw === '' ? null : Number(raw))
                        }}
                        aria-label={`${SCORE_LABELS[f]} — ${row.studentNameAr}`}
                      >
                        <option value="">—</option>
                        {FOLLOW_UP_SCALE.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.value}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatFollowUpCell(row[f])
                    )}
                  </td>
                ))}
                <td className="border border-slate-300 px-1.5 py-1.5 text-center font-semibold">
                  {formatFollowUpCell(total)}
                </td>
                <td className="border border-slate-300 px-1 py-1">
                  {editable ? (
                    <input
                      className="h-8 w-full min-w-[8rem] rounded border border-slate-300 px-2 print:border-0 disabled:opacity-60"
                      value={row.notes ?? ''}
                      maxLength={500}
                      disabled={inputsDisabled}
                      onChange={(e) => onChangeNotes?.(row.studentId, e.target.value)}
                      aria-label={`ملاحظات — ${row.studentNameAr}`}
                    />
                  ) : (
                    row.notes?.trim() || '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function WeeklyFollowUpSubjectTable({
  rows,
}: {
  rows: Array<{
    subjectNameAr: string
    participation: number | null
    homeworkScore: number | null
    understanding: number | null
    discipline: number | null
    interaction: number | null
    progress: number | null
    notes: string | null
  }>
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">لا توجد مواد للمتابعة هذا الأسبوع.</p>
  }
  return (
    <div className={cn('overflow-x-auto')}>
      <table className="w-full min-w-[44rem] border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="bg-[#1e3a5f] text-white">
            <th className="border border-slate-400 px-1.5 py-2 text-start">المادة</th>
            {SCORE_FIELDS.map((f) => (
              <th key={f} className="border border-slate-400 px-1 py-2">
                {SCORE_LABELS[f]}
              </th>
            ))}
            <th className="border border-slate-400 px-1.5 py-2">المجموع</th>
            <th className="border border-slate-400 px-1.5 py-2 text-start">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.subjectNameAr} className="bg-white">
              <td className="border border-slate-300 px-1.5 py-1.5 font-medium">{row.subjectNameAr}</td>
              {SCORE_FIELDS.map((f) => (
                <td key={f} className="border border-slate-300 px-1 py-1.5 text-center">
                  {formatFollowUpCell(row[f])}
                </td>
              ))}
              <td className="border border-slate-300 px-1.5 py-1.5 text-center font-semibold">
                {formatFollowUpCell(followUpTotal(row))}
              </td>
              <td className="border border-slate-300 px-1.5 py-1.5">{row.notes?.trim() || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
