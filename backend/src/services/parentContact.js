import { Prisma } from '@prisma/client';
import { conflict, notFound } from '../utils/errors.js';

export const parentContactInclude = {
  student: {
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      classId: true,
      class: { select: { id: true, name: true, gradeLevel: true } },
    },
  },
  repliedBy: { select: { id: true, name: true } },
};

export function serializeParentContact(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    studentNameAr: row.student?.nameAr ?? null,
    studentNameEn: row.student?.nameEn ?? null,
    gradeLevel: row.student?.class?.gradeLevel ?? null,
    className: row.student?.class?.name ?? null,
    kind: row.kind,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    replyBody: row.replyBody ?? null,
    repliedAt: row.repliedAt?.toISOString() ?? null,
    repliedByName: row.repliedBy?.name ?? null,
  };
}

export function serializeParentContactForParent(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    kind: row.kind,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    replyBody: row.replyBody ?? null,
    repliedAt: row.repliedAt?.toISOString() ?? null,
  };
}

function isUniqueViolation(err) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function createParentContact(prisma, { studentId, parentPhone, kind, body }) {
  try {
    return await prisma.parentContactMessage.create({
      data: {
        studentId,
        parentPhone,
        kind,
        body,
        status: 'OPEN',
        openMarker: studentId,
      },
      include: parentContactInclude,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict('يوجد رسالة مفتوحة بانتظار رد الإدارة');
    }
    throw err;
  }
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function cancelParentContact(prisma, { id, parentPhone }) {
  const existing = await prisma.parentContactMessage.findUnique({
    where: { id },
    include: { student: { select: { parentPhone: true, isActive: true } } },
  });
  if (!existing) throw notFound('الرسالة غير موجودة');
  if (!existing.student?.isActive || existing.student.parentPhone !== parentPhone) {
    throw notFound('الرسالة غير موجودة');
  }

  const result = await prisma.parentContactMessage.updateMany({
    where: { id, status: 'OPEN' },
    data: { status: 'CANCELLED', openMarker: null },
  });
  if (result.count === 0) {
    throw conflict('لا يمكن إلغاء هذه الرسالة');
  }

  return prisma.parentContactMessage.findUnique({
    where: { id },
    include: parentContactInclude,
  });
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function replyParentContact(prisma, { id, replyBody, repliedById }) {
  const existing = await prisma.parentContactMessage.findUnique({ where: { id } });
  if (!existing) throw notFound('الرسالة غير موجودة');

  const result = await prisma.parentContactMessage.updateMany({
    where: { id, status: 'OPEN' },
    data: {
      replyBody,
      repliedAt: new Date(),
      repliedById,
      status: 'CLOSED',
      openMarker: null,
    },
  });
  if (result.count === 0) {
    throw conflict('تم إغلاق هذه الرسالة مسبقاً');
  }

  return prisma.parentContactMessage.findUnique({
    where: { id },
    include: parentContactInclude,
  });
}
