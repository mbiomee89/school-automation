import { closeOpenEnrollments, openEnrollment } from './enrollment.js';
import { migrateParentPhoneOnStudentChange } from './parentPhoneSync.js';
import { tryNormalizePhone } from '../utils/phone.js';
import { badRequest, notFound } from '../utils/errors.js';
import { parseLeftoverClassIds, retireLeftoverEmptyClasses } from './noorClassMatch.js';

export function fileHasPhone(row) {
  return Boolean(String(row?.parentPhone || '').trim());
}

/**
 * File rows that still need a phone after apply.
 * Confirm: pass landedIds + storedPhoneById so kept numbers and failed rows are omitted.
 * Dedupes by studentId (invalid wins over missing).
 */
export function buildPhoneReview(rows, classNameForRowOrOpts) {
  const opts =
    typeof classNameForRowOrOpts === 'function' || classNameForRowOrOpts == null
      ? { classNameForRow: classNameForRowOrOpts }
      : classNameForRowOrOpts;
  const { classNameForRow, landedIds = null, storedPhoneById = null } = opts;
  const landed = landedIds ? new Set(landedIds) : null;

  const byId = new Map();
  for (const row of rows || []) {
    if (row.phoneReviewReason !== 'missing' && row.phoneReviewReason !== 'invalid') continue;
    if (!row.id) continue;
    if (landed && !landed.has(row.id)) continue;
    if (storedPhoneById) {
      const stored = storedPhoneById.get(row.id) ?? storedPhoneById.get(String(row.id));
      if (String(stored || '').trim()) continue;
    }
    const prev = byId.get(row.id);
    if (prev && prev.reason === 'invalid') continue;
    byId.set(row.id, {
      studentId: row.id,
      nameAr: row.nameAr,
      className: typeof classNameForRow === 'function' ? classNameForRow(row) : null,
      reason: row.phoneReviewReason,
      rawPhone: row.phoneReviewReason === 'invalid' ? String(row.rawPhone || '') : null,
    });
  }
  return [...byId.values()];
}

export function phonesEqual(a, b) {
  const left = tryNormalizePhone(String(a || '')) || String(a || '').trim();
  const right = tryNormalizePhone(String(b || '')) || String(b || '').trim();
  return left === right && left !== '';
}

function namesEqual(existing, row) {
  return existing.nameAr === row.nameAr && existing.nameEn === row.nameEn;
}

export function parseImportedIdsJson(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? [...new Set(arr.filter((id) => typeof id === 'string' && id.trim()))] : [];
  } catch {
    return [];
  }
}

export function serializeImportedIds(ids) {
  return JSON.stringify([...new Set((ids || []).filter(Boolean))]);
}

export function serializePhoneDecision(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    studentNameAr: row.student?.nameAr ?? '',
    className: row.student?.class?.name ?? null,
    currentPhone: row.currentPhone,
    proposedPhone: row.proposedPhone,
    status: row.status,
    batchId: row.batchId,
    createdAt: row.createdAt,
  };
}

export async function upsertPendingPhoneDecision(tx, { studentId, batchId, currentPhone, proposedPhone }) {
  const existing = await tx.noorParentPhoneDecision.findFirst({
    where: { studentId, status: 'PENDING' },
  });
  if (existing) {
    return tx.noorParentPhoneDecision.update({
      where: { id: existing.id },
      data: { batchId, currentPhone, proposedPhone },
    });
  }
  return tx.noorParentPhoneDecision.create({
    data: {
      studentId,
      batchId,
      currentPhone,
      proposedPhone,
      status: 'PENDING',
    },
  });
}

async function ensureEnrollment(tx, { studentId, cls, changedBy }) {
  await closeOpenEnrollments(tx, studentId);
  await openEnrollment(tx, {
    studentId,
    classId: cls.id,
    academicYear: cls.academicYear,
    changedBy,
  });
}

/**
 * Apply one Noor row: create, reactivate, or update name/class.
 * Parent phone on an active student is never overwritten — a pending decision is queued instead.
 */
