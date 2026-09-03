import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, validateQuery, studentIdParam, idParam } from '../middleware/validate.js';
import { requireParent } from '../middleware/auth.js';
import { uploadAbsenceAttachment, assertSniffedAttachment, deleteUploadFile } from '../middleware/upload.js';
import {
  hasExcuseAttachment,
  parentAttachmentApiPath,
  sendExcuseAttachment,
} from '../services/excuseAttachment.js';
import fs from 'fs';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import {
  toUtcMidnight,
  schoolTodayUtcMidnight,
  addDaysToDateOnlyStr,
  weekdayUtcFromDateOnly,
  weekStartSaturdayUtc,
  schoolDateOnlyStr,
} from '../utils/dates.js';
import { normalizePhone } from '../utils/phone.js';
import { schoolLogoUrl } from '../services/schoolLogo.js';
import { getClassWeekSchedule } from '../services/timetableImport.js';

const router = Router();

router.use(requireParent);

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
    if (parsed && typeof parsed === 'object' && 'sunday' in parsed) return parsed;
  } catch {
    /* legacy */
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
  if (plan.date && plan.period && (plan.title || '').trim()) {
    const dateStr = toUtcMidnight(plan.date).toISOString().slice(0, 10);
    const dayIdx = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
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
        excuseNote: a.counselorNote ?? null,
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
    const header = await schoolHeader();
    const className = student.class?.name ?? 'بدون فصل';
    if (student.classId == null) {
      return res.json({
        ...header,
        className,
        classId: null,
        homework: [],
      });
    }

    const where = { classId: student.classId };
    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = toUtcMidnight(req.query.from);
      if (req.query.to) where.date.lte = toUtcMidnight(req.query.to);
    }

    const rows = await prisma.homework.findMany({
      where,
      include: {
        subject: true,
        teacher: { select: { name: true } },
        class: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { period: 'asc' }, { subjectId: 'asc' }],
      take: req.query.limit ?? 60,
    });

    res.json({
      ...header,
      className: student.class.name,
      classId: student.classId,
      homework: rows.map((h) => ({
        id: h.id,
        date: toUtcMidnight(h.date).toISOString().slice(0, 10),
        subjectNameAr: h.subject.nameAr,
        subjectNameEn: h.subject.nameEn,
        subjectName: h.subject.nameAr,
        teacherName: h.teacher.name,
        className: h.class.name,
        period: h.period || null,
        noHomework: Boolean(h.noHomework),
        description: h.noHomework ? 'لا يوجد واجب' : h.description,
        dueDate: h.dueDate ? toUtcMidnight(h.dueDate).toISOString().slice(0, 10) : null,
      })),
    });
  })
);

const weeklyPlanQuery = z.object({
  date: z.string().optional(),
});

/** GET /parent/students/:id/weekly-plans?date=YYYY-MM-DD — formal week sheet for child's class */
router.get(
  '/students/:id/weekly-plans',
  validateParams(studentIdParam),
  validateQuery(weeklyPlanQuery),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    const header = await schoolHeader();
    const className = student.class?.name ?? 'بدون فصل';

    if (student.classId == null) {
      return res.json({
        ...header,
        className,
        classId: null,
        weekStart: null,
        weekEnd: null,
        rows: [],
        weeklyPlans: [],
      });
    }

    const anchor = req.query.date
      ? toUtcMidnight(req.query.date)
      : schoolTodayUtcMidnight();
    const weekStart = weekStartSaturdayUtc(anchor);
    const weekEnd = new Date(
      Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 5)
    );

    const plans = await prisma.weeklyPlan.findMany({
      where: { classId: student.classId, weekStart },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { nameAr: true, nameEn: true } },
        teacher: { select: { name: true } },
      },
      orderBy: [{ subjectId: 'asc' }],
    });

    const rows = plans.flatMap(expandWeeklyLessonRows);
    const dayOrder = Object.fromEntries(WEEKDAY_KEYS.map((k, i) => [k, i]));
    rows.sort((a, b) => {
      const dayDiff = (dayOrder[a.dayKey] ?? 99) - (dayOrder[b.dayKey] ?? 99);
      if (dayDiff !== 0) return dayDiff;
      const periodDiff = Number(a.period || 0) - Number(b.period || 0);
      if (periodDiff !== 0) return periodDiff;
      return a.subjectName.localeCompare(b.subjectName, 'ar');
    });

    // Legacy card shape for older clients
    const weeklyPlans = plans.map((p) => {
      if (p.date && p.period && (p.title || '').trim()) {
        const dateStr = toUtcMidnight(p.date).toISOString().slice(0, 10);
        const dayIdx = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
        return {
          id: p.id,
          weekStart: toUtcMidnight(p.weekStart).toISOString().slice(0, 10),
          date: dateStr,
          period: p.period,
          dayLabel: WEEKDAY_LABELS[WEEKDAY_KEYS[dayIdx]] || '',
          title: p.title.trim(),
          subjectNameAr: p.subject.nameAr,
          subjectNameEn: p.subject.nameEn,
          days: null,
        };
      }
      return {
        id: p.id,
        weekStart: toUtcMidnight(p.weekStart).toISOString().slice(0, 10),
        date: null,
        period: null,
        dayLabel: null,
        title: null,
        subjectNameAr: p.subject.nameAr,
        subjectNameEn: p.subject.nameEn,
        days: parseDays(p.topics),
      };
    });

    res.json({
      ...header,
      className: student.class.name,
      classId: student.classId,
      date: anchor.toISOString().slice(0, 10),
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      rows,
      weeklyPlans,
    });
  })
);

const timetableQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** GET /parent/students/:id/timetable — class weekly schedule for parent home */
router.get(
  '/students/:id/timetable',
  validateParams(studentIdParam),
  validateQuery(timetableQuery),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    const header = await schoolHeader();
    const anchor = req.query.date || schoolDateOnlyStr();

    if (student.classId == null) {
      const empty = await getClassWeekSchedule(null, anchor, header.academicYear || undefined);
      return res.json({
        ...header,
        ...empty,
        classId: null,
        className: 'بدون فصل',
        studentId: student.id,
        studentNameAr: student.nameAr,
      });
    }

    const schedule = await getClassWeekSchedule(student.classId, anchor);
    res.json({
      ...header,
      ...schedule,
      className: schedule.className || student.class?.name || 'بدون فصل',
      studentId: student.id,
      studentNameAr: student.nameAr,
    });
  })
);

/** GET /parent/students/:id/summary — today snapshot for home tab */
router.get(
  '/students/:id/summary',
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    const today = schoolTodayUtcMidnight();
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
  assertSniffedAttachment,
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

const SCHOOL_DAYS = new Set([0, 1, 2, 3, 4]); // Sun–Thu
const EARLY_LEAVE_MAX_DAYS_AHEAD = 7;

const earlyLeaveCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leaveTime: z.string().min(1),
  reason: z.string().min(1),
  pickupName: z.string().min(1),
  pickupRelation: z.string().min(1),
  pickupPhone: z.string().min(1),
});

const earlyLeaveCancelParams = z.object({
  id: z.coerce.number().int().positive(),
});

function serializeEarlyLeave(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    classId: row.classId,
    className: row.class?.name ?? null,
    date: toUtcMidnight(row.date).toISOString().slice(0, 10),
    leaveTime: row.leaveTime.toISOString(),
    reason: row.reason,
    pickupName: row.pickupName,
    pickupRelation: row.pickupRelation,
    pickupPhone: row.pickupPhone,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

/** Combine YYYY-MM-DD + HH:mm (or ISO) into a DateTime. HH:mm uses calendar-day UTC components. */
function parseLeaveDateTime(dateStr, leaveTimeRaw) {
  const raw = String(leaveTimeRaw).trim();
  const hm = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (hm) {
    const hour = Number(hm[1]);
    const minute = Number(hm[2]);
    if (hour > 23 || minute > 59) throw badRequest('وقت غير صالح');
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) throw badRequest('وقت غير صالح');
  return dt;
}

function assertValidEarlyLeaveDate(dateStr) {
  const today = schoolTodayUtcMidnight();
  const todayStr = today.toISOString().slice(0, 10);
  const date = toUtcMidnight(dateStr);
  const dateOnly = date.toISOString().slice(0, 10);

  if (dateOnly < todayStr) {
    throw badRequest('لا يمكن طلب استئذان لتاريخ ماضٍ');
  }

  const maxStr = addDaysToDateOnlyStr(todayStr, EARLY_LEAVE_MAX_DAYS_AHEAD);
  if (dateOnly > maxStr) {
    throw badRequest('يمكن طلب الاستئذان خلال 7 أيام فقط');
  }

  const dow = weekdayUtcFromDateOnly(dateOnly);
  if (!SCHOOL_DAYS.has(dow)) {
    throw badRequest('الاستئذان متاح لأيام الدوام فقط (الأحد–الخميس)');
  }

  return date;
}

/** GET /parent/students/:id/early-leave */
router.get(
  '/students/:id/early-leave',
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    const rows = await prisma.earlyLeaveRequest.findMany({
      where: { studentId: student.id },
      include: { class: { select: { id: true, name: true } } },
      orderBy: [{ date: 'desc' }, { requestedAt: 'desc' }],
      take: 60,
    });
    res.json({ earlyLeaveRequests: rows.map(serializeEarlyLeave) });
  })
);

