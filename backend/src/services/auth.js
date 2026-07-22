import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { normalizePhone } from '../utils/phone.js';
import { badRequest, conflict, unauthorized } from '../utils/errors.js';

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
    throw unauthorized('Invalid phone or password');
  }

  if (!password || typeof password !== 'string') {
    throw unauthorized('Invalid phone or password');
  }

  const account = await prisma.parentAccount.findUnique({ where: { phone } });
  if (!account || !account.isActive) {
    throw unauthorized('Invalid phone or password');
  }

  const ok = await verifyPassword(password, account.passwordHash);
  if (!ok) throw unauthorized('Invalid phone or password');

  const students = await listActiveStudentsForPhone(phone);
  if (students.length === 0) {
    throw unauthorized('Invalid phone or password');
  }

  const token = signParentToken(phone);
  return { token, phone, students };
}

/**
 * First-time parent registration — phone must already appear on active students,
 * and no ParentAccount may exist yet.
 */
export async function registerParent(rawPhone, password) {
  let phone;
  try {
    phone = normalizePhone(rawPhone);
  } catch {
    throw badRequest('Invalid phone number');
  }

  if (!password || typeof password !== 'string' || password.length < MIN_PARENT_PASSWORD) {
    throw badRequest(`Password must be at least ${MIN_PARENT_PASSWORD} characters`);
  }

  const activeCount = await prisma.student.count({
    where: { parentPhone: phone, isActive: true },
  });
  if (activeCount === 0) {
    throw badRequest('This phone is not linked to any student at the school');
  }

  const existing = await prisma.parentAccount.findUnique({ where: { phone } });
  if (existing) {
    throw conflict('An account already exists for this phone — please log in');
  }

  const passwordHash = await hashPassword(password);
  await prisma.parentAccount.create({
    data: { phone, passwordHash },
  });

  const students = await listActiveStudentsForPhone(phone);
  const token = signParentToken(phone);
  return { token, phone, students };
}
