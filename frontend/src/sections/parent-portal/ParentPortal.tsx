import { useEffect, useRef, useState } from 'react'
import {
  BookOpenCheck,
  ChevronLeft,
  LogOut,
  ClipboardList,
  Inbox,
  type LucideIcon,
} from 'lucide-react'
import type {
  AttendanceDay,
  ParentPortalProps,
  ParentTab,
} from './types'
import { EmptyState } from '../../shared/EmptyState'
import { Modal } from '../../shared/Modal'
import { buttonVariants } from '../../shared/buttonVariants'
import { TONE_CLASSES } from '../../shared/colors'
import { fontArabic } from '../../shared/fonts'
import { cn } from '../../shared/utils'
import { BottomTabBar } from './BottomTabBar'
import { ChildSwitcher } from './ChildSwitcher'
import { AttendanceDayRow } from './AttendanceDayRow'
import { ExcuseUploadModal } from './ExcuseUploadModal'
import { ExcuseSubmissionsList } from './ExcuseSubmissionsList'
import { HomeworkList } from './HomeworkList'
import { WeeklyPlanList } from './WeeklyPlanList'
import { SegmentedTabs } from './SegmentedTabs'
import { ATTENDANCE_STATUS_META, formatLongDate } from './statusMeta'

type AttendanceView = 'history' | 'excuses'
type HomeworkView = 'homework' | 'plans'

export function ParentPortal({
  children,
  activeChildId,
  todaySummary,
  attendanceHistory,
  homeworkItems,
  weeklyPlans,
  excuseSubmissions,
  activeTab: controlledTab,
  onTabChange,
  onSelectChild,
  onSelectAttendanceDay,
  onSubmitExcuse,
  onLogout,
  homeworkBrowseDate,
  onHomeworkBrowseDateChange,
}: ParentPortalProps) {
  const [tab, setTab] = useState<ParentTab>(controlledTab ?? 'home')
  const [attendanceView, setAttendanceView] = useState<AttendanceView>('history')
  const [homeworkView, setHomeworkView] = useState<HomeworkView>('homework')
  const [excuseTarget, setExcuseTarget] = useState<AttendanceDay | null>(null)
  const [submittingExcuse, setSubmittingExcuse] = useState(false)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current)
    }
  }, [])

  const currentTab = controlledTab ?? tab
  const safeTab: ParentTab =
    currentTab === 'notifications' ? 'home' : currentTab
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

  function submitExcuse(input: { reasonText: string; file: File }) {
    if (!excuseTarget) return
    setSubmittingExcuse(true)
    onSubmitExcuse?.({ attendanceDate: excuseTarget.date, reasonText: input.reasonText, file: input.file })
    submitTimeoutRef.current = setTimeout(() => {
      setSubmittingExcuse(false)
      setExcuseTarget(null)
    }, 900)
  }

  const pendingExcuseCount = excuseSubmissions.filter((s) => s.status === 'PENDING_REVIEW').length
  const todaysHomework = homeworkItems.filter((h) => h.date === todaySummary.date)
  const homePreviewItems = (todaysHomework.length > 0 ? todaysHomework : homeworkItems).slice(0, 2)

  return (
    <div
      dir="rtl"
      lang="ar"
      className="flex min-h-screen justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
      style={fontArabic}
    >
      <div className="flex min-h-screen w-full max-w-md flex-col bg-white dark:bg-slate-950">
        {/* Slim top bar: product/child context */}
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
          <ChildSwitcher children={children} activeChildId={activeChildId} onSelectChild={onSelectChild} />
          <p className="shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">بوابة ولي الأمر</p>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5">
          {safeTab === 'home' && (
            <div className="space-y-5 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
              <HomeHero
                date={todaySummary.date}
                attendanceStatus={todaySummary.attendanceStatus}
                childName={activeChild?.nameAr}
                className={activeChild?.className}
              />

              <StatCard
                label="الواجبات المستحقة"
                value={todaySummary.homeworkDueCount}
                icon={BookOpenCheck}
                tone="blue"
                onClick={() => switchTab('homework')}
              />

              <section>
                {homeworkItems.length > 0 && (
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                      {todaysHomework.length > 0 ? 'واجبات اليوم' : 'أحدث الواجبات'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => switchTab('homework')}
                      className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-500/10"
                    >
                      عرض الكل
                      <ChevronLeft className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                )}
                <HomeworkList items={homePreviewItems} compact />
              </section>
            </div>
          )}

          {safeTab === 'attendance' && (
            <div className="space-y-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
              <SegmentedTabs
                label="عرض الحضور"
                value={attendanceView}
                onChange={setAttendanceView}
                options={[
                  { id: 'history', label: 'سجل الحضور' },
                  { id: 'excuses', label: 'أعذاري المُرسلة', count: pendingExcuseCount },
                ]}
              />

              {attendanceView === 'history' ? (
                attendanceHistory.length === 0 ? (
                  <EmptyState icon={Inbox} title="لا يوجد سجل حضور بعد" />
                ) : (
                  <ul className="space-y-3">
                    {attendanceHistory.map((day) => (
                      <AttendanceDayRow key={day.id} day={day} onUploadExcuse={openExcuseFlow} />
                    ))}
                  </ul>
                )
              ) : (
                <ExcuseSubmissionsList submissions={excuseSubmissions} />
              )}
            </div>
          )}

          {safeTab === 'homework' && (
            <div className="space-y-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
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
                  {homeworkBrowseDate != null && onHomeworkBrowseDateChange ? (
                    <label className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        عرض واجبات يوم
                      </span>
                      <input
                        type="date"
                        value={homeworkBrowseDate}
                        onChange={(e) => onHomeworkBrowseDateChange(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-900"
                        dir="ltr"
                      />
                    </label>
                  ) : null}
                  <HomeworkList items={homeworkItems} />
                </div>
              ) : (
                <WeeklyPlanList items={weeklyPlans} />
              )}
            </div>
          )}

          {safeTab === 'settings' && (
            <div className="space-y-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
              <section className="rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/60 dark:bg-red-950/20">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  سيتم تسجيل خروجك من بوابة ولي الأمر على هذا الجهاز.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmingLogout(true)}
                  className={buttonVariants({ variant: 'danger', className: 'mt-3 w-full' })}
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
            className={buttonVariants({ variant: 'danger', className: 'flex-1' })}
          >
            تأكيد الخروج
          </button>
          <button
            type="button"
            onClick={() => setConfirmingLogout(false)}
            className={buttonVariants({ variant: 'secondary', className: 'flex-1' })}
          >
            إلغاء
          </button>
        </div>
      </Modal>
    </div>
  )
}