/** POST /parent/students/:id/early-leave */
router.post(
  '/students/:id/early-leave',
  validateParams(studentIdParam),
  validateBody(earlyLeaveCreateSchema),
  asyncHandler(async (req, res) => {
    const student = await assertOwnsStudent(req.parentPhone, req.params.id);
    if (student.classId == null) {
      throw badRequest('الطالب غير مسجّل في فصل حالياً');
    }

    const date = assertValidEarlyLeaveDate(req.body.date);
    const dateStr = date.toISOString().slice(0, 10);
    const leaveTime = parseLeaveDateTime(dateStr, req.body.leaveTime);

    const reason = req.body.reason.trim();
    const pickupName = req.body.pickupName.trim();
    const pickupRelation = req.body.pickupRelation.trim();
    if (!reason) throw badRequest('سبب الاستئذان مطلوب');
    if (!pickupName) throw badRequest('اسم المستلم مطلوب');
    if (!pickupRelation) throw badRequest('صلة القرابة مطلوبة');

    let pickupPhone;
    try {
      pickupPhone = normalizePhone(req.body.pickupPhone);
    } catch {
      throw badRequest('رقم جوال المستلم غير صالح');
    }

    const activeSlotKey = `${student.id}|${dateStr}`

    let row
    try {
      row = await prisma.$transaction(async (tx) => {
        const active = await tx.earlyLeaveRequest.findFirst({
          where: {
            studentId: student.id,
            date,
            status: { in: ['PENDING', 'APPROVED'] },
          },
        })
        if (active) {
          throw conflict('يوجد طلب استئذان معلّق أو معتمد لهذا اليوم')
        }

        return tx.earlyLeaveRequest.create({
          data: {
            studentId: student.id,
            classId: student.classId,
            date,
            leaveTime,
            reason,
            pickupName,
            pickupRelation,
            pickupPhone,
            activeSlotKey,
          },
          include: { class: { select: { id: true, name: true } } },
        })
      })
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        throw conflict('يوجد طلب استئذان معلّق أو معتمد لهذا اليوم')
      }
      throw err
    }

    res.status(201).json({ earlyLeaveRequest: serializeEarlyLeave(row) });
  })
);

/** POST /parent/early-leave/:id/cancel */
router.post(
  '/early-leave/:id/cancel',
  validateParams(earlyLeaveCancelParams),
  asyncHandler(async (req, res) => {
    const existing = await prisma.earlyLeaveRequest.findUnique({
      where: { id: req.params.id },
      include: {
        student: true,
        class: { select: { id: true, name: true } },
      },
    });
    if (!existing) throw notFound('طلب الاستئذان غير موجود');
    if (existing.student.parentPhone !== req.parentPhone || !existing.student.isActive) {
      throw forbidden('غير مصرح');
    }
    if (existing.status !== 'PENDING' && existing.status !== 'APPROVED') {
      throw conflict('لا يمكن إلغاء هذا الطلب');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.earlyLeaveRequest.updateMany({
        where: {
          id: existing.id,
          status: { in: ['PENDING', 'APPROVED'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          activeSlotKey: null,
        },
      });
      if (result.count === 0) {
        throw conflict('لا يمكن إلغاء هذا الطلب');
      }
      return tx.earlyLeaveRequest.findUnique({
        where: { id: existing.id },
        include: { class: { select: { id: true, name: true } } },
      });
    });

    res.json({ earlyLeaveRequest: serializeEarlyLeave(updated) });
  })
);

export default router;
