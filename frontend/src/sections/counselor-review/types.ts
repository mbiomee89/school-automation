/**
 * Types and props for the Counselor Review section screen designs.
 */

export type AbsenceReasonStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'

export type CounselorTab = 'pending' | 'approved' | 'rejected'

export interface AbsenceReasonItem {
  id: number
  studentId: string
  studentName: string
  className: string
  /** UTC-midnight date string (YYYY-MM-DD) of the absence being explained. */
  absenceDate: string
  reasonText: string
  /** Usually empty — parent attaches at most one photo/PDF as evidence. */
  attachments: string[]
  status: AbsenceReasonStatus
  submittedAt: string
  reviewedAt: string | null
  reviewerName: string | null
  /** Optional note the counselor leaves when rejecting; null for approvals or pending items. */
  counselorNote: string | null
}

export interface DateRangeFilter {
  from: string | null
  to: string | null
}

export interface CounselorReviewProps {
  items: AbsenceReasonItem[]
  /** Active tab for controlled preview */
  activeTab?: CounselorTab

  /** Switch between Pending / Approved / Rejected */
  onTabChange?: (tab: CounselorTab) => void
  /** Search the active tab by student name */
  onSearchStudents?: (query: string) => void
  /** Filter the active tab by absence date range */
  onFilterDateRange?: (range: DateRangeFilter) => void
  /** Open a single case's detail view */
  onSelectItem?: (itemId: number) => void
  /** Open an attachment full-size in a lightbox */
  onViewAttachment?: (url: string) => void
  /** Download an attachment file to the counselor's device */
  onDownloadAttachment?: (url: string) => void
  /** Approve a pending item — excuses the absence */
  onApprove?: (itemId: number) => void
  /** Reject a pending item, with an optional explanatory note */
  onReject?: (itemId: number, note?: string) => void
  /** Print the current list/tab view, or a single case when itemId is provided */
  onPrint?: (view: 'list' | 'case', itemId?: number) => void
  /** Navigate to the shared "التقارير" Reports section */
  onOpenReportsHub?: () => void
}
