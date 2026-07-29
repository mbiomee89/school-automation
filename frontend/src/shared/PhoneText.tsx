import type { CSSProperties } from 'react'
import { cn } from './utils'
import { fontMono } from './fonts'

/**
 * Renders phone numbers in LTR so the leading "+" stays on the left
 * inside RTL pages (otherwise bidirectional text can flip it to the right).
 */
export function PhoneText({
  value,
  className,
  style,
}: {
  value: string | null | undefined
  className?: string
  style?: CSSProperties
}) {
  if (value == null || value === '') return null
  return (
    <span
      dir="ltr"
      className={cn('inline-block', className)}
      style={{ ...fontMono, unicodeBidi: 'isolate', ...style }}
    >
      {value}
    </span>
  )
}
