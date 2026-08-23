/**
 * Strict Saudi mobile for the parent personal-data form.
 * Accepted input only: +9665XXXXXXXX
 */

const STRICT = /^\+9665\d{8}$/

export function looksLikeSaudiMobile(value: string): boolean {
  return STRICT.test(value.trim())
}

/** Returns the trimmed E.164 value, or null if not exactly +9665XXXXXXXX. */
export function tryNormalizeSaudiMobile(input: string): string | null {
  const v = input.trim()
  return STRICT.test(v) ? v : null
}

export const SAUDI_MOBILE_HINT = 'الصيغة المطلوبة فقط: +9665XXXXXXXX'
