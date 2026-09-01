import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpenCheck,
  Camera,
  ChevronLeft,
  ClipboardList,
  Inbox,
  LogOut,
  UserRound,
} from 'lucide-react'
import type { AttendanceDay, ParentPortalProps, ParentTab } from './types'
import { EmptyState } from '../../shared/EmptyState'
import { Modal } from '../../shared/Modal'
import { buttonVariants } from '../../shared/buttonVariants'
import { fontArabic } from '../../shared/fonts'
import { cn } from '../../shared/utils'
import { BottomTabBar } from './BottomTabBar'
import { ChildSwitcher } from './ChildSwitcher'
import { AttendanceDayRow } from './AttendanceDayRow'
import { ExcuseUploadModal } from './ExcuseUploadModal'
import { ExcuseSubmissionsList } from './ExcuseSubmissionsList'
import { HomeworkList } from './HomeworkList'
import { ParentHomeworkSheet } from './ParentHomeworkSheet'
import { ParentWeeklyPlanSheet } from './ParentWeeklyPlanSheet'
import { SegmentedTabs } from './SegmentedTabs'
import { DayChipStrip } from './DayChipStrip'
import { EarlyLeavePanel } from './EarlyLeavePanel'
import { ATTENDANCE_STATUS_META, formatLongDate, formatShortDate } from './statusMeta'
import { PARENT_PORTAL_THEME, addDaysIso, weekStartSundayIso } from './theme'

type AttendanceView = 'history' | 'excuses'
type HomeworkView = 'homework' | 'plans'

function groupAttendanceByWeek(days: AttendanceDay[]) {
  const map = new Map<string, AttendanceDay[]>()
  for (const day of days) {
    const key = weekStartSundayIso(day.date)
    const list = map.get(key) ?? []
    list.push(day)
    map.set(key, list)
  }
  return [...map.entries()].map(([weekStart, groupDays]) => ({
    weekStart,
    label: `أسبوع ${formatShortDate(weekStart)}`,
    days: groupDays,
  }))
}

