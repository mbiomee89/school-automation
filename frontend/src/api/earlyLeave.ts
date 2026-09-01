import { apiRequest } from './client'
import type { EarlyLeaveRequest, EarlyLeaveStatus } from '../sections/parent-portal/types'

export type StaffEarlyLeaveItem = EarlyLeaveRequest & {
  studentName: string | null
  reviewerName: string | null
}

export async function listEarlyLeave(params: { date: string; status?: EarlyLeaveStatus }) {
  const search = new URLSearchParams({ date: params.date })
  if (params.status) search.set('status', params.status)
  const data = await apiRequest<{ date: string; items: StaffEarlyLeaveItem[] }>(
    `/early-leave?${search}`
  )
  return data
}

export async function reviewEarlyLeave(
  id: number,
  decision: 'APPROVED' | 'REJECTED',
  note?: string
) {
  const data = await apiRequest<{ item: StaffEarlyLeaveItem }>(`/early-leave/${id}/review`, {
    method: 'PATCH',
    body: { decision, note: note ?? null },
  })
  return data.item
}
