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

    res.json({
      date: date.toISOString().slice(0, 10),
      schoolName: header.schoolName,
      academicYear: header.academicYear,
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
          lastGeneratedAt: null,
        },
        {
          type: 'LATE_ARRIVALS',
          title: 'التأخر',
          description: 'سجل التأخر لنفس اليوم',
          iconHint: 'CLOCK',
          context: dateStr,
          count: lateCount,
          lastGeneratedAt: null,
        },
        {
          type: 'HOMEWORK_LOG',
          title: 'سجل الواجبات',
          description: 'الواجبات المسجّلة لهذا اليوم',
          iconHint: 'BOOK_OPEN',
          context: dateStr,
          count: homeworkCount,
          lastGeneratedAt: null,
        },
        {
          type: 'WEEKLY_PLAN',
          title: 'الخطة الأسبوعية',
          description: 'خطط المواد للأسبوع الحالي',
          iconHint: 'CALENDAR_RANGE',
          context: dateStr,
          count: weeklyPlanCount,
          lastGeneratedAt: null,
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
