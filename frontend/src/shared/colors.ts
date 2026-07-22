/**
 * Central color/category tokens for product screen designs.
 *
 * Design OS's `colors.json` only stores three single Tailwind color-family
 * names (`primary` / `secondary` / `neutral`) — that shape is fixed by
 * `src/lib/design-system-loader.ts` and rendered by the Design OS app's own
 * "Design System" page, so it isn't a place to stash a fuller palette.
 *
 * The product actually needs more roles than that (accent, semantic states,
 * per-category tints, sidebar tones), so this module centralizes them as
 * Tailwind v4 **built-in** utility classes only — no hex, no custom CSS, no
 * tailwind.config.js. Shell + section components import from here instead of
 * re-deriving ad-hoc color choices, which is what keeps the whole product
 * visually consistent.
 */

export type Tone = 'blue' | 'emerald' | 'purple' | 'amber' | 'green' | 'red' | 'slate'

export interface ToneClasses {
  /** Soft tinted background, e.g. badge/icon-chip fill. */
  bg: string
  /** Text color for content sitting on the tinted background. */
  text: string
  /** Border color pairing with the tinted background. */
  border: string
  /** Solid background for primary actions / strong indicators. */
  solidBg: string
  solidText: string
  /** Focus ring color for interactive elements using this tone. */
  ring: string
}

export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-500/30',
    solidBg: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
    solidText: 'text-white',
    ring: 'focus-visible:ring-blue-500',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    solidBg: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800',
    solidText: 'text-white',
    ring: 'focus-visible:ring-emerald-500',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-500/30',
    solidBg: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800',
    solidText: 'text-white',
    ring: 'focus-visible:ring-purple-500',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-500/30',
    solidBg: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700',
    solidText: 'text-white',
    ring: 'focus-visible:ring-amber-500',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-500/15',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-500/30',
    solidBg: 'bg-green-600 hover:bg-green-700 active:bg-green-800',
    solidText: 'text-white',
    ring: 'focus-visible:ring-green-500',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-500/30',
    solidBg: 'bg-red-600 hover:bg-red-700 active:bg-red-800',
    solidText: 'text-white',
    ring: 'focus-visible:ring-red-500',
  },
  slate: {
    bg: 'bg-slate-100 dark:bg-slate-700/60',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-600',
    solidBg: 'bg-slate-600 hover:bg-slate-700 active:bg-slate-800',
    solidText: 'text-white',
    ring: 'focus-visible:ring-slate-500',
  },
}

/** Data-category color mapping used across stat cards / icon chips. */
export const CATEGORY_TONE = {
  students: 'blue',
  teachers: 'emerald',
  staff: 'emerald',
  classes: 'purple',
  attendance: 'amber',
} as const satisfies Record<string, Tone>

/** Sidebar-specific tones — the sidebar is always a dark surface regardless of app light/dark mode. */
export const sidebar = {
  bg: 'bg-slate-800 dark:bg-slate-900',
  border: 'border-slate-700/60 dark:border-slate-800',
  itemText: 'text-slate-300',
  itemHover: 'hover:bg-slate-700 hover:text-white',
  itemActiveBg: 'bg-blue-600',
  itemActiveText: 'text-white',
  logoutText: 'text-red-400',
  logoutHover: 'hover:bg-red-500/10 hover:text-red-300',
}
