import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateQuery } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { notFound, badRequest } from '../utils/errors.js';
import { toUtcMidnight, weekStartSaturdayUtc, weekStartSundayStr } from '../utils/dates.js';
import { schoolLogoUrl } from '../services/schoolLogo.js';
import { ACTIVE_CLASS } from '../services/activeClass.js';
import {
  currentSchoolWeekSunday,
  isPeSubject,
  loadFollowUpClassSheet,
  parseWeekStartParam,
  weekEndThursday,
} from '../services/weeklyFollowUp.js';

const router = Router();

router.use(requireStaff, requireRole('ADMIN', 'COUNSELOR', 'STUDENT_AFFAIRS'));

const dateQuery = z.object({
  date: z.string().min(1),
});

const SINGLETON_ID = 1;

async function schoolHeader() {
  const settings = await prisma.schoolSettings.findUnique({
    where: { id: SINGLETON_ID },
    select: {
      name: true,
      academicYear: true,
      principalName: true,
      educationAdminName: true,
      logoPath: true,
      logoMime: true,
      updatedAt: true,
    },
  });
  return {
    schoolName: settings?.name ?? 'المدرسة',
    academicYear: settings?.academicYear ?? '',
    principalName: settings?.principalName ?? null,
    educationAdminName: settings?.educationAdminName ?? null,
    logoUrl: schoolLogoUrl(settings),
  };
}

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
const WEEKDAY_LABELS = {
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
};

function parseWeeklyDays(topics) {
  try {
    const parsed = JSON.parse(topics);
    if (parsed && typeof parsed === 'object' && 'sunday' in parsed) {
      return parsed;
    }
  } catch {
    /* legacy plain text */
  }
  return {
    sunday: { topics: String(topics || ''), objectives: null, notes: null },
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
  };
}

function expandWeeklyLessonRows(plan) {
  // Cell-based plan (عنوان الدرس per period)
  if (plan.date && plan.period && (plan.title || '').trim()) {
    const dateStr = toUtcMidnight(plan.date).toISOString().slice(0, 10);
    const dayIdx = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay(); // 0=Sun
    const keyByIdx = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday' };
    const dayKey = keyByIdx[dayIdx];
    if (!dayKey) return [];
    return [
      {
        planId: plan.id,
        classId: plan.classId,
        className: plan.class.name,
        dayKey,
        dayLabel: WEEKDAY_LABELS[dayKey],
        period: plan.period,
        subjectName: plan.subject.nameAr,
        teacherName: plan.teacher.name,
        lessonTopic: plan.title.trim(),
        notes: null,
      },
    ];
  }

  // Legacy Saturday-week JSON
  const days = parseWeeklyDays(plan.topics);
  const rows = [];
  for (const key of WEEKDAY_KEYS) {
    const lesson = days[key];
    if (!lesson || typeof lesson !== 'object') continue;
    const lessonTopic = typeof lesson.topics === 'string' ? lesson.topics.trim() : '';
    if (!lessonTopic) continue;
    const notesBits = [];
    if (typeof lesson.notes === 'string' && lesson.notes.trim()) notesBits.push(lesson.notes.trim());
    if (typeof lesson.objectives === 'string' && lesson.objectives.trim()) {
      notesBits.push(lesson.objectives.trim());
    }
    rows.push({
      planId: plan.id,
      classId: plan.classId,
      className: plan.class.name,
      dayKey: key,
      dayLabel: WEEKDAY_LABELS[key],
      period: null,
      subjectName: plan.subject.nameAr,
      teacherName: plan.teacher.name,
      lessonTopic,
      notes: notesBits.length ? notesBits.join(' — ') : null,
    });
  }
  return rows;
}

function groupRowsByClass(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.classId ?? row.className;
    if (!map.has(key)) {
      map.set(key, {
        classId: row.classId ?? null,
        className: row.className,
        rows: [],
      });
    }
    map.get(key).rows.push(row);
  }
  return [...map.values()];
}

