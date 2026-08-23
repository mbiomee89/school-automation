import { apiRequest } from './client'

export type StaffRole = 'ADMIN' | 'TEACHER' | 'COUNSELOR' | 'STUDENT_AFFAIRS'

export interface StaffUser {
  id: number
  name: string
  email: string
  role: StaffRole
  langPref: 'AR' | 'EN'
  phone?: string | null
  isActive?: boolean
  mustChangePassword?: boolean
}

export async function loginStaff(email: string, password: string) {
  return apiRequest<{ token: string; user: StaffUser }>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
}

export async function fetchMe() {
  return apiRequest<{ user: StaffUser }>('/auth/me')
}

export async function changeStaffPassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ user: StaffUser }>('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  })
}
