/**
 * Shared font stacks for product screen designs (Arabic-first).
 * Loaded via the Cairo Google Font link in index.html; falls back to
 * platform Arabic sans stacks, then generic sans-serif.
 */
export const fontArabic = {
  fontFamily: '"Cairo", "IBM Plex Sans Arabic", "Noto Sans Arabic", Arial, sans-serif',
} as const

/** For numeric/code values that should stay LTR and tabular even in RTL flow. */
export const fontMono = {
  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
} as const