/** GET /reports/daily-absence?date=YYYY-MM-DD */
router.get(
  '/daily-absence',
  validateQuery(dateQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const header = await schoolHeader();

    const rows = await prisma.attendance.findMany({
      where: {
        date,
        status: { in: ['ABSENT', 'EXCUSED'] },
      },
      include: {
        student: { select: { id: true, nameAr: true } },
        class: { select: { name: true } },
      },
      orderBy: [{ classId: 'asc' }, { studentId: 'asc' }],
    });

    res.json({
      date: date.toISOString().slice(0, 10),
      schoolName: header.schoolName,
      academicYear: header.academicYear,
      educationAdminName: header.educationAdminName,
      logoUrl: header.logoUrl,
      principalName: header.principalName,
      generatedAt: new Date().toISOString(),
      rows: rows.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.student.nameAr,
        className: r.class.name,
        date: date.toISOString().slice(0, 10),
        status: r.status,
        period: r.period,
      })),
    });
  })
);

/** GET /reports/late-arrivals?date=YYYY-MM-DD */
router.get(
  '/late-arrivals',
  validateQuery(dateQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const header = await schoolHeader();

    const rows = await prisma.lateReport.findMany({
      where: { date },
      include: {
        student: { select: { id: true, nameAr: true } },
        class: { select: { name: true } },
      },
      orderBy: { time: 'asc' },
    });

    const dateStr = date.toISOString().slice(0, 10);
    res.json({
      date: dateStr,
      schoolName: header.schoolName,
      academicYear: header.academicYear,
      educationAdminName: header.educationAdminName,
      logoUrl: header.logoUrl,
      principalName: header.principalName,
      generatedAt: new Date().toISOString(),
      rows: rows.map((r) => ({
        studentId: r.studentId,
        studentName: r.student.nameAr,
        className: r.class.name,
        time: r.time.toISOString(),
        reason: r.reason,
      })),
      count: rows.length,
    });
  })
);

/** GET /reports/early-leave?date=YYYY-MM-DD */
router.get(
  '/early-leave',
  validateQuery(dateQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const header = await schoolHeader();

    const rows = await prisma.earlyLeaveRequest.findMany({
      where: { date },
      include: {
        student: { select: { id: true, nameAr: true } },
        class: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
      orderBy: [{ leaveTime: 'asc' }, { requestedAt: 'asc' }],
    });

    const dateStr = date.toISOString().slice(0, 10);
    res.json({
      date: dateStr,
      schoolName: header.schoolName,
      academicYear: header.academicYear,
      educationAdminName: header.educationAdminName,
      logoUrl: header.logoUrl,
      principalName: header.principalName,
      generatedAt: new Date().toISOString(),
      rows: rows.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.student.nameAr,
        className: r.class.name,
        leaveTime: r.leaveTime.toISOString(),
        reason: r.reason,
        pickupName: r.pickupName,
        pickupRelation: r.pickupRelation,
        pickupPhone: r.pickupPhone,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        reviewNote: r.reviewNote ?? null,
        reviewerName: r.reviewer?.name ?? null,
        cancelledAt: r.cancelledAt?.toISOString() ?? null,
      })),
      count: rows.length,
    });
  })
);

/** GET /reports/homework-log?date=YYYY-MM-DD — flat list for that day, ordered by period */
router.get(
  '/homework-log',
  validateQuery(dateQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const header = await schoolHeader();

    const found = await prisma.homework.findMany({
      where: { date },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { nameAr: true, nameEn: true } },
        teacher: { select: { name: true } },
      },
      orderBy: [{ classId: 'asc' }, { period: 'asc' }, { subjectId: 'asc' }],
    });

    const dateStr = date.toISOString().slice(0, 10);
    const rows = found.map((r) => ({
      id: r.id,
      classId: r.classId,
      className: r.class.name,
      subjectName: r.subject.nameAr,
      teacherName: r.teacher.name,
      period: r.period || null,
      noHomework: Boolean(r.noHomework),
      description: r.noHomework ? 'لا يوجد واجب' : r.description,
      dueDate: r.dueDate ? toUtcMidnight(r.dueDate).toISOString().slice(0, 10) : null,
    }));

    res.json({
      date: dateStr,
      schoolName: header.schoolName,
      academicYear: header.academicYear,
      educationAdminName: header.educationAdminName,
      logoUrl: header.logoUrl,
      principalName: header.principalName,
      generatedAt: new Date().toISOString(),
      rows,
      classes: groupRowsByClass(rows),
      count: rows.length,
    });
  })
);

