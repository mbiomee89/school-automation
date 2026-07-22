import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, idParam } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { conflict, notFound } from '../utils/errors.js';

const router = Router();

router.use(requireStaff);

const subjectSchema = z.object({
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const subjects = await prisma.subject.findMany({
      orderBy: { nameEn: 'asc' },
      include: { _count: { select: { assignments: true } } },
    });
    res.json({ subjects });
  })
);

router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(subjectSchema),
  asyncHandler(async (req, res) => {
    const subject = await prisma.subject.create({
      data: {
        nameAr: req.body.nameAr.trim(),
        nameEn: req.body.nameEn.trim(),
      },
    });
    res.status(201).json({ subject });
  })
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateParams(idParam),
  validateBody(subjectSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.subject.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Subject not found');

    const data = {};
    if (req.body.nameAr !== undefined) data.nameAr = req.body.nameAr.trim();
    if (req.body.nameEn !== undefined) data.nameEn = req.body.nameEn.trim();

    const subject = await prisma.subject.update({ where: { id: req.params.id }, data });
    res.json({ subject });
  })
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        _count: { select: { homework: true, weeklyPlans: true, assignments: true } },
      },
    });
    if (!subject) throw notFound('Subject not found');

    if (subject._count.homework + subject._count.weeklyPlans > 0) {
      throw conflict('Subject has homework or weekly plans and cannot be deleted');
    }

    await prisma.teacherAssignment.deleteMany({ where: { subjectId: id } });
    await prisma.subject.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
