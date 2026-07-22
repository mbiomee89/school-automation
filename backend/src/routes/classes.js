import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, validateQuery, idParam } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { conflict, notFound } from '../utils/errors.js';

const router = Router();

router.use(requireStaff);

const classSchema = z.object({
  name: z.string().min(1),
  gradeLevel: z.string().min(1),
  section: z.string().optional().nullable(),
  academicYear: z.string().min(1),
});

const listQuery = z.object({
  academicYear: z.string().optional(),
});

router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.academicYear) where.academicYear = req.query.academicYear;

    const classes = await prisma.class.findMany({
      where,
      orderBy: [{ academicYear: 'desc' }, { gradeLevel: 'asc' }, { section: 'asc' }],
      include: {
        _count: {
          select: {
            students: true,
            assignments: true,
            attendance: true,
            homework: true,
            lateReports: true,
            weeklyPlans: true,
            enrollments: true,
          },
        },
      },
    });
    res.json({ classes });
  })
);

router.get(
  '/:id',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const cls = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          include: {
            teacher: { select: { id: true, name: true, email: true } },
            subject: true,
          },
        },
        _count: { select: { students: true } },
      },
    });
    if (!cls) throw notFound('Class not found');
    res.json({ class: cls });
  })
);

router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(classSchema),
  asyncHandler(async (req, res) => {
    const cls = await prisma.class.create({
      data: {
        name: req.body.name.trim(),
        gradeLevel: req.body.gradeLevel.trim(),
        section: req.body.section?.trim() || null,
        academicYear: req.body.academicYear.trim(),
      },
    });
    res.status(201).json({ class: cls });
  })
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateParams(idParam),
  validateBody(classSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Class not found');

    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.gradeLevel !== undefined) data.gradeLevel = req.body.gradeLevel.trim();
    if (req.body.section !== undefined) data.section = req.body.section?.trim() || null;
    if (req.body.academicYear !== undefined) data.academicYear = req.body.academicYear.trim();

    const cls = await prisma.class.update({ where: { id: req.params.id }, data });
    res.json({ class: cls });
  })
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const counts = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            attendance: true,
            homework: true,
            lateReports: true,
            weeklyPlans: true,
            enrollments: true,
          },
        },
      },
    });
    if (!counts) throw notFound('الفصل غير موجود');

    const blockers = [];
    if (counts._count.students > 0) blockers.push(`${counts._count.students} طالباً ملتحقاً حالياً`);
    if (counts._count.enrollments > 0) blockers.push(`${counts._count.enrollments} سجل التحاق سابق`);
    if (counts._count.attendance > 0) blockers.push(`${counts._count.attendance} سجل حضور`);
    if (counts._count.homework > 0) blockers.push(`${counts._count.homework} واجب`);
    if (counts._count.lateReports > 0) blockers.push(`${counts._count.lateReports} تأخر`);
    if (counts._count.weeklyPlans > 0) blockers.push(`${counts._count.weeklyPlans} خطة أسبوعية`);

    if (blockers.length > 0) {
      throw conflict(
        `لا يمكن حذف هذا الفصل لوجود سجلات مرتبطة به: ${blockers.join('، ')}. إن وُجد طلاب حالياً فأزلهم أولاً من الفصل. السجلات التاريخية تُحفظ عمداً ولا يُحذف الفصل.`
      );
    }

    await prisma.teacherAssignment.deleteMany({ where: { classId: id } });
    await prisma.class.delete({ where: { id } });
    res.status(204).send();
  })
);

/**
 * Bulk-unassign every student currently in this class (Student.classId = null),
 * closing their open ClassEnrollment rows. Does NOT delete students or their
 * history — it only clears the "current class" pointer so the class can
 * potentially be deleted afterward (if it also has no historical records) or
 * so the roster can be rebuilt from scratch. Applies to all students referencing
 * this class, active or inactive, since Class deletion counts both.
 */
router.post(
  '/:id/remove-all-students',
  requireRole('ADMIN'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) throw notFound('Class not found');

    const result = await prisma.$transaction(async (tx) => {
      const students = await tx.student.findMany({
        where: { classId: id },
        select: { id: true },
      });

      if (students.length === 0) {
        return { unassigned: 0 };
      }

      const now = new Date();
      await tx.classEnrollment.updateMany({
        where: { classId: id, endDate: null },
        data: { endDate: now },
      });

      await tx.student.updateMany({
        where: { classId: id },
        data: { classId: null },
      });

      return { unassigned: students.length };
    });

    res.json(result);
  })
);

export default router;
