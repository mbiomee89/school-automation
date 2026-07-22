import {
  CheckCircle2,
  XCircle,
  Clock3,
  ShieldCheck,
  Hourglass,
  Ban,
  CalendarX,
  BookOpenCheck,
  NotebookPen,
  Send,
  CheckCheck,
  Eye,
  type LucideIcon,
} from 'lucide-react'
import type {
  AttendanceDayStatus,
  ExcuseStatus,
  NotificationEventType,
  NotificationStatus,
} from './types'
import type { Tone } from '../../shared/colors'

interface StatusMeta {
  label: string
  tone: Tone
  icon: LucideIcon
}

/** Status of a single attendance day, as shown on the attendance history list and the "Today" hero card. */
export const ATTENDANCE_STATUS_META: Record<AttendanceDayStatus, StatusMeta> = {
  PRESENT: { label: 'حاضر', tone: 'emerald', icon: CheckCircle2 },
  LATE: { label: 'متأخر', tone: 'amber', icon: Clock3 },
  ABSENT: { label: 'غائب', tone: 'red', icon: XCircle },
  EXCUSED: { label: 'معفى', tone: 'purple', icon: ShieldCheck },
}

/** Review status of an absence excuse — shown inline on attendance rows and in "أعذاري المُرسلة". */
export const EXCUSE_STATUS_META: Record<ExcuseStatus, StatusMeta> = {
  NONE: { label: 'بدون عذر', tone: 'slate', icon: Ban },
  PENDING_REVIEW: { label: 'قيد المراجعة', tone: 'amber', icon: Hourglass },
  APPROVED: { label: 'مقبول', tone: 'emerald', icon: CheckCircle2 },
  REJECTED: { label: 'مرفوض', tone: 'red', icon: XCircle },
}

export const NOTIFICATION_EVENT_META: Record<NotificationEventType, { label: string; icon: LucideIcon }> = {
  ABSENCE: { label: 'غياب', icon: CalendarX },
  LATE: { label: 'تأخر', icon: Clock3 },
  HOMEWORK_DIGEST: { label: 'ملخص الواجبات', icon: BookOpenCheck },
  WEEKLY_PLAN: { label: 'الخطة الأسبوعية', icon: NotebookPen },
}

export const NOTIFICATION_STATUS_META: Record<NotificationStatus, StatusMeta> = {
  QUEUED: { label: 'في الانتظار', tone: 'slate', icon: Hourglass },
  SENT: { label: 'تم الإرسال', tone: 'blue', icon: Send },
  DELIVERED: { label: 'تم التسليم', tone: 'emerald', icon: CheckCheck },
  READ: { label: 'تمت القراءة', tone: 'green', icon: Eye },
  FAILED: { label: 'فشل الإرسال', tone: 'red', icon: XCircle },
}

/** Long Arabic weekday + day + month, e.g. "الخميس، ١٧ سبتمبر" — used for attendance/excuse dates. */
export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Short Arabic day + month, e.g. "١٧ سبتمبر" — used where a compact date is enough. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ar-SA', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  })
}
