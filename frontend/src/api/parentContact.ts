import { apiRequest } from './client'
import type { ParentContactAdminItem } from '../sections/parent-portal/types'

export async function listParentContactMessages(opts?: {
  status?: 'OPEN' | 'CLOSED' | 'all'
  from?: string
  to?: string
}) {
  const status = opts?.status ?? 'OPEN'
  const search = new URLSearchParams()
  if (status !== 'OPEN') search.set('status', status)
  if (opts?.from) search.set('from', opts.from)
  if (opts?.to) search.set('to', opts.to)
  const qs = search.toString() ? `?${search}` : ''
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
