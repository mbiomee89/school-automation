import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useParentAuth } from '../../lib/parentAuth'
import { ROLE_HOME } from '../../shared/accessControl'
import { ParentLogin } from '../../sections/parent-portal/ParentLogin'
import type { ParentLoginErrorCode, ParentLoginMode } from '../../sections/parent-portal/types'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

export function ParentLoginPage() {
  const { login, register, resetPassword, isAuthenticated, bootstrapping } = useParentAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<ParentLoginMode>('login')
  const [errorCode, setErrorCode] = useState<ParentLoginErrorCode | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (bootstrapping) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={ROLE_HOME.PARENT.homeHref} replace />
  }

  return (
    <ParentLogin
      mode={mode}
      errorCode={errorCode}
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      onModeChange={(next) => {
        setMode(next)
        setErrorCode(null)
        setErrorMessage(null)
      }}
      onSubmit={async ({ phone, password, mode: submitMode, studentId }) => {
        setErrorCode(null)
        setErrorMessage(null)
        setIsSubmitting(true)
        try {
          if (submitMode === 'register') {
            await register(phone, password, studentId ?? '')
          } else if (submitMode === 'reset') {
            await resetPassword(phone, password, studentId ?? '')
          } else {
            await login(phone, password)
          }
          navigate(ROLE_HOME.PARENT.homeHref, { replace: true })
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.status === 401) {
              setErrorCode('INVALID_CREDENTIALS')
            } else if (err.status === 409) {
              setErrorCode('ACCOUNT_EXISTS')
            } else if (err.status === 400) {
              const msg = err.message.toLowerCase()
              if (msg.includes('password')) setErrorCode('WEAK_PASSWORD')
              else if (submitMode === 'reset') {
                setErrorCode('RESET_FAILED')
                setErrorMessage(err.message)
              } else setErrorMessage(err.message)
            } else {
              setErrorCode('NETWORK')
            }
          } else {
            setErrorCode('NETWORK')
          }
        } finally {
          setIsSubmitting(false)
        }
      }}
      onOpenStaffLogin={() => navigate('/login')}
    />
  )
}
