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
import { requireStaff, requireRole, requireTeacherAssignment } from '../middleware/auth.js';
import { badRequest, notFound, forbidden } from '../utils/errors.js';
import { toUtcMidnight, schoolDateOnlyStr, isCurrentSchoolWeekEditable } from '../utils/dates.js';

const router = Router();

router.use(requireStaff);

const NO_HOMEWORK_LABEL = 'لا يوجد واجب';

const createSchema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  date: z.string().min(1),
  period: z.string().regex(/^[1-6]$/).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  noHomework: z.boolean().optional(),
});

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  dueDate: z.string().optional().nullable(),
  noHomework: z.boolean().optional(),
});

const listQuery = z.object({
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  date: z.string().min(1),
  period: z.string().regex(/^[1-6]$/).optional(),
});

function assertCurrentWeekEditable(dateStr) {
  if (!isCurrentSchoolWeekEditable(dateStr, schoolDateOnlyStr())) {
    throw forbidden('لا يمكن تعديل واجبات الأسابيع السابقة — للعرض فقط');
  }
}

function serialize(h) {
  return {
    id: h.id,
    classId: h.classId,
    subjectId: h.subjectId,
    period: h.period || null,
    noHomework: Boolean(h.noHomework),
    description: h.description,
    date: toUtcMidnight(h.date).toISOString().slice(0, 10),
    dueDate: h.dueDate ? toUtcMidnight(h.dueDate).toISOString().slice(0, 10) : null,
    createdAt: h.createdAt.toISOString(),
  };
}

router.get(
  '/',
  validateQuery(listQuery),
  requireTeacherAssignment({ classIdParam: 'classId', subjectIdParam: 'subjectId' }),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const where = {
      classId: req.query.classId,
      subjectId: req.query.subjectId,
      date,
    };
    if (req.query.period) where.period = req.query.period;

    const rows = await prisma.homework.findMany({
      where,
      orderBy: [{ period: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ date: date.toISOString().slice(0, 10), homework: rows.map(serialize) });
  })
);

router.post(
  '/',
  requireRole('TEACHER', 'ADMIN'),
  validateBody(createSchema),
  requireTeacherAssignment({ classIdParam: 'classId', subjectIdParam: 'subjectId' }),
  asyncHandler(async (req, res) => {
    assertCurrentWeekEditable(req.body.date);
    const date = toUtcMidnight(req.body.date);
    const period = req.body.period ? String(req.body.period) : '';
    const noHomework = Boolean(req.body.noHomework);
    const description = noHomework
      ? NO_HOMEWORK_LABEL
      : String(req.body.description || '').trim();
    if (!noHomework && !description) throw badRequest('وصف الواجب مطلوب');

    let dueDate = null;
    if (!noHomework && req.body.dueDate) {
      dueDate = toUtcMidnight(req.body.dueDate);
      if (dueDate.getTime() < date.getTime()) {
        throw badRequest('تاريخ الاستحقاق يجب أن يكون في يوم الواجب أو بعده');
      }
    }

    const existing = await prisma.homework.findFirst({
      where: {
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        date,
        period,
      },
    });

    const data = {
      teacherId: req.user.id,
      noHomework,
      description,
      dueDate: noHomework ? null : dueDate,
    };

    let row;
    if (existing) {
      row = await prisma.homework.update({
        where: { id: existing.id },
        data,
      });
    } else {
      row = await prisma.homework.create({
        data: {
          classId: req.body.classId,
          subjectId: req.body.subjectId,
          date,
          period,
          ...data,
        },
      });
    }

    res.status(existing ? 200 : 201).json({ homework: serialize(row) });
  })
);

router.patch(
  '/:id',
  requireRole('TEACHER', 'ADMIN'),
  validateParams(idParam),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.homework.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('الواجب غير موجود');
    if (req.user.role === 'TEACHER' && existing.teacherId !== req.user.id) {
      throw forbidden('لا يمكنك تعديل واجب معلم آخر');
    }
    assertCurrentWeekEditable(toUtcMidnight(existing.date).toISOString().slice(0, 10));

    const data = {};
    if (req.body.noHomework === true) {
      data.noHomework = true;
      data.description = NO_HOMEWORK_LABEL;
      data.dueDate = null;
    } else {
      if (req.body.noHomework === false) data.noHomework = false;
      if (req.body.description !== undefined) {
        const trimmed = req.body.description.trim();
        if (!trimmed) throw badRequest('وصف الواجب مطلوب');
        data.description = trimmed;
        data.noHomework = false;
      }
      if (req.body.dueDate !== undefined) {
        data.dueDate = req.body.dueDate ? toUtcMidnight(req.body.dueDate) : null;
      }
    }

    const row = await prisma.homework.update({ where: { id: req.params.id }, data });
    res.json({ homework: serialize(row) });
  })
);

router.delete(
  '/:id',
  requireRole('TEACHER', 'ADMIN'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const existing = await prisma.homework.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('الواجب غير موجود');
    if (req.user.role === 'TEACHER' && existing.teacherId !== req.user.id) {
      throw forbidden('لا يمكنك حذف واجب معلم آخر');
    }
    assertCurrentWeekEditable(toUtcMidnight(existing.date).toISOString().slice(0, 10));
    await prisma.homework.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
