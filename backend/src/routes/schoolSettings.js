import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { uploadLogo, logoPathToUrl, deleteUploadFile } from '../middleware/upload.js';
import { badRequest } from '../utils/errors.js';

const router = Router();

router.use(requireStaff);

// The application always upserts against this fixed id — there is exactly one row.
const SINGLETON_ID = 1;

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
    logoUrl: logoPathToUrl(settings.logoPath),
    academicYear: settings.academicYear,
    principalName: settings.principalName,
    educationAdminName: settings.educationAdminName,
    address: settings.address,
  };
}

/** Any authenticated staff member can read — used to render headers/print views. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await prisma.schoolSettings.findUnique({ where: { id: SINGLETON_ID } });
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
    const existing = await prisma.schoolSettings.findUnique({ where: { id: SINGLETON_ID } });

    const settings = await prisma.schoolSettings.upsert({
      where: { id: SINGLETON_ID },
      update: { logoPath: relativePath },
      create: {
        id: SINGLETON_ID,
        name: existing?.name ?? '',
        academicYear: existing?.academicYear ?? '',
        logoPath: relativePath,
      },
    });

    if (existing?.logoPath && existing.logoPath !== relativePath) {
      deleteUploadFile(existing.logoPath);
    }

    res.status(201).json({ logoUrl: logoPathToUrl(settings.logoPath) });
  })
);

export default router;
