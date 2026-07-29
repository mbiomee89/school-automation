import fs from 'fs';
import path from 'path';
import { UPLOAD_ROOT } from '../middleware/upload.js';
import { hashPassword } from './auth.js';
import { badRequest } from '../utils/errors.js';

const DEFAULT_RESTORED_PASSWORD = 'Password123!';

function asDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function stripAttendanceForBackup(row) {
  const { absenceAttachmentData, ...rest } = row;
  return {
    ...rest,
    absenceAttachmentDataBase64: absenceAttachmentData
      ? Buffer.from(absenceAttachmentData).toString('base64')
      : null,
  };
}

function restoreAttachmentBytes(row) {
  if (row.absenceAttachmentDataBase64) {
    return Buffer.from(row.absenceAttachmentDataBase64, 'base64');
  }
  if (row.absenceAttachmentData?.type === 'Buffer' && Array.isArray(row.absenceAttachmentData.data)) {
    return Buffer.from(row.absenceAttachmentData.data);
  }
  return null;
}

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

  const attendanceSafe = attendance.map(stripAttendanceForBackup);

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
    attendance: attendanceSafe,
    lateReports,
    homework,
    weeklyPlans,
    notifications,
    reports: {
      dailyAbsence: attendanceSafe.filter((r) => r.status === 'ABSENT' || r.status === 'EXCUSED'),
      attendance: attendanceSafe,
      lateArrivals: lateReports,
      homeworkLog: homework,
      weeklyPlans,
      notifications,
    },
    counts: {
      users: users.length,
      classes: classes.length,
      subjects: subjects.length,
      students: students.length,
      attendance: attendanceSafe.length,
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

function assertBackup(backup) {
  if (!backup || typeof backup !== 'object') {
    throw badRequest('ملف النسخة الاحتياطية غير صالح');
  }
  if (backup.kind !== 'school-automation-full-backup') {
    throw badRequest('هذا الملف ليس نسخة احتياطية للمنصة');
  }
}

/**
 * Wipe current operational data, then recreate from a backup JSON.
 * Restored staff/parent passwords become Password123! (hashes are not stored in backups).
 */
export async function restoreFromBackup(prisma, backup) {
  assertBackup(backup);

  const passwordHash = await hashPassword(DEFAULT_RESTORED_PASSWORD);
  const wipeSummary = await resetDataKeepAdmin(prisma);

  const subjectIdMap = new Map();
  const classIdMap = new Map();
  const userIdMap = new Map();
  const batchIdMap = new Map();
  const attendanceIdMap = new Map();
  const lateIdMap = new Map();

  const counts = {
    subjects: 0,
    classes: 0,
    users: 0,
    importBatches: 0,
    students: 0,
    teacherAssignments: 0,
    classEnrollments: 0,
    homework: 0,
    weeklyPlans: 0,
    lateReports: 0,
    attendance: 0,
    notifications: 0,
    parentAccounts: 0,
    skipped: [],
  };

  const settingsRow = Array.isArray(backup.schoolSettings)
    ? backup.schoolSettings[0]
    : backup.schoolSettings;
  if (settingsRow) {
    await prisma.schoolSettings.upsert({
      where: { id: 1 },
      update: {
        name: settingsRow.name || 'المدرسة',
        academicYear: settingsRow.academicYear || '2026-2027',
        principalName: settingsRow.principalName ?? null,
        educationAdminName: settingsRow.educationAdminName ?? null,
        address: settingsRow.address ?? null,
      },
      create: {
        id: 1,
        name: settingsRow.name || 'المدرسة',
        academicYear: settingsRow.academicYear || '2026-2027',
        principalName: settingsRow.principalName ?? null,
        educationAdminName: settingsRow.educationAdminName ?? null,
        address: settingsRow.address ?? null,
        logoPath: null,
      },
    });
  }

  for (const s of backup.subjects || []) {
    const created = await prisma.subject.create({
      data: { nameAr: s.nameAr, nameEn: s.nameEn },
    });
    subjectIdMap.set(s.id, created.id);
    counts.subjects += 1;
  }

  for (const c of backup.classes || []) {
    const created = await prisma.class.create({
      data: {
        name: c.name,
        gradeLevel: c.gradeLevel,
        section: c.section ?? null,
        academicYear: c.academicYear,
      },
    });
    classIdMap.set(c.id, created.id);
    counts.classes += 1;
  }

  const existingAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });
  const adminByEmail = new Map(existingAdmins.map((a) => [a.email.toLowerCase(), a.id]));
  const fallbackAdminId = existingAdmins[0]?.id;
  if (!fallbackAdminId) throw new Error('No ADMIN available for restore');

  for (const u of backup.users || []) {
    if (u.role === 'ADMIN') {
      const mapped = adminByEmail.get(String(u.email || '').toLowerCase()) ?? fallbackAdminId;
      userIdMap.set(u.id, mapped);
      continue;
    }

    const email = String(u.email || '').trim().toLowerCase();
    if (!email) {
      counts.skipped.push(`user:${u.id}:missing-email`);
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      userIdMap.set(u.id, existing.id);
      continue;
    }

    const created = await prisma.user.create({
      data: {
        name: u.name || email,
        email,
        phone: u.phone ?? null,
        role: u.role === 'COUNSELOR' ? 'COUNSELOR' : 'TEACHER',
        langPref: u.langPref === 'EN' ? 'EN' : 'AR',
        isActive: u.isActive !== false,
        passwordHash,
      },
    });
    userIdMap.set(u.id, created.id);
    counts.users += 1;
  }

  const mapUser = (oldId) => {
    if (oldId == null) return null;
    return userIdMap.get(oldId) ?? fallbackAdminId;
  };

  for (const b of backup.importBatches || []) {
    const created = await prisma.studentImportBatch.create({
      data: {
        importedBy: mapUser(b.importedBy),
        fileName: b.fileName ?? null,
        rowCount: b.rowCount ?? 0,
        importedAt: asDate(b.importedAt) ?? new Date(),
      },
    });
    batchIdMap.set(b.id, created.id);
    counts.importBatches += 1;
  }

  for (const s of backup.students || []) {
    const classId = s.classId == null ? null : classIdMap.get(s.classId) ?? null;
    const importBatchId =
      s.importBatchId == null ? null : batchIdMap.get(s.importBatchId) ?? null;
    await prisma.student.create({
      data: {
        id: s.id,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        classId,
        parentPhone: s.parentPhone,
        parentEmail: s.parentEmail ?? null,
        waOptedIn: !!s.waOptedIn,
        isActive: s.isActive !== false,
        deletedAt: asDate(s.deletedAt),
        importBatchId,
        createdAt: asDate(s.createdAt) ?? undefined,
      },
    });
    counts.students += 1;
  }

  for (const a of backup.teacherAssignments || []) {
    const teacherId = mapUser(a.teacherId);
    const classId = classIdMap.get(a.classId);
    const subjectId = subjectIdMap.get(a.subjectId);
    if (!teacherId || !classId || !subjectId) {
      counts.skipped.push(`assignment:${a.id}`);
      continue;
    }
    try {
      await prisma.teacherAssignment.create({
        data: { teacherId, classId, subjectId },
      });
      counts.teacherAssignments += 1;
    } catch {
      counts.skipped.push(`assignment-dup:${a.id}`);
    }
  }

  for (const e of backup.classEnrollments || []) {
    const classId = classIdMap.get(e.classId);
    if (!classId) {
      counts.skipped.push(`enrollment:${e.id}`);
      continue;
    }
    await prisma.classEnrollment.create({
      data: {
        studentId: e.studentId,
        classId,
        academicYear: e.academicYear,
        startDate: asDate(e.startDate) ?? new Date(),
        endDate: asDate(e.endDate),
        changedBy: mapUser(e.changedBy),
      },
    });
    counts.classEnrollments += 1;
  }

  const homeworkRows = backup.homework || backup.reports?.homeworkLog || [];
  for (const h of homeworkRows) {
    const classId = classIdMap.get(h.classId);
    const subjectId = subjectIdMap.get(h.subjectId);
    const teacherId = mapUser(h.teacherId);
    const date = asDate(h.date);
    if (!classId || !subjectId || !teacherId || !date) {
      counts.skipped.push(`homework:${h.id}`);
      continue;
    }
    await prisma.homework.create({
      data: {
        classId,
        subjectId,
        teacherId,
        date,
        description: h.description || '',
        dueDate: asDate(h.dueDate),
        createdAt: asDate(h.createdAt) ?? undefined,
        updatedAt: asDate(h.updatedAt) ?? undefined,
      },
    });
    counts.homework += 1;
  }

  const weeklyRows = backup.weeklyPlans || backup.reports?.weeklyPlans || [];
  for (const w of weeklyRows) {
    const classId = classIdMap.get(w.classId);
    const subjectId = subjectIdMap.get(w.subjectId);
    const teacherId = mapUser(w.teacherId);
    const weekStart = asDate(w.weekStart);
    if (!classId || !subjectId || !teacherId || !weekStart) {
      counts.skipped.push(`weekly:${w.id}`);
      continue;
    }
    try {
      await prisma.weeklyPlan.create({
        data: {
          classId,
          subjectId,
          teacherId,
          weekStart,
          topics: w.topics || '',
          objectives: w.objectives ?? null,
          notes: w.notes ?? null,
          createdAt: asDate(w.createdAt) ?? undefined,
          updatedAt: asDate(w.updatedAt) ?? undefined,
        },
      });
      counts.weeklyPlans += 1;
    } catch {
      counts.skipped.push(`weekly-dup:${w.id}`);
    }
  }

  const lateRows = backup.lateReports || backup.reports?.lateArrivals || [];
  for (const r of lateRows) {
    const classId = classIdMap.get(r.classId);
    const date = asDate(r.date);
    if (!classId || !date || !r.studentId) {
      counts.skipped.push(`late:${r.id}`);
      continue;
    }
    try {
      const created = await prisma.lateReport.create({
        data: {
          studentId: r.studentId,
          classId,
          date,
          time: asDate(r.time) ?? new Date(),
          reason: r.reason ?? null,
          recordedBy: mapUser(r.recordedBy),
        },
      });
      lateIdMap.set(r.id, created.id);
      counts.lateReports += 1;
    } catch {
      counts.skipped.push(`late-dup:${r.id}`);
    }
  }

  const attendanceRows = backup.attendance || backup.reports?.attendance || [];
  for (const r of attendanceRows) {
    const classId = classIdMap.get(r.classId);
    const date = asDate(r.date);
    if (!classId || !date || !r.studentId) {
      counts.skipped.push(`attendance:${r.id}`);
      continue;
    }
    try {
      const created = await prisma.attendance.create({
        data: {
          studentId: r.studentId,
          classId,
          date,
          period: r.period || 'DAY',
          status: r.status,
          recordedBy: mapUser(r.recordedBy),
          createdAt: asDate(r.createdAt) ?? undefined,
          absenceReason: r.absenceReason ?? null,
          absenceAttachmentUrl: r.absenceAttachmentUrl ?? null,
          absenceAttachmentData: restoreAttachmentBytes(r),
          absenceAttachmentMime: r.absenceAttachmentMime ?? null,
          reasonSubmittedAt: asDate(r.reasonSubmittedAt),
          reasonStatus: r.reasonStatus || 'NONE',
          reasonReviewedBy: mapUser(r.reasonReviewedBy),
          reasonReviewedAt: asDate(r.reasonReviewedAt),
          counselorNote: r.counselorNote ?? null,
        },
      });
      attendanceIdMap.set(r.id, created.id);
      counts.attendance += 1;
    } catch {
      counts.skipped.push(`attendance-dup:${r.id}`);
    }
  }

  const notifRows = backup.notifications || backup.reports?.notifications || [];
  for (const n of notifRows) {
    try {
      await prisma.notification.create({
        data: {
          eventType: n.eventType,
          studentId: n.studentId ?? null,
          parentPhone: n.parentPhone,
          templateName: n.templateName || 'unknown',
          status: n.status || 'QUEUED',
          providerMessageId: n.providerMessageId ?? null,
          attendanceId:
            n.attendanceId == null ? null : attendanceIdMap.get(n.attendanceId) ?? null,
          lateReportId: n.lateReportId == null ? null : lateIdMap.get(n.lateReportId) ?? null,
          forDate: asDate(n.forDate),
          sentAt: asDate(n.sentAt),
          createdAt: asDate(n.createdAt) ?? undefined,
          errorMessage: n.errorMessage ?? null,
        },
      });
      counts.notifications += 1;
    } catch {
      counts.skipped.push(`notification:${n.id}`);
    }
  }

  for (const p of backup.parentAccounts || []) {
    if (!p.phone) continue;
    try {
      await prisma.parentAccount.create({
        data: {
          phone: p.phone,
          passwordHash,
          isActive: p.isActive !== false,
          createdAt: asDate(p.createdAt) ?? undefined,
          updatedAt: asDate(p.updatedAt) ?? undefined,
        },
      });
      counts.parentAccounts += 1;
    } catch {
      counts.skipped.push(`parent:${p.phone}`);
    }
  }

  return {
    wipeSummary,
    restored: counts,
    defaultPassword: DEFAULT_RESTORED_PASSWORD,
  };
}
