import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, idParam } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../services/auth.js';
import { badRequest, notFound } from '../utils/errors.js';
import { tryNormalizePhone } from '../utils/phone.js';
import { uploadNoorSpreadsheet } from '../middleware/upload.js';
import { parseNoorTeachersSpreadsheet } from '../services/noorTeacherImport.js';
import {
  backupAndResetData,
  createDataBackup,
  writeBackupFile,
  restoreFromBackup,
  parseBackupUpload,
} from '../services/resetData.js';

const router = Router();

router.use(requireStaff, requireRole('ADMIN'));

const uploadBackupFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (
      name.endsWith('.zip') ||
      name.endsWith('.json') ||
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.mimetype === 'application/json' ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'text/plain'
    ) {
      return cb(null, true);
    }
    return cb(badRequest('Only ZIP or JSON backup files are allowed'));
  },
}).single('backup');

/** Default password for newly imported Noor teachers (admin should ask them to change it). */
const NOOR_TEACHER_DEFAULT_PASSWORD = 'Password123!';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'TEACHER', 'COUNSELOR']),
  langPref: z.enum(['AR', 'EN']).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'TEACHER', 'COUNSELOR']).optional(),
  langPref: z.enum(['AR', 'EN']).optional(),
});

const staffSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  langPref: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
};

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: staffSelect,
      orderBy: { name: 'asc' },
    });
    res.json({ users });
  })
);

/**
 * POST /users/import-noor
 * Upload GetSchoolTeachersDataReport (.xlsx) — upserts TEACHER users from
 * name + email + mobile only. New accounts get a shared default password.
 */
router.post(
  '/import-noor',
  (req, res, next) => uploadNoorSpreadsheet(req, res, next),
  asyncHandler(async (req, res) => {
    if (!req.file?.buffer) throw badRequest('لم يتم رفع ملف');

    const parsed = parseNoorTeachersSpreadsheet(req.file.buffer);
    if (parsed.rows.length === 0 && parsed.errors.length > 0) {
      return res.status(400).json({
        error: parsed.errors[0]?.error || 'فشل قراءة الملف',
        errors: parsed.errors,
      });
    }

    const errors = [...parsed.errors];
    const fileName = req.file.originalname || 'noor-teachers.xlsx';
    let created = 0;
    let updated = 0;
    let reactivated = 0;
    const passwordHash = await hashPassword(NOOR_TEACHER_DEFAULT_PASSWORD);

    for (const row of parsed.rows) {
      try {
        const existing = await prisma.user.findUnique({ where: { email: row.email } });

        if (!existing) {
          await prisma.user.create({
            data: {
              name: row.name,
              email: row.email,
              phone: row.phone,
              passwordHash,
              role: 'TEACHER',
              langPref: 'AR',
              mustChangePassword: true,
            },
          });
          created += 1;
          continue;
        }

        if (existing.role !== 'TEACHER') {
          errors.push({
            index: row.index,
            id: row.nationalId || row.email,
            error: `البريد مستخدم لدور ${existing.role} — تم التجاوز`,
          });
          continue;
        }

        const data = {
          name: row.name,
          phone: row.phone,
        };
        if (!existing.isActive) {
          data.isActive = true;
          reactivated += 1;
        } else {
          updated += 1;
        }

        await prisma.user.update({ where: { id: existing.id }, data });
      } catch (e) {
        errors.push({
          index: row.index,
          id: row.nationalId || row.email,
          error: e.message || 'فشل حفظ المعلم',
        });
      }
    }

    res.status(201).json({
      fileName,
      created,
      updated,
      reactivated,
      skipped: errors.length,
      defaultPassword: created > 0 ? NOOR_TEACHER_DEFAULT_PASSWORD : null,
      errors,
    });
  })
);

router.post(
  '/',
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    let phone = req.body.phone ?? null;
    if (phone) {
      phone = tryNormalizePhone(phone);
      if (!phone) throw badRequest('Invalid phone number');
    }

    const passwordHash = await hashPassword(req.body.password);
    const user = await prisma.user.create({
      data: {
        name: req.body.name.trim(),
        email,
        phone,
        passwordHash,
        role: req.body.role,
        langPref: req.body.langPref ?? 'AR',
        mustChangePassword: true,
      },
      select: staffSelect,
    });
    res.status(201).json({ user });
  })
);