export async function applyNoorStudentRow(tx, { row, cls, batchId, changedBy }) {
  const existing = await tx.student.findUnique({ where: { id: row.id } });
  const incomingPhone = fileHasPhone(row);

  if (!existing) {
    await tx.student.create({
      data: {
        id: row.id,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        classId: cls.id,
        parentPhone: incomingPhone ? row.parentPhone : '',
        importBatchId: batchId,
        ...(row.parentEmail !== undefined ? { parentEmail: row.parentEmail } : {}),
      },
    });
    await openEnrollment(tx, {
      studentId: row.id,
      classId: cls.id,
      academicYear: cls.academicYear,
      changedBy,
    });
    return { kind: 'created' };
  }

  if (!existing.isActive) {
    const data = {
      importBatchId: batchId,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      isActive: true,
      deletedAt: null,
      classId: cls.id,
      ...(row.parentEmail !== undefined ? { parentEmail: row.parentEmail } : {}),
    };
    if (incomingPhone) data.parentPhone = row.parentPhone;
    await ensureEnrollment(tx, { studentId: row.id, cls, changedBy });
    if (incomingPhone && !phonesEqual(existing.parentPhone, row.parentPhone)) {
      await migrateParentPhoneOnStudentChange(tx, {
        oldPhone: existing.parentPhone,
        newPhone: row.parentPhone,
        excludeStudentId: existing.id,
      });
    }
    await tx.student.update({ where: { id: row.id }, data });
    return { kind: 'reactivated' };
  }

  const phoneChanged = incomingPhone && !phonesEqual(existing.parentPhone, row.parentPhone);
  const nameChanged = !namesEqual(existing, row);
  const classChanged = existing.classId !== cls.id;
  const data = { importBatchId: batchId };
  if (row.parentEmail !== undefined) data.parentEmail = row.parentEmail;
  if (nameChanged) {
    data.nameAr = row.nameAr;
    data.nameEn = row.nameEn;
  }
  if (classChanged) {
    await ensureEnrollment(tx, { studentId: row.id, cls, changedBy });
    data.classId = cls.id;
  }

  await tx.student.update({ where: { id: row.id }, data });

  let phoneConflict = null;
  if (phoneChanged) {
    const decision = await upsertPendingPhoneDecision(tx, {
      studentId: row.id,
      batchId,
      currentPhone: existing.parentPhone,
      proposedPhone: row.parentPhone,
    });
    phoneConflict = {
      id: decision.id,
      studentId: row.id,
      studentNameAr: nameChanged ? row.nameAr : existing.nameAr,
      className: cls.name,
      currentPhone: existing.parentPhone,
      proposedPhone: row.parentPhone,
    };
  }

  return {
    kind: nameChanged || classChanged ? 'updated' : 'unchanged',
    phoneConflict,
  };
}

/**
 * Active students in this academic year who were not in the uploaded file.
 * Unassigned students are included only if they have an enrollment in that year.
 */
export async function listYearScopedMissingStudents(db, { academicYear, importedIds }) {
  const ids = importedIds.filter(Boolean);
  if (ids.length === 0) return [];
  return db.student.findMany({
    where: {
      isActive: true,
      id: { notIn: ids },
      OR: [
        { class: { academicYear } },
        { classId: null, enrollments: { some: { academicYear } } },
      ],
    },
    select: {
      id: true,
      nameAr: true,
      class: { select: { name: true } },
    },
    orderBy: { nameAr: 'asc' },
  });
}

export function mapDeactivationCandidate(row) {
  return {
    id: row.id,
    nameAr: row.nameAr,
    className: row.class?.name ?? null,
  };
}

