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
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { toUtcMidnight } from '../utils/dates.js';

const router = Router();

router.use(requireStaff, requireRole('ADMIN', 'STUDENT_AFFAIRS', 'COUNSELOR'));

const listQuery = z.object({
  date: z.string().min(1),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});

const reviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().optional().nullable(),
});

function serialize(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.student?.nameAr ?? null,
    classId: row.classId,
    className: row.class?.name ?? null,
    date: toUtcMidnight(row.date).toISOString().slice(0, 10),
    leaveTime: row.leaveTime.toISOString(),
    reason: row.reason,
    pickupName: row.pickupName,
    pickupRelation: row.pickupRelation,
    pickupPhone: row.pickupPhone,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    reviewerName: row.reviewer?.name ?? null,
  };
}

const includeRelations = {
  student: { select: { id: true, nameAr: true, nameEn: true } },
  class: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
};

/** GET /early-leave?date=&status= */
router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const where = { date };
    if (req.query.status) where.status = req.query.status;

    const rows = await prisma.earlyLeaveRequest.findMany({
      where,
      include: includeRelations,
      orderBy: [{ leaveTime: 'asc' }, { requestedAt: 'asc' }],
    });

    res.json({
      date: date.toISOString().slice(0, 10),
      items: rows.map(serialize),
    });
  })
);

/** PATCH /early-leave/:id/review */
router.patch(
  '/:id/review',
  validateParams(idParam),
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.earlyLeaveRequest.findUnique({
      where: { id: req.params.id },
      include: includeRelations,
    });
    if (!existing) throw notFound('طلب الاستئذان غير موجود');
    if (existing.status !== 'PENDING') {
      throw conflict('تمت مراجعة هذا الطلب مسبقاً أو أُلغي');
    }

    const decision = req.body.decision;
    const note =
      typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim() : null;

    if (decision === 'REJECTED' && !note) {
      throw badRequest('سبب الرفض مطلوب');
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.earlyLeaveRequest.updateMany({
        where: { id: existing.id, status: 'PENDING' },
        data: {
          status: decision,
          reviewedBy: req.user.id,
          reviewedAt: now,
          reviewNote: note,
        },
      });
      if (result.count === 0) {
        throw conflict('تمت مراجعة هذا الطلب مسبقاً أو أُلغي');
      }
      return tx.earlyLeaveRequest.findUnique({
        where: { id: existing.id },
        include: includeRelations,
      });
    });

    res.json({ item: serialize(updated) });
  })
);

export default router;
