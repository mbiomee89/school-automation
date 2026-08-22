import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  activateUser,
  addAssignment,
  backupDataOnly,
  createStudent,
  createUser,
  deactivateUser,
  deleteClass,
  deleteSubject,
  downloadBackupZip,
  getSchoolSettings,
  getStudentStats,
  importNoorFile,
  importNoorTeachersFile,
  importTimetableFile,
  confirmTimetableImport,
  listAssignments,
  listClasses,
  listEnrollments,
  listImportBatches,
  listStudents,
  listSubjects,
  listUsers,
  promoteStudent,
  removeAllStudentsFromClass,
  removeAssignment,
  resetAllDataWithBackup,
  restoreDataFromBackupFile,
  restoreStudent,
  saveClass,
  saveSchoolSettings,
  saveSubject,
  softRemoveStudent,
  syncTeacherAssignments,
  unassignStudent,
  updateStudent,
  uploadSchoolLogo,
} from '../../api/admin'
import { ApiError } from '../../api/client'
import { AdminDashboard } from '../../sections/school-administration/AdminDashboard'
import type {
  AdminTab,
  AssignmentInput,
  ClassEnrollment,
  ClassInput,
  ClassItem,
  ImportBatch,
  ImportResult,
  OverviewStats,
  SchoolSettings,
  TimetableImportResult,
  Staff,
  StaffInput,
  Student,
  StudentInput,
  Subject,
  SubjectInput,
  TeacherAssignment,
} from '../../sections/school-administration/types'
import { EmptyState } from '../../shared/EmptyState'
import { SPINNER_CLASS } from '../../shared/buttonVariants'

function alertError(err: unknown, fallback: string) {
  const message = err instanceof ApiError ? err.message : fallback
  window.alert(message)
}

