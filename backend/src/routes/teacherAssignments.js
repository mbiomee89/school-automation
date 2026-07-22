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

const syncSchema = z.object({
  teacherId: z.number().int().positive(),
  /** Classes in scope — unchecked cells inside these classes are removed. */
  classIds: z.array(z.number().int().positive()).min(1),
  /** Desired (classId, subjectId) pairs for this teacher. */
  items: z.array(
    z.object({
      classId: z.number().int().positive(),
      subjectId: z.number().int().positive(),
    })
  ),
});

const listQuery = z.object({
  teacherId: z.coerce.number().int().positive().optional(),
  classId: z.coerce.number().int().positive().optional(),
});

const assignmentInclude = {
  teacher: { select: { id: true, name: true, email: true } },
  class: true,
  subject: true,
};

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
      include: assignmentInclude,
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
      include: assignmentInclude,
    });
    res.status(201).json({ assignment });
  })
);

/**
 * POST /teacher-assignments/sync
 * Replace a teacher's assignments for the given classIds with `items`
 * (create missing pairs, delete unchecked pairs in scope).
 */
router.post(
  '/sync',
  requireRole('ADMIN'),
  validateBody(syncSchema),
  asyncHandler(async (req, res) => {
    const { teacherId, classIds, items } = req.body;

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'TEACHER' || !teacher.isActive) {
      throw badRequest('teacherId must be an active TEACHER user');
    }

    const classIdSet = new Set(classIds);
    for (const item of items) {
      if (!classIdSet.has(item.classId)) {
        throw badRequest('كل صف في التوزيع يجب أن يكون ضمن classIds');
      }
    }

    const [classes, subjects] = await Promise.all([
      prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true } }),
      items.length
        ? prisma.subject.findMany({
            where: { id: { in: [...new Set(items.map((i) => i.subjectId))] } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);
    if (classes.length !== classIds.length) throw badRequest('أحد الفصول غير موجود');
    if (items.length) {
      const subjectIds = new Set(items.map((i) => i.subjectId));
      if (subjects.length !== subjectIds.size) {
        throw badRequest('إحدى المواد غير موجودة');
      }
    }

    const pairKey = (classId, subjectId) => `${classId}:${subjectId}`;
    const desired = new Map();
    for (const item of items) {
      desired.set(pairKey(item.classId, item.subjectId), item);
    }

    const existing = await prisma.teacherAssignment.findMany({
      where: { teacherId, classId: { in: classIds } },
    });
    const existingByKey = new Map(existing.map((a) => [pairKey(a.classId, a.subjectId), a]));

    const toCreate = [...desired.values()].filter(
      (item) => !existingByKey.has(pairKey(item.classId, item.subjectId))
    );
    const toDelete = existing.filter((a) => !desired.has(pairKey(a.classId, a.subjectId)));

    await prisma.$transaction(async (tx) => {
      if (toDelete.length) {
        await tx.teacherAssignment.deleteMany({
          where: { id: { in: toDelete.map((a) => a.id) } },
        });
      }
      for (const item of toCreate) {
        await tx.teacherAssignment.create({
          data: { teacherId, classId: item.classId, subjectId: item.subjectId },
        });
      }
    });

    const assignments = await prisma.teacherAssignment.findMany({
      where: { teacherId },
      include: assignmentInclude,
      orderBy: { id: 'asc' },
    });

    res.json({
      created: toCreate.length,
      removed: toDelete.length,
      assignments,
    });
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
