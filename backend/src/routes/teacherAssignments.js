import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, validateQuery, idParam } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/errors.js';

const router = Router();

router.use(requireStaff);

const createSchema = z.object({
  teacherId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
});

const listQuery = z.object({
  teacherId: z.coerce.number().int().positive().optional(),
  classId: z.coerce.number().int().positive().optional(),
});

router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.teacherId) where.teacherId = req.query.teacherId;
    if (req.query.classId) where.classId = req.query.classId;

    // Teachers only see their own assignments unless admin
    if (req.user.role === 'TEACHER') {
      where.teacherId = req.user.id;
    }

    const assignments = await prisma.teacherAssignment.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        class: true,
        subject: true,
      },
      orderBy: { id: 'asc' },
    });
    res.json({ assignments });
  })
);

router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const { teacherId, classId, subjectId } = req.body;

    const [teacher, cls, subject] = await Promise.all([
      prisma.user.findUnique({ where: { id: teacherId } }),
      prisma.class.findUnique({ where: { id: classId } }),
      prisma.subject.findUnique({ where: { id: subjectId } }),
    ]);

    if (!teacher || teacher.role !== 'TEACHER' || !teacher.isActive) {
      throw badRequest('teacherId must be an active TEACHER user');
    }
    if (!cls) throw badRequest('classId not found');
    if (!subject) throw badRequest('subjectId not found');

    const assignment = await prisma.teacherAssignment.create({
      data: { teacherId, classId, subjectId },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        class: true,
        subject: true,
      },
    });
    res.status(201).json({ assignment });
  })
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const existing = await prisma.teacherAssignment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Assignment not found');
    await prisma.teacherAssignment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
