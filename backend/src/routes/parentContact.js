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
import { badRequest } from '../utils/errors.js';
import { addDaysToDateOnlyStr, toUtcMidnight } from '../utils/dates.js';
import {
  parentContactInclude,
  replyParentContact,
  serializeParentContact,
} from '../services/parentContact.js';

const router = Router();

router.use(requireStaff);
router.use(requireRole('ADMIN'));

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const listQuery = z.object({
  status: z.enum(['OPEN', 'CLOSED', 'all']).optional().default('OPEN'),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

const replySchema = z.object({
  replyBody: z.string().trim().min(1).max(2000),
});

/** GET /parent-contact/pending-count — all OPEN; ignores date filters. */
router.get(
  '/pending-count',
  asyncHandler(async (_req, res) => {
    const count = await prisma.parentContactMessage.count({
      where: { status: 'OPEN' },
    });
    res.json({ count });
  })
);

/** GET /parent-contact?status=&from=&to= — CANCELLED never returned. */
router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const status = req.query.status ?? 'OPEN';
    const from = req.query.from;
    const to = req.query.to;

    if (from && to && from > to) {
      throw badRequest('تاريخ البداية يجب أن يسبق تاريخ النهاية أو يساويه');
    }

    const where = {
      ...(status === 'all'
        ? { status: { in: ['OPEN', 'CLOSED'] } }
        : { status }),
    };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = toUtcMidnight(from);
      if (to) where.createdAt.lt = toUtcMidnight(addDaysToDateOnlyStr(to, 1));
    }

    const rows = await prisma.parentContactMessage.findMany({
      where,
      include: parentContactInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });

    res.json({ items: rows.map(serializeParentContact) });
  })
);

/** PATCH /parent-contact/:id/reply */
router.patch(
  '/:id/reply',
  validateParams(idParam),
  validateBody(replySchema),
  asyncHandler(async (req, res) => {
    const row = await replyParentContact(prisma, {
      id: req.params.id,
      replyBody: req.body.replyBody,
      repliedById: req.user.id,
    });
    res.json({ item: serializeParentContact(row) });
  })
);

export default router;