/** GET /reports/weekly-plan?date=YYYY-MM-DD — plans for the week containing date */
router.get(
  '/weekly-plan',
  validateQuery(dateQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const weekStart = weekStartSaturdayUtc(date);
    const weekEnd = new Date(
      Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 5)
    );
    const header = await schoolHeader();

    const plans = await prisma.weeklyPlan.findMany({
      where: { weekStart },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { nameAr: true } },
        teacher: { select: { name: true } },
      },
      orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }],
    });

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const rows = plans.flatMap(expandWeeklyLessonRows);
    // Stable day order within each class (already class-ordered from plans)
    const dayOrder = Object.fromEntries(WEEKDAY_KEYS.map((k, i) => [k, i]));
    rows.sort((a, b) => {
      if (a.classId !== b.classId) return a.classId - b.classId;
      const dayDiff = (dayOrder[a.dayKey] ?? 99) - (dayOrder[b.dayKey] ?? 99);
      if (dayDiff !== 0) return dayDiff;
      const periodDiff = Number(a.period || 0) - Number(b.period || 0);
      if (periodDiff !== 0) return periodDiff;
      return a.subjectName.localeCompare(b.subjectName, 'ar');
    });

    res.json({
      date: date.toISOString().slice(0, 10),
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      schoolName: header.schoolName,
      academicYear: header.academicYear,
      educationAdminName: header.educationAdminName,
      logoUrl: header.logoUrl,
      principalName: header.principalName,
      generatedAt: new Date().toISOString(),
      rows,
      classes: groupRowsByClass(rows),
      count: rows.length,
    });
  })
);

