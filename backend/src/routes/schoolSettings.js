import fs from 'fs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { uploadLogo, deleteUploadFile } from '../middleware/upload.js';
import { badRequest, notFound } from '../utils/errors.js';
import { loadSchoolLogo, schoolLogoUrl } from '../services/schoolLogo.js';

const router = Router();

// The application always upserts against this fixed id — there is exactly one row.
const SINGLETON_ID = 1;

const settingsSelect = {
  id: true,
  name: true,
  logoPath: true,
  logoMime: true,
  academicYear: true,
  principalName: true,
  educationAdminName: true,
  address: true,
  updatedAt: true,
};

const settingsSchema = z.object({
  name: z.string().min(1),
  academicYear: z.string().min(1),
  principalName: z.string().optional().nullable(),
  educationAdminName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

function serialize(settings) {
  if (!settings) {
    return {
      name: null,
      logoUrl: null,
      academicYear: null,
      principalName: null,
      educationAdminName: null,
      address: null,
    };
  }
  return {
    name: settings.name,
    logoUrl: schoolLogoUrl(settings),
    academicYear: settings.academicYear,
    principalName: settings.principalName,
    educationAdminName: settings.educationAdminName,
    address: settings.address,
  };
}

/**
 * Public logo stream for <img src> / print headers.
 * Must stay unauthenticated — browsers do not send JWT on image requests.
 * Bytes come from Postgres (survives Render redeploy); disk is a fallback only.
 */
router.get(
  '/logo',
  asyncHandler(async (_req, res) => {
    const file = await loadSchoolLogo();
    if (!file) {
      throw notFound('شعار المدرسة غير متوفر');
    }
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    res.send(file.buffer);
  })
);

router.use(requireStaff);

/** Any authenticated staff member can read — used to render headers/print views. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await prisma.schoolSettings.findUnique({
      where: { id: SINGLETON_ID },
      select: settingsSelect,
    });
    res.json({ schoolSettings: serialize(settings) });
  })
);

router.patch(
  '/',
  requireRole('ADMIN'),
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const data = {
      name: req.body.name.trim(),
      academicYear: req.body.academicYear.trim(),
      principalName: req.body.principalName?.trim() || null,
      educationAdminName: req.body.educationAdminName?.trim() || null,
      address: req.body.address?.trim() || null,
    };

    const settings = await prisma.schoolSettings.upsert({
      where: { id: SINGLETON_ID },
      update: data,
      create: { id: SINGLETON_ID, ...data },
      select: settingsSelect,
    });

    res.json({ schoolSettings: serialize(settings) });
  })
);

router.post(
  '/logo',
  requireRole('ADMIN'),
  (req, res, next) => uploadLogo(req, res, next),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No logo file was uploaded');

    const relativePath = `logos/${req.file.filename}`;
    const logoData = fs.readFileSync(req.file.path);
    const logoMime = req.file.mimetype || 'image/png';
    const existing = await prisma.schoolSettings.findUnique({ where: { id: SINGLETON_ID } });

    const settings = await prisma.schoolSettings.upsert({
      where: { id: SINGLETON_ID },
      update: { logoPath: relativePath, logoData, logoMime },
      create: {
        id: SINGLETON_ID,
        name: existing?.name ?? 'المدرسة',
        academicYear: existing?.academicYear ?? '2026-2027',
        logoPath: relativePath,
        logoData,
        logoMime,
      },
      select: settingsSelect,
    });

    if (existing?.logoPath && existing.logoPath !== relativePath) {
      deleteUploadFile(existing.logoPath);
    }

    res.status(201).json({ logoUrl: schoolLogoUrl(settings) });
  })
);

export default router;