export function AdministrationPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')

  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    name: 'منصة إدارة المدرسة',
    logoUrl: null,
    academicYear: '2026-2027',
    principalName: null,
    educationAdminName: null,
    address: null,
  })
  const [staff, setStaff] = useState<Staff[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [activeStudentCount, setActiveStudentCount] = useState(0)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsLoaded, setStudentsLoaded] = useState(false)
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([])
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([])
  const [importBatchesLoaded, setImportBatchesLoaded] = useState(false)
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [teacherImportResult, setTeacherImportResult] = useState<ImportResult | null>(null)
  const [timetableImportResult, setTimetableImportResult] = useState<TimetableImportResult | null>(null)
  const studentsLoadGen = useRef(0)

  const studentsActiveFilter = useRef<'true' | 'false' | 'all'>('true')
  const enrollmentLoadGen = useRef(0)

  const refreshStudentStats = useCallback(async () => {
    const stats = await getStudentStats()
    setActiveStudentCount(stats.activeCount)
  }, [])

  const loadStudents = useCallback(async (query?: string) => {
    const gen = ++studentsLoadGen.current
    setStudentsLoading(true)
    try {
      const list = await listStudents({
        q: query || undefined,
        active: studentsActiveFilter.current,
      })
      if (gen !== studentsLoadGen.current) return
      setStudents(list)
      setStudentsLoaded(true)
      if (!query && studentsActiveFilter.current === 'true') {
        setActiveStudentCount(list.filter((s) => s.isActive).length)
      }
    } finally {
      if (gen === studentsLoadGen.current) setStudentsLoading(false)
    }
  }, [])

  const loadAssignments = useCallback(async () => {
    setAssignments(await listAssignments())
    setAssignmentsLoaded(true)
  }, [])

  const loadImportBatches = useCallback(async () => {
    setImportBatches(await listImportBatches())
    setImportBatchesLoaded(true)
  }, [])

  /** Core shell for overview — no full student roster. */
  const loadShell = useCallback(async () => {
    setError(null)
    const [settings, users, classList, subjectList, stats] = await Promise.all([
      getSchoolSettings(),
      listUsers(),
      listClasses(),
      listSubjects(),
      getStudentStats(),
    ])
    setSchoolSettings(settings)
    setStaff(users)
    setClasses(classList)
    setSubjects(subjectList)
    setActiveStudentCount(stats.activeCount)
    setStudentsLoaded(false)
    setStudents([])
    setAssignmentsLoaded(false)
    setAssignments([])
    setImportBatchesLoaded(false)
    setImportBatches([])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadShell()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'تعذّر تحميل بيانات الإدارة')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadShell])

  useEffect(() => {
    if (activeTab === 'students' && !studentsLoaded && !studentsLoading) {
      void loadStudents().catch((err) => alertError(err, 'فشل تحميل الطلاب'))
    }
    if (activeTab === 'assignments' && !assignmentsLoaded) {
      void loadAssignments().catch((err) => alertError(err, 'فشل تحميل التوزيع'))
    }
    if (activeTab === 'import' && !importBatchesLoaded) {
      void loadImportBatches().catch((err) => alertError(err, 'فشل تحميل سجل الاستيراد'))
    }
  }, [
    activeTab,
    studentsLoaded,
    studentsLoading,
    assignmentsLoaded,
    importBatchesLoaded,
    loadStudents,
    loadAssignments,
    loadImportBatches,
  ])

  const overviewStats: OverviewStats = {
    activeStudents: activeStudentCount,
    staffCount: staff.filter((s) => s.isActive).length,
    classesThisYear: classes.filter((c) => c.academicYear === schoolSettings.academicYear).length,
    notificationsFailedToday: 0,
    academicYear: schoolSettings.academicYear || '2026-2027',
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className={SPINNER_CLASS} aria-label="جارٍ التحميل" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        tone="error"
        title="تعذّر تحميل الإدارة"
        description={error}
        actionLabel="إعادة المحاولة"
        onAction={() => {
          setLoading(true)
          loadShell()
            .catch((err) => setError(err instanceof ApiError ? err.message : 'فشل التحميل'))
            .finally(() => setLoading(false))
        }}
      />
    )
  }

  return (
    <AdminDashboard
      overviewStats={overviewStats}
      schoolSettings={schoolSettings}
      staff={staff}
      classes={classes}
      subjects={subjects}
      assignments={assignments}
      students={students}
      studentsLoading={studentsLoading}
      enrollments={enrollments}
      importBatches={importBatches}
      importResult={importResult}
      notifications={[]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSearchStudents={async (query) => {
        try {
          await loadStudents(query || undefined)
        } catch (err) {
          alertError(err, 'فشل البحث')
        }
      }}
      onSelectStudent={async (studentId) => {
        const gen = ++enrollmentLoadGen.current
        try {
          const rows = await listEnrollments(studentId)
          if (gen !== enrollmentLoadGen.current) return
          setEnrollments(rows)
        } catch (err) {
          if (gen !== enrollmentLoadGen.current) return
          alertError(err, 'فشل جلب سجل الفصول')
        }
      }}
      onFilterStudentsActive={async (active) => {
        studentsActiveFilter.current = active
        try {
          await loadStudents()
        } catch (err) {
          alertError(err, 'فشل تحميل الطلاب')
        }
      }}
      onRestoreStudent={async (studentId) => {
        try {
          await restoreStudent(studentId)
          await Promise.all([loadStudents(), refreshStudentStats()])
        } catch (err) {
          alertError(err, 'فشل استعادة الطالب')
        }
      }}
      onSaveStudent={async (input: StudentInput) => {
        try {
          const existing = students.find((s) => s.id === input.id)
          if (existing) {
            await updateStudent(input.id, input)
            const nextClassId = input.classId && input.classId > 0 ? input.classId : null
            if (nextClassId !== existing.classId) {
              if (nextClassId == null) await unassignStudent(input.id)
              else await promoteStudent(input.id, nextClassId)
            }
          } else {
            await createStudent(input)
          }
          await Promise.all([loadStudents(), listClasses().then(setClasses), refreshStudentStats()])
        } catch (err) {
          alertError(err, 'فشل حفظ الطالب')
        }
      }}
      onSoftRemoveStudent={async (studentId) => {
        try {
          await softRemoveStudent(studentId)
          await Promise.all([loadStudents(), refreshStudentStats()])
        } catch (err) {
          alertError(err, 'فشل استبعاد الطالب')
        }
      }}
      onPromoteStudent={async (studentId, classId) => {
        try {
          await promoteStudent(studentId, classId)
          await Promise.all([loadStudents(), listClasses().then(setClasses)])
        } catch (err) {
          alertError(err, 'فشل نقل الطالب')
        }
      }}
      onUnassignStudent={async (studentId) => {
        try {
          await unassignStudent(studentId)
          await Promise.all([loadStudents(), listClasses().then(setClasses)])
        } catch (err) {
          alertError(err, 'فشل إزالة الطالب من الفصل')
        }
      }}
      onSaveClass={async (input: ClassInput & { id?: number }) => {
        try {
          await saveClass(input)
          setClasses(await listClasses())
        } catch (err) {
          alertError(err, 'فشل حفظ الفصل')
        }
      }}
      onRemoveClass={async (classId) => {
        try {
          await deleteClass(classId)
          setClasses(await listClasses())
        } catch (err) {
          alertError(err, 'فشل حذف الفصل')
        }
      }}
      onRemoveAllStudentsFromClass={async (classId) => {
        try {
          await removeAllStudentsFromClass(classId)
          await Promise.all([
            loadStudents(),
            listClasses().then(setClasses),
            refreshStudentStats(),
          ])
        } catch (err) {
          alertError(err, 'فشل تفريغ الفصل')
        }
      }}
      onSaveSubject={async (input: SubjectInput & { id?: number }) => {
        try {
          await saveSubject(input)
          setSubjects(await listSubjects())
        } catch (err) {
          alertError(err, 'فشل حفظ المادة')
        }
      }}
      onRemoveSubject={async (subjectId) => {
        try {
          await deleteSubject(subjectId)
          setSubjects(await listSubjects())
          if (assignmentsLoaded) await loadAssignments()
        } catch (err) {
          alertError(err, 'فشل حذف المادة')
        }
      }}
      onCreateStaff={async (input: StaffInput) => {
        try {
          await createUser(input)
          setStaff(await listUsers())
        } catch (err) {
          alertError(err, 'فشل إنشاء حساب الموظف')
          throw err
        }
      }}
      onDeactivateStaff={async (staffId) => {
        try {
          await deactivateUser(staffId)
          setStaff(await listUsers())
        } catch (err) {
          alertError(err, 'فشل تعطيل الحساب')
        }
      }}
      onActivateStaff={async (staffId) => {
        try {
          await activateUser(staffId)
          setStaff(await listUsers())
        } catch (err) {
          alertError(err, 'فشل تفعيل الحساب')
        }
      }}
      onAddAssignment={async (input: AssignmentInput) => {
        try {
          await addAssignment(input)
          await loadAssignments()
        } catch (err) {
          alertError(err, 'فشل إضافة التوزيع')
        }
      }}
      onSyncAssignments={async (input) => {
        try {
          await syncTeacherAssignments(input)
          await loadAssignments()
        } catch (err) {
          alertError(err, 'فشل حفظ توزيع المعلم')
          throw err
        }
      }}
      onRemoveAssignment={async (assignmentId) => {
        try {
          await removeAssignment(assignmentId)
          await loadAssignments()
        } catch (err) {
          alertError(err, 'فشل حذف التوزيع')
        }
      }}
      teacherImportResult={teacherImportResult}
      timetableImportResult={timetableImportResult}
      onImportStudents={async (file) => {
        try {
          const result = await importNoorFile(file)
          setImportResult(result)
          setStudentsLoaded(false)
          await Promise.all([
            loadStudents(),
            listClasses().then(setClasses),
            loadImportBatches(),
            refreshStudentStats(),
          ])
        } catch (err) {
          alertError(err, 'فشل استيراد الطلاب')
        }
      }}
      onImportTeachers={async (file) => {
        try {
          const result = await importNoorTeachersFile(file)
          setTeacherImportResult(result)
          setStaff(await listUsers())
        } catch (err) {
          alertError(err, 'فشل استيراد المعلمين')
        }
      }}
      onImportTimetable={async (file) => {
        try {
          const result = await importTimetableFile(file)
          setTimetableImportResult(result)
        } catch (err) {
          alertError(err, 'فشل تحليل الجدول الدراسي')
        }
      }}
      onConfirmTimetableImport={async (maps) => {
        if (!timetableImportResult?.slots?.length) {
          window.alert('ارفع ملف الجدول أولاً')
          return
        }
        try {
          const result = await confirmTimetableImport({
            slots: timetableImportResult.slots,
            teacherMap: maps.teacherMap,
            createTeachers: maps.createTeachers,
            classMap: maps.classMap,
            subjectMap: maps.subjectMap,
            fileName: timetableImportResult.fileName,
            view: timetableImportResult.view,
            academicYear: timetableImportResult.academicYear,
          })
          setTimetableImportResult(result)
          setAssignmentsLoaded(false)
          await Promise.all([loadAssignments(), listUsers().then(setStaff), listSubjects().then(setSubjects)])
        } catch (err) {
          alertError(err, 'فشل حفظ الجدول بعد المطابقة')
        }
      }}
      onPrint={(view) => {
        void view
        window.print()
      }}
      onSaveSchoolSettings={async (settings) => {
        setSchoolSettings(await saveSchoolSettings(settings))
      }}
      onUploadSchoolLogo={async (file) => {
        const logoUrl = await uploadSchoolLogo(file)
        setSchoolSettings((prev) => ({ ...prev, logoUrl }))
        return logoUrl
      }}
      onBackupData={async () => {
        const result = await backupDataOnly()
        downloadBackupZip(result.backupFileName, result.backupZipBase64)
        return { backupFileName: result.backupFileName }
      }}
      onResetAllData={async () => {
        const result = await resetAllDataWithBackup()
        downloadBackupZip(result.backupFileName, result.backupZipBase64)

        setImportResult(null)
        setTeacherImportResult(null)
        setTimetableImportResult(null)
        setEnrollments([])
        setActiveTab('overview')
        await loadShell()
        return { backupFileName: result.backupFileName }
      }}
      onRestoreFromBackup={async (file) => {
        const result = await restoreDataFromBackupFile(file)
        setImportResult(null)
        setTeacherImportResult(null)
        setTimetableImportResult(null)
        setEnrollments([])
        setActiveTab('overview')
        setStudentsLoaded(false)
        setAssignmentsLoaded(false)
        await loadShell()
        return {
          defaultPassword: result.defaultPassword,
          restored: result.restored,
          safetyBackupFileName: result.safetyBackupFileName,
        }
      }}
    />
  )
}
