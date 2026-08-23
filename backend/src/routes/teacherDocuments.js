import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateParams } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { notFound } from '../utils/errors.js';
import {
  uploadTeacherPdf,
  assertPdfSniff,
  safePdfDisplayName,
  writeTeacherPdfMirror,
  deleteUploadFile,
} from '../middleware/upload.js';

const router = Router();

export const TEACHER_DOC_TYPES = [
  'NOMINATION_FORM',
  'NATIONAL_ID',
  'CRIMINAL_CLEARANCE',
  'MEDICAL_EXAM',
  'ACADEMIC_QUALIFICATION',
  'TRAINING_COURSES',
  'PREVIOUS_EXPERIENCE',
  'PROFESSIONAL_LICENSE',
  'UNIFIED_CONTRACT',
  'PERFORMANCE_2Y',
];

export const TEACHER_DOC_LABELS_AR = {
  NOMINATION_FORM: 'نموذج ترشيح معلم',
  NATIONAL_ID: 'الهوية الوطنية',
  CRIMINAL_CLEARANCE: 'شهادة خلو سوابق',
  MEDICAL_EXAM: 'الكشف الطبي',
  ACADEMIC_QUALIFICATION: 'المؤهل العلمي',
  TRAINING_COURSES: 'الدورات التدريبية',
  PREVIOUS_EXPERIENCE: 'الخبرات السابقة',
  PROFESSIONAL_LICENSE: 'الرخصة المهنية',
  UNIFIED_CONTRACT: 'العقد الموحد الوظيفي',
  PERFORMANCE_2Y: 'الأداء الوظيفي لآخر عامين',
};

const docTypeSchema = z
  .string()
  .refine((v) => TEACHER_DOC_TYPES.includes(v), { message: 'نوع مستند غير صالح' });

const docTypeParam = z.object({
  docType: docTypeSchema,
});

const teacherIdParam = z.object({
  teacherId: z.coerce.number().int().positive(),
});

const teacherDocParam = z.object({
  teacherId: z.coerce.number().int().positive(),
  docType: docTypeSchema,
});

function metaForType(docType, row) {
  return {
    docType,
    labelAr: TEACHER_DOC_LABELS_AR[docType],
    uploaded: Boolean(row),
    uploadedAt: row?.uploadedAt?.toISOString() ?? null,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
    fileName: row?.fileName ?? null,
  };
}

function buildSlots(docsByType) {
  return TEACHER_DOC_TYPES.map((docType) => metaForType(docType, docsByType.get(docType) ?? null));
}

