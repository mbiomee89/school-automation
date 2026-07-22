import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, validateQuery, studentIdParam, idParam } from '../middleware/validate.js';
import { requireParent } from '../middleware/auth.js';
import { uploadAbsenceAttachment, deleteUploadFile } from '../middleware/upload.js';
import {
  hasExcuseAttachment,
  parentAttachmentApiPath,
  sendExcuseAttachment,
} from '../services/excuseAttachment.js';
import fs from 'fs';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { toUtcMidnight } from '../utils/dates.js';

const router = Router();

router.use(requireParent);

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

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
      for (const key of WEEKDAYS) days[key] = parsed[key] ?? null;
      return days;
    }
  } catch {
    /* legacy */
  }
  return { ...emptyDays(), sunday: { topics, objectives: null, notes: null } };
}

async function assertOwnsStudent(parentPhone, studentId) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, parentPhone, isActive: true },
    include: {
      class: { select: { id: true, name: true, gradeLevel: true, section: true, academicYear: true } },
    },
  });
  if (!student) throw forbidden('Student not found for this parent session');
  return student;
}

function mapChild(s) {
  return {
    id: s.id,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    className: s.class?.name ?? 'بدون فصل',
    gradeLevel: s.class?.gradeLevel ?? '',
    classId: s.classId,
    waOptedIn: s.waOptedIn,
  };
}

/** GET /parent/students */
router.get(
  '/students',
  asyncHandler(async (req, res) => {
    const students = await prisma.student.findMany({
      where: { parentPhone: req.parentPhone, isActive: true },
      include: {
        class: { select: { id: true, name: true, gradeLevel: true, section: true, academicYear: true } },
      },
      orderBy: { nameAr: 'asc' },
    });
    res.json({ students: students.map(mapChild), phone: req.parentPhone });
  })
);

const historyQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

/** GET /parent/students/:id/attendance */
router.get(
  '/students/:id/attendance',
  validateParams(studentIdParam),
  validateQuery(historyQuery),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    const where = { studentId: student.id };
    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = toUtcMidnight(req.query.from);
      if (req.query.to) where.date.lte = toUtcMidnight(req.query.to);
    }

    const [attendance, lateReports] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: [{ date: 'desc' }, { period: 'asc' }],
        take: req.query.limit ?? 90,
      }),
      prisma.lateReport.findMany({
        where: { studentId: student.id },
        orderBy: { date: 'desc' },
        take: 90,
      }),
    ]);

    const lateByDate = new Map(
      lateReports.map((l) => [toUtcMidnight(l.date).toISOString().slice(0, 10), l])
    );

    const days = attendance.map((a) => {
      const date = toUtcMidnight(a.date).toISOString().slice(0, 10);
      const late = lateByDate.get(date);
      let status = a.status;
      if (status === 'PRESENT' && late) status = 'LATE';

      return {
        id: a.id,
        date,
        status,
        period: a.period,
        lateMinutes: null,
        excuseStatus: a.reasonStatus,
        excuseNote: null,
        hasExcuseAttachment: hasExcuseAttachment(a),
        absenceReason: a.absenceReason,
        reasonSubmittedAt: a.reasonSubmittedAt?.toISOString() ?? null,
        reasonReviewedAt: a.reasonReviewedAt?.toISOString() ?? null,
        attachmentUrl: hasExcuseAttachment(a) ? parentAttachmentApiPath(a.id) : null,
      };
    });

    res.json({ attendance: days });
  })
);

/** GET /parent/students/:id/homework */
router.get(
  '/students/:id/homework',
  validateParams(studentIdParam),
  validateQuery(historyQuery),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    if (student.classId == null) {
      return res.json({ homework: [] });
    }

    const where = { classId: student.classId };
    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = toUtcMidnight(req.query.from);
      if (req.query.to) where.date.lte = toUtcMidnight(req.query.to);
    }

    const rows = await prisma.homework.findMany({
      where,
      include: { subject: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: req.query.limit ?? 60,
    });

    res.json({
      homework: rows.map((h) => ({
        id: h.id,
        date: toUtcMidnight(h.date).toISOString().slice(0, 10),
        subjectNameAr: h.subject.nameAr,
        subjectNameEn: h.subject.nameEn,
        description: h.description,
        dueDate: h.dueDate ? toUtcMidnight(h.dueDate).toISOString().slice(0, 10) : null,
      })),
    });
  })
);

