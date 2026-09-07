import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import {
  SCORE_FIELDS,
  currentSchoolWeekSunday,
  isBlankFollowUpRow,
  isFutureWeek,
  isPeSubject,
  parseNotes,
  parseScore,
  parseWeekStartParam,
  loadFollowUpRowsByStudent,
  serializeFollowUpScores,
  weekEndThursday,
} from '../services/weeklyFollowUp.js';

const router = Router();

const meQuery = z.object({
  assignmentId: z.coerce.number().int().positive(),
  weekStart: z.string().min(1),
});

const rowSchema = z.object({
  studentId: z.string().min(1),
  participation: z.any().optional().nullable(),
  homeworkScore: z.any().optional().nullable(),
  understanding: z.any().optional().nullable(),
  discipline: z.any().optional().nullable(),
  interaction: z.any().optional().nullable(),
  progress: z.any().optional().nullable(),
  notes: z.any().optional().nullable(),
  total: z.any().optional(),
});

const saveSchema = z.object({
  assignmentId: z.number().int().positive(),
  weekStart: z.string().min(1),
  rows: z.array(rowSchema),
});

async function rosterForClass(classId) {
  return prisma.student.findMany({
    where: { classId, isActive: true },
    orderBy: { nameAr: 'asc' },
    select: { id: true, nameAr: true },
  });
}

async function loadAssignmentForTeacher(assignmentId, user) {
  const assignment = await prisma.teacherAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: true,
      subject: true,
    },
  });
  if (!assignment) throw notFound('التكليف غير موجود');
  if (user.role === 'TEACHER' && assignment.teacherId !== user.id) {
    throw forbidden('لا يمكنك رصد متابعة لتكليف معلم آخر');
  }
  if (assignment.class.retiredAt) {
    throw badRequest('هذا الفصل غير نشط');
  }
  if (isPeSubject(assignment.subject.nameAr)) {
    throw badRequest('التربية البدنية ليست في المتابعة الأسبوعية');
  }
  return assignment;
}

function assertWeekNotFuture(sundayStr) {
  if (isFutureWeek(sundayStr)) {
    throw badRequest('لا يمكن رصد أسبوع قادم');
  }
}

function scoresFromBody(row) {
  const scores = {};
  for (const key of SCORE_FIELDS) {
    scores[key] = parseScore(row[key]);
  }
  scores.notes = parseNotes(row.notes);
  return scores;
}

router.get(
  '/me/assignments',
  requireStaff,
  requireRole('TEACHER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const where =
      req.user.role === 'ADMIN' ? {} : { teacherId: req.user.id };
    const rows = await prisma.teacherAssignment.findMany({
      where: { ...where, class: { retiredAt: null } },
      include: { class: true, subject: true },
      orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }],
    });
    const assignments = rows
      .filter((a) => !isPeSubject(a.subject.nameAr))
      .map((a) => ({
        id: a.id,
        classId: a.classId,
        className: a.class.name,
        gradeLevel: a.class.gradeLevel,
        subjectId: a.subjectId,
        subjectNameAr: a.subject.nameAr,
        academicYear: a.class.academicYear,
      }));
    res.json({ assignments, currentWeekStart: currentSchoolWeekSunday() });
  })
);

router.get(
  '/me',
  requireStaff,
  requireRole('TEACHER', 'ADMIN'),
  validateQuery(meQuery),
  asyncHandler(async (req, res) => {
    const assignment = await loadAssignmentForTeacher(req.query.assignmentId, req.user);
    const { sundayStr, sundayDate } = parseWeekStartParam(req.query.weekStart);
    assertWeekNotFuture(sundayStr);
    const academicYear = assignment.class.academicYear;
    const students = await rosterForClass(assignment.classId);
    const byStudent = await loadFollowUpRowsByStudent({
      studentIds: students.map((s) => s.id),
      subjectId: assignment.subjectId,
      academicYear,
      sundayDate,
    });
    res.json({
      assignment: {
        id: assignment.id,
        classId: assignment.classId,
        className: assignment.class.name,
        gradeLevel: assignment.class.gradeLevel,
        subjectId: assignment.subjectId,
        subjectNameAr: assignment.subject.nameAr,
        academicYear,
      },
      weekStart: sundayStr,
      weekEnd: weekEndThursday(sundayStr),
      currentWeekStart: currentSchoolWeekSunday(),
      rows: students.map((st) => ({
        studentId: st.id,
        studentNameAr: st.nameAr,
        ...serializeFollowUpScores(byStudent.get(st.id)),
      })),
    });
  })
);

router.put(
  '/me',
  requireStaff,
  requireRole('TEACHER', 'ADMIN'),
  validateBody(saveSchema),
  asyncHandler(async (req, res) => {
    const assignment = await loadAssignmentForTeacher(req.body.assignmentId, req.user);
    const { sundayStr, sundayDate } = parseWeekStartParam(req.body.weekStart);
    assertWeekNotFuture(sundayStr);
    const academicYear = assignment.class.academicYear;
    const roster = await rosterForClass(assignment.classId);
    const allowed = new Set(roster.map((s) => s.id));

    const ops = [];
    const opKinds = [];
    for (const row of req.body.rows) {
      if (!allowed.has(row.studentId)) {
        throw badRequest('الطالب ليس في هذا الفصل');
      }
      const scores = scoresFromBody(row);
      if (isBlankFollowUpRow(scores)) {
        ops.push(
          prisma.weeklyFollowUp.deleteMany({
            where: {
              studentId: row.studentId,
              subjectId: assignment.subjectId,
              academicYear,
              weekStart: sundayDate,
            },
          })
        );
        opKinds.push('delete');
        continue;
      }
      ops.push(
        prisma.weeklyFollowUp.upsert({
          where: {
            studentId_subjectId_academicYear_weekStart: {
              studentId: row.studentId,
              subjectId: assignment.subjectId,
              academicYear,
              weekStart: sundayDate,
            },
          },
          create: {
            studentId: row.studentId,
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            academicYear,
            weekStart: sundayDate,
            ...scores,
            recordedById: req.user.id,
          },
          update: {
            classId: assignment.classId,
            ...scores,
            recordedById: req.user.id,
          },
        })
      );
      opKinds.push('upsert');
    }

    let saved = 0;
    let deleted = 0;
    if (ops.length) {
      const results = await prisma.$transaction(ops);
      for (let i = 0; i < results.length; i++) {
        if (opKinds[i] === 'delete') deleted += results[i]?.count ?? 0;
        else saved += 1;
      }
    }

    const byStudent = await loadFollowUpRowsByStudent({
      studentIds: roster.map((s) => s.id),
      subjectId: assignment.subjectId,
      academicYear,
      sundayDate,
    });
    res.json({
      ok: true,
      saved,
      deleted,
      weekStart: sundayStr,
      weekEnd: weekEndThursday(sundayStr),
      rows: roster.map((st) => ({
        studentId: st.id,
        studentNameAr: st.nameAr,
        ...serializeFollowUpScores(byStudent.get(st.id)),
      })),
    });
  })
);

export default router;
