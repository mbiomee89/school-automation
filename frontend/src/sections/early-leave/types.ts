/**
 * Types for staff Early Leave (طلبات الاستئذان) review screen.
 */

import type { EarlyLeaveStatus } from '../parent-portal/types'
import type { StaffEarlyLeaveItem } from '../../api/earlyLeave'

export type EarlyLeaveTab = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all'

export interface EarlyLeaveReviewProps {
  date: string
  items: StaffEarlyLeaveItem[]
  statusFilter: EarlyLeaveStatus | 'ALL'
  reviewingId?: number | null
  loading?: boolean
  onDateChange?: (date: string) => void
  onStatusFilterChange?: (status: EarlyLeaveStatus | 'ALL') => void
  onApprove?: (id: number) => void | Promise<void>
  onReject?: (id: number, note: string) => void | Promise<void>
  onPrint?: () => void
}

export type { EarlyLeaveStatus, StaffEarlyLeaveItem }
