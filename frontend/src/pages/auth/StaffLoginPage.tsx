import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../lib/auth'
import { ROLE_HOME } from '../../shared/accessControl'
import { StaffLogin } from '../../sections/staff-login/StaffLogin'
import type { StaffLoginErrorCode } from '../../sections/staff-login/types'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

export function StaffLoginPage() {
  const { login, isAuthenticated, bootstrapping, role } = useAuth()
  const navigate = useNavigate()
  const [errorCode, setErrorCode] = useState<StaffLoginErrorCode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (bootstrapping) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (isAuthenticated && role) {
    return <Navigate to={ROLE_HOME[role].homeHref} replace />
  }

  return (
    <StaffLogin
      errorCode={errorCode}
      isSubmitting={isSubmitting}
      onLogin={async ({ email, password }) => {
        setErrorCode(null)
        setIsSubmitting(true)
        try {
          const user = await login(email.trim(), password)
          navigate(ROLE_HOME[user.role].homeHref, { replace: true })
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            setErrorCode('INVALID_CREDENTIALS')
          } else {
            setErrorCode('NETWORK')
          }
        } finally {
          setIsSubmitting(false)
        }
      }}
      onOpenParentLogin={() => navigate('/parent/login')}
    />
  )
}
