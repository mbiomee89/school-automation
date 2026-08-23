import { useId, useState, type FormEvent } from 'react'
import { Building2, Eye, EyeOff, IdCard, Lock, Smartphone } from 'lucide-react'
import type { ParentLoginErrorCode, ParentLoginMode, ParentLoginProps } from './types'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic, fontMono } from '../../shared/fonts'
import { cn } from '../../shared/utils'

const ERROR_AR: Record<ParentLoginErrorCode, string> = {
  INVALID_PHONE: 'تحقق من رقم الجوال — يجب أن يكون سعودياً بصيغة صحيحة.',
  INVALID_CREDENTIALS: 'رقم الجوال أو كلمة المرور غير صحيحة.',
  PHONE_NOT_FOUND: 'هذا الرقم غير مرتبط بطالب في المدرسة. تواصل مع الإدارة.',
  ACCOUNT_EXISTS: 'يوجد حساب لهذا الرقم مسبقاً — سجّل الدخول بدل الإنشاء.',
  WEAK_PASSWORD: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
  STUDENT_ID_REQUIRED: 'أدخل معرّف / رقم هوية أحد أبنائك المسجّلين على هذا الجوال.',
  NETWORK: 'تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.',
}

function looksLikeSaudiPhone(value: string) {
  const digits = value.trim().replace(/[\s()-]/g, '').replace(/^\+/, '')
  if (!/^\d+$/.test(digits)) return false
  return (
    (digits.startsWith('9665') && digits.length === 12) ||
    (digits.startsWith('05') && digits.length === 10) ||
    (digits.startsWith('5') && digits.length === 9)
  )
}

/**
 * Parent phone + password login / first-time register (register also needs student ID).
 * Mobile-first, no app shell.
 */
export function ParentLogin({
  brand,
  mode: controlledMode,
  initialPhone = '',
  errorCode = null,
  errorMessage = null,
  isSubmitting = false,
  onModeChange,
  onSubmit,
  onOpenStaffLogin,
}: ParentLoginProps) {
  const phoneId = useId()
  const passwordId = useId()
  const studentIdFieldId = useId()
  const [mode, setMode] = useState<ParentLoginMode>(controlledMode ?? 'login')
  const [phone, setPhone] = useState(initialPhone)
  const [password, setPassword] = useState('')
  const [studentId, setStudentId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<ParentLoginErrorCode | null>(null)

  const currentMode = controlledMode ?? mode
  const displayError =
    errorMessage || (errorCode ? ERROR_AR[errorCode] : null) || (localError ? ERROR_AR[localError] : null)
  const schoolName = brand?.schoolName ?? 'منصة إدارة المدرسة'

  function switchMode(next: ParentLoginMode) {
    setLocalError(null)
    setMode(next)
    onModeChange?.(next)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    const trimmedPhone = phone.trim()
    if (!looksLikeSaudiPhone(trimmedPhone)) {
      setLocalError('INVALID_PHONE')
      return
    }
    if (!password) {
      setLocalError('INVALID_CREDENTIALS')
      return
    }
    if (currentMode === 'register' && password.length < 8) {
      setLocalError('WEAK_PASSWORD')
      return
    }
    const trimmedStudentId = studentId.trim()
    if (currentMode === 'register' && !trimmedStudentId) {
      setLocalError('STUDENT_ID_REQUIRED')
      return
    }
    onSubmit?.({
      phone: trimmedPhone,
      password,
      mode: currentMode,
      ...(currentMode === 'register' ? { studentId: trimmedStudentId } : {}),
    })
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 dark:bg-slate-950"
      style={fontArabic}
    >
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
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">بوابة أولياء الأمور</p>
        </header>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 sm:p-8"
        >
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={cn(
                'rounded-lg py-2 text-sm font-semibold transition-colors',
                currentMode === 'login'
                  ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400'
              )}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={cn(
                'rounded-lg py-2 text-sm font-semibold transition-colors',
                currentMode === 'register'
                  ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400'
              )}
            >
              إنشاء كلمة مرور
            </button>
          </div>

          {currentMode === 'register' && (
            <p className="rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
              لأول مرة فقط: أدخل رقم الجوال المسجّل لدى المدرسة ومعرّف أحد أبنائك على هذا الجوال، ثم اختر
              كلمة مرور (8 أحرف على الأقل).
            </p>
          )}

          <label className="block text-sm" htmlFor={phoneId}>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              رقم الجوال <span className="text-red-600">*</span>
            </span>
            <div className="relative mt-1.5">
              <Smartphone
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <input
                id={phoneId}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                disabled={isSubmitting}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setLocalError(null)
                }}
                placeholder="05XXXXXXXX"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pe-3 ps-10 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                style={fontMono}
                aria-invalid={!!displayError}
              />
            </div>
          </label>

          {currentMode === 'register' && (
            <label className="block text-sm" htmlFor={studentIdFieldId}>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                معرّف الطالب / رقم الهوية <span className="text-red-600">*</span>
              </span>
              <div className="relative mt-1.5">
                <IdCard
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <input
                  id={studentIdFieldId}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                  value={studentId}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setStudentId(e.target.value)
                    setLocalError(null)
                  }}
                  placeholder="رقم هوية أحد الأبناء"
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pe-3 ps-10 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  style={fontMono}
                  aria-invalid={!!displayError}
                />
              </div>
              <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">
                يجب أن يطابق رقم الجوال المسجّل لهذا الطالب في سجلات المدرسة.
              </span>
            </label>
          )}

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
                autoComplete={currentMode === 'login' ? 'current-password' : 'new-password'}
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
            {isSubmitting
              ? 'جارٍ المتابعة…'
              : currentMode === 'login'
                ? 'تسجيل الدخول'
                : 'إنشاء الحساب والدخول'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          موظف؟{' '}
          <button
            type="button"
            onClick={() => onOpenStaffLogin?.()}
            className="font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300"
          >
            دخول الموظفين
          </button>
        </p>
      </div>
    </div>
  )
}

export default ParentLogin