interface HomeHeroProps {
  date: string
  attendanceStatus: ParentPortalProps['todaySummary']['attendanceStatus']
  childName?: string
  className?: string
}

function HomeHero({ date, attendanceStatus, childName, className }: HomeHeroProps) {
  const meta = attendanceStatus ? ATTENDANCE_STATUS_META[attendanceStatus] : null
  const Icon = meta?.icon ?? ClipboardList
  const tone = meta ? TONE_CLASSES[meta.tone] : TONE_CLASSES.slate

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5 dark:border-slate-700 dark:from-blue-500/10 dark:via-slate-800 dark:to-slate-800">
      <div
        className="pointer-events-none absolute -end-8 -top-10 size-36 rounded-full bg-blue-100/60 dark:bg-blue-500/10"
        aria-hidden="true"
      />
      <p className="relative text-xs font-medium text-slate-500 dark:text-slate-400">
        اليوم · {formatLongDate(date)}
      </p>
      <div className="relative mt-3 flex items-center gap-3">
        <span className={cn('inline-flex size-12 shrink-0 items-center justify-center rounded-2xl', tone.bg, tone.text)}>
          <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
            {meta ? meta.label : 'لم يُسجَّل الحضور بعد'}
          </p>
          {childName && (
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {childName}
              {className ? ` · ${className}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number
  icon: LucideIcon
  tone: 'blue' | 'purple'
  onClick?: () => void
}

function StatCard({ label, value, icon: Icon, tone, onClick }: StatCardProps) {
  const toneClasses = TONE_CLASSES[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-start transition-colors duration-150 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
    >
      <span className={cn('inline-flex size-9 items-center justify-center rounded-xl', toneClasses.bg, toneClasses.text)}>
        <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </button>
  )
}

export default ParentPortal
