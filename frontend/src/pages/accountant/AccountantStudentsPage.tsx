import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Search, X } from 'lucide-react'
import { listEnrollments, listStudents } from '../../api/admin'
import { ApiError } from '../../api/client'
import type { ClassEnrollment, Student } from '../../sections/school-administration/types'
import { EmptyState } from '../../shared/EmptyState'
import { PhoneText } from '../../shared/PhoneText'
import { SPINNER_CLASS } from '../../shared/buttonVariants'
import { fontArabic, fontMono } from '../../shared/fonts'
import { cn } from '../../shared/utils'

const PAGE_SIZE = 40

export function AccountantStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await listStudents({ active: 'true' })
        if (!cancelled) setStudents(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل قائمة الطلاب')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const gradeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of students) {
      if (s.gradeLevel) set.add(s.gradeLevel)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'))
  }, [students])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students.filter((s) => {
      if (gradeFilter) {
        if (gradeFilter === '__none__') {
          if (s.classId != null) return false
        } else if (s.gradeLevel !== gradeFilter) {
          return false
        }
      }
      if (!q) return true
      return (
        s.nameAr.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.parentPhone.includes(q)
      )
    })
  }, [students, query, gradeFilter])

  useEffect(() => {
    setPage(0)
  }, [query, gradeFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const selected = selectedId ? students.find((s) => s.id === selectedId) ?? null : null

  useEffect(() => {
    if (!selectedId) {
      setEnrollments([])
      setEnrollmentsError(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setEnrollmentsLoading(true)
      setEnrollmentsError(null)
      try {
        const rows = await listEnrollments(selectedId)
        if (!cancelled) setEnrollments(rows)
      } catch (err) {
        if (!cancelled) {
          setEnrollments([])
          setEnrollmentsError(
            err instanceof ApiError ? err.message : 'تعذّر تحميل سجل الالتحاق'
          )
        }
      } finally {
        if (!cancelled) setEnrollmentsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (error && students.length === 0) {
    return <EmptyState icon={AlertTriangle} tone="error" title="تعذّر التحميل" description={error} />
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
      style={fontArabic}
    >
      <div className="border-b border-slate-200 bg-gradient-to-bl from-slate-100 via-white to-teal-50 px-4 py-6 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-teal-950/30">
        <p className="text-sm font-medium text-slate-500">محاسب · عرض فقط</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">الطلاب</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          عرض الهوية ورقم جوال ولي الأمر — بحث بالاسم أو الصف. لا يمكن التعديل من هذا الحساب.
        </p>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <label className="relative block text-sm">
            <span className="mb-1 block text-slate-500">بحث بالاسم أو الهوية أو الجوال</span>
            <span className="pointer-events-none absolute bottom-3 start-3 text-slate-400">
              <Search className="size-4" strokeWidth={1.5} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اكتب للبحث…"
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pe-3 ps-10 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-500">الصف</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">كل الصفوف</option>
              <option value="__none__">بدون فصل</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-slate-500">
          {filtered.length} طالب
          {filtered.length !== students.length ? ` من أصل ${students.length}` : ''}
        </p>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2.5 font-medium">الطالب</th>
                <th className="hidden px-3 py-2.5 font-medium sm:table-cell">رقم الهوية</th>
                <th className="hidden px-3 py-2.5 font-medium md:table-cell">الصف / الفصل</th>
                <th className="px-3 py-2.5 font-medium">جوال ولي الأمر</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => (
                <tr
                  key={s.id}
                  className={cn(
                    'border-t border-slate-100 dark:border-slate-800',
                    selectedId === s.id && 'bg-teal-50/80 dark:bg-teal-950/30'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="text-start hover:text-teal-800 dark:hover:text-teal-200"
                      onClick={() => setSelectedId(s.id)}
                    >
                      <div className="font-semibold">{s.nameAr}</div>
                      <div className="text-xs text-slate-500 sm:hidden" style={fontMono}>
                        {s.id}
                      </div>
                    </button>
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell" style={fontMono}>
                    {s.id}
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {s.className ?? <span className="text-slate-400">بدون فصل</span>}
                    {s.gradeLevel ? (
                      <span className="mt-0.5 block text-xs text-slate-500">صف {s.gradeLevel}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    {s.parentPhone ? (
                      <PhoneText value={s.parentPhone} />
                    ) : (
                      <span className="text-slate-400">بدون جوال</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">لا يوجد طلاب مطابقون لبحثك.</p>
          ) : null}
        </div>

        {filtered.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-600"
            >
              السابق
            </button>
            <span className="text-slate-500">
              صفحة {safePage + 1} من {pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-600"
            >
              التالي
            </button>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-start print:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="إغلاق"
            onClick={() => setSelectedId(null)}
          />
          <aside className="relative z-50 flex h-full w-full max-w-md flex-col border-e border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-medium text-teal-700 dark:text-teal-300">بطاقة معلومات · عرض فقط</p>
                <h2 className="mt-1 text-2xl font-bold">{selected.nameAr}</h2>
                <p className="text-slate-500">{selected.nameEn}</p>
                <p className="mt-1 text-xs" style={fontMono}>
                  {selected.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="إغلاق"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">الفصل الحالي</dt>
                  <dd className="mt-0.5 font-medium">
                    {selected.className ?? 'بدون فصل'}
                    {selected.gradeLevel ? ` · صف ${selected.gradeLevel}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">جوال ولي الأمر</dt>
                  <dd className="mt-0.5">
                    {selected.parentPhone ? (
                      <PhoneText value={selected.parentPhone} />
                    ) : (
                      <span className="text-slate-400">بدون جوال</span>
                    )}
                  </dd>
                </div>
                {selected.parentEmail ? (
                  <div>
                    <dt className="text-slate-500">بريد ولي الأمر</dt>
                    <dd className="mt-0.5" dir="ltr">
                      {selected.parentEmail}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <h3 className="mt-6 mb-2 font-bold">سجل الالتحاق بالفصول</h3>
              {enrollmentsLoading ? (
                <p className="text-sm text-slate-500">جارٍ التحميل…</p>
              ) : enrollmentsError ? (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
                  {enrollmentsError}
                </p>
              ) : (
                <ul className="space-y-2">
                  {enrollments.map((e) => (
                    <li
                      key={e.id}
                      className="rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <div className="font-semibold">{e.className}</div>
                      <div className="text-xs text-slate-500">
                        {e.academicYear} · من {e.startDate}{' '}
                        {e.endDate ? `إلى ${e.endDate}` : '— الحالي'}
                      </div>
                    </li>
                  ))}
                  {enrollments.length === 0 ? (
                    <li className="text-sm text-slate-500">لا يوجد سجل التحاق لهذا الطالب.</li>
                  ) : null}
                </ul>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