export function ParentPortal({
  children,
  activeChildId,
  todaySummary,
  attendanceHistory,
  homeworkItems,
  homeHomeworkItems,
  weeklyPlans: _weeklyPlans,
  weeklyPlanRows = [],
  weeklyPlanWeekStart,
  weeklyPlanWeekEnd,
  reportBrand,
  reportClassName,
  excuseSubmissions,
  earlyLeaveRequests = [],
  activeTab: controlledTab,
  onTabChange,
  onSelectChild,
  onSelectAttendanceDay,
  onSubmitExcuse,
  onSubmitEarlyLeave,
  onCancelEarlyLeave,
  onLogout,
  homeworkBrowseDate,
  onHomeworkBrowseDateChange,
  weeklyPlanAnchorDate,
  onWeeklyPlanAnchorDateChange,
}: ParentPortalProps) {
  const [tab, setTab] = useState<ParentTab>(controlledTab ?? 'home')
  const [attendanceView, setAttendanceView] = useState<AttendanceView>('history')
  const [homeworkView, setHomeworkView] = useState<HomeworkView>('homework')
  const [excuseTarget, setExcuseTarget] = useState<AttendanceDay | null>(null)
  const [submittingExcuse, setSubmittingExcuse] = useState(false)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  const currentTab = controlledTab ?? tab
  const safeTab: ParentTab = currentTab === 'notifications' ? 'home' : currentTab
  const activeChild = children.find((c) => c.id === activeChildId) ?? children[0]

  function switchTab(next: ParentTab) {
    const resolved = next === 'notifications' ? 'home' : next
    setTab(resolved)
    onTabChange?.(resolved)
  }

  function openExcuseFlow(day: AttendanceDay) {
    setExcuseTarget(day)
    onSelectAttendanceDay?.(day.id)
  }

  function closeExcuseFlow() {
    if (submittingExcuse) return
    setExcuseTarget(null)
  }

  async function submitExcuse(input: { reasonText: string; file: File }) {
    if (!excuseTarget) return
    setSubmittingExcuse(true)
    try {
      await onSubmitExcuse?.({
        attendanceDate: excuseTarget.date,
        reasonText: input.reasonText,
        file: input.file,
      })
      setExcuseTarget(null)
      showToast('تم إرسال العذر للمراجعة')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'فشل إرسال العذر')
    } finally {
      setSubmittingExcuse(false)
    }
  }

  const pendingExcuseCount = excuseSubmissions.filter((s) => s.status === 'PENDING_REVIEW').length
  const needsExcuseDays = attendanceHistory.filter(
    (d) => d.status === 'ABSENT' && (d.excuseStatus === 'NONE' || d.excuseStatus === 'REJECTED')
  )
  const todaysHomework = (homeHomeworkItems ?? homeworkItems.filter((h) => h.date === todaySummary.date)).slice(
    0,
    2
  )
  const absenceDays = useMemo(
    () => attendanceHistory.filter((d) => d.status === 'ABSENT' || d.status === 'EXCUSED'),
    [attendanceHistory]
  )
  const attendanceGroups = useMemo(() => groupAttendanceByWeek(absenceDays), [absenceDays])
  const browseDate = homeworkBrowseDate ?? todaySummary.date
  const brand = reportBrand ?? { schoolName: 'المدرسة', academicYear: '' }
  const classLabel = reportClassName || activeChild?.className || 'بدون فصل'

  return (
    <div
      dir="rtl"
      lang="ar"
      className="flex min-h-screen justify-center bg-[color:var(--pp-sky)] text-[color:var(--pp-ink)]"
      style={{ ...fontArabic, ...PARENT_PORTAL_THEME }}
    >
      <div className="flex min-h-screen w-full max-w-md flex-col bg-[color:var(--pp-sky)]">
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--pp-ink)]/8 bg-[color:var(--pp-sand)]/90 px-4 py-2.5 backdrop-blur-sm">
          <ChildSwitcher children={children} activeChildId={activeChildId} onSelectChild={onSelectChild} />
          <p className="shrink-0 text-xs font-semibold text-[color:var(--pp-ink)]/45">بوابة ولي الأمر</p>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5">
          {safeTab === 'home' && (
            <div className="space-y-4 animate-in fade-in-0 duration-300 motion-reduce:animate-none">
              <TodayScene
                date={todaySummary.date}
                attendanceStatus={todaySummary.attendanceStatus}
                childName={activeChild?.nameAr}
                className={activeChild?.className}
                homeworkDueCount={todaySummary.homeworkDueCount}
                needsExcuseCount={needsExcuseDays.length}
                onOpenHomework={() => switchTab('homework')}
                onOpenExcuse={() => {
                  if (needsExcuseDays[0]) openExcuseFlow(needsExcuseDays[0])
                  else switchTab('attendance')
                }}
              />

              <section>
                {todaysHomework.length > 0 ? (
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[color:var(--pp-ink)]">واجبات اليوم</h2>
                    <button
                      type="button"
                      onClick={() => switchTab('homework')}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-[color:var(--pp-primary)] hover:bg-[color:var(--pp-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
                    >
                      عرض الكل
                      <ChevronLeft className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
                <HomeworkList
                  items={todaysHomework}
                  compact
                  emptyTitle="لا واجبات مستحقة اليوم"
                  emptyDescription="يمكنك تصفح أيام أخرى من تبويب الواجبات."
                />
              </section>
            </div>
          )}

          {safeTab === 'attendance' && (
            <div className="space-y-4 animate-in fade-in-0 duration-300 motion-reduce:animate-none">
              <SegmentedTabs
                label="عرض الغياب"
                value={attendanceView}
                onChange={setAttendanceView}
                options={[
                  { id: 'history', label: 'سجل الغياب' },
                  { id: 'excuses', label: 'أعذاري المُرسلة', count: pendingExcuseCount },
                ]}
              />

              {attendanceView === 'history' ? (
                absenceDays.length === 0 ? (
                  <EmptyState icon={Inbox} title="لا يوجد سجل غياب بعد" />
                ) : (
                  <div className="space-y-5">
                    {attendanceGroups.map((group) => (
                      <section key={group.weekStart} className="space-y-2.5">
                        <h2 className="sticky top-0 z-10 bg-[color:var(--pp-sky)]/95 py-1 text-xs font-bold text-[color:var(--pp-ink)]/50 backdrop-blur-sm">
                          {group.label}
                        </h2>
                        <ul className="space-y-2.5">
                          {group.days.map((day) => (
                            <AttendanceDayRow key={day.id} day={day} onUploadExcuse={openExcuseFlow} />
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )
              ) : (
                <ExcuseSubmissionsList submissions={excuseSubmissions} />
              )}
            </div>
          )}

          {safeTab === 'homework' && (
            <div className="space-y-4 animate-in fade-in-0 duration-300 motion-reduce:animate-none">
              <SegmentedTabs
                label="الواجبات والخطط"
                value={homeworkView}
                onChange={setHomeworkView}
                options={[
                  { id: 'homework', label: 'الواجبات' },
                  { id: 'plans', label: 'الخطة الأسبوعية' },
                ]}
              />
              {homeworkView === 'homework' ? (
                <div className="space-y-3">
                  {onHomeworkBrowseDateChange ? (
                    <DayChipStrip
                      value={browseDate}
                      today={todaySummary.date}
                      onChange={onHomeworkBrowseDateChange}
                      label="عرض واجبات يوم"
                    />
                  ) : null}
                  <ParentHomeworkSheet
                    brand={brand}
                    className={classLabel}
                    date={browseDate}
                    items={homeworkItems}
                  />
                </div>
              ) : (
                <ParentWeeklyPlanSheet
                  brand={brand}
                  className={classLabel}
                  weekStart={weeklyPlanWeekStart ?? weeklyPlanAnchorDate ?? todaySummary.date}
                  weekEnd={
                    weeklyPlanWeekEnd ??
                    addDaysIso(weeklyPlanWeekStart ?? weeklyPlanAnchorDate ?? todaySummary.date, 5)
                  }
                  rows={weeklyPlanRows}
                  onWeekChange={(anchor) => onWeeklyPlanAnchorDateChange?.(anchor)}
                />
              )}
            </div>
          )}

          {safeTab === 'early-leave' && (
            <EarlyLeavePanel
              today={todaySummary.date}
              requests={earlyLeaveRequests}
              onSubmit={onSubmitEarlyLeave}
              onCancel={onCancelEarlyLeave}
              onToast={showToast}
            />
          )}

          {safeTab === 'settings' && (
            <div className="space-y-4 animate-in fade-in-0 duration-300 motion-reduce:animate-none">
              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[color:var(--pp-ink)]/8">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[color:var(--pp-primary-soft)] text-[color:var(--pp-primary)]">
                    <UserRound className="size-6" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[color:var(--pp-ink)]/45">الطالب الحالي</p>
                    <p className="truncate text-base font-bold text-[color:var(--pp-ink)]">
                      {activeChild?.nameAr ?? '—'}
                    </p>
                    {activeChild?.className ? (
                      <p className="text-sm text-[color:var(--pp-ink)]/55">{activeChild.className}</p>
                    ) : null}
                  </div>
                </div>
                {children.length > 1 ? (
                  <p className="mt-3 text-xs text-[color:var(--pp-ink)]/45">
                    لديك {children.length} أبناء — بدّل من القائمة أعلى الصفحة.
                  </p>
                ) : null}
              </section>

              <section className="rounded-2xl bg-[color:var(--pp-danger-soft)] p-4">
                <p className="text-xs text-[color:var(--pp-danger)]">
                  سيتم تسجيل خروجك من بوابة ولي الأمر على هذا الجهاز.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmingLogout(true)}
                  className={buttonVariants({ variant: 'danger', className: 'mt-3 w-full min-h-11 cursor-pointer' })}
                >
                  <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  تسجيل الخروج
                </button>
              </section>
            </div>
          )}
        </main>

        <BottomTabBar activeTab={safeTab} onSelect={switchTab} />
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-full max-w-md px-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
        >
          <p className="rounded-2xl bg-[color:var(--pp-ink)] px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
            {toast}
          </p>
        </div>
      ) : null}

      <ExcuseUploadModal
        open={!!excuseTarget}
        attendanceDate={excuseTarget?.date ?? null}
        submitting={submittingExcuse}
        onClose={closeExcuseFlow}
        onSubmit={submitExcuse}
      />

      <Modal
        open={confirmingLogout}
        onClose={() => setConfirmingLogout(false)}
        title="تسجيل الخروج؟"
        description="سيتعين عليك إدخال رقم جوالك وكلمة المرور لتسجيل الدخول مرة أخرى."
        maxWidthClassName="max-w-sm"
      >
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirmingLogout(false)
              onLogout?.()
            }}
            className={buttonVariants({ variant: 'danger', className: 'min-h-11 flex-1 cursor-pointer' })}
          >
            تأكيد الخروج
          </button>
          <button
            type="button"
            onClick={() => setConfirmingLogout(false)}
            className={buttonVariants({ variant: 'secondary', className: 'min-h-11 flex-1 cursor-pointer' })}
          >
            إلغاء
          </button>
        </div>
      </Modal>
    </div>
  )
}

interface TodaySceneProps {
  date: string
  attendanceStatus: ParentPortalProps['todaySummary']['attendanceStatus']
  childName?: string
  className?: string
  homeworkDueCount: number
  needsExcuseCount: number
  onOpenHomework: () => void
  onOpenExcuse: () => void
}

function TodayScene({
  date,
  attendanceStatus,
  childName,
  className,
  homeworkDueCount,
  needsExcuseCount,
  onOpenHomework,
  onOpenExcuse,
}: TodaySceneProps) {
  const meta = attendanceStatus ? ATTENDANCE_STATUS_META[attendanceStatus] : null
  const Icon = meta?.icon ?? ClipboardList

  const scene =
    attendanceStatus === 'ABSENT'
      ? {
          wash: 'from-[color:var(--pp-danger-soft)] via-white to-white',
          iconBg: 'bg-[color:var(--pp-danger)] text-white',
        }
      : attendanceStatus === 'LATE'
        ? {
            wash: 'from-[color:var(--pp-warn-soft)] via-white to-white',
            iconBg: 'bg-[color:var(--pp-warn)] text-white',
          }
        : attendanceStatus === 'PRESENT' || attendanceStatus === 'EXCUSED'
          ? {
              wash: 'from-[color:var(--pp-ok-soft)] via-white to-white',
              iconBg: 'bg-[color:var(--pp-ok)] text-white',
            }
          : {
              wash: 'from-[color:var(--pp-primary-soft)] via-white to-white',
              iconBg: 'bg-[color:var(--pp-primary)] text-white',
            }

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl bg-gradient-to-bl p-5 shadow-sm ring-1 ring-[color:var(--pp-ink)]/8 animate-in fade-in-0 zoom-in-95 duration-300 motion-reduce:animate-none',
        scene.wash
      )}
    >
      <p className="text-xs font-medium text-[color:var(--pp-ink)]/50">اليوم · {formatLongDate(date)}</p>
      {childName ? (
        <p className="mt-1 truncate text-sm font-semibold text-[color:var(--pp-ink)]/70">
          {childName}
          {className ? ` · ${className}` : ''}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <span className={cn('inline-flex size-14 shrink-0 items-center justify-center rounded-2xl', scene.iconBg)}>
          <Icon className="size-7" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--pp-ink)]">
            {meta ? meta.label : 'لم يُسجَّل الحضور بعد'}
          </h1>
          <p className="mt-0.5 text-sm text-[color:var(--pp-ink)]/55">حالة اليوم الدراسية</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          onClick={onOpenHomework}
          className="flex min-h-12 cursor-pointer items-center justify-between rounded-2xl bg-white/80 px-3.5 py-2.5 text-start ring-1 ring-[color:var(--pp-ink)]/8 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-primary)]"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--pp-ink)]">
            <BookOpenCheck className="size-4 text-[color:var(--pp-primary)]" strokeWidth={1.75} aria-hidden="true" />
            واجبات مستحقة اليوم
          </span>
          <span className="text-lg font-bold tabular-nums text-[color:var(--pp-primary)]">{homeworkDueCount}</span>
        </button>

        {needsExcuseCount > 0 ? (
          <button
            type="button"
            onClick={onOpenExcuse}
            className="flex min-h-12 cursor-pointer items-center justify-between rounded-2xl bg-[color:var(--pp-danger)] px-3.5 py-2.5 text-start text-white transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pp-danger)] focus-visible:ring-offset-2"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Camera className="size-4" strokeWidth={1.75} aria-hidden="true" />
              يحتاج عذر غياب
            </span>
            <span className="text-lg font-bold tabular-nums">{needsExcuseCount}</span>
          </button>
        ) : null}
      </div>
    </section>
  )
}

export default ParentPortal
