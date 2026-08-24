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
import { toUtcMidnight, schoolHourRiyadh } from '../utils/dates.js';

const router = Router();

/** Late arrival recording is شؤون الطلاب (+ admin) only — not teachers. */
router.use(requireStaff, requireRole('STUDENT_AFFAIRS', 'ADMIN'));

const createSchema = z.object({
  studentId: z.string().min(1),
  classId: z.number().int().positive(),
  date: z.string().min(1),
  time: z.string().optional(),
  reason: z.string().optional().nullable(),
});

const updateSchema = z.object({
  time: z.string().optional(),
  reason: z.string().optional().nullable(),
});

const listQuery = z.object({
  classId: z.coerce.number().int().positive(),
  date: z.string().min(1),
});

function serialize(r) {
  return {
    id: r.id,
    studentId: r.studentId,
    studentName: r.student?.nameAr ?? r.studentName,
    classId: r.classId,
    date: toUtcMidnight(r.date).toISOString().slice(0, 10),
    time: r.time.toISOString(),
    reason: r.reason,
  };
}

router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const rows = await prisma.lateReport.findMany({
      where: { classId: req.query.classId, date },
      include: { student: { select: { id: true, nameAr: true, nameEn: true } } },
      orderBy: { time: 'asc' },
    });
    res.json({
      date: date.toISOString().slice(0, 10),
      lateReports: rows.map((r) =>
        serialize({ ...r, studentName: r.student.nameAr })
      ),
    });
  })
);

router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const { studentId, classId, reason } = req.body;
    const date = toUtcMidnight(req.body.date);
    const time = req.body.time ? new Date(req.body.time) : new Date();
    if (Number.isNaN(time.getTime())) throw badRequest('وقت غير صالح');
    const hour = schoolHourRiyadh(time);
    if (hour < 5 || hour > 22) {
      throw badRequest('وقت التأخر يجب أن يكون ضمن ساعات الدوام (5 صباحاً – 10 مساءً بتوقيت الرياض)');
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || !student.isActive) throw badRequest('Student not found or inactive');
    if (student.classId !== classId) throw badRequest('Student is not in this class');

    try {
      const row = await prisma.lateReport.create({
        data: {
          studentId,
          classId,
          date,
          time,
          reason: reason?.trim() || null,
          recordedBy: req.user.id,
        },
        include: { student: { select: { id: true, nameAr: true, nameEn: true } } },
      });
      res.status(201).json({ lateReport: serialize({ ...row, studentName: row.student.nameAr }) });
    } catch (err) {
      if (err?.code === 'P2002') {
        throw conflict('A late report already exists for this student on this date');
      }
      throw err;
    }
  })
);

router.patch(
  '/:id',
  validateParams(idParam),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.lateReport.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Late report not found');

    const data = {};
    if (req.body.time !== undefined) {
      const time = new Date(req.body.time);
      if (Number.isNaN(time.getTime())) throw badRequest('وقت غير صالح');
      const hour = schoolHourRiyadh(time);
      if (hour < 5 || hour > 22) {
        throw badRequest('وقت التأخر يجب أن يكون ضمن ساعات الدوام (5 صباحاً – 10 مساءً بتوقيت الرياض)');
      }
      data.time = time;
    }
    if (req.body.reason !== undefined) {
      data.reason = req.body.reason?.trim() || null;
    }

    const row = await prisma.lateReport.update({
      where: { id: req.params.id },
      data,
      include: { student: { select: { id: true, nameAr: true, nameEn: true } } },
    });
    res.json({ lateReport: serialize({ ...row, studentName: row.student.nameAr }) });
  })
);

router.delete(
  '/:id',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const existing = await prisma.lateReport.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Late report not found');

    await prisma.lateReport.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
