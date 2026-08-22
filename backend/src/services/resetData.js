import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { UPLOAD_ROOT } from '../middleware/upload.js';
import { hashPassword } from './auth.js';
import { badRequest } from '../utils/errors.js';

const DEFAULT_RESTORED_PASSWORD = 'Password123!';
const BACKUP_JSON_NAME = 'school-backup.json';

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

function stripSchoolSettingsForBackup(row) {
  if (!row) return row;
  const { logoData, ...rest } = row;
  return {
    ...rest,
    logoDataBase64: logoData ? Buffer.from(logoData).toString('base64') : null,
  };
}

function restoreLogoBytes(row) {
  if (!row) return null;
  if (row.logoDataBase64) return Buffer.from(row.logoDataBase64, 'base64');
  if (row.logoData?.type === 'Buffer' && Array.isArray(row.logoData.data)) {
    return Buffer.from(row.logoData.data);
  }
  return null;
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
  const schoolSettingsSafe = schoolSettings.map(stripSchoolSettingsForBackup);

  return {
    version: 1,
    kind: 'school-automation-full-backup',
    createdAt: new Date().toISOString(),
    schoolSettings: schoolSettingsSafe,
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

const MAX_BACKUP_FILES = 15;

/** Delete older ZIP backups, keeping the newest MAX_BACKUP_FILES. */
export function pruneBackupFiles() {
  const dir = path.join(UPLOAD_ROOT, 'backups');
  if (!fs.existsSync(dir)) return { deleted: 0 };
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => {
      const absolute = path.join(dir, f);
      return { name: f, absolute, mtime: fs.statSync(absolute).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  let deleted = 0;
  for (const old of files.slice(MAX_BACKUP_FILES)) {
    try {
      fs.unlinkSync(old.absolute);
      deleted += 1;
    } catch {
      /* ignore */
    }
  }
  return { deleted };
}

/** Persist backup as a compressed ZIP under /uploads/backups. */
export async function writeBackupFile(backup, { prefix = 'school-backup' } = {}) {
  const dir = path.join(UPLOAD_ROOT, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${prefix}-${stamp}.zip`;
  const absolute = path.join(dir, fileName);

  const zip = new JSZip();
  zip.file(BACKUP_JSON_NAME, JSON.stringify(backup, null, 2));
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(absolute, buffer);
  pruneBackupFiles();

  return {
    fileName,
    downloadUrl: `/uploads/backups/${fileName}`,
    zipBuffer: buffer,
  };
}

/**
 * Parse an uploaded backup (.zip preferred, .json still accepted).
 */
export async function parseBackupUpload(buffer, originalName = '') {
  const name = String(originalName || '').toLowerCase();
  const looksZip =
    name.endsWith('.zip') ||
    (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b);

  if (looksZip) {
    let zip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      throw badRequest('تعذّر فتح ملف ZIP — قد يكون تالفاً');
    }
    const preferred = zip.file(BACKUP_JSON_NAME);
    const jsonEntry =
      preferred ||
      Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith('.json'));
    if (!jsonEntry) {
      throw badRequest('ملف ZIP لا يحتوي على school-backup.json');
    }
    try {
      return JSON.parse(await jsonEntry.async('string'));
    } catch {
      throw badRequest('تعذّر قراءة JSON داخل ملف ZIP');
    }
  }

  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw badRequest('تعذّر قراءة ملف النسخة الاحتياطية');
  }
}

/**
 * Wipe all operational data; keep ADMIN users (and SchoolSettings row).
 * Used by CLI script and ADMIN API.
 *
 * Uses short per-table transactions instead of one long interactive
 * $transaction — free Render Postgres often closes interactive txs mid-wipe
 * ("Transaction not found" on later deleteMany calls).
 *
 * NOTE: This intentionally hard-deletes Students and non-ADMIN Users,
 * which is an explicit exception to the schema "never hard-delete" invariant.
 * Callers must write a ZIP safety backup first (see backupAndResetData /
 * restoreFromBackup).
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 */
export async function resetDataKeepAdmin(db) {
  const summary = {};

  async function wipe(label, run) {
    const count = await run();
    summary[label] = count;
    return count;
  }

  // FK-safe order (children → parents). Each step is its own short transaction
  // when `db` is the root client; inside an interactive tx they share that tx.
  await wipe('notifications', async () => (await db.notification.deleteMany()).count);
  await wipe('attendance', async () => (await db.attendance.deleteMany()).count);
  await wipe('lateReports', async () => (await db.lateReport.deleteMany()).count);
  await wipe('homework', async () => (await db.homework.deleteMany()).count);
  await wipe('weeklyPlans', async () => (await db.weeklyPlan.deleteMany()).count);
  await wipe('timetableSlots', async () => (await db.timetableSlot.deleteMany()).count);
  await wipe(
    'classEnrollments',
    async () => (await db.classEnrollment.deleteMany()).count
  );
  await wipe(
    'teacherAssignments',
    async () => (await db.teacherAssignment.deleteMany()).count
  );
  await wipe('students', async () => (await db.student.deleteMany()).count);
  await wipe(
    'importBatches',
    async () => (await db.studentImportBatch.deleteMany()).count
  );
  await wipe('classes', async () => (await db.class.deleteMany()).count);
  await wipe('subjects', async () => (await db.subject.deleteMany()).count);
  await wipe('parentOtps', async () => (await db.parentOtp.deleteMany()).count);
  await wipe('parentAccounts', async () => (await db.parentAccount.deleteMany()).count);
  await wipe(
    'nonAdminUsers',
    async () => (await db.user.deleteMany({ where: { role: { not: 'ADMIN' } } })).count
  );

  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true },
  });
  summary.adminsKept = admins;

  if (admins.length === 0) {
    throw new Error('No ADMIN user left after reset — aborting');
  }

  const settings = await db.schoolSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    await db.schoolSettings.create({
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

  return summary;
}

/**
 * Backup everything, write a ZIP copy, then wipe operational data.
 */
export async function backupAndResetData(prisma) {
  const backup = await createDataBackup(prisma);
  const stored = await writeBackupFile(backup);
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
 *
 * Safety: always writes a pre-restore ZIP of the live DB first. Wipe+restore run inside
 * one interactive transaction so a mid-restore failure rolls back instead of leaving a
 * half-wiped database. If the process crashes hard (OOM/kill), use the pre-restore ZIP.
 */
export async function restoreFromBackup(prisma, backup) {
  assertBackup(backup);

  const safetyBackup = await createDataBackup(prisma);
  const safetyStored = await writeBackupFile(safetyBackup, { prefix: 'pre-restore' });

  const passwordHash = await hashPassword(DEFAULT_RESTORED_PASSWORD);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const wipeSummary = await resetDataKeepAdmin(tx);

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
          inactiveAdminsRestored: 0,
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
          const logoData = restoreLogoBytes(settingsRow);
          const logoFields = {
            logoPath: settingsRow.logoPath ?? null,
            logoMime: settingsRow.logoMime ?? null,
            logoData,
          };
          await tx.schoolSettings.upsert({
            where: { id: 1 },
            update: {
              name: settingsRow.name || 'المدرسة',
              academicYear: settingsRow.academicYear || '2026-2027',
              principalName: settingsRow.principalName ?? null,
              educationAdminName: settingsRow.educationAdminName ?? null,
              address: settingsRow.address ?? null,
              ...logoFields,
            },
            create: {
              id: 1,
              name: settingsRow.name || 'المدرسة',
              academicYear: settingsRow.academicYear || '2026-2027',
              principalName: settingsRow.principalName ?? null,
              educationAdminName: settingsRow.educationAdminName ?? null,
              address: settingsRow.address ?? null,
              ...logoFields,
            },
          });
        }

        for (const s of backup.subjects || []) {
          try {
            const created = await tx.subject.create({
              data: { nameAr: s.nameAr, nameEn: s.nameEn },
            });
            subjectIdMap.set(s.id, created.id);
            counts.subjects += 1;
          } catch (err) {
            counts.skipped.push(`subject:${s.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        for (const c of backup.classes || []) {
          try {
            const created = await tx.class.create({
              data: {
                name: c.name,
                gradeLevel: c.gradeLevel,
                section: c.section ?? null,
                academicYear: c.academicYear,
              },
            });
            classIdMap.set(c.id, created.id);
            counts.classes += 1;
          } catch (err) {
            counts.skipped.push(`class:${c.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        const existingAdmins = await tx.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true, email: true },
        });
        const adminByEmail = new Map(
          existingAdmins.map((a) => [a.email.toLowerCase(), a.id])
        );
        if (existingAdmins.length === 0) {
          throw new Error('No ADMIN available for restore');
        }

        for (const u of backup.users || []) {
          const email = String(u.email || '')
            .trim()
            .toLowerCase();

          if (u.role === 'ADMIN') {
            if (email && adminByEmail.has(email)) {
              userIdMap.set(u.id, adminByEmail.get(email));
              continue;
            }
            // Recreate unmatched backup admins as inactive so historical FKs
            // (recordedBy / reasonReviewedBy) keep pointing at the right person —
            // never silently remap to an arbitrary live admin.
            if (!email) {
              counts.skipped.push(`admin:${u.id}:missing-email`);
              continue;
            }
            const existing = await tx.user.findUnique({ where: { email } });
            if (existing) {
              userIdMap.set(u.id, existing.id);
              continue;
            }
            const created = await tx.user.create({
              data: {
                name: u.name || email,
                email,
                phone: u.phone ?? null,
                role: 'ADMIN',
                langPref: u.langPref === 'EN' ? 'EN' : 'AR',
                isActive: false,
                mustChangePassword: true,
                passwordHash,
              },
            });
            userIdMap.set(u.id, created.id);
            counts.inactiveAdminsRestored += 1;
            continue;
          }

          if (!email) {
            counts.skipped.push(`user:${u.id}:missing-email`);
            continue;
          }

          const existing = await tx.user.findUnique({ where: { email } });
          if (existing) {
            userIdMap.set(u.id, existing.id);
            continue;
          }

          try {
            const created = await tx.user.create({
              data: {
                name: u.name || email,
                email,
                phone: u.phone ?? null,
                role: u.role === 'COUNSELOR' ? 'COUNSELOR' : 'TEACHER',
                langPref: u.langPref === 'EN' ? 'EN' : 'AR',
                isActive: u.isActive !== false,
                mustChangePassword: true,
                passwordHash,
              },
            });
            userIdMap.set(u.id, created.id);
            counts.users += 1;
          } catch (err) {
            counts.skipped.push(`user:${u.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        const mapUser = (oldId) => {
          if (oldId == null) return null;
          return userIdMap.has(oldId) ? userIdMap.get(oldId) : null;
        };

        for (const b of backup.importBatches || []) {
          const importedBy = mapUser(b.importedBy);
          if (importedBy == null) {
            counts.skipped.push(`batch:${b.id}:unmapped-importer`);
            continue;
          }
          const created = await tx.studentImportBatch.create({
            data: {
              importedBy,
              fileName: b.fileName ?? null,
              rowCount: b.rowCount ?? 0,
              importedAt: asDate(b.importedAt) ?? new Date(),
            },
          });
          batchIdMap.set(b.id, created.id);
          counts.importBatches += 1;
        }

        for (const s of backup.students || []) {
          try {
            const classId = s.classId == null ? null : classIdMap.get(s.classId) ?? null;
            const importBatchId =
              s.importBatchId == null ? null : batchIdMap.get(s.importBatchId) ?? null;
            await tx.student.create({
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
          } catch (err) {
            counts.skipped.push(`student:${s.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        for (const a of backup.teacherAssignments || []) {
          const teacherId = mapUser(a.teacherId);
          const classId = classIdMap.get(a.classId);
          const subjectId = subjectIdMap.get(a.subjectId);
          if (!teacherId || !classId || !subjectId) {
            counts.skipped.push(
              `assignment:${a.id}:${!teacherId ? 'unmapped-teacher' : 'missing-class-or-subject'}`
            );
            continue;
          }
          try {
            await tx.teacherAssignment.create({
              data: { teacherId, classId, subjectId },
            });
            counts.teacherAssignments += 1;
          } catch (err) {
            counts.skipped.push(`assignment:${a.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        for (const e of backup.classEnrollments || []) {
          const classId = classIdMap.get(e.classId);
          if (!classId) {
            counts.skipped.push(`enrollment:${e.id}:missing-class`);
            continue;
          }
          const endDate = asDate(e.endDate);
          const isOpen = endDate == null;
          try {
            await tx.classEnrollment.create({
              data: {
                studentId: e.studentId,
                classId,
                academicYear: e.academicYear,
                startDate: asDate(e.startDate) ?? new Date(),
                endDate,
                openMarker: isOpen ? e.studentId : null,
                changedBy: mapUser(e.changedBy),
              },
            });
            counts.classEnrollments += 1;
          } catch (err) {
            counts.skipped.push(`enrollment:${e.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        const homeworkRows = backup.homework || backup.reports?.homeworkLog || [];
        for (const h of homeworkRows) {
          const classId = classIdMap.get(h.classId);
          const subjectId = subjectIdMap.get(h.subjectId);
          const teacherId = mapUser(h.teacherId);
          const date = asDate(h.date);
          if (!classId || !subjectId || !teacherId || !date) {
            counts.skipped.push(
              `homework:${h.id}:${!teacherId ? 'unmapped-teacher' : 'missing-fields'}`
            );
            continue;
          }
          try {
            await tx.homework.create({
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
          } catch (err) {
            counts.skipped.push(`homework:${h.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        const weeklyRows = backup.weeklyPlans || backup.reports?.weeklyPlans || [];
        for (const w of weeklyRows) {
          const classId = classIdMap.get(w.classId);
          const subjectId = subjectIdMap.get(w.subjectId);
          const teacherId = mapUser(w.teacherId);
          const weekStart = asDate(w.weekStart);
          if (!classId || !subjectId || !teacherId || !weekStart) {
            counts.skipped.push(
              `weekly:${w.id}:${!teacherId ? 'unmapped-teacher' : 'missing-fields'}`
            );
            continue;
          }
          try {
            await tx.weeklyPlan.create({
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
          } catch (err) {
            counts.skipped.push(`weekly:${w.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        const lateRows = backup.lateReports || backup.reports?.lateArrivals || [];
        for (const r of lateRows) {
          const classId = classIdMap.get(r.classId);
          const date = asDate(r.date);
          const recordedBy = mapUser(r.recordedBy);
          if (!classId || !date || !r.studentId || recordedBy == null) {
            counts.skipped.push(
              `late:${r.id}:${recordedBy == null ? 'unmapped-recorder' : 'missing-fields'}`
            );
            continue;
          }
          try {
            const created = await tx.lateReport.create({
              data: {
                studentId: r.studentId,
                classId,
                date,
                time: asDate(r.time) ?? new Date(),
                reason: r.reason ?? null,
                recordedBy,
              },
            });
            lateIdMap.set(r.id, created.id);
            counts.lateReports += 1;
          } catch (err) {
            counts.skipped.push(`late:${r.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        const attendanceRows = backup.attendance || backup.reports?.attendance || [];
        for (const r of attendanceRows) {
          const classId = classIdMap.get(r.classId);
          const date = asDate(r.date);
          const recordedBy = mapUser(r.recordedBy);
          if (!classId || !date || !r.studentId || recordedBy == null) {
            counts.skipped.push(
              `attendance:${r.id}:${recordedBy == null ? 'unmapped-recorder' : 'missing-fields'}`
            );
            continue;
          }
          try {
            const created = await tx.attendance.create({
              data: {
                studentId: r.studentId,
                classId,
                date,
                period: r.period || 'DAY',
                status: r.status,
                recordedBy,
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
          } catch (err) {
            counts.skipped.push(`attendance:${r.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        const notifRows = backup.notifications || backup.reports?.notifications || [];
        for (const n of notifRows) {
          try {
            await tx.notification.create({
              data: {
                eventType: n.eventType,
                studentId: n.studentId ?? null,
                parentPhone: n.parentPhone,
                templateName: n.templateName || 'unknown',
                status: n.status || 'QUEUED',
                providerMessageId: n.providerMessageId ?? null,
                attendanceId:
                  n.attendanceId == null ? null : attendanceIdMap.get(n.attendanceId) ?? null,
                lateReportId:
                  n.lateReportId == null ? null : lateIdMap.get(n.lateReportId) ?? null,
                forDate: asDate(n.forDate),
                sentAt: asDate(n.sentAt),
                createdAt: asDate(n.createdAt) ?? undefined,
                errorMessage: n.errorMessage ?? null,
              },
            });
            counts.notifications += 1;
          } catch (err) {
            counts.skipped.push(`notification:${n.id}:${err?.code || err?.message || 'error'}`);
          }
        }

        for (const p of backup.parentAccounts || []) {
          if (!p.phone) continue;
          try {
            await tx.parentAccount.create({
              data: {
                phone: p.phone,
                passwordHash,
                isActive: p.isActive !== false,
                createdAt: asDate(p.createdAt) ?? undefined,
                updatedAt: asDate(p.updatedAt) ?? undefined,
              },
            });
            counts.parentAccounts += 1;
          } catch (err) {
            counts.skipped.push(`parent:${p.phone}:${err?.code || err?.message || 'error'}`);
          }
        }

        return {
          wipeSummary,
          restored: counts,
          defaultPassword: DEFAULT_RESTORED_PASSWORD,
        };
      },
      { timeout: 300_000, maxWait: 60_000 }
    );

    return {
      ...result,
      safetyBackupFileName: safetyStored.fileName,
      safetyBackupDownloadUrl: safetyStored.downloadUrl,
    };
  } catch (err) {
    const message =
      err?.message ||
      'فشلت الاستعادة — لم تُغيَّر قاعدة البيانات (أو أُلغيت المعاملة). استخدم النسخة السابقة للاسترداد إن لزم.';
    const wrapped = badRequest(message, {
      safetyBackupFileName: safetyStored.fileName,
      safetyBackupDownloadUrl: safetyStored.downloadUrl,
    });
    throw wrapped;
  }
}

