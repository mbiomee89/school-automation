/**
 * Shared early-leave (استئذان) date/time + uniqueness.
 * Parent portal and staff gate/office create both go through here.
 */

import { prisma } from '../utils/prisma.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { normalizePhone } from '../utils/phone.js';
import {
  addDaysToDateOnlyStr,
  schoolTodayUtcMidnight,
  toUtcMidnight,
  weekdayUtcFromDateOnly,
} from '../utils/dates.js';

const SCHOOL_DAYS = new Set([0, 1, 2, 3, 4]); // Sun–Thu
export const EARLY_LEAVE_MAX_DAYS_AHEAD = 7;
export const ACTIVE_EARLY_LEAVE_STATUSES = ['PENDING', 'APPROVED'];
const CONFLICT_MSG = 'يوجد طلب استئذان معلّق أو معتمد لهذا اليوم';

export const earlyLeaveInclude = {
  student: { select: { id: true, nameAr: true, nameEn: true } },
  class: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
};

/** Combine YYYY-MM-DD + HH:mm (or ISO) into a DateTime. HH:mm uses calendar-day UTC components. */
export function parseLeaveDateTime(dateStr, leaveTimeRaw) {
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

/**
 * @param {string} dateStr
 * @param {{ todayOnly?: boolean, maxDaysAhead?: number }} [opts]
 */
export function assertValidEarlyLeaveDate(dateStr, opts = {}) {
  const todayOnly = !!opts.todayOnly;
  const maxDaysAhead = opts.maxDaysAhead ?? EARLY_LEAVE_MAX_DAYS_AHEAD;
  const today = schoolTodayUtcMidnight();
  const todayStr = today.toISOString().slice(0, 10);
  const date = toUtcMidnight(dateStr);
  const dateOnly = date.toISOString().slice(0, 10);

  if (dateOnly < todayStr) {
    throw badRequest('لا يمكن طلب استئذان لتاريخ ماضٍ');
  }

  if (todayOnly && dateOnly !== todayStr) {
    throw badRequest('يمكن تسجيل الاستئذان لليوم الحالي فقط');
  }

  if (!todayOnly) {
    const maxStr = addDaysToDateOnlyStr(todayStr, maxDaysAhead);
    if (dateOnly > maxStr) {
      throw badRequest('يمكن طلب الاستئذان خلال 7 أيام فقط');
    }
  }

  const dow = weekdayUtcFromDateOnly(dateOnly);
  if (!SCHOOL_DAYS.has(dow)) {
    throw badRequest('الاستئذان متاح لأيام الدوام فقط (الأحد–الخميس)');
  }

  return date;
}

export function serializeEarlyLeaveStaff(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.student?.nameAr ?? null,
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
    reviewerName: row.reviewer?.name ?? null,
    createdByStaff: row.createdById != null,
    createdByName: row.createdBy?.name ?? null,
  };
}

export function parseEarlyLeaveFields(body) {
  const reason = String(body.reason ?? '').trim();
  const pickupName = String(body.pickupName ?? '').trim();
  const pickupRelation = String(body.pickupRelation ?? '').trim();
  if (!reason) throw badRequest('سبب الاستئذان مطلوب');
  if (!pickupName) throw badRequest('اسم المستلم مطلوب');
  if (!pickupRelation) throw badRequest('صلة القرابة مطلوبة');
  let pickupPhone;
  try {
    pickupPhone = normalizePhone(body.pickupPhone);
  } catch {
    throw badRequest('رقم جوال المستلم غير صالح');
  }
  return { reason, pickupName, pickupRelation, pickupPhone };
}

/**
 * @param {{
 *   studentId: string,
 *   dateStr: string,
 *   leaveTimeRaw: string,
 *   reason: string,
 *   pickupName: string,
 *   pickupRelation: string,
 *   pickupPhone: string,
 *   todayOnly?: boolean,
 *   createdById?: number | null,
 *   autoApprove?: boolean,
 * }} input
 */
export async function createEarlyLeaveRecord(input) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, classId: true, isActive: true },
  });
  if (!student || !student.isActive) throw notFound('الطالب غير موجود');
  if (student.classId == null) {
    throw badRequest('الطالب غير مسجّل في فصل حالياً');
  }

  const date = assertValidEarlyLeaveDate(input.dateStr, { todayOnly: !!input.todayOnly });
  const dateStr = date.toISOString().slice(0, 10);
  const leaveTime = parseLeaveDateTime(dateStr, input.leaveTimeRaw);
  const activeSlotKey = `${student.id}|${dateStr}`;
  const now = new Date();
  const autoApprove = !!input.autoApprove;

  try {
    return await prisma.$transaction(async (tx) => {
      const active = await tx.earlyLeaveRequest.findFirst({
        where: {
          studentId: student.id,
          date,
          status: { in: ACTIVE_EARLY_LEAVE_STATUSES },
        },
        include: earlyLeaveInclude,
      });
      if (active) {
        throw conflict(CONFLICT_MSG, { item: serializeEarlyLeaveStaff(active) });
      }

      return tx.earlyLeaveRequest.create({
        data: {
          studentId: student.id,
          classId: student.classId,
          date,
          leaveTime,
          reason: input.reason,
          pickupName: input.pickupName,
          pickupRelation: input.pickupRelation,
          pickupPhone: input.pickupPhone,
          activeSlotKey,
          createdById: input.createdById ?? null,
          ...(autoApprove
            ? {
                status: 'APPROVED',
                reviewedBy: input.createdById ?? null,
                reviewedAt: now,
                reviewNote: 'تسجيل من المدرسة',
              }
            : {}),
        },
        include: earlyLeaveInclude,
      });
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      const existing = await prisma.earlyLeaveRequest.findFirst({
        where: {
          studentId: student.id,
          date,
          status: { in: ACTIVE_EARLY_LEAVE_STATUSES },
        },
        include: earlyLeaveInclude,
      });
      throw conflict(CONFLICT_MSG, existing ? { item: serializeEarlyLeaveStaff(existing) } : undefined);
    }
    throw err;
  }
}
