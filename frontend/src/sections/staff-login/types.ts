/**
 * Types and props for the Staff Login screen design.
 * Standalone auth screen — no app shell (see spec.md `shell: false`).
 *
 * Access rules: see `product/access-control.md`. After login the host MUST
 * route only to ROLE_HOME[role] and filter shell nav with filterStaffNavByRole.
 */

export type StaffRole = 'ADMIN' | 'TEACHER' | 'COUNSELOR'

export type StaffLoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_INACTIVE'
  | 'NETWORK'

export interface StaffLoginBrand {
  schoolName: string
  logoUrl: string | null
}

/** Session payload the host creates after a successful staff login. */
export interface StaffAuthSuccess {
  role: StaffRole
  /** Where the host must navigate (see ROLE_HOME in accessControl). */
  homeHref: string
  userName: string
  userId: number
}

export interface StaffLoginProps {
  /** Optional school branding stamped on the login screen. */
  brand?: StaffLoginBrand
  /** Inline error to display after a failed attempt. */
  errorCode?: StaffLoginErrorCode | null
  /** True while the login request is in flight. */
  isSubmitting?: boolean
  /** Prefill email for Design OS preview only. */
  initialEmail?: string

  /**
   * Submit email + password. Host authenticates, then MUST call routing with
   * the returned role’s home only — never open another role’s section.
   */
  onLogin?: (credentials: { email: string; password: string }) => void
  /**
   * Fired when auth succeeds (host may drive this after API response).
   * Prefer navigating with `success.homeHref` and mounting AppShell with
   * nav filtered to that role only.
   */
  onLoginSuccess?: (success: StaffAuthSuccess) => void
  /** Navigate to the Parent OTP login screen (different auth realm). */
  onOpenParentLogin?: () => void
}
