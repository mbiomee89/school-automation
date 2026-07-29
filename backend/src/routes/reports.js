import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateQuery } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { notFound } from '../utils/errors.js';
import { toUtcMidnight, weekStartSaturdayUtc } from '../utils/dates.js';

const router = Router();

router.use(requireStaff, requireRole('ADMIN', 'COUNSELOR'));

const dateQuery = z.object({
  date: z.string().min(1),
});

const SINGLETON_ID = 1;

async function schoolHeader() {
  const settings = await prisma.schoolSettings.findUnique({ where: { id: SINGLETON_ID } });
  return {
    schoolName: settings?.name ?? 'المدرسة',
    academicYear: settings?.academicYear ?? '',
    principalName: settings?.principalName ?? null,
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

/** GET /reports/homework-log?date=YYYY-MM-DD */
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
      orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }],
    });

    const dateStr = date.toISOString().slice(0, 10);
    const rows = found.map((r) => ({
      id: r.id,
      classId: r.classId,
      className: r.class.name,
      subjectName: r.subject.nameAr,
      teacherName: r.teacher.name,
      description: r.description,
      dueDate: r.dueDate ? toUtcMidnight(r.dueDate).toISOString().slice(0, 10) : null,
    }));

    res.json({
      date: dateStr,
      schoolName: header.schoolName,
      academicYear: header.academicYear,
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
      return a.subjectName.localeCompare(b.subjectName, 'ar');
    });

    res.json({
      date: date.toISOString().slice(0, 10),
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      schoolName: header.schoolName,
      academicYear: header.academicYear,
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
      generatedAt: new Date().toISOString(),
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
      count: attendanceRows.length + lateRows.length + enrollmentRows.length,
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

    const [absenceCount, lateCount, homeworkCount, weeklyPlans] = await Promise.all([
      prisma.attendance.count({
        where: { date, status: { in: ['ABSENT', 'EXCUSED'] } },
      }),
      prisma.lateReport.count({ where: { date } }),
      prisma.homework.count({ where: { date } }),
      prisma.weeklyPlan.findMany({
        where: { weekStart },
        select: { topics: true, classId: true, class: { select: { name: true } }, subject: { select: { nameAr: true } }, teacher: { select: { name: true } }, id: true },
      }),
    ]);

    const weeklyLessonCount = weeklyPlans.flatMap((p) =>
      expandWeeklyLessonRows({
        ...p,
        class: p.class,
        subject: p.subject,
        teacher: p.teacher,
      })
    ).length;

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
          type: 'HOMEWORK_LOG',
          title: 'سجل الواجبات',
          description: 'الواجبات المسجّلة لهذا اليوم',
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
          type: 'STUDENT_HISTORY',
          title: 'سجل طالب',
          description: 'تاريخ الحضور والفصول لطالب واحد',
          iconHint: 'HISTORY',
          context: 'اختر طالبًا',
          count: null,
          lastGeneratedAt: null,
        },
      ],
    });
  })
);

export default router;
