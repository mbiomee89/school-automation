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
import { toUtcMidnight, schoolDateOnlyStr } from '../utils/dates.js';
import {
  createEarlyLeaveRecord,
  earlyLeaveInclude,
  parseEarlyLeaveFields,
  serializeEarlyLeaveStaff,
} from '../services/earlyLeave.js';

const router = Router();

router.use(requireStaff);

const listQuery = z.object({
  date: z.string().min(1),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});

const reviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().optional().nullable(),
});

const staffCreateSchema = z.object({
  studentId: z.string().min(1),
  /** Ignored — server always uses school today. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  leaveTime: z.string().min(1),
  reason: z.string().min(1),
  pickupName: z.string().min(1),
  pickupRelation: z.string().min(1),
  pickupPhone: z.string().min(1),
});

const REVIEW_ROLES = ['ADMIN', 'STUDENT_AFFAIRS', 'COUNSELOR'];
const LIST_ROLES = ['ADMIN', 'STUDENT_AFFAIRS', 'COUNSELOR', 'SECURITY_GUARD'];
const CREATE_ROLES = ['ADMIN', 'STUDENT_AFFAIRS', 'SECURITY_GUARD'];

/** GET /early-leave/pending-count — badge/notification for staff shell + admin hub */
router.get(
  '/pending-count',
  requireRole(...REVIEW_ROLES),
  asyncHandler(async (_req, res) => {
    const count = await prisma.earlyLeaveRequest.count({
      where: { status: 'PENDING' },
    });
    res.json({ count });
  })
);

/** GET /early-leave?date=&status= */
router.get(
  '/',
  requireRole(...LIST_ROLES),
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const where = { date };
    if (req.query.status) where.status = req.query.status;

    const rows = await prisma.earlyLeaveRequest.findMany({
      where,
      include: earlyLeaveInclude,
      orderBy: [{ leaveTime: 'asc' }, { requestedAt: 'asc' }],
    });

    res.json({
      date: date.toISOString().slice(0, 10),
      items: rows.map(serializeEarlyLeaveStaff),
    });
  })
);

/** POST /early-leave — staff register when parent did not request */
router.post(
  '/',
  requireRole(...CREATE_ROLES),
  validateBody(staffCreateSchema),
  asyncHandler(async (req, res) => {
    const fields = parseEarlyLeaveFields(req.body);
    const row = await createEarlyLeaveRecord({
      studentId: req.body.studentId,
      dateStr: schoolDateOnlyStr(),
      leaveTimeRaw: req.body.leaveTime,
      ...fields,
      todayOnly: true,
      createdById: req.user.id,
      autoApprove: true,
    });
    res.status(201).json({ item: serializeEarlyLeaveStaff(row) });
  })
);

/** PATCH /early-leave/:id/review */
router.patch(
  '/:id/review',
  requireRole(...REVIEW_ROLES),
  validateParams(idParam),
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.earlyLeaveRequest.findUnique({
      where: { id: req.params.id },
      include: earlyLeaveInclude,
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
          ...(decision === 'REJECTED' ? { activeSlotKey: null } : {}),
        },
      });
      if (result.count === 0) {
        throw conflict('تمت مراجعة هذا الطلب مسبقاً أو أُلغي');
      }
      return tx.earlyLeaveRequest.findUnique({
        where: { id: existing.id },
        include: earlyLeaveInclude,
      });
    });

    res.json({ item: serializeEarlyLeaveStaff(updated) });
  })
);

export default router;
