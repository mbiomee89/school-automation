import { apiRequest } from './client'
import type { ParentContactAdminItem } from '../sections/parent-portal/types'

export async function listParentContactMessages(status: 'OPEN' | 'CLOSED' | 'all' = 'OPEN') {
  const qs = status === 'OPEN' ? '' : `?status=${status}`
  const data = await apiRequest<{ items: ParentContactAdminItem[] }>(`/parent-contact${qs}`)
  return data.items
}

export async function getParentContactPendingCount() {
  const data = await apiRequest<{ count: number }>('/parent-contact/pending-count')
  return data.count
}

export async function replyParentContactMessage(id: number, replyBody: string) {
  const data = await apiRequest<{ item: ParentContactAdminItem }>(`/parent-contact/${id}/reply`, {
    method: 'PATCH',
    body: { replyBody },
  })
  return data.item
}
