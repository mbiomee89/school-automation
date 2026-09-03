import { prisma } from '../utils/prisma.js';
import { normalizePhone, tryNormalizePhone } from '../utils/phone.js';

/**
 * When a student's parent phone changes A → B, keep parent login working:
 * - If B already has an account → leave it (do not overwrite password)
 * - Else if A has an account and no other active students remain on A → rename A→B
 * - Else if A has an account and siblings still on A → clone password hash to new B account
 * - Else → noop (parent registers later on B)
 *
 * @param {import('@prisma/client').Prisma.TransactionClient | typeof prisma} tx
 * @param {{ oldPhone: string | null | undefined, newPhone: string, excludeStudentId?: string | null }} args
 */
export async function migrateParentPhoneOnStudentChange(tx, { oldPhone, newPhone, excludeStudentId }) {
  let from = null;
  let to = null;
  try {
    if (oldPhone) from = normalizePhone(String(oldPhone));
  } catch {
    from = null;
  }
  try {
    to = normalizePhone(String(newPhone));
  } catch {
    return;
  }

  if (!to || from === to) return;

  const existingTo = await tx.parentAccount.findUnique({ where: { phone: to } });
  if (existingTo) return;

  if (!from) return;

  const existingFrom = await tx.parentAccount.findUnique({ where: { phone: from } });
  if (!existingFrom) return;

  const othersOnFrom = await tx.student.count({
    where: {
      parentPhone: from,
      isActive: true,
      ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}),
    },
  });

  if (othersOnFrom === 0) {
    await tx.parentAccount.update({
      where: { phone: from },
      data: { phone: to },
    });
    return;
  }

  await tx.parentAccount.create({
    data: {
      phone: to,
      passwordHash: existingFrom.passwordHash,
      isActive: existingFrom.isActive,
    },
  });
}

/**
 * Update Student.parentPhone from card guardianMobile when different.
 * @returns {Promise<{ updated: boolean, oldPhone: string | null, newPhone: string | null, warning?: string }>}
 */
export async function syncStudentParentPhoneFromGuardianMobile(
  tx,
  { studentId, guardianMobile, student: preloaded }
) {
  const student =
    preloaded ||
    (await tx.student.findUnique({
      where: { id: studentId },
      select: { id: true, parentPhone: true, isActive: true, nameAr: true },
    }));

  if (!student || !student.isActive) {
    return { updated: false, oldPhone: null, newPhone: null };
  }

  const newPhone = tryNormalizePhone(String(guardianMobile ?? '').trim());
  if (!newPhone) {
    return { updated: false, oldPhone: student.parentPhone, newPhone: null };
  }

  const oldNorm = tryNormalizePhone(student.parentPhone) || student.parentPhone;
  if (oldNorm === newPhone) {
    return { updated: false, oldPhone: student.parentPhone, newPhone };
  }

  await migrateParentPhoneOnStudentChange(tx, {
    oldPhone: student.parentPhone,
    newPhone,
    excludeStudentId: student.id,
  });

  await tx.student.update({
    where: { id: student.id },
    data: { parentPhone: newPhone },
  });

  return { updated: true, oldPhone: student.parentPhone, newPhone };
}

function parsePayloadJson(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

/**
 * Preview diffs: active campaign, linked + active students, live guardianMobile ≠ parentPhone.
 */
export async function previewParentPhoneDiffsFromCards() {
  const campaign = await prisma.studentProfileCampaign.findFirst({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });
  if (!campaign) {
    return { diffs: [], campaignId: null };
  }

  const rows = await prisma.studentProfileSubmission.findMany({
    where: {
      campaignId: campaign.id,
      studentId: { not: null },
      student: { isActive: true },
    },
    include: {
      student: {
        select: { id: true, nameAr: true, parentPhone: true, isActive: true },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  const diffs = [];
  const cardPhones = new Set();
  const candidates = [];

  for (const row of rows) {
    const student = row.student;
    if (!student?.isActive || !row.studentId) continue;

    const payload = parsePayloadJson(row.payload);
    const cardRaw = payload?.guardianMobile;
    const cardPhone = tryNormalizePhone(String(cardRaw ?? '').trim());
    if (!cardPhone) continue;

    const currentNorm = tryNormalizePhone(student.parentPhone) || student.parentPhone;
    if (currentNorm === cardPhone) continue;

    cardPhones.add(cardPhone);
    candidates.push({ student, cardPhone });
  }

  const cardPhoneList = [...cardPhones];
  const [accounts, studentsOnPhones] = await Promise.all([
    cardPhoneList.length
      ? prisma.parentAccount.findMany({
          where: { phone: { in: cardPhoneList } },
          select: { phone: true },
        })
      : Promise.resolve([]),
    cardPhoneList.length
      ? prisma.student.findMany({
          where: { parentPhone: { in: cardPhoneList }, isActive: true },
          select: { id: true, parentPhone: true },
        })
      : Promise.resolve([]),
  ]);

  const accountSet = new Set(accounts.map((a) => a.phone));

  for (const { student, cardPhone } of candidates) {
    const otherOnCard = studentsOnPhones.filter(
      (s) => (tryNormalizePhone(s.parentPhone) || s.parentPhone) === cardPhone && s.id !== student.id
    ).length;
    const cardHasAccount = accountSet.has(cardPhone);


    let warning = null;
    if (otherOnCard > 0 || cardHasAccount) {
      warning =
        otherOnCard > 0
          ? `الجوال الجديد مرتبط بـ ${otherOnCard} طالب آخر / حساب ولي أمر موجود`
          : 'يوجد حساب ولي أمر على الجوال الجديد';
    }

    diffs.push({
      studentId: student.id,
      nameAr: student.nameAr,
      currentPhone: student.parentPhone,
      cardPhone,
      warning,
    });
  }

  return { diffs, campaignId: campaign.id };
}

/**
 * Apply selected studentIds one-by-one (re-read live card each time).
 */
export async function applyParentPhoneDiffsFromCards(studentIds) {
  const ids = Array.isArray(studentIds)
    ? [...new Set(studentIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    : [];

  const results = { updated: 0, skipped: 0, failed: [] };

  const campaign = await prisma.studentProfileCampaign.findFirst({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });
  if (!campaign) {
    return { ...results, failed: ids.map((studentId) => ({ studentId, error: 'لا توجد حملة نشطة' })) };
  }

  for (const studentId of ids) {
    try {
      await prisma.$transaction(async (tx) => {
        const student = await tx.student.findUnique({
          where: { id: studentId },
          select: { id: true, parentPhone: true, isActive: true, nameAr: true },
        });
        if (!student?.isActive) {
          throw new Error('الطالب غير نشط أو غير موجود');
        }

        const submission = await tx.studentProfileSubmission.findFirst({
          where: {
            campaignId: campaign.id,
            studentId,
          },
          select: { payload: true },
        });
        if (!submission) {
          throw new Error('لا توجد بطاقة مرتبطة في الحملة النشطة');
        }

        const payload = parsePayloadJson(submission.payload);
        const outcome = await syncStudentParentPhoneFromGuardianMobile(tx, {
          studentId,
          guardianMobile: payload?.guardianMobile,
          student,
        });

        if (!outcome.updated) {
          results.skipped += 1;
        } else {
          results.updated += 1;
        }
      });
    } catch (err) {
      results.failed.push({
        studentId,
        error: err?.message || 'فشل التحديث',
      });
    }
  }

  return results;
}
