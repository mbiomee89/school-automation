import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  activateUser,
  addAssignment,
  createStudent,
  createUser,
  deactivateUser,
  deleteClass,
  deleteSubject,
  getSchoolSettings,
  importNoorFile,
  importNoorTeachersFile,
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
  saveClass,
  saveSchoolSettings,
  saveSubject,
  softRemoveStudent,
  syncTeacherAssignments,
  unassignStudent,
  updateStudent,
  uploadSchoolLogo,
  resetAllDataWithBackup,
  restoreDataFromBackupFile,
  backupDataOnly,
  downloadBackupZip,
} from '../../api/admin'
import { ApiError } from '../../api/client'
import { AdminDashboard } from '../../sections/school-administration/AdminDashboard'
import type {
  AssignmentInput,
  ClassEnrollment,
  ClassInput,
  ClassItem,
  ImportBatch,
  ImportResult,
  OverviewStats,
  SchoolSettings,
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
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([])
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [teacherImportResult, setTeacherImportResult] = useState<ImportResult | null>(null)

  const loadAll = useCallback(async () => {
    setError(null)
    const [settings, users, classList, subjectList, assignmentList, studentList, batches] =
      await Promise.all([
        getSchoolSettings(),
        listUsers(),
        listClasses(),
        listSubjects(),
        listAssignments(),
        listStudents(),
        listImportBatches(),
      ])
    setSchoolSettings(settings)
    setStaff(users)
    setClasses(classList)
    setSubjects(subjectList)
    setAssignments(assignmentList)
    setStudents(studentList)
    setImportBatches(batches)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadAll()
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
  }, [loadAll])

  const overviewStats: OverviewStats = {
    activeStudents: students.filter((s) => s.isActive).length,
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
          loadAll()
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
      enrollments={enrollments}
      importBatches={importBatches}
      importResult={importResult}
      notifications={[]}
      onSearchStudents={async (query) => {
        try {
          setStudents(await listStudents({ q: query || undefined }))
        } catch (err) {
          alertError(err, 'فشل البحث')
        }
      }}
      onSelectStudent={async (studentId) => {
        try {
          setEnrollments(await listEnrollments(studentId))
        } catch (err) {
          alertError(err, 'فشل جلب سجل الفصول')
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
          setStudents(await listStudents())
          setClasses(await listClasses())
        } catch (err) {
          alertError(err, 'فشل حفظ الطالب')
        }
      }}
      onSoftRemoveStudent={async (studentId) => {
        try {
          await softRemoveStudent(studentId)
          setStudents(await listStudents())
        } catch (err) {
          alertError(err, 'فشل استبعاد الطالب')
        }
      }}
      onPromoteStudent={async (studentId, classId) => {
        try {
          await promoteStudent(studentId, classId)
          setStudents(await listStudents())
          setClasses(await listClasses())
        } catch (err) {
          alertError(err, 'فشل نقل الطالب')
        }
      }}
      onUnassignStudent={async (studentId) => {
        try {
          await unassignStudent(studentId)
          setStudents(await listStudents())
          setClasses(await listClasses())
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
          setStudents(await listStudents())
          setClasses(await listClasses())
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
          setAssignments(await listAssignments())
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
          setAssignments(await listAssignments())
        } catch (err) {
          alertError(err, 'فشل إضافة التوزيع')
        }
      }}
      onSyncAssignments={async (input) => {
        try {
          const result = await syncTeacherAssignments(input)
          setAssignments(await listAssignments())
          if (result.created || result.removed) {
            // silent success — list refresh is enough
          }
        } catch (err) {
          alertError(err, 'فشل حفظ توزيع المعلم')
          throw err
        }
      }}
      onRemoveAssignment={async (assignmentId) => {
        try {
          await removeAssignment(assignmentId)
          setAssignments(await listAssignments())
        } catch (err) {
          alertError(err, 'فشل حذف التوزيع')
        }
      }}
      teacherImportResult={teacherImportResult}
      onImportStudents={async (file) => {
        try {
          const result = await importNoorFile(file)
          setImportResult(result)
          setStudents(await listStudents())
          setClasses(await listClasses())
          setImportBatches(await listImportBatches())
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
        setEnrollments([])
        await loadAll()
        return { backupFileName: result.backupFileName }
      }}
      onRestoreFromBackup={async (file) => {
        const result = await restoreDataFromBackupFile(file)
        setImportResult(null)
        setTeacherImportResult(null)
        setEnrollments([])
        await loadAll()
        return { defaultPassword: result.defaultPassword }
      }}
    />
  )
}