/** GET /parent/students/:id/weekly-plans */
router.get(
  '/students/:id/weekly-plans',
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    if (student.classId == null) {
      return res.json({ weeklyPlans: [] });
    }

    const rows = await prisma.weeklyPlan.findMany({
      where: { classId: student.classId },
      include: { subject: true },
      orderBy: { weekStart: 'desc' },
      take: 8,
    });

    res.json({
      weeklyPlans: rows.map((p) => ({
        id: p.id,
        weekStart: toUtcMidnight(p.weekStart).toISOString().slice(0, 10),
        subjectNameAr: p.subject.nameAr,
        subjectNameEn: p.subject.nameEn,
        days: parseDays(p.topics),
      })),
    });
  })
);

/** GET /parent/students/:id/summary — today snapshot for home tab */
router.get(
  '/students/:id/summary',
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    const today = toUtcMidnight(new Date());
    const todayStr = today.toISOString().slice(0, 10);

    const [att, late, homeworkDueCount, notifications] = await Promise.all([
      prisma.attendance.findFirst({
        where: { studentId: student.id, date: today },
        orderBy: { period: 'asc' },
      }),
      prisma.lateReport.findFirst({
        where: { studentId: student.id, date: today },
      }),
      student.classId == null
        ? Promise.resolve(0)
        : prisma.homework.count({
            where: {
              classId: student.classId,
              OR: [{ date: today }, { dueDate: today }],
            },
          }),
      prisma.notification.count({
        where: {
          studentId: student.id,
          createdAt: { gte: today },
          status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
        },
      }),
    ]);

    let attendanceStatus = att?.status ?? null;
    if (attendanceStatus === 'PRESENT' && late) attendanceStatus = 'LATE';
    if (!attendanceStatus && late) attendanceStatus = 'LATE';

    res.json({
      date: todayStr,
      attendanceStatus,
      homeworkDueCount,
      newAlertsCount: notifications,
      waOptedIn: student.waOptedIn,
    });
  })
);

/** GET /parent/students/:id/notifications */
router.get(
  '/students/:id/notifications',
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    const rows = await prisma.notification.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const EVENT_AR = {
      ABSENCE: 'إشعار غياب',
      LATE: 'إشعار تأخر',
      HOMEWORK_DIGEST: 'ملخص الواجبات',
      WEEKLY_PLAN: 'الخطة الأسبوعية',
    };

    res.json({
      notifications: rows.map((n) => ({
        id: n.id,
        eventType: n.eventType,
        status: n.status,
        summary: EVENT_AR[n.eventType] ?? n.templateName,
        sentAt: n.sentAt?.toISOString() ?? null,
      })),
    });
  })
);

/** GET /parent/students/:id/excuses — absence reasons submitted for this child */
router.get(
  '/students/:id/excuses',
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    const rows = await prisma.attendance.findMany({
      where: {
        studentId: student.id,
        reasonStatus: { in: ['PENDING_REVIEW', 'APPROVED', 'REJECTED'] },
      },
      orderBy: { reasonSubmittedAt: 'desc' },
    });

    res.json({
      excuses: rows.map((a) => ({
        id: a.id,
        attendanceDate: toUtcMidnight(a.date).toISOString().slice(0, 10),
        reasonText: a.absenceReason ?? '',
        attachmentUrl: hasExcuseAttachment(a) ? parentAttachmentApiPath(a.id) : null,
        status: a.reasonStatus,
        submittedAt: a.reasonSubmittedAt?.toISOString() ?? a.createdAt.toISOString(),
        reviewedAt: a.reasonReviewedAt?.toISOString() ?? null,
        counselorNote: a.counselorNote ?? null,
      })),
    });
  })
);

/**
 * GET /parent/attendance/:id/attachment?download=1
 */
