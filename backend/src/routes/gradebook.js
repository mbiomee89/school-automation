import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import {
  resolveGradeShape,
  periodTotal,
  computeTermTotals,
  GRADE_SHAPE,
} from '../services/gradebook.js';

const router = Router();

const termPeriodQuery = z.object({
  assignmentId: z.coerce.number().int().positive().optional(),
  classId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  term: z.coerce.number().int().min(1).max(2),
  period: z.coerce.number().int().min(1).max(2).optional(),
  academicYear: z.string().min(4).optional(),
});

const periodSaveSchema = z.object({
  assignmentId: z.number().int().positive(),
  term: z.number().int().min(1).max(2),
  period: z.number().int().min(1).max(2),
  academicYear: z.string().min(4).optional(),
  rows: z
    .array(
      z.object({
        studentId: z.string().min(1),
        assessment: z.number().int().min(0).max(40),
        exams: z.number().int().min(0).max(60),
      })
    )
    .min(1),
});

const finalSaveSchema = z.object({
  assignmentId: z.number().int().positive(),
  term: z.number().int().min(1).max(2),
  academicYear: z.string().min(4).optional(),
  rows: z
    .array(
      z.object({
        studentId: z.string().min(1),
        finalExam: z.number().int().min(0).max(40),
      })
    )
    .min(1),
});

async function resolveAcademicYear(explicit) {
  if (explicit?.trim()) return explicit.trim();
  const settings = await prisma.schoolSettings.findFirst({
    select: { academicYear: true },
  });
  return settings?.academicYear || new Date().getFullYear().toString();
}

async function loadAssignmentForTeacher(assignmentId, user) {
  const assignment = await prisma.teacherAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: true,
      subject: true,
      teacher: { select: { id: true, name: true } },
    },
  });
  if (!assignment) throw notFound('التكليف غير موجود');
  if (user.role === 'TEACHER' && assignment.teacherId !== user.id) {
    throw forbidden('لا يمكنك رصد درجات لتكليف معلم آخر');
  }
  const shape = resolveGradeShape(assignment.subject.nameAr, assignment.class.gradeLevel);
  if (!shape) {
    throw badRequest('هذه المادة خارج سجل المتابعة للمرحلة الابتدائية في هذا الإصدار');
  }
  return { assignment, shape };
}

async function loadClassSubject(classId, subjectId) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!cls || !subject) throw notFound('الفصل أو المادة غير موجود');
  const shape = resolveGradeShape(subject.nameAr, cls.gradeLevel);
  if (!shape) {
    throw badRequest('هذه المادة خارج سجل المتابعة في هذا الإصدار');
  }
  return { cls, subject, shape };
}

async function rosterForClass(classId) {
  return prisma.student.findMany({
    where: { classId, isActive: true },
    orderBy: { nameAr: 'asc' },
    select: { id: true, nameAr: true, nameEn: true },
  });
}

function serializePeriodRow(student, score, shape) {
  const assessment = score?.assessment ?? null;
  const exams = score?.exams ?? null;
  const total =
    assessment == null || exams == null
      ? null
      : periodTotal(assessment, exams, shape);
  return {
    studentId: student.id,
    studentNameAr: student.nameAr,
    assessment,
    exams,
    periodTotal: total,
    periodMax: shape.periodMax,
  };
}

// ---------- Teacher ----------

router.get(
  '/me/assignments',
  requireStaff,
  requireRole('TEACHER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const where =
      req.user.role === 'ADMIN'
        ? {}
        : { teacherId: req.user.id };
    const rows = await prisma.teacherAssignment.findMany({
      where,
      include: {
        class: true,
        subject: true,
      },
      orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }],
    });
    const assignments = rows
      .map((a) => {
        const shape = resolveGradeShape(a.subject.nameAr, a.class.gradeLevel);
        if (!shape) return null;
        return {
          id: a.id,
          classId: a.classId,
          className: a.class.name,
          gradeLevel: a.class.gradeLevel,
          subjectId: a.subjectId,
          subjectNameAr: a.subject.nameAr,
          academicYear: a.class.academicYear,
          shape: shape.shape,
          assessmentMax: shape.assessmentMax,
          examsMax: shape.examsMax,
          periodMax: shape.periodMax,
          finalMax: shape.finalMax,
        };
      })
      .filter(Boolean);
    res.json({ assignments });
  })
);

