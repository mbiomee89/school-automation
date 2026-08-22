import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, validateQuery, idParam } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/errors.js';
import { uploadTimetableFile } from '../middleware/upload.js';
import { parseTimetableUpload } from '../services/timetablePdfParse.js';
import {
  applyTimetableImport,
  getTeacherDaySchedule,
  getTeacherWeekSchedule,
  resolveTimetableSlots,
  weekStartSunday,
} from '../services/timetableImport.js';

const router = Router();

router.use(requireStaff);

const createSchema = z.object({
  teacherId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
});

const syncSchema = z.object({
  teacherId: z.number().int().positive(),
  classIds: z.array(z.number().int().positive()).min(1),
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

const todayQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const weekQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const assignmentInclude = {
  teacher: { select: { id: true, name: true, email: true } },
  class: true,
  subject: true,
};

function pairKey(classId, subjectId) {
  return `${classId}:${subjectId}`;
}

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * GET /teacher-assignments/today?date=YYYY-MM-DD
 * Today's timetable slots for the logged-in teacher (ordered by period).
 */
router.get(
  '/today',
  validateQuery(todayQuery),
  asyncHandler(async (req, res) => {
    const date = req.query.date || todayLocal();
    if (req.user.role !== 'TEACHER') {
      return res.json({ date, dayOfWeek: null, academicYear: null, slots: [] });
    }
    const schedule = await getTeacherDaySchedule(req.user.id, date);
    res.json(schedule);
  })
);

/**
 * GET /teacher-assignments/week?date=YYYY-MM-DD
 * Sun–Thu grid for the week containing date (teacher only).
 */
router.get(
  '/week',
  validateQuery(weekQuery),
  asyncHandler(async (req, res) => {
    const date = req.query.date || todayLocal();
    if (req.user.role !== 'TEACHER') {
      return res.json({
        weekStart: weekStartSunday(date),
        weekEnd: null,
        academicYear: null,
        editable: false,
        days: [],
      });
    }
    const schedule = await getTeacherWeekSchedule(req.user.id, date);
    res.json(schedule);
  })
);

/**
 * POST /teacher-assignments/import-timetable?dryRun=1
 * Upload aSc PDF — always prefer dryRun first so admin can map short names → full names.
 */
router.post(
  '/import-timetable',
  requireRole('ADMIN'),
  (req, res, next) => {
    uploadTimetableFile(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('ارفع ملف الجدول (PDF أو Excel)');
    const dryRun =
      String(req.query.dryRun || '') === '1' ||
      String(req.query.dryRun || '') === 'true' ||
      req.query.dryRun === undefined; // default to preview/mapping flow

    const parsed = await parseTimetableUpload(req.file);
    if (!parsed.slots.length) {
      throw badRequest(
        parsed.errors?.[0]?.error ||
          'لم يُستخرج أي درس من الملف. جرّب «teachers table.pdf» من aSc Timetables.'
      );
    }

    if (dryRun) {
      const preview = await resolveTimetableSlots(parsed.slots, { createMissingSubjects: false });
      return res.json({
        dryRun: true,
        view: parsed.view,
        fileName: req.file.originalname,
        parseErrors: parsed.errors,
        academicYear: preview.academicYear,
        total: preview.total,
        matched: preview.matched,
        unresolved: preview.unresolved,
        unmatchedTeachers: preview.unmatchedTeachers,
        unmatchedClasses: preview.unmatchedClasses,
        unmatchedSubjects: preview.unmatchedSubjects,
        sample: preview.sample,
        teacherMappings: preview.teacherMappings,
        classMappings: preview.classMappings,
        subjectMappings: preview.subjectMappings,
        teacherOptions: preview.teacherOptions,
        classOptions: preview.classOptions,
        subjectOptions: preview.subjectOptions,
        slots: preview.slots,
      });
    }

    const result = await applyTimetableImport(parsed.slots);
    res.json({
      dryRun: false,
      view: parsed.view,
      fileName: req.file.originalname,
      parseErrors: parsed.errors,
      ...result,
    });
  })
);

const confirmSchema = z.object({
  slots: z
    .array(
      z.object({
        teacherName: z.string().min(1),
        classLabel: z.string().min(1),
        subjectName: z.string().min(1),
        dayOfWeek: z.enum(['SUN', 'MON', 'TUE', 'WED', 'THU']),
        period: z.union([z.string(), z.number()]).transform(String),
      })
    )
    .min(1),
  teacherMap: z.record(z.string(), z.number().int().positive()).default({}),
  /** Timetable short names → create new TEACHER accounts (edit full name later in staff). */
  createTeachers: z.array(z.string().min(1)).default([]),
  classMap: z.record(z.string(), z.number().int().positive()).default({}),
  subjectMap: z.record(z.string(), z.number().int().positive()).default({}),
  fileName: z.string().optional(),
  view: z.string().optional(),
  academicYear: z.string().optional(),
});

/**
 * POST /teacher-assignments/import-timetable/confirm
 * Apply parsed slots after admin finishes the name-mapping grid.
 */
router.post(
  '/import-timetable/confirm',
  requireRole('ADMIN'),
  validateBody(confirmSchema),
  asyncHandler(async (req, res) => {
    const {
      slots,
      teacherMap,
      createTeachers,
      classMap,
      subjectMap,
      fileName,
      view,
      academicYear,
    } = req.body;
    const result = await applyTimetableImport(slots, {
      academicYear,
      teacherMap,
      createTeachers,
      classMap,
      subjectMap,
    });
    res.json({
      dryRun: false,
      view: view || null,
      fileName: fileName || 'timetable',
      ...result,
    });
  })
);

router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.teacherId) where.teacherId = req.query.teacherId;
    if (req.query.classId) where.classId = req.query.classId;

    if (req.user.role === 'TEACHER') {
      where.teacherId = req.user.id;
    } else if (req.user.role === 'COUNSELOR') {
      if (!req.query.teacherId && !req.query.classId) {
        return res.json({ assignments: [] });
      }
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

    const [teacher, cls, subject, taken] = await Promise.all([
      prisma.user.findUnique({ where: { id: teacherId } }),
      prisma.class.findUnique({ where: { id: classId } }),
      prisma.subject.findUnique({ where: { id: subjectId } }),
      prisma.teacherAssignment.findUnique({
        where: { classId_subjectId: { classId, subjectId } },
        include: { teacher: { select: { id: true, name: true } }, subject: true, class: true },
      }),
    ]);

    if (!teacher || teacher.role !== 'TEACHER' || !teacher.isActive) {
      throw badRequest('يجب أن يكون المعلم حساب معلّم نشط');
    }
    if (!cls) throw badRequest('الفصل غير موجود');
    if (!subject) throw badRequest('المادة غير موجودة');

    if (taken) {
      if (taken.teacherId === teacherId) {
        return res.status(200).json({ assignment: { ...taken, teacher, class: cls, subject } });
      }
      throw badRequest(
        `المادة «${taken.subject.nameAr}» للفصل «${taken.class.name}» مسندة حالياً إلى ${taken.teacher.name}. أزلها من ذلك المعلم أولاً أو استخدم شبكة التوزيع لإعادة التعيين.`
      );
    }

    const assignment = await prisma.teacherAssignment.create({
      data: { teacherId, classId, subjectId },
      include: assignmentInclude,
    });
    res.status(201).json({ assignment });
  })
);

