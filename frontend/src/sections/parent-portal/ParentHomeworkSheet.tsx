import { FormalClassSheet, FormalTable } from '../../shared/FormalReportSheet'
import { formatReportDate } from '../../shared/dates'
import type { HomeworkItem, ReportBrand } from './types'

export interface ParentHomeworkSheetProps {
  brand: ReportBrand
  className: string
  date: string
  items: HomeworkItem[]
}

/** Formal class homework sheet — same layout as staff HOMEWORK_LOG for one class. */
export function ParentHomeworkSheet({ brand, className, date, items }: ParentHomeworkSheetProps) {
  const sorted = [...items].sort((a, b) => {
    const pa = Number(a.period ?? 99)
    const pb = Number(b.period ?? 99)
    if (pa !== pb) return pa - pb
    return (a.subjectNameAr || '').localeCompare(b.subjectNameAr || '', 'ar')
  })

  return (
    <FormalClassSheet
      schoolName={brand.schoolName}
      academicYear={brand.academicYear}
      educationAdminName={brand.educationAdminName}
      logoUrl={brand.logoUrl}
      principalName={brand.principalName}
      metaLines={[`تاريخ الواجبات: ${formatReportDate(date)}`, `الفصل: ${className}`]}
      title={`سجل الواجبات — ${className}`}
    >
      <FormalTable
        headers={['الحصة', 'المادة', 'المعلم', 'الوصف', 'الاستحقاق']}
        colWidths={['10%', '16%', '16%', '40%', '18%']}
        empty="لا توجد واجبات مسجّلة لهذا اليوم."
        rows={sorted.map((r) => [
          r.period ? `ح${r.period}` : '—',
          r.subjectNameAr,
          r.teacherName ?? '—',
          r.description,
          r.dueDate ? formatReportDate(r.dueDate) : '—',
        ])}
      />
    </FormalClassSheet>
  )
}