router.get(
  '/me',
  requireStaff,
  requireRole('TEACHER', 'ADMIN'),
  validateQuery(termPeriodQuery),
  asyncHandler(async (req, res) => {
    const assignmentId = req.query.assignmentId;
    if (!assignmentId) throw badRequest('assignmentId مطلوب');
    const term = req.query.term;
    const period = req.query.period ?? 1;
    const { assignment, shape } = await loadAssignmentForTeacher(assignmentId, req.user);
    const academicYear = await resolveAcademicYear(
      req.query.academicYear || assignment.class.academicYear
    );
    const students = await rosterForClass(assignment.classId);
    const scores = await prisma.gradePeriodScore.findMany({
      where: {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        academicYear,
        term,
        period,
      },
    });
    const byStudent = new Map(scores.map((s) => [s.studentId, s]));
    const finals = await prisma.gradeTermFinal.findMany({
      where: {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        academicYear,
        term,
      },
    });
    const finalByStudent = new Map(finals.map((f) => [f.studentId, f]));

    const p1 = await prisma.gradePeriodScore.findMany({
      where: {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        academicYear,
        term,
        period: 1,
      },
    });
    const p2 = await prisma.gradePeriodScore.findMany({
      where: {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        academicYear,
        term,
        period: 2,
      },
    });
    const p1Map = new Map(p1.map((s) => [s.studentId, s]));
    const p2Map = new Map(p2.map((s) => [s.studentId, s]));

    res.json({
      assignment: {
        id: assignment.id,
        classId: assignment.classId,
        className: assignment.class.name,
        gradeLevel: assignment.class.gradeLevel,
        subjectId: assignment.subjectId,
        subjectNameAr: assignment.subject.nameAr,
      },
      academicYear,
      term,
      period,
      shape,
      rows: students.map((st) => {
        const row = serializePeriodRow(st, byStudent.get(st.id), shape);
        const termCalc = computeTermTotals(
          p1Map.get(st.id),
          p2Map.get(st.id),
          finalByStudent.get(st.id)?.finalExam,
          shape
        );
        return {
          ...row,
          finalExam: finalByStudent.get(st.id)?.finalExam ?? null,
          termReady: termCalc.ready,
          avgAssessment: termCalc.avgAssessment,
          avgExams: termCalc.avgExams,
          termTotal: termCalc.total,
        };
      }),
    });
  })
);

router.put(
  '/me/period',
  requireStaff,
  requireRole('TEACHER', 'ADMIN'),
  validateBody(periodSaveSchema),
  asyncHandler(async (req, res) => {
    const { assignmentId, term, period, rows } = req.body;
    const { assignment, shape } = await loadAssignmentForTeacher(assignmentId, req.user);
    const academicYear = await resolveAcademicYear(
      req.body.academicYear || assignment.class.academicYear
    );
    const roster = await rosterForClass(assignment.classId);
    const allowed = new Set(roster.map((s) => s.id));

    for (const row of rows) {
      if (!allowed.has(row.studentId)) {
        throw badRequest(`الطالب ${row.studentId} ليس في هذا الفصل`);
      }
      if (row.assessment > shape.assessmentMax) {
        throw badRequest(`درجة التقييم أعلى من ${shape.assessmentMax}`);
      }
      if (row.exams > shape.examsMax) {
        throw badRequest(`درجة الاختبارات أعلى من ${shape.examsMax}`);
      }
    }

    await prisma.$transaction(
      rows.map((row) =>
        prisma.gradePeriodScore.upsert({
          where: {
            studentId_subjectId_academicYear_term_period: {
              studentId: row.studentId,
              subjectId: assignment.subjectId,
              academicYear,
              term,
              period,
            },
          },
          create: {
            studentId: row.studentId,
            subjectId: assignment.subjectId,
            classId: assignment.classId,
            academicYear,
            term,
            period,
            assessment: row.assessment,
            exams: row.exams,
            recordedById: req.user.id,
          },
          update: {
            assessment: row.assessment,
            exams: row.exams,
            classId: assignment.classId,
            recordedById: req.user.id,
          },
        })
      )
    );

    res.json({ ok: true, saved: rows.length });
  })
);

router.put(
  '/me/final',
  requireStaff,
  requireRole('TEACHER', 'ADMIN'),
  validateBody(finalSaveSchema),
  asyncHandler(async (req, res) => {
    const { assignmentId, term, rows } = req.body;
    const { assignment, shape } = await loadAssignmentForTeacher(assignmentId, req.user);
    if (shape.shape !== GRADE_SHAPE.KHITAMI) {
      throw badRequest('اختبار نهاية الفصل متاح فقط للمواد الختامية');
    }
    const academicYear = await resolveAcademicYear(
      req.body.academicYear || assignment.class.academicYear
    );
    const roster = await rosterForClass(assignment.classId);
    const allowed = new Set(roster.map((s) => s.id));

    for (const row of rows) {
      if (!allowed.has(row.studentId)) {
        throw badRequest(`الطالب ${row.studentId} ليس في هذا الفصل`);
      }
    }

    await prisma.$transaction(
      rows.map((row) =>
        prisma.gradeTermFinal.upsert({
          where: {
            studentId_subjectId_academicYear_term: {
              studentId: row.studentId,
              subjectId: assignment.subjectId,
              academicYear,
              term,
            },
          },
          create: {
            studentId: row.studentId,
            subjectId: assignment.subjectId,
            classId: assignment.classId,
            academicYear,
            term,
            finalExam: row.finalExam,
            recordedById: req.user.id,
          },
          update: {
            finalExam: row.finalExam,
            classId: assignment.classId,
            recordedById: req.user.id,
          },
        })
      )
    );

    res.json({ ok: true, saved: rows.length });
  })
);