router.post(
  '/sync',
  requireRole('ADMIN'),
  validateBody(syncSchema),
  asyncHandler(async (req, res) => {
    const { teacherId, classIds, items } = req.body;

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'TEACHER' || !teacher.isActive) {
      throw badRequest('يجب أن يكون المعلم حساب معلّم نشط');
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

    const desired = new Map();
    for (const item of items) {
      desired.set(pairKey(item.classId, item.subjectId), item);
    }

    let reassigned = 0;
    let createdCount = 0;
    let removedCount = 0;

    await prisma.$transaction(async (tx) => {
      const existingForTeacher = await tx.teacherAssignment.findMany({
        where: { teacherId, classId: { in: classIds } },
      });
      const mineByKey = new Map(
        existingForTeacher.map((a) => [pairKey(a.classId, a.subjectId), a])
      );

      const toCreate = [...desired.values()].filter(
        (item) => !mineByKey.has(pairKey(item.classId, item.subjectId))
      );
      const toDelete = existingForTeacher.filter(
        (a) => !desired.has(pairKey(a.classId, a.subjectId))
      );
      createdCount = toCreate.length;
      removedCount = toDelete.length;

      if (toDelete.length) {
        await tx.teacherAssignment.deleteMany({
          where: { id: { in: toDelete.map((a) => a.id) } },
        });
      }

      for (const item of toCreate) {
        const taken = await tx.teacherAssignment.findUnique({
          where: {
            classId_subjectId: { classId: item.classId, subjectId: item.subjectId },
          },
        });
        if (taken) {
          if (taken.teacherId === teacherId) continue;
          await tx.teacherAssignment.delete({ where: { id: taken.id } });
          reassigned += 1;
        }
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
      created: createdCount - reassigned,
      reassigned,
      removed: removedCount,
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
    if (!existing) throw notFound('التوزيع غير موجود');
    await prisma.teacherAssignment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
