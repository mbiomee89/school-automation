import fs from 'fs';
import path from 'path';
import { UPLOAD_ROOT } from '../middleware/upload.js';

/**
 * Full operational snapshot for download before wipe.
 * Omits password hashes and OTP codes.
 */
export async function createDataBackup(prisma) {
  const [
    schoolSettings,
    users,
    classes,
    subjects,
    teacherAssignments,
    students,
    classEnrollments,
    attendance,
    lateReports,
    homework,
    weeklyPlans,
    notifications,
    importBatches,
    parentAccounts,
  ] = await Promise.all([
    prisma.schoolSettings.findMany(),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        langPref: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.class.findMany(),
    prisma.subject.findMany(),
    prisma.teacherAssignment.findMany(),
    prisma.student.findMany(),
    prisma.classEnrollment.findMany(),
    prisma.attendance.findMany(),
    prisma.lateReport.findMany(),
    prisma.homework.findMany(),
    prisma.weeklyPlan.findMany(),
    prisma.notification.findMany(),
    prisma.studentImportBatch.findMany(),
    prisma.parentAccount.findMany({
      select: {
        id: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const reports = {
    dailyAbsence: attendance.filter((r) => r.status === 'ABSENT' || r.status === 'EXCUSED'),
    attendance,
    lateArrivals: lateReports,
    homeworkLog: homework,
    weeklyPlans,
    notifications,
  };

  return {
    version: 1,
    kind: 'school-automation-full-backup',
    createdAt: new Date().toISOString(),
    schoolSettings,
    users,
    classes,
    subjects,
    teacherAssignments,
    students,
    classEnrollments,
    importBatches,
    parentAccounts,
    reports,
    counts: {
      users: users.length,
      classes: classes.length,
      subjects: subjects.length,
      students: students.length,
      attendance: attendance.length,
      lateReports: lateReports.length,
      homework: homework.length,
      weeklyPlans: weeklyPlans.length,
      notifications: notifications.length,
    },
  };
}

/** Persist backup under /uploads/backups and return public path + filename. */
export function writeBackupFile(backup) {
  const dir = path.join(UPLOAD_ROOT, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `school-backup-${stamp}.json`;
  const absolute = path.join(dir, fileName);
  fs.writeFileSync(absolute, JSON.stringify(backup, null, 2), 'utf8');
  return {
    fileName,
    downloadUrl: `/uploads/backups/${fileName}`,
  };
}

/**
 * Wipe all operational data; keep ADMIN users (and SchoolSettings row).
 * Used by CLI script and ADMIN API.
 */
export async function resetDataKeepAdmin(prisma) {
  const summary = {};

  await prisma.$transaction(async (tx) => {
    summary.notifications = (await tx.notification.deleteMany()).count;
    summary.attendance = (await tx.attendance.deleteMany()).count;
    summary.lateReports = (await tx.lateReport.deleteMany()).count;
    summary.homework = (await tx.homework.deleteMany()).count;
    summary.weeklyPlans = (await tx.weeklyPlan.deleteMany()).count;
    summary.classEnrollments = (await tx.classEnrollment.deleteMany()).count;
    summary.teacherAssignments = (await tx.teacherAssignment.deleteMany()).count;
    summary.students = (await tx.student.deleteMany()).count;
    summary.importBatches = (await tx.studentImportBatch.deleteMany()).count;
    summary.classes = (await tx.class.deleteMany()).count;
    summary.subjects = (await tx.subject.deleteMany()).count;
    summary.parentOtps = (await tx.parentOtp.deleteMany()).count;
    summary.parentAccounts = (await tx.parentAccount.deleteMany()).count;
    summary.nonAdminUsers = (
      await tx.user.deleteMany({ where: { role: { not: 'ADMIN' } } })
    ).count;

    const admins = await tx.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true },
    });
    summary.adminsKept = admins;

    if (admins.length === 0) {
      throw new Error('No ADMIN user left after reset — aborting');
    }

    // Ensure school settings singleton exists; do not wipe name/year if already set.
    const settings = await tx.schoolSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      await tx.schoolSettings.create({
        data: {
          id: 1,
          name: 'المدرسة',
          academicYear: '2026-2027',
          principalName: null,
          educationAdminName: null,
          address: null,
          logoPath: null,
        },
      });
      summary.schoolSettings = 'created';
    } else {
      summary.schoolSettings = 'kept';
    }
  });

  return summary;
}

/**
 * Backup everything, write a server copy, then wipe operational data.
 */
export async function backupAndResetData(prisma) {
  const backup = await createDataBackup(prisma);
  const stored = writeBackupFile(backup);
  const summary = await resetDataKeepAdmin(prisma);
  return { backup, stored, summary };
}
