const STAFF_TOKEN_KEY = 'staff-token'
const PARENT_TOKEN_KEY = 'parent-token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(STAFF_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STAFF_TOKEN_KEY, token)
    else localStorage.removeItem(STAFF_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function getParentToken(): string | null {
  try {
    return localStorage.getItem(PARENT_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setParentToken(token: string | null) {
  try {
    if (token) localStorage.setItem(PARENT_TOKEN_KEY, token)
    else localStorage.removeItem(PARENT_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  /**
   * Auth mode:
   * - true / 'staff' (default) → staff JWT
   * - 'parent' → parent OTP JWT
   * - false → no Authorization header
   */
  auth?: boolean | 'staff' | 'parent'
}

/**
 * JSON API helper. Dev requests go through Vite `/api` → Express (no CORS issues).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = 'staff', headers: extraHeaders, ...rest } = options
  const headers = new Headers(extraHeaders)

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (auth === true || auth === 'staff') {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  } else if (auth === 'parent') {
    const token = getParentToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`/api${path}`, {
    ...rest,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }

  if (!res.ok) {
    const err = data as { error?: string; details?: unknown } | null
    if (res.status === 401) {
      const path = typeof window !== 'undefined' ? window.location.pathname : ''
      if (auth === 'parent') {
        setParentToken(null)
        if (!path.startsWith('/parent/login') && !path.startsWith('/parent/register')) {
          window.location.assign('/parent/login')
        }
      } else if (auth === true || auth === 'staff') {
        setToken(null)
        if (!path.startsWith('/login')) {
          window.location.assign('/login')
        }
      }
    }
    const message =
      res.status === 401
        ? auth === 'parent'
          ? 'انتهت الجلسة. سجّل الدخول مرة أخرى.'
          : err?.error || 'انتهت الجلسة. سجّل الدخول مرة أخرى.'
        : err?.error || `Request failed (${res.status})`
    throw new ApiError(res.status, message, err?.details)
  }

  return data as T
}