router.get(
  '/attendance/:id/attachment',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const attendance = await prisma.attendance.findUnique({
      where: { id: req.params.id },
      include: { student: true },
    });
    if (!attendance) throw notFound('سجل الغياب غير موجود');
    if (attendance.student.parentPhone !== req.parentPhone || !attendance.student.isActive) {
      throw forbidden('غير مصرح');
    }
    if (!hasExcuseAttachment(attendance)) throw notFound('لا يوجد مرفق');

    const download =
      req.query.download === '1' ||
      req.query.download === 'true' ||
      req.query.download === 'yes';
    sendExcuseAttachment(res, attendance, { download });
  })
);

/**
 * POST /parent/attendance/:id/reason
 * multipart: reason (text) + optional attachment file
 */
router.post(
  '/attendance/:id/reason',
  validateParams(idParam),
  (req, res, next) => uploadAbsenceAttachment(req, res, next),
  asyncHandler(async (req, res) => {
    const attendance = await prisma.attendance.findUnique({
      where: { id: req.params.id },
      include: { student: true },
    });
    if (!attendance) throw notFound('Attendance record not found');

    if (attendance.student.parentPhone !== req.parentPhone || !attendance.student.isActive) {
      throw forbidden('Not allowed');
    }

    if (attendance.status !== 'ABSENT') {
      throw badRequest('Excuse can only be submitted for ABSENT records');
    }

    if (attendance.reasonStatus === 'PENDING_REVIEW' || attendance.reasonStatus === 'APPROVED') {
      throw conflict('An excuse is already pending or approved for this absence');
    }

    const reason =
      typeof req.body?.reason === 'string'
        ? req.body.reason.trim()
        : typeof req.body?.reasonText === 'string'
          ? req.body.reasonText.trim()
          : '';

    if (!reason) throw badRequest('نص سبب الغياب مطلوب');

    let attachmentRelative = null;
    let attachmentData = null;
    let attachmentMime = null;
    if (req.file) {
      attachmentRelative = `absence-reasons/${req.file.filename}`;
      attachmentData = fs.readFileSync(req.file.path);
      attachmentMime = req.file.mimetype;
    }

    if (attendance.absenceAttachmentUrl && attachmentRelative) {
      deleteUploadFile(attendance.absenceAttachmentUrl);
    }

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        absenceReason: reason,
        absenceAttachmentUrl: attachmentRelative ?? attendance.absenceAttachmentUrl,
        ...(attachmentData
          ? {
              absenceAttachmentData: attachmentData,
              absenceAttachmentMime: attachmentMime,
            }
          : {}),
        reasonSubmittedAt: new Date(),
        reasonStatus: 'PENDING_REVIEW',
        reasonReviewedBy: null,
        reasonReviewedAt: null,
        counselorNote: null,
      },
    });

    res.status(201).json({
      excuse: {
        id: updated.id,
        attendanceDate: toUtcMidnight(updated.date).toISOString().slice(0, 10),
        reasonText: updated.absenceReason,
        attachmentUrl: hasExcuseAttachment(updated) ? parentAttachmentApiPath(updated.id) : null,
        status: updated.reasonStatus,
        submittedAt: updated.reasonSubmittedAt.toISOString(),
        reviewedAt: null,
        counselorNote: null,
      },
    });
  })
);

const optInSchema = z.object({
  waOptedIn: z.boolean(),
  studentId: z.string().min(1).optional(),
});

/** PATCH /parent/wa-opt-in */
router.patch(
  '/wa-opt-in',
  validateBody(optInSchema),
  asyncHandler(async (req, res) => {
    const { waOptedIn, studentId } = req.body;

    if (studentId) {
      await assertOwnsStudent(req.parentPhone, studentId);
      await prisma.student.update({
        where: { id: studentId },
        data: { waOptedIn },
      });
    } else {
      await prisma.student.updateMany({
        where: { parentPhone: req.parentPhone, isActive: true },
        data: { waOptedIn },
      });
    }

    const students = await prisma.student.findMany({
      where: { parentPhone: req.parentPhone, isActive: true },
      include: {
        class: { select: { id: true, name: true, gradeLevel: true, section: true, academicYear: true } },
      },
      orderBy: { nameAr: 'asc' },
    });

    res.json({ students: students.map(mapChild) });
  })
);

export default router;
