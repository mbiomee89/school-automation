import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireStaff, requireRole, requireTeacherAssignment } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/errors.js';
import { toUtcMidnight } from '../utils/dates.js';

const router = Router();

router.use(requireStaff);

const bulkSchema = z.object({
  classId: z.number().int().positive(),
  date: z.string().min(1),
  period: z.string().min(1),
  marks: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(['PRESENT', 'ABSENT', 'EXCUSED']),
      })
    )
    .min(1),
});

const listQuery = z.object({
  classId: z.coerce.number().int().positive(),
  date: z.string().min(1),
  period: z.string().optional(),
});

function dateOnlyIso(d) {
  return toUtcMidnight(d).toISOString().slice(0, 10);
}

/** GET /attendance?classId=&date=&period= */
router.get(
  '/',
  validateQuery(listQuery),
  requireTeacherAssignment({ classIdParam: 'classId' }),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const where = {
      classId: req.query.classId,
      date,
    };
    if (req.query.period) where.period = req.query.period;

    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, nameAr: true, nameEn: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { studentId: 'asc' }],
    });

    const savedAt = records[0]?.updatedAt?.toISOString() ?? records[0]?.createdAt?.toISOString() ?? null;

    res.json({
      date: dateOnlyIso(date),
      period: req.query.period ?? null,
      savedAt,
      attendance: records.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.student.nameAr,
        classId: r.classId,
        period: r.period,
        status: r.status,
        recordedAt: (r.updatedAt ?? r.createdAt).toISOString(),
        reasonStatus: r.reasonStatus,
      })),
    });
  })
);

/**
 * POST /attendance — bulk upsert for one class/date/period.
 * WhatsApp enqueue deferred to Phase 4 (skipped here).
 */
router.post(
  '/',
  requireRole('TEACHER', 'ADMIN'),
  validateBody(bulkSchema),
  requireTeacherAssignment({ classIdParam: 'classId' }),
  asyncHandler(async (req, res) => {
    const { classId, period } = req.body;
    const date = toUtcMidnight(req.body.date);
    const marks = req.body.marks;

    const studentIds = [...new Set(marks.map((m) => m.studentId))];
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, classId: true, isActive: true },
    });
    const byId = new Map(students.map((s) => [s.id, s]));

    for (const id of studentIds) {
      const s = byId.get(id);
      if (!s || !s.isActive) throw badRequest(`Student ${id} is inactive or missing`);
      if (s.classId !== classId) {
        throw badRequest(`Student ${id} is not in class ${classId}`);
      }
    }

    const saved = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const mark of marks) {
        const row = await tx.attendance.upsert({
          where: {
            studentId_date_period: {
              studentId: mark.studentId,
              date,
              period,
            },
          },
          create: {
            studentId: mark.studentId,
            classId,
            date,
            period,
            status: mark.status,
            recordedBy: req.user.id,
          },
          update: {
            status: mark.status,
            recordedBy: req.user.id,
            classId,
          },
        });
        results.push(row);
      }
      return results;
    });

    res.status(201).json({
      date: dateOnlyIso(date),
      period,
      classId,
      savedAt: new Date().toISOString(),
      count: saved.length,
      attendance: saved.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        status: r.status,
      })),
    });
  })
);

export default router;
