import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { normalizePhone } from '../utils/phone.js';
import { badRequest, unauthorized, notFound } from '../utils/errors.js';

const SALT_ROUNDS = 10;
const MIN_PARENT_PASSWORD = 8;

const PARENT_REGISTER_GENERIC =
  'تعذّر إنشاء الحساب. تحقق من البيانات أو سجّل الدخول إن كان الحساب موجوداً';

const PARENT_RESET_GENERIC =
  'تعذّر إعادة التعيين. تحقق من الجوال ومعرّف الطالب، أو تواصل مع المدرسة.';

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signStaffToken(user) {
  return jwt.sign(
    { kind: 'staff', sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

export function signParentToken(phone) {
  return jwt.sign(
    { kind: 'parent', phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.PARENT_JWT_EXPIRES_IN || '2h' }
  );
}

async function listActiveStudentsForPhone(phone) {
  return prisma.student.findMany({
    where: { parentPhone: phone, isActive: true },
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      classId: true,
      class: { select: { id: true, name: true, academicYear: true } },
    },
  });
}

/**
 * Parent login — phone + password.
 * Generic 401 message (no phone/account enumeration).
 */
export async function loginParent(rawPhone, password) {
  let phone;
  try {
    phone = normalizePhone(rawPhone);
  } catch {
    throw unauthorized('رقم الجوال أو كلمة المرور غير صحيحة');
  }

  if (!password || typeof password !== 'string') {
    throw unauthorized('رقم الجوال أو كلمة المرور غير صحيحة');
  }

  const account = await prisma.parentAccount.findUnique({ where: { phone } });
  if (!account || !account.isActive) {
    throw unauthorized('رقم الجوال أو كلمة المرور غير صحيحة');
  }

  const ok = await verifyPassword(password, account.passwordHash);
  if (!ok) throw unauthorized('رقم الجوال أو كلمة المرور غير صحيحة');

  const students = await listActiveStudentsForPhone(phone);
  if (students.length === 0) {
    throw unauthorized('رقم الجوال أو كلمة المرور غير صحيحة');
  }

  const token = signParentToken(phone);
  return { token, phone, students };
}

/**
 * First-time parent registration — requires an active Student whose id matches
 * studentId and parentPhone matches the phone. Blocks phone-only takeover.
 * No ParentAccount may exist yet for that phone.
 */
export async function registerParent(rawPhone, password, rawStudentId) {
  let phone;
  try {
    phone = normalizePhone(rawPhone);
  } catch {
    throw badRequest('Invalid phone number');
  }

  if (!password || typeof password !== 'string' || password.length < MIN_PARENT_PASSWORD) {
    throw badRequest(`Password must be at least ${MIN_PARENT_PASSWORD} characters`);
  }

  const studentId = String(rawStudentId ?? '').trim();
  if (!studentId) {
    throw badRequest(PARENT_REGISTER_GENERIC);
  }

  // Proof of possession: national ID must belong to a child on this phone.
  const matched = await prisma.student.findFirst({
    where: {
      id: studentId,
      parentPhone: phone,
      isActive: true,
    },
    select: { id: true },
  });
  if (!matched) {
    // Same generic message — avoid phone / ID enumeration.
    throw badRequest(PARENT_REGISTER_GENERIC);
  }

  const existing = await prisma.parentAccount.findUnique({ where: { phone } });
  if (existing) {
    throw badRequest(PARENT_REGISTER_GENERIC);
  }

  const passwordHash = await hashPassword(password);
  await prisma.parentAccount.create({
    data: { phone, passwordHash },
  });

  const students = await listActiveStudentsForPhone(phone);
  const token = signParentToken(phone);
  return { token, phone, students };
}

/**
 * Forgot-password reset — same proof as register (phone + child national ID),
 * but requires an existing ParentAccount and updates its passwordHash.
 */
export async function resetParentPassword(rawPhone, password, rawStudentId) {
  let phone;
  try {
    phone = normalizePhone(rawPhone);
  } catch {
    throw badRequest(PARENT_RESET_GENERIC);
  }

  if (!password || typeof password !== 'string' || password.length < MIN_PARENT_PASSWORD) {
    throw badRequest(`Password must be at least ${MIN_PARENT_PASSWORD} characters`);
  }

  const studentId = String(rawStudentId ?? '').trim();
  if (!studentId) {
    throw badRequest(PARENT_RESET_GENERIC);
  }

  const matched = await prisma.student.findFirst({
    where: {
      id: studentId,
      parentPhone: phone,
      isActive: true,
    },
    select: { id: true },
  });
  if (!matched) {
    throw badRequest(PARENT_RESET_GENERIC);
  }

  const existing = await prisma.parentAccount.findUnique({ where: { phone } });
  if (!existing || !existing.isActive) {
    throw badRequest(PARENT_RESET_GENERIC);
  }

  const passwordHash = await hashPassword(password);
  await prisma.parentAccount.update({
    where: { phone },
    data: { passwordHash },
  });

  const students = await listActiveStudentsForPhone(phone);
  if (students.length === 0) {
    throw badRequest(PARENT_RESET_GENERIC);
  }

  const token = signParentToken(phone);
  return { token, phone, students };
}

/** Staff-issued temporary password for a student's linked parent phone. */
export function generateTempParentPassword() {
  return `Parent${crypto.randomInt(100000, 999999)}`;
}

/**
 * Staff: set a temporary password on ParentAccount for the student's parentPhone.
 * Returns the plaintext password once. Creates no account if none exists.
 */
export async function staffResetParentPasswordForStudent(studentId) {
  const id = String(studentId ?? '').trim();
  if (!id) throw badRequest('معرّف الطالب مطلوب');

  const student = await prisma.student.findFirst({
    where: { id, isActive: true },
    select: { id: true, parentPhone: true, nameAr: true },
  });
  if (!student) throw notFound('الطالب غير موجود');
  if (!student.parentPhone) {
    throw badRequest('لا يوجد جوال ولي أمر مسجّل لهذا الطالب');
  }

  const account = await prisma.parentAccount.findUnique({
    where: { phone: student.parentPhone },
  });
  if (!account) {
    throw badRequest(
      'لا يوجد حساب ولي أمر لهذا الجوال بعد — يمكن لولي الأمر إنشاء كلمة مرور من التطبيق'
    );
  }
  if (!account.isActive) {
    throw badRequest('حساب ولي الأمر موقوف');
  }

  const temporaryPassword = generateTempParentPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.parentAccount.update({
    where: { phone: student.parentPhone },
    data: { passwordHash },
  });

  return {
    phone: student.parentPhone,
    studentId: student.id,
    studentNameAr: student.nameAr,
    temporaryPassword,
  };
}
