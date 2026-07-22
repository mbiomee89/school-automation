import { useId, useState, type FormEvent } from 'react'
import { Building2, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import type { StaffLoginErrorCode, StaffLoginProps } from './types'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { ROLE_HOME } from '../../shared/accessControl'
import { fontArabic, fontMono } from '../../shared/fonts'
import { cn } from '../../shared/utils'

const ERROR_AR: Record<StaffLoginErrorCode, string> = {
  INVALID_CREDENTIALS: 'البريد أو كلمة المرور غير صحيحة.',
  ACCOUNT_INACTIVE: 'هذا الحساب معطّل. تواصل مع إدارة المدرسة.',
  NETWORK: 'تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.',
}

/**
 * Standalone staff login (email + password). No app shell.
 * Host must route only to ROLE_HOME[role] after auth — see access-control.md.
 */
export function StaffLogin({
  brand,
  errorCode = null,
  isSubmitting = false,
  initialEmail = '',
  onLogin,
  onOpenParentLogin,
}: StaffLoginProps) {
  const emailId = useId()
  const passwordId = useId()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const displayError = errorCode ? ERROR_AR[errorCode] : localError
  const schoolName = brand?.schoolName ?? 'منصة إدارة المدرسة'

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setLocalError('أدخل البريد الإلكتروني وكلمة المرور.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalError('صيغة البريد الإلكتروني غير صحيحة.')
      return
    }
    onLogin?.({ email: trimmedEmail, password })
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 dark:bg-slate-800 dark:text-slate-100"
      style={fontArabic}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-200/60 via-transparent to-blue-100/70 dark:from-slate-900 dark:to-blue-950/40"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to left, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md">
        <header className="mb-8 text-center">
          {brand?.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt=""
              className="mx-auto size-16 rounded-2xl object-contain shadow-sm"
            />
          ) : (
            <span className="mx-auto inline-flex size-16 items-center justify-center rounded-2xl bg-slate-800 text-slate-100 shadow-lg dark:bg-slate-700">
              <Building2 className="size-8" strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {schoolName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">تسجيل دخول الموظفين</p>
        </header>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 sm:p-8"
        >
          <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p className="font-semibold">بعد الدخول تُفتح مساحة عملك فقط</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-blue-800/90 dark:text-blue-200/90">
                <li>
                  إداري → {ROLE_HOME.ADMIN.homeLabelAr}
                </li>
                <li>
                  معلم → {ROLE_HOME.TEACHER.homeLabelAr}
                </li>
                <li>
                  مرشد → {ROLE_HOME.COUNSELOR.homeLabelAr}
                </li>
              </ul>
              <p className="mt-1">لا يمكنك فتح صفحات الأدوار الأخرى.</p>
            </div>
          </div>

          <label className="block text-sm" htmlFor={emailId}>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              البريد الإلكتروني <span className="text-red-600">*</span>
            </span>
            <div className="relative mt-1.5">
              <Mail
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <input
                id={emailId}
                type="email"
                autoComplete="username"
                dir="ltr"
                value={email}
                disabled={isSubmitting}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setLocalError(null)
                }}
                placeholder="name@school.local"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pe-3 ps-10 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                style={fontMono}
                aria-invalid={!!displayError}
              />
            </div>
          </label>

          <label className="block text-sm" htmlFor={passwordId}>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              كلمة المرور <span className="text-red-600">*</span>
            </span>
            <div className="relative mt-1.5">
              <Lock
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                dir="ltr"
                value={password}
                disabled={isSubmitting}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setLocalError(null)
                }}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pe-12 ps-10 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                aria-invalid={!!displayError}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute end-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                {showPassword ? (
                  <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
            </div>
          </label>

          {displayError && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={buttonVariants({ variant: 'primary', className: 'w-full' })}
          >
            {isSubmitting && <span className={SPINNER_CLASS} aria-hidden="true" />}
            {isSubmitting ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
          </button>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100/60 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-100">حساب تجريبي</p>
            <p className="mt-1" dir="ltr" style={fontMono}>
              admin@school.local
            </p>
            <p dir="ltr" style={fontMono}>
              Password123!
            </p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              حرف P كبير وعلامة ! في النهاية — كلمة المرور حساسة لحالة الأحرف
            </p>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          ولي أمر؟{' '}
          <button
            type="button"
            onClick={() => onOpenParentLogin?.()}
            className={cn(
              'font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300'
            )}
          >
            دخول أولياء الأمور
          </button>
          <span className="mt-1 block text-xs text-slate-400">
            جلسة منفصلة — لا تشارك صلاحيات الموظفين
          </span>
        </p>
      </div>
    </div>
  )
}

export default StaffLogin
