import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireStaff, requireRole, requireTeacherAssignment } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { isSaturdayUtc, toUtcMidnight } from '../utils/dates.js';

const router = Router();

router.use(requireStaff);

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

const lessonSchema = z
  .object({
    topics: z.string(),
    objectives: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .nullable();

const daysSchema = z.object({
  sunday: lessonSchema,
  monday: lessonSchema,
  tuesday: lessonSchema,
  wednesday: lessonSchema,
  thursday: lessonSchema,
});

const upsertSchema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  weekStart: z.string().min(1),
  days: daysSchema,
});

const listQuery = z.object({
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  weekStart: z.string().min(1),
});

function emptyDays() {
  return {
    sunday: null,
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
  };
}

function parseDays(topics) {
  try {
    const parsed = JSON.parse(topics);
    if (parsed && typeof parsed === 'object' && 'sunday' in parsed) {
      const days = emptyDays();
      for (const key of WEEKDAYS) {
        days[key] = parsed[key] ?? null;
      }
      return days;
    }
  } catch {
    /* legacy plain text */
  }
  return {
    ...emptyDays(),
    sunday: { topics, objectives: null, notes: null },
  };
}

function serialize(row) {
  return {
    id: row.id,
    classId: row.classId,
    subjectId: row.subjectId,
    weekStart: toUtcMidnight(row.weekStart).toISOString().slice(0, 10),
    days: parseDays(row.topics),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get(
  '/',
  validateQuery(listQuery),
  requireTeacherAssignment({ classIdParam: 'classId', subjectIdParam: 'subjectId' }),
  asyncHandler(async (req, res) => {
    const weekStart = toUtcMidnight(req.query.weekStart);
    if (!isSaturdayUtc(weekStart)) {
      throw badRequest('weekStart must be a Saturday (UTC)');
    }

    const row = await prisma.weeklyPlan.findUnique({
      where: {
        classId_subjectId_weekStart: {
          classId: req.query.classId,
          subjectId: req.query.subjectId,
          weekStart,
        },
      },
    });

    res.json({
      weekStart: weekStart.toISOString().slice(0, 10),
      weeklyPlan: row ? serialize(row) : null,
    });
  })
);

router.post(
  '/',
  requireRole('TEACHER', 'ADMIN'),
  validateBody(upsertSchema),
  requireTeacherAssignment({ classIdParam: 'classId', subjectIdParam: 'subjectId' }),
  asyncHandler(async (req, res) => {
    const weekStart = toUtcMidnight(req.body.weekStart);
    if (!isSaturdayUtc(weekStart)) {
      throw badRequest('weekStart must be a Saturday (UTC)');
    }

    const topics = JSON.stringify(req.body.days);

    const row = await prisma.weeklyPlan.upsert({
      where: {
        classId_subjectId_weekStart: {
          classId: req.body.classId,
          subjectId: req.body.subjectId,
          weekStart,
        },
      },
      create: {
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        teacherId: req.user.id,
        weekStart,
        topics,
      },
      update: {
        topics,
        teacherId: req.user.id,
      },
    });

    res.status(201).json({ weeklyPlan: serialize(row) });
  })
);

export default router;
