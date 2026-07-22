import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  idParam,
} from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { conflict, notFound } from '../utils/errors.js';
import { toUtcMidnight } from '../utils/dates.js';

const router = Router();

router.use(requireStaff, requireRole('COUNSELOR', 'ADMIN'));

const listQuery = z.object({
  status: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  q: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const reviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().optional().nullable(),
});

function serialize(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.student.nameAr,
    className: row.class.name,
    absenceDate: toUtcMidnight(row.date).toISOString().slice(0, 10),
    reasonText: row.absenceReason ?? '',
    attachments: row.absenceAttachmentUrl ? [row.absenceAttachmentUrl] : [],
    status: row.reasonStatus,
    submittedAt: row.reasonSubmittedAt?.toISOString() ?? row.createdAt.toISOString(),
    reviewedAt: row.reasonReviewedAt?.toISOString() ?? null,
    reviewerName: row.reasonReviewer?.name ?? null,
    counselorNote: null,
  };
}

/** GET /absence-reasons?status=PENDING_REVIEW */
router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const where = {
      absenceReason: { not: null },
      reasonStatus: req.query.status ?? 'PENDING_REVIEW',
    };

    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = toUtcMidnight(req.query.from);
      if (req.query.to) where.date.lte = toUtcMidnight(req.query.to);
    }

    if (req.query.q) {
      const q = req.query.q.trim();
      where.OR = [
        { student: { nameAr: { contains: q } } },
        { student: { nameEn: { contains: q } } },
        { studentId: { contains: q } },
      ];
    }

    const rows = await prisma.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, nameAr: true, nameEn: true } },
        class: { select: { id: true, name: true } },
        reasonReviewer: { select: { id: true, name: true } },
      },
      orderBy: [{ reasonSubmittedAt: 'desc' }, { date: 'desc' }],
    });

    // Filter out NONE accidentally if status not set tightly
    const items = rows
      .filter((r) => r.reasonStatus !== 'NONE')
      .map(serialize);

    res.json({ items });
  })
);

/** PATCH /absence-reasons/:id/review — :id is Attendance id */
router.patch(
  '/:id/review',
  validateParams(idParam),
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.attendance.findUnique({
      where: { id: req.params.id },
      include: {
        student: { select: { id: true, nameAr: true, nameEn: true } },
        class: { select: { id: true, name: true } },
        reasonReviewer: { select: { id: true, name: true } },
      },
    });
    if (!existing) throw notFound('Absence reason not found');
    if (existing.reasonStatus !== 'PENDING_REVIEW') {
      throw conflict('This reason has already been reviewed');
    }

    const decision = req.body.decision;
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      return tx.attendance.update({
        where: { id: existing.id },
        data: {
          reasonStatus: decision,
          reasonReviewedBy: req.user.id,
          reasonReviewedAt: now,
          // Product rule: approval excuses the absence
          ...(decision === 'APPROVED' ? { status: 'EXCUSED' } : {}),
        },
        include: {
          student: { select: { id: true, nameAr: true, nameEn: true } },
          class: { select: { id: true, name: true } },
          reasonReviewer: { select: { id: true, name: true } },
        },
      });
    });

    res.json({ item: serialize(updated) });
  })
);

export default router;
