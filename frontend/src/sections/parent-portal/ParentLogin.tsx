import { useId, useState, type FormEvent } from 'react'
import { Building2, Eye, EyeOff, IdCard, Lock, Smartphone } from 'lucide-react'
import type { ParentLoginErrorCode, ParentLoginMode, ParentLoginProps } from './types'
import { buttonVariants, SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic, fontMono } from '../../shared/fonts'
import { cn } from '../../shared/utils'
import { PARENT_PORTAL_THEME } from './theme'

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
      className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-[color:var(--pp-sky)] px-4 py-10"
      style={{ ...fontArabic, ...PARENT_PORTAL_THEME }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(29,111,168,0.25), transparent)',
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
            <span className="mx-auto inline-flex size-16 items-center justify-center rounded-2xl bg-[color:var(--pp-ink)] text-white shadow-lg">
              <Building2 className="size-8" strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[color:var(--pp-ink)]">
            {schoolName}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-[color:var(--pp-primary)]">بوابة أولياء الأمور</p>
          <p className="mt-1 text-xs text-[color:var(--pp-ink)]/50">تابع حضور ابنك وواجباته بسهولة</p>
        </header>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-3xl bg-[color:var(--pp-sand)] p-6 shadow-sm ring-1 ring-[color:var(--pp-ink)]/8 sm:p-8"
        >
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/70 p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={cn(
                'min-h-11 cursor-pointer rounded-lg py-2 text-sm font-semibold transition-colors',
                currentMode === 'login'
                  ? 'bg-[color:var(--pp-primary)] text-white shadow-sm'
                  : 'text-[color:var(--pp-ink)]/55'
              )}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={cn(
                'min-h-11 cursor-pointer rounded-lg py-2 text-sm font-semibold transition-colors',
                currentMode === 'register'
                  ? 'bg-[color:var(--pp-primary)] text-white shadow-sm'
                  : 'text-[color:var(--pp-ink)]/55'
              )}
            >
              إنشاء كلمة مرور
            </button>
          </div>

          {currentMode === 'register' && (
            <p className="rounded-xl bg-[color:var(--pp-primary-soft)] px-3 py-2 text-xs text-[color:var(--pp-ink)]">
              لأول مرة فقط: أدخل رقم الجوال المسجّل لدى المدرسة ومعرّف أحد أبنائك على هذا الجوال، ثم اختر
              كلمة مرور (8 أحرف على الأقل).
            </p>
          )}

          <label className="block text-sm" htmlFor={phoneId}>
            <span className="font-medium text-[color:var(--pp-ink)]">
              رقم الجوال <span className="text-[color:var(--pp-danger)]">*</span>
            </span>
            <div className="relative mt-1.5">
              <Smartphone
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--pp-ink)]/35"
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
                className="min-h-11 w-full rounded-xl border border-[color:var(--pp-ink)]/15 bg-white py-2.5 pe-3 ps-10 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
                style={fontMono}
                aria-invalid={!!displayError}
              />
            </div>
          </label>

          {currentMode === 'register' && (
            <label className="block text-sm" htmlFor={studentIdFieldId}>
              <span className="font-medium text-[color:var(--pp-ink)]">
                معرّف الطالب / رقم الهوية <span className="text-[color:var(--pp-danger)]">*</span>
              </span>
              <div className="relative mt-1.5">
                <IdCard
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--pp-ink)]/35"
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
                  className="min-h-11 w-full rounded-xl border border-[color:var(--pp-ink)]/15 bg-white py-2.5 pe-3 ps-10 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
                  style={fontMono}
                  aria-invalid={!!displayError}
                />
              </div>
              <span className="mt-1.5 block text-xs text-[color:var(--pp-ink)]/50">
                يجب أن يطابق رقم الجوال المسجّل لهذا الطالب في سجلات المدرسة.
              </span>
            </label>
          )}

          <label className="block text-sm" htmlFor={passwordId}>
            <span className="font-medium text-[color:var(--pp-ink)]">
              كلمة المرور <span className="text-[color:var(--pp-danger)]">*</span>
            </span>
            <div className="relative mt-1.5">
              <Lock
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--pp-ink)]/35"
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
                className="min-h-11 w-full rounded-xl border border-[color:var(--pp-ink)]/15 bg-white py-2.5 pe-12 ps-10 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
                aria-invalid={!!displayError}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute end-2 top-1/2 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[color:var(--pp-ink)]/45 hover:bg-[color:var(--pp-sky)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
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
              className="rounded-xl bg-[color:var(--pp-danger-soft)] px-3 py-2 text-sm text-[color:var(--pp-danger)]"
            >
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={buttonVariants({ variant: 'primary', className: 'min-h-11 w-full cursor-pointer' })}
          >
            {isSubmitting && <span className={SPINNER_CLASS} aria-hidden="true" />}
            {isSubmitting
              ? 'جارٍ المتابعة…'
              : currentMode === 'login'
                ? 'تسجيل الدخول'
                : 'إنشاء الحساب والدخول'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[color:var(--pp-ink)]/50">
          موظف؟{' '}
          <button
            type="button"
            onClick={() => onOpenStaffLogin?.()}
            className="cursor-pointer font-semibold text-[color:var(--pp-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
          >
            دخول الموظفين
          </button>
        </p>
      </div>
    </div>
  )
}

export default ParentLogin
