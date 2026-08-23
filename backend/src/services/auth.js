import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { normalizePhone } from '../utils/phone.js';
import { badRequest, unauthorized } from '../utils/errors.js';

const SALT_ROUNDS = 10;
const MIN_PARENT_PASSWORD = 8;

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

const PARENT_REGISTER_GENERIC =
  'تعذّر إنشاء الحساب. تحقق من البيانات أو سجّل الدخول إن كان الحساب موجوداً';

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
