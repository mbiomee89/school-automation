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
import { badRequest, notFound } from '../utils/errors.js';
import { toUtcMidnight } from '../utils/dates.js';

const router = Router();

router.use(requireStaff);

const createSchema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  date: z.string().min(1),
  description: z.string().min(1),
  dueDate: z.string().optional().nullable(),
});

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  dueDate: z.string().optional().nullable(),
});

const listQuery = z.object({
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  date: z.string().min(1),
});

function serialize(h) {
  return {
    id: h.id,
    classId: h.classId,
    subjectId: h.subjectId,
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

    const rows = await prisma.homework.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    const date = toUtcMidnight(req.body.date);
    let dueDate = null;
    if (req.body.dueDate) {
      dueDate = toUtcMidnight(req.body.dueDate);
      if (dueDate.getTime() < date.getTime()) {
        throw badRequest('تاريخ الاستحقاق يجب أن يكون في يوم الواجب أو بعده');
      }
    }

    const row = await prisma.homework.create({
      data: {
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        teacherId: req.user.id,
        date,
        description: req.body.description.trim(),
        dueDate,
      },
    });
    res.status(201).json({ homework: serialize(row) });
  })
);

router.patch(
  '/:id',
  requireRole('TEACHER', 'ADMIN'),
  validateParams(idParam),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.homework.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Homework not found');

    if (req.user.role === 'TEACHER' && existing.teacherId !== req.user.id) {
      const assignment = await prisma.teacherAssignment.findFirst({
        where: {
          teacherId: req.user.id,
          classId: existing.classId,
          subjectId: existing.subjectId,
        },
      });
      if (!assignment) throw badRequest('Not assigned to this class/subject');
    }

    const data = {};
    if (req.body.description !== undefined) data.description = req.body.description.trim();
    if (req.body.dueDate !== undefined) {
      if (req.body.dueDate) {
        const due = toUtcMidnight(req.body.dueDate);
        if (due.getTime() < toUtcMidnight(existing.date).getTime()) {
          throw badRequest('تاريخ الاستحقاق يجب أن يكون في يوم الواجب أو بعده');
        }
        data.dueDate = due;
      } else {
        data.dueDate = null;
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
    if (!existing) throw notFound('Homework not found');

    if (req.user.role === 'TEACHER' && existing.teacherId !== req.user.id) {
      const assignment = await prisma.teacherAssignment.findFirst({
        where: {
          teacherId: req.user.id,
          classId: existing.classId,
          subjectId: existing.subjectId,
        },
      });
      if (!assignment) throw badRequest('Not assigned to this class/subject');
    }

    await prisma.homework.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
