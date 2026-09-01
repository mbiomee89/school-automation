import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FormalClassSheet, WeeklyPlanFormalTable } from '../../shared/FormalReportSheet'
import { formatReportDateRange } from '../../shared/dates'
import { addDaysIso } from './theme'
import type { ReportBrand, WeeklyPlanFormalRow } from './types'

export interface ParentWeeklyPlanSheetProps {
  brand: ReportBrand
  className: string
  weekStart: string
  weekEnd: string
  rows: WeeklyPlanFormalRow[]
  onWeekChange: (anchorDate: string) => void
}

/** Formal weekly plan sheet — same layout as staff WEEKLY_PLAN for one class. */
export function ParentWeeklyPlanSheet({
  brand,
  className,
  weekStart,
  weekEnd,
  rows,
  onWeekChange,
}: ParentWeeklyPlanSheetProps) {
  // Storage weekStart is Saturday; school week Sun–Thu → display range from Sun
  const schoolWeekStart = addDaysIso(weekStart, 1)
  const schoolWeekEnd = weekEnd

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="الأسبوع السابق"
          onClick={() => onWeekChange(addDaysIso(weekStart, -7))}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-[color:var(--pp-ink)] hover:bg-[color:var(--pp-sky)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
        >
          <ChevronRight className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <p className="text-xs font-semibold text-[color:var(--pp-ink)]/60" dir="ltr">
          {formatReportDateRange(schoolWeekStart, schoolWeekEnd)}
        </p>
        <button
          type="button"
          aria-label="الأسبوع التالي"
          onClick={() => onWeekChange(addDaysIso(weekStart, 7))}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-[color:var(--pp-ink)] hover:bg-[color:var(--pp-sky)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <FormalClassSheet
        schoolName={brand.schoolName}
        academicYear={brand.academicYear}
        educationAdminName={brand.educationAdminName}
        logoUrl={brand.logoUrl}
        principalName={brand.principalName}
        metaLines={[
          brand.academicYear ? `العام الدراسي ${brand.academicYear}` : 'العام الدراسي',
          formatReportDateRange(schoolWeekStart, schoolWeekEnd),
          `الفصل: ${className}`,
        ]}
        title={`الخطة الدراسية الأسبوعية — ${className}`}
      >
        <WeeklyPlanFormalTable rows={rows} />
      </FormalClassSheet>
    </div>
  )
}
