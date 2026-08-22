import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, validateQuery, idParam } from '../middleware/validate.js';
import { requireStaff, requireRole, requireTeacherAssignment } from '../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { toUtcMidnight } from '../utils/dates.js';
import {
  weekStartSunday,
  weekStartSaturdayFromDate,
} from '../services/timetableImport.js';

const router = Router();

router.use(requireStaff);

const cellUpsertSchema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  date: z.string().min(1),
  period: z.string().regex(/^[1-6]$/),
  title: z.string().min(1),
});

const listCellQuery = z.object({
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  date: z.string().min(1),
  period: z.string().regex(/^[1-6]$/),
});

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function assertCurrentWeekEditable(dateStr) {
  if (weekStartSunday(dateStr) !== weekStartSunday(todayLocal())) {
    throw forbidden('لا يمكن تعديل خطط الأسابيع السابقة — للعرض فقط');
  }
}

function serializeCell(row) {
  return {
    id: row.id,
    classId: row.classId,
    subjectId: row.subjectId,
    date: row.date ? toUtcMidnight(row.date).toISOString().slice(0, 10) : null,
    period: row.period || null,
    title: row.title || '',
    weekStart: toUtcMidnight(row.weekStart).toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** GET /weekly-plans?classId=&subjectId=&date=&period= */
router.get(
  '/',
  validateQuery(listCellQuery),
  requireTeacherAssignment({ classIdParam: 'classId', subjectIdParam: 'subjectId' }),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const row = await prisma.weeklyPlan.findFirst({
      where: {
        classId: req.query.classId,
        subjectId: req.query.subjectId,
        date,
        period: String(req.query.period),
      },
    });
    res.json({ weeklyPlan: row ? serializeCell(row) : null });
  })
);

/** POST /weekly-plans — upsert عنوان الدرس for one timetable cell */
router.post(
  '/',
  requireRole('TEACHER', 'ADMIN'),
  validateBody(cellUpsertSchema),
  requireTeacherAssignment({ classIdParam: 'classId', subjectIdParam: 'subjectId' }),
  asyncHandler(async (req, res) => {
    assertCurrentWeekEditable(req.body.date);
    const date = toUtcMidnight(req.body.date);
    const weekStart = toUtcMidnight(weekStartSaturdayFromDate(req.body.date));
    const title = String(req.body.title).trim();
    if (!title) throw badRequest('عنوان الدرس مطلوب');

    const existing = await prisma.weeklyPlan.findFirst({
      where: {
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        date,
        period: req.body.period,
      },
    });

    const data = {
      teacherId: req.user.id,
      title,
      topics: '',
      objectives: null,
      notes: null,
      weekStart,
    };

    let row;
    if (existing) {
      row = await prisma.weeklyPlan.update({ where: { id: existing.id }, data });
    } else {
      row = await prisma.weeklyPlan.create({
        data: {
          classId: req.body.classId,
          subjectId: req.body.subjectId,
          date,
          period: req.body.period,
          ...data,
        },
      });
    }

    res.status(existing ? 200 : 201).json({ weeklyPlan: serializeCell(row) });
  })
);

router.delete(
  '/:id',
  requireRole('TEACHER', 'ADMIN'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const existing = await prisma.weeklyPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('الخطة غير موجودة');
    if (req.user.role === 'TEACHER' && existing.teacherId !== req.user.id) {
      throw forbidden('لا يمكنك حذف خطة معلم آخر');
    }
    if (existing.date) {
      assertCurrentWeekEditable(toUtcMidnight(existing.date).toISOString().slice(0, 10));
    } else if (existing.weekStart) {
      // legacy week row — allow delete without Sunday-week check
    }
    await prisma.weeklyPlan.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

export default router;