const studentHistoryQuery = z.object({
  studentId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** GET /reports/student-history?studentId= — attendance, late, enrollments */
router.get(
  '/student-history',
  validateQuery(studentHistoryQuery),
  asyncHandler(async (req, res) => {
    const studentId = req.query.studentId.trim();
    const header = await schoolHeader();

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        parentPhone: true,
        isActive: true,
        class: { select: { name: true, academicYear: true } },
      },
    });
    if (!student) throw notFound('الطالب غير موجود');

    const attendanceWhere = { studentId };
    if (req.query.from || req.query.to) {
      attendanceWhere.date = {};
      if (req.query.from) attendanceWhere.date.gte = toUtcMidnight(req.query.from);
      if (req.query.to) attendanceWhere.date.lte = toUtcMidnight(req.query.to);
    }

    const lateWhere = { studentId };
    if (req.query.from || req.query.to) {
      lateWhere.date = {};
      if (req.query.from) lateWhere.date.gte = toUtcMidnight(req.query.from);
      if (req.query.to) lateWhere.date.lte = toUtcMidnight(req.query.to);
    }

    const [attendance, lateReports, enrollments] = await Promise.all([
      prisma.attendance.findMany({
        where: attendanceWhere,
        include: { class: { select: { name: true } } },
        orderBy: [{ date: 'desc' }, { period: 'asc' }],
        take: 200,
      }),
      prisma.lateReport.findMany({
        where: lateWhere,
        include: { class: { select: { name: true } } },
        orderBy: { date: 'desc' },
        take: 100,
      }),
      prisma.classEnrollment.findMany({
        where: { studentId },
        include: { class: { select: { name: true } } },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    const attendanceRows = attendance.map((a) => ({
      id: a.id,
      date: toUtcMidnight(a.date).toISOString().slice(0, 10),
      period: a.period,
      status: a.status,
      className: a.class.name,
      reasonStatus: a.reasonStatus,
      absenceReason: a.absenceReason,
    }));

    const lateRows = lateReports.map((l) => ({
      id: l.id,
      date: toUtcMidnight(l.date).toISOString().slice(0, 10),
      time: l.time.toISOString(),
      className: l.class.name,
      reason: l.reason,
    }));

    const enrollmentRows = enrollments.map((e) => ({
      id: e.id,
      className: e.class.name,
      academicYear: e.academicYear,
      startDate: toUtcMidnight(e.startDate).toISOString().slice(0, 10),
      endDate: e.endDate ? toUtcMidnight(e.endDate).toISOString().slice(0, 10) : null,
      isCurrent: e.endDate == null,
    }));

    res.json({
      schoolName: header.schoolName,
      academicYear: header.academicYear,
      educationAdminName: header.educationAdminName,
      logoUrl: header.logoUrl,
      principalName: header.principalName,
      generatedAt: new Date().toISOString(),
      from: req.query.from || null,
      to: req.query.to || null,
      student: {
        id: student.id,
        nameAr: student.nameAr,
        nameEn: student.nameEn,
        parentPhone: student.parentPhone,
        isActive: student.isActive,
        currentClassName: student.class?.name ?? null,
        currentAcademicYear: student.class?.academicYear ?? null,
      },
      attendance: attendanceRows,
      lateArrivals: lateRows,
      enrollments: enrollmentRows,
      attendanceLimit: 200,
      lateLimit: 100,
      attendanceTruncated: attendanceRows.length >= 200,
      lateTruncated: lateRows.length >= 100,
      count: attendanceRows.length + lateRows.length + enrollmentRows.length,
    });
  })
);

/** GET /reports/absence-days?from=&to=&minDays= — days absent per student */
router.get(
  '/absence-days',
  validateQuery(
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      minDays: z.coerce.number().int().min(0).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const header = await schoolHeader();
    const minDays = req.query.minDays ?? 0;
    const where = {
      status: { in: ['ABSENT', 'EXCUSED'] },
    };
    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = toUtcMidnight(req.query.from);
      if (req.query.to) where.date.lte = toUtcMidnight(req.query.to);
    }

    const rows = await prisma.attendance.findMany({
      where,
      select: {
        studentId: true,
        date: true,
        student: {
          select: {
            id: true,
            nameAr: true,
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    const byStudent = new Map();
    for (const r of rows) {
      const day = toUtcMidnight(r.date).toISOString().slice(0, 10);
      let entry = byStudent.get(r.studentId);
      if (!entry) {
        entry = {
          studentId: r.studentId,
          studentName: r.student.nameAr,
          classId: r.student.classId,
          className: r.student.class?.name ?? '—',
          days: new Set(),
        };
        byStudent.set(r.studentId, entry);
      }
      entry.days.add(day);
    }

    const result = [...byStudent.values()]
      .map((e) => ({
        studentId: e.studentId,
        studentName: e.studentName,
        classId: e.classId,
        className: e.className,
        absenceDays: e.days.size,
      }))
      .filter((e) => e.absenceDays > minDays)
      .sort((a, b) => b.absenceDays - a.absenceDays || a.studentName.localeCompare(b.studentName, 'ar'));

    res.json({
      from: req.query.from || null,
      to: req.query.to || null,
      minDays,
      schoolName: header.schoolName,
      academicYear: header.academicYear,
      educationAdminName: header.educationAdminName,
      logoUrl: header.logoUrl,
      principalName: header.principalName,
      generatedAt: new Date().toISOString(),
      rows: result,
      count: result.length,
    });
  })
);

const followUpQuery = z.object({
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  weekStart: z.string().min(1),
});

/** GET /reports/weekly-follow-up/options */
router.get(
  '/weekly-follow-up/options',
  asyncHandler(async (req, res) => {
    const classes = await prisma.class.findMany({
      where: ACTIVE_CLASS,
      orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        academicYear: true,
        gradeLevel: true,
        assignments: {
          include: { subject: { select: { id: true, nameAr: true } } },
        },
      },
    });
    res.json({
      classes: classes.map((c) => {
        const seen = new Set();
        const subjects = [];
        for (const a of c.assignments) {
          if (isPeSubject(a.subject.nameAr) || seen.has(a.subject.id)) continue;
          seen.add(a.subject.id);
          subjects.push({ id: a.subject.id, nameAr: a.subject.nameAr });
        }
        subjects.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
        return {
          id: c.id,
          name: c.name,
          academicYear: c.academicYear,
          gradeLevel: c.gradeLevel,
          subjects,
        };
      }),
      currentWeekStart: currentSchoolWeekSunday(),
    });
  })
);

/** GET /reports/weekly-follow-up?classId=&subjectId=&weekStart= */
router.get(
  '/weekly-follow-up',
  validateQuery(followUpQuery),
  asyncHandler(async (req, res) => {
    const cls = await prisma.class.findUnique({ where: { id: req.query.classId } });
    const subject = await prisma.subject.findUnique({ where: { id: req.query.subjectId } });
    if (!cls || !subject) throw notFound('الفصل أو المادة غير موجود');
    if (cls.retiredAt) throw badRequest('هذا الفصل غير نشط');
    if (isPeSubject(subject.nameAr)) {
      throw badRequest('التربية البدنية ليست في المتابعة الأسبوعية');
    }
    const { sundayStr, sundayDate } = parseWeekStartParam(req.query.weekStart);
    const header = await schoolHeader();
    const rows = await loadFollowUpClassSheet({
      classId: cls.id,
      subjectId: subject.id,
      academicYear: cls.academicYear,
      sundayDate,
    });
    res.json({
      ...header,
      classId: cls.id,
      className: cls.name,
      subjectId: subject.id,
      subjectNameAr: subject.nameAr,
      academicYear: cls.academicYear,
      weekStart: sundayStr,
      weekEnd: weekEndThursday(sundayStr),
      generatedAt: new Date().toISOString(),
      rows,
    });
  })
);

const NO_PHONE_KEY = '__NO_PHONE__';

function phoneKeyFromStudent(parentPhone) {
  const trimmed = (parentPhone ?? '').trim();
  if (!trimmed) return { key: NO_PHONE_KEY, phone: null, noPhone: true };
  return { key: trimmed, phone: trimmed, noPhone: false };
}

function summarizeActivationBuckets(groups, byPhone) {
  let activated = 0;
  let notActivated = 0;
  let noPhone = 0;
  for (const g of groups.values()) {
    if (g.noPhone) {
      noPhone += 1;
      continue;
    }
    const account = byPhone.get(g.phone);
    if (account && account.isActive) activated += 1;
    else notActivated += 1;
  }
  return {
    totalPhones: activated + notActivated + noPhone,
    activated,
    notActivated,
    noPhone,
  };
}

/** Hub card counts only — no student name payloads. */
async function computeParentActivationSummary() {
  const students = await prisma.student.findMany({
    where: { isActive: true },
    select: { parentPhone: true },
  });

  /** @type {Map<string, { phone: string | null, noPhone: boolean }>} */
  const groups = new Map();
  for (const s of students) {
    const { key, phone, noPhone } = phoneKeyFromStudent(s.parentPhone);
    if (!groups.has(key)) groups.set(key, { phone, noPhone });
  }

  const phones = [...groups.keys()].filter((k) => k !== NO_PHONE_KEY);
  const accounts =
    phones.length > 0
      ? await prisma.parentAccount.findMany({
          where: { phone: { in: phones } },
          select: { phone: true, isActive: true },
        })
      : [];
  const byPhone = new Map(accounts.map((a) => [a.phone, a]));
  return summarizeActivationBuckets(groups, byPhone);
}

/**
 * Unique parent phones among active students, with ParentAccount activation status.
 * Detail endpoint only — summary uses computeParentActivationSummary().
 */
async function computeParentActivation() {
  const students = await prisma.student.findMany({
    where: { isActive: true },
    select: {
      id: true,
      nameAr: true,
      parentPhone: true,
      class: { select: { name: true } },
    },
  });

  /** @type {Map<string, { phone: string | null, noPhone: boolean, students: Array<{ id: string, nameAr: string, className: string | null }> }>} */
  const groups = new Map();
  for (const s of students) {
    const { key, phone, noPhone } = phoneKeyFromStudent(s.parentPhone);
    let g = groups.get(key);
    if (!g) {
      g = { phone, noPhone, students: [] };
      groups.set(key, g);
    }
    g.students.push({
      id: s.id,
      nameAr: s.nameAr,
      className: s.class?.name ?? null,
    });
  }

  const phones = [...groups.keys()].filter((k) => k !== NO_PHONE_KEY);
  const accounts =
    phones.length > 0
      ? await prisma.parentAccount.findMany({
          where: { phone: { in: phones } },
          select: { phone: true, isActive: true, createdAt: true },
        })
      : [];
  const byPhone = new Map(accounts.map((a) => [a.phone, a]));

  const parents = [];
  for (const g of groups.values()) {
    const account = g.noPhone ? null : byPhone.get(g.phone);
    const activated = !!(account && account.isActive);
    const accountDisabled = !!(account && !account.isActive);
    g.students.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
    parents.push({
      phone: g.phone,
      noPhone: g.noPhone,
      activated,
      accountDisabled,
      accountCreatedAt: account ? account.createdAt.toISOString() : null,
      studentCount: g.students.length,
      students: g.students,
    });
  }

  parents.sort((a, b) => {
    const rank = (p) => (p.noPhone ? 2 : p.activated ? 1 : 0);
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return (a.phone || '').localeCompare(b.phone || '', 'ar');
  });

  return {
    summary: summarizeActivationBuckets(groups, byPhone),
    parents,
  };
}

const parentActivationQuery = z.object({
  status: z.enum(['ACTIVATED', 'NOT_ACTIVATED', 'NO_PHONE', 'all']).default('all'),
});

/** GET /reports/parent-activation?status= — portal registration outreach list */
router.get(
  '/parent-activation',
  validateQuery(parentActivationQuery),
  asyncHandler(async (req, res) => {
    const status = req.query.status ?? 'all';
    const header = await schoolHeader();
    const { summary, parents: allParents } = await computeParentActivation();

    let parents = allParents;
    if (status === 'ACTIVATED') {
      parents = allParents.filter((p) => p.activated && !p.noPhone);
    } else if (status === 'NOT_ACTIVATED') {
      parents = allParents.filter((p) => !p.activated && !p.noPhone);
    } else if (status === 'NO_PHONE') {
      parents = allParents.filter((p) => p.noPhone);
    }

    res.json({
      ...header,
      generatedAt: new Date().toISOString(),
      status,
      summary,
      parents,
    });
  })
);

/** GET /reports/summary?date= — hub card counts for today */
router.get(
  '/summary',
  validateQuery(dateQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const dateStr = date.toISOString().slice(0, 10);
    const weekStart = weekStartSaturdayUtc(date);
    const followWeekStart = toUtcMidnight(weekStartSundayStr(dateStr));

    const [
      absenceCount,
      lateCount,
      homeworkCount,
      weeklyPlans,
      earlyLeaveCount,
      followUpCount,
      parentActivationSummary,
    ] = await Promise.all([
      prisma.attendance.count({
        where: { date, status: { in: ['ABSENT', 'EXCUSED'] } },
      }),
      prisma.lateReport.count({ where: { date } }),
      prisma.homework.count({ where: { date } }),
      prisma.weeklyPlan.findMany({
        where: { weekStart },
        select: {
          id: true,
          classId: true,
          topics: true,
          date: true,
          period: true,
          title: true,
          class: { select: { name: true } },
          subject: { select: { nameAr: true } },
          teacher: { select: { name: true } },
        },
      }),
      prisma.earlyLeaveRequest.count({ where: { date } }),
      prisma.weeklyFollowUp.count({ where: { weekStart: followWeekStart } }),
      computeParentActivationSummary(),
    ]);

    const weeklyLessonCount = weeklyPlans.flatMap((p) =>
      expandWeeklyLessonRows({
        ...p,
        class: p.class,
        subject: p.subject,
        teacher: p.teacher,
      })
    ).length;

    const { activated, notActivated } = parentActivationSummary;
    const canActivate = activated + notActivated;

    res.json({
      date: dateStr,
      reports: [
        {
          type: 'DAILY_ABSENCE',
          title: 'الغياب اليومي',
          description: 'قائمة الغياب والغياب بعذر ليوم محدد',
          iconHint: 'CALENDAR_OFF',
          context: dateStr,
          count: absenceCount,
          lastGeneratedAt: new Date().toISOString(),
        },
        {
          type: 'LATE_ARRIVALS',
          title: 'التأخر',
          description: 'سجل التأخر لنفس اليوم',
          iconHint: 'CLOCK',
          context: dateStr,
          count: lateCount,
          lastGeneratedAt: new Date().toISOString(),
        },
        {
          type: 'EARLY_LEAVE',
          title: 'الاستئذان',
          description: 'طلبات الاستئذان (خروج مبكر) ليوم محدد',
          iconHint: 'LOG_OUT',
          context: dateStr,
          count: earlyLeaveCount,
          lastGeneratedAt: new Date().toISOString(),
        },
        {
          type: 'ABSENCE_DAYS',
          title: 'أيام الغياب للطالب',
          description: 'عدد أيام الغياب مع فلتر أكثر من N يوم',
          iconHint: 'CALENDAR_OFF',
          context: dateStr,
          count: null,
          lastGeneratedAt: new Date().toISOString(),
        },
        {
          type: 'HOMEWORK_LOG',
          title: 'سجل الواجبات',
          description: 'الواجبات المسجّلة لهذا اليوم مرتبة حسب الحصة',
          iconHint: 'BOOK_OPEN',
          context: dateStr,
          count: homeworkCount,
          lastGeneratedAt: new Date().toISOString(),
        },
        {
          type: 'WEEKLY_PLAN',
          title: 'الخطة الأسبوعية',
          description: 'خطط المواد للأسبوع الحالي',
          iconHint: 'CALENDAR_RANGE',
          context: weekStart.toISOString().slice(0, 10),
          count: weeklyLessonCount,
          lastGeneratedAt: new Date().toISOString(),
        },
        {
          type: 'WEEKLY_FOLLOW_UP',
          title: 'المتابعة الأسبوعية',
          description: 'درجات المتابعة الأسبوعية حسب الفصل والمادة',
          iconHint: 'CALENDAR_RANGE',
          context: weekStartSundayStr(dateStr),
          count: followUpCount,
          lastGeneratedAt: new Date().toISOString(),
        },
        {
          type: 'STUDENT_HISTORY',
          title: 'سجل طالب',
          description: 'تاريخ الحضور والفصول لطالب واحد',
          iconHint: 'HISTORY',
          context: 'اختر طالبًا',
          count: null,
          lastGeneratedAt: null,
        },
        {
          type: 'PARENT_ACTIVATION',
          title: 'تفعيل بوابة أولياء الأمور',
          description: 'حسابات مفعّلة وغير مفعّلة لمتابعة تسجيل أولياء الأمور',
          iconHint: 'USERS',
          context: `مفعّل ${activated} من ${canActivate}`,
          count: notActivated,
          lastGeneratedAt: null,
        },
      ],
    });
  })
);

export default router;