export async function confirmNoorDeactivations(prisma, { batchId, studentIds }) {
  const batch = await prisma.studentImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw notFound('دفعة الاستيراد غير موجودة');

  const academicYear = batch.academicYear?.trim();
  if (!academicYear) throw badRequest('دفعة الاستيراد بلا عام دراسي — أعد الاستيراد');

  const importedIds = parseImportedIdsJson(batch.importedIdsJson);
  if (importedIds.length === 0) {
    throw badRequest('دفعة الاستيراد لا تحتوي على قائمة الطلاب — أعد الاستيراد');
  }

  const sameYearBatches = await prisma.studentImportBatch.findMany({
    where: { academicYear },
    orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, importedIdsJson: true },
  });
  const latestReal = sameYearBatches.find((b) => parseImportedIdsJson(b.importedIdsJson).length > 0);
  if (latestReal && latestReal.id !== batchId) {
    throw badRequest('هناك استيراد أحدث لنفس العام الدراسي — أكّد الاستبعاد من آخر ملف فقط');
  }

  const allowed = await listYearScopedMissingStudents(prisma, { academicYear, importedIds });
  const allowedSet = new Set(allowed.map((s) => s.id));
  const uniqueRequested = [...new Set(studentIds.filter(Boolean))];
  const ids = uniqueRequested.filter((id) => allowedSet.has(id));

  let deactivated = 0;
  for (const id of ids) {
    await prisma.$transaction(async (tx) => {
      await closeOpenEnrollments(tx, id);
      await tx.student.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date(), classId: null },
      });
    });
    deactivated += 1;
  }

  const remaining = await listYearScopedMissingStudents(prisma, { academicYear, importedIds });
  const leftoverClassIds = parseLeftoverClassIds(batch.leftoverClassIdsJson);
  const retiredClasses =
    leftoverClassIds.length === 0
      ? []
      : await retireLeftoverEmptyClasses(prisma, { leftoverClassIds });
  return {
    deactivated,
    skipped: uniqueRequested.length - deactivated,
    pendingDeactivations: remaining.map(mapDeactivationCandidate),
    retiredClasses,
  };
}

export async function listPendingPhoneDecisions(prisma) {
  const rows = await prisma.noorParentPhoneDecision.findMany({
    where: { status: 'PENDING' },
    include: {
      student: { select: { nameAr: true, class: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializePhoneDecision);
}

export async function resolveNoorPhoneDecision(prisma, { id, action, decidedBy }) {
  if (action !== 'keep' && action !== 'accept') throw badRequest('إجراء غير صالح');

  return prisma.$transaction(async (tx) => {
    const decision = await tx.noorParentPhoneDecision.findUnique({
      where: { id },
      include: { student: { select: { id: true, parentPhone: true } } },
    });
    if (!decision) throw notFound('القرار غير موجود');
    if (decision.status !== 'PENDING') throw badRequest('تم البت في هذا الطلب مسبقاً');

    if (action === 'keep') {
      const updated = await tx.noorParentPhoneDecision.update({
        where: { id },
        data: { status: 'KEPT', decidedBy, decidedAt: new Date() },
        include: { student: { select: { nameAr: true, class: { select: { name: true } } } } },
      });
      return serializePhoneDecision(updated);
    }

    const proposed =
      tryNormalizePhone(String(decision.proposedPhone || '')) || decision.proposedPhone;
    const student = await tx.student.findUnique({ where: { id: decision.studentId } });
    if (student && !phonesEqual(student.parentPhone, proposed)) {
      await migrateParentPhoneOnStudentChange(tx, {
        oldPhone: student.parentPhone,
        newPhone: proposed,
        excludeStudentId: student.id,
      });
      await tx.student.update({
        where: { id: student.id },
        data: { parentPhone: proposed },
      });
    } else if (student && student.parentPhone !== proposed) {
      await tx.student.update({
        where: { id: student.id },
        data: { parentPhone: proposed },
      });
    }

    const updated = await tx.noorParentPhoneDecision.update({
      where: { id },
      data: { status: 'ACCEPTED', decidedBy, decidedAt: new Date() },
      include: { student: { select: { nameAr: true, class: { select: { name: true } } } } },
    });
    return serializePhoneDecision(updated);
  });
}