function sendPdf(res, row) {
  const buffer = Buffer.from(row.data);
  const safeName = (row.fileName || `${row.docType}.pdf`).replace(/"/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}

// ---------- Teacher (self) ----------

router.get(
  '/me',
  requireStaff,
  requireRole('TEACHER'),
  asyncHandler(async (req, res) => {
    const rows = await prisma.teacherDocument.findMany({
      where: { teacherId: req.user.id },
      select: {
        docType: true,
        fileName: true,
        uploadedAt: true,
        updatedAt: true,
      },
    });
    const byType = new Map(rows.map((r) => [r.docType, r]));
    const documents = buildSlots(byType);
    const uploadedCount = documents.filter((d) => d.uploaded).length;
    res.json({
      documents,
      uploadedCount,
      totalCount: TEACHER_DOC_TYPES.length,
    });
  })
);

router.post(
  '/me/:docType',
  requireStaff,
  requireRole('TEACHER'),
  validateParams(docTypeParam),
  (req, res, next) => uploadTeacherPdf(req, res, next),
  assertPdfSniff,
  asyncHandler(async (req, res) => {
    const { docType } = req.params;
    const teacherId = req.user.id;
    const fileName = safePdfDisplayName(req.file.originalname);
    const data = req.file.buffer;

    const existing = await prisma.teacherDocument.findUnique({
      where: { teacherId_docType: { teacherId, docType } },
      select: { storagePath: true },
    });

    const storagePath = writeTeacherPdfMirror(teacherId, docType, data);

    const row = await prisma.teacherDocument.upsert({
      where: { teacherId_docType: { teacherId, docType } },
      create: {
        teacherId,
        docType,
        fileName,
        mime: 'application/pdf',
        data,
        storagePath,
      },
      update: {
        fileName,
        mime: 'application/pdf',
        data,
        storagePath,
      },
      select: {
        docType: true,
        fileName: true,
        uploadedAt: true,
        updatedAt: true,
      },
    });

    if (existing?.storagePath && existing.storagePath !== storagePath) {
      deleteUploadFile(existing.storagePath);
    }

    res.json(metaForType(docType, row));
  })
);

router.get(
  '/me/:docType/file',
  requireStaff,
  requireRole('TEACHER'),
  validateParams(docTypeParam),
  asyncHandler(async (req, res) => {
    const row = await prisma.teacherDocument.findUnique({
      where: {
        teacherId_docType: { teacherId: req.user.id, docType: req.params.docType },
      },
    });
    if (!row) throw notFound('لم يتم رفع هذا المستند بعد');
    sendPdf(res, row);
  })
);

router.delete(
  '/me/:docType',
  requireStaff,
  requireRole('TEACHER'),
  validateParams(docTypeParam),
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const { docType } = req.params;
    const existing = await prisma.teacherDocument.findUnique({
      where: { teacherId_docType: { teacherId, docType } },
      select: { id: true, storagePath: true },
    });
    if (!existing) throw notFound('لم يتم رفع هذا المستند بعد');

    await prisma.teacherDocument.delete({ where: { id: existing.id } });
    if (existing.storagePath) deleteUploadFile(existing.storagePath);

    res.json(metaForType(docType, null));
  })
);

// ---------- Admin ----------

router.get(
  '/admin',
  requireStaff,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const teachers = await prisma.user.findMany({
      where: { role: 'TEACHER', isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        teacherDocuments: {
          select: { docType: true, uploadedAt: true, fileName: true },
        },
      },
    });

    res.json({
      teachers: teachers.map((t) => {
        const byType = new Map(t.teacherDocuments.map((d) => [d.docType, d]));
        const documents = buildSlots(byType);
        const uploadedCount = documents.filter((d) => d.uploaded).length;
        return {
          id: t.id,
          name: t.name,
          email: t.email,
          uploadedCount,
          totalCount: TEACHER_DOC_TYPES.length,
          documents,
        };
      }),
      totalCount: TEACHER_DOC_TYPES.length,
    });
  })
);

router.get(
  '/admin/:teacherId',
  requireStaff,
  requireRole('ADMIN'),
  validateParams(teacherIdParam),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.user.findFirst({
      where: { id: req.params.teacherId, role: 'TEACHER' },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        teacherDocuments: {
          select: { docType: true, fileName: true, uploadedAt: true, updatedAt: true },
        },
      },
    });
    if (!teacher) throw notFound('المعلم غير موجود');

    const byType = new Map(teacher.teacherDocuments.map((d) => [d.docType, d]));
    const documents = buildSlots(byType);
    res.json({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      isActive: teacher.isActive,
      uploadedCount: documents.filter((d) => d.uploaded).length,
      totalCount: TEACHER_DOC_TYPES.length,
      documents,
    });
  })
);

router.get(
  '/admin/:teacherId/:docType/file',
  requireStaff,
  requireRole('ADMIN'),
  validateParams(teacherDocParam),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.user.findFirst({
      where: { id: req.params.teacherId, role: 'TEACHER' },
      select: { id: true },
    });
    if (!teacher) throw notFound('المعلم غير موجود');

    const row = await prisma.teacherDocument.findUnique({
      where: {
        teacherId_docType: {
          teacherId: req.params.teacherId,
          docType: req.params.docType,
        },
      },
    });
    if (!row) throw notFound('لم يتم رفع هذا المستند بعد');
    sendPdf(res, row);
  })
);

export default router;
