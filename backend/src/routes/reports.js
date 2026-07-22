import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateQuery } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
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
  };
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
        studentId: r.studentId,
        studentName: r.student.nameAr,
        className: r.class.name,
        date: date.toISOString().slice(0, 10),
        status: r.status,
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

    const rows = await prisma.homework.findMany({
      where: { date },
      include: {
        class: { select: { name: true } },
        subject: { select: { nameAr: true, nameEn: true } },
        teacher: { select: { name: true } },
      },
      orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }],
    });

    const dateStr = date.toISOString().slice(0, 10);
    res.json({
      date: dateStr,
      schoolName: header.schoolName,
      academicYear: header.academicYear,
      generatedAt: new Date().toISOString(),
      rows: rows.map((r) => ({
        id: r.id,
        className: r.class.name,
        subjectName: r.subject.nameAr,
        teacherName: r.teacher.name,
        description: r.description,
        dueDate: r.dueDate ? toUtcMidnight(r.dueDate).toISOString().slice(0, 10) : null,
      })),
      count: rows.length,
    });
  })
);

function summarizeWeeklyTopics(topics) {
  try {
    const parsed = JSON.parse(topics);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const bits = [];
      for (const [day, lesson] of Object.entries(parsed)) {
        if (!lesson || typeof lesson !== 'object') continue;
        const t = typeof lesson.topics === 'string' ? lesson.topics.trim() : '';
        if (t) bits.push(`${day}: ${t}`);
      }
      if (bits.length) return bits.join(' · ');
    }
  } catch {
    /* plain string */
  }
  return String(topics || '').trim() || '—';
}

/** GET /reports/weekly-plan?date=YYYY-MM-DD — plans for the week containing date */
router.get(
  '/weekly-plan',
  validateQuery(dateQuery),
  asyncHandler(async (req, res) => {
    const date = toUtcMidnight(req.query.date);
    const weekStart = weekStartSaturdayUtc(date);
    const header = await schoolHeader();

    const rows = await prisma.weeklyPlan.findMany({
      where: { weekStart },
      include: {
        class: { select: { name: true } },
        subject: { select: { nameAr: true } },
        teacher: { select: { name: true } },
      },
      orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }],
    });

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    res.json({
      date: date.toISOString().slice(0, 10),
      weekStart: weekStartStr,
      schoolName: header.schoolName,
      academicYear: header.academicYear,
      generatedAt: new Date().toISOString(),
      rows: rows.map((r) => ({
        id: r.id,
        className: r.class.name,
        subjectName: r.subject.nameAr,
        teacherName: r.teacher.name,
        weekStart: weekStartStr,
        topicsSummary: summarizeWeeklyTopics(r.topics),
        objectives: r.objectives,
        notes: r.notes,
      })),
      count: rows.length,
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

    const [absenceCount, lateCount, homeworkCount, weeklyPlanCount] = await Promise.all([
      prisma.attendance.count({
        where: { date, status: { in: ['ABSENT', 'EXCUSED'] } },
      }),
      prisma.lateReport.count({ where: { date } }),
      prisma.homework.count({ where: { date } }),
      prisma.weeklyPlan.count({
        where: { weekStart },
      }),
    ]);

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
          count: weeklyPlanCount,
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