router.patch(
  '/:id',
  validateParams(idParam),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound('User not found');

    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.email !== undefined) data.email = req.body.email.trim().toLowerCase();
    if (req.body.role !== undefined) {
      if (id === req.user.id && req.body.role !== existing.role) {
        throw badRequest('لا يمكنك تغيير دور حسابك بنفسك');
      }
      if (
        id === req.user.id &&
        existing.role === 'ADMIN' &&
        req.body.role !== 'ADMIN'
      ) {
        throw badRequest('لا يمكنك تخفيض صلاحية حسابك الإداري');
      }
      // Prevent demoting the last active admin
      if (existing.role === 'ADMIN' && req.body.role !== 'ADMIN' && existing.isActive) {
        const otherAdmins = await prisma.user.count({
          where: { role: 'ADMIN', isActive: true, id: { not: id } },
        });
        if (otherAdmins === 0) {
          throw badRequest('لا يمكن تخفيض صلاحية آخر مسؤول نشط');
        }
      }
      data.role = req.body.role;
    }
    if (req.body.langPref !== undefined) data.langPref = req.body.langPref;
    if (req.body.phone !== undefined) {
      if (req.body.phone === null || req.body.phone === '') {
        data.phone = null;
      } else {
        const phone = tryNormalizePhone(req.body.phone);
        if (!phone) throw badRequest('Invalid phone number');
        data.phone = phone;
      }
    }
    if (req.body.password) {
      data.passwordHash = await hashPassword(req.body.password);
      data.mustChangePassword = true;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: staffSelect,
    });
    res.json({ user });
  })
);

router.patch(
  '/:id/deactivate',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (id === req.user.id) {
      throw badRequest('You cannot deactivate your own account');
    }
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: staffSelect,
    });
    res.json({ user });
  })
);

router.patch(
  '/:id/activate',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: true },
      select: staffSelect,
    });
    res.json({ user });
  })
);

const resetSchema = z.object({
  confirm: z.literal('DELETE_ALL_EXCEPT_ADMIN'),
});

/** POST /users/backup-data — download ZIP backup only (no wipe) */
router.post(
  '/backup-data',
  asyncHandler(async (_req, res) => {
    const backup = await createDataBackup(prisma);
    const stored = await writeBackupFile(backup);
    res.json({
      ok: true,
      counts: backup.counts,
      backupFileName: stored.fileName,
      backupDownloadUrl: stored.downloadUrl,
      // Base64 ZIP so the browser can download even if /uploads is delayed.
      backupZipBase64: stored.zipBuffer.toString('base64'),
    });
  })
);

/** POST /users/reset-data — backup all data as ZIP, then wipe operational data (keep ADMIN) */
router.post(
  '/reset-data',
  validateBody(resetSchema),
  asyncHandler(async (_req, res) => {
    const { stored, summary } = await backupAndResetData(prisma);
    res.json({
      ok: true,
      summary,
      backupFileName: stored.fileName,
      backupDownloadUrl: stored.downloadUrl,
      // Base64 ZIP so the browser can download even if /uploads is delayed.
      backupZipBase64: stored.zipBuffer.toString('base64'),
    });
  })
);

/** POST /users/restore-data — upload backup ZIP/JSON and restore */
router.post(
  '/restore-data',
  (req, res, next) => uploadBackupFile(req, res, next),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('أرفق ملف النسخة الاحتياطية (ZIP أو JSON)');
    if (req.body?.confirm !== 'RESTORE_FROM_BACKUP') {
      throw badRequest('Confirmation required — send confirm=RESTORE_FROM_BACKUP');
    }
    const backup = await parseBackupUpload(req.file.buffer, req.file.originalname);
    const result = await restoreFromBackup(prisma, backup);
    res.json({ ok: true, ...result });
  })
);

export default router;