async function buildReport({ cls, subject, shape, academicYear, term, period }) {
  const students = await rosterForClass(cls.id);
  if (period != null) {
    const scores = await prisma.gradePeriodScore.findMany({
      where: {
        classId: cls.id,
        subjectId: subject.id,
        academicYear,
        term,
        period,
      },
    });
    const byStudent = new Map(scores.map((s) => [s.studentId, s]));
    return {
      type: 'period',
      academicYear,
      term,
      period,
      classId: cls.id,
      className: cls.name,
      gradeLevel: cls.gradeLevel,
      subjectId: subject.id,
      subjectNameAr: subject.nameAr,
      shape,
      rows: students.map((st) => serializePeriodRow(st, byStudent.get(st.id), shape)),
    };
  }

  const [p1, p2, finals] = await Promise.all([
    prisma.gradePeriodScore.findMany({
      where: {
        classId: cls.id,
        subjectId: subject.id,
        academicYear,
        term,
        period: 1,
      },
    }),
    prisma.gradePeriodScore.findMany({
      where: {
        classId: cls.id,
        subjectId: subject.id,
        academicYear,
        term,
        period: 2,
      },
    }),
    prisma.gradeTermFinal.findMany({
      where: {
        classId: cls.id,
        subjectId: subject.id,
        academicYear,
        term,
      },
    }),
  ]);
  const p1Map = new Map(p1.map((s) => [s.studentId, s]));
  const p2Map = new Map(p2.map((s) => [s.studentId, s]));
  const fMap = new Map(finals.map((f) => [f.studentId, f]));

  return {
    type: 'term',
    academicYear,
    term,
    classId: cls.id,
    className: cls.name,
    gradeLevel: cls.gradeLevel,
    subjectId: subject.id,
    subjectNameAr: subject.nameAr,
    shape,
    rows: students.map((st) => {
      const calc = computeTermTotals(
        p1Map.get(st.id),
        p2Map.get(st.id),
        fMap.get(st.id)?.finalExam,
        shape
      );
      return {
        studentId: st.id,
        studentNameAr: st.nameAr,
        period1: p1Map.get(st.id)
          ? {
              assessment: p1Map.get(st.id).assessment,
              exams: p1Map.get(st.id).exams,
              total: periodTotal(
                p1Map.get(st.id).assessment,
                p1Map.get(st.id).exams,
                shape
              ),
            }
          : null,
        period2: p2Map.get(st.id)
          ? {
              assessment: p2Map.get(st.id).assessment,
              exams: p2Map.get(st.id).exams,
              total: periodTotal(
                p2Map.get(st.id).assessment,
                p2Map.get(st.id).exams,
                shape
              ),
            }
          : null,
        avgAssessment: calc.avgAssessment,
        avgExams: calc.avgExams,
        finalExam: calc.finalExam,
        termReady: calc.ready,
        termTotal: calc.total,
        termMax: 100,
      };
    }),
  };
}

router.get(
  '/me/report',
  requireStaff,
  requireRole('TEACHER', 'ADMIN'),
  validateQuery(termPeriodQuery),
  asyncHandler(async (req, res) => {
    const assignmentId = req.query.assignmentId;
    if (!assignmentId) throw badRequest('assignmentId مطلوب');
    const { assignment, shape } = await loadAssignmentForTeacher(assignmentId, req.user);
    const academicYear = await resolveAcademicYear(
      req.query.academicYear || assignment.class.academicYear
    );
    const report = await buildReport({
      cls: assignment.class,
      subject: assignment.subject,
      shape,
      academicYear,
      term: req.query.term,
      period: req.query.period,
    });
    res.json(report);
  })
);

// ---------- Admin ----------

router.get(
  '/admin/options',
  requireStaff,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const classes = await prisma.class.findMany({
      orderBy: [{ academicYear: 'desc' }, { gradeLevel: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        section: true,
        academicYear: true,
      },
    });
    const subjects = await prisma.subject.findMany({
      orderBy: { nameAr: 'asc' },
      select: { id: true, nameAr: true, nameEn: true },
    });
    const eligibleSubjects = subjects.filter((s) => {
      // any elementary band that resolves for this name
      return (
        resolveGradeShape(s.nameAr, '3') != null ||
        resolveGradeShape(s.nameAr, '1') != null
      );
    });
    res.json({ classes, subjects: eligibleSubjects });
  })
);

router.get(
  '/admin/report',
  requireStaff,
  requireRole('ADMIN'),
  validateQuery(
    z.object({
      classId: z.coerce.number().int().positive(),
      subjectId: z.coerce.number().int().positive(),
      term: z.coerce.number().int().min(1).max(2),
      period: z.coerce.number().int().min(1).max(2).optional(),
      academicYear: z.string().min(4).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { cls, subject, shape } = await loadClassSubject(
      req.query.classId,
      req.query.subjectId
    );
    const academicYear = await resolveAcademicYear(
      req.query.academicYear || cls.academicYear
    );
    const report = await buildReport({
      cls,
      subject,
      shape,
      academicYear,
      term: req.query.term,
      period: req.query.period,
    });
    res.json(report);
  })
);

export default router;
