import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { unauthorized, forbidden } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Staff auth (ADMIN / TEACHER / COUNSELOR). Attaches req.user.
 */
export const requireStaff = asyncHandler(async (req, _res, next) => {
  const token = getBearerToken(req);
  if (!token) throw unauthorized('Missing or invalid Authorization header');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  if (payload.kind !== 'staff' || !payload.sub) {
    throw unauthorized('Invalid token');
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      langPref: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.isActive) {
    throw unauthorized('Invalid or expired token');
  }

  req.user = user;
  next();
});

/**
 * Parent auth — JWT issued after OTP verify. Payload = normalized phone.
 * Attaches req.parentPhone.
 */
export const requireParent = asyncHandler(async (req, _res, next) => {
  const token = getBearerToken(req);
  if (!token) throw unauthorized('Missing or invalid Authorization header');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  if (payload.kind !== 'parent' || !payload.phone) {
    throw unauthorized('Invalid token');
  }

  req.parentPhone = payload.phone;
  next();
});

/** Require one of the given staff roles. Use after requireStaff. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Insufficient permissions'));
    }
    return next();
  };
}

/**
 * Teacher must have a TeacherAssignment for classId.
 * If subjectId is provided, require exact teacher+class+subject match
 * (Homework / WeeklyPlan). Otherwise any subject for that class is enough
 * (Attendance / LateReport).
 */
export function requireTeacherAssignment({ classIdParam = 'classId', subjectIdParam = null } = {}) {
  return asyncHandler(async (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (req.user.role === 'ADMIN') return next();
    if (req.user.role !== 'TEACHER') throw forbidden('Teachers only');

    const classId = Number(req.body?.[classIdParam] ?? req.params?.[classIdParam] ?? req.query?.[classIdParam]);
    if (!Number.isFinite(classId)) throw forbidden('classId is required for this action');

    const where = {
      teacherId: req.user.id,
      classId,
    };

    if (subjectIdParam) {
      const subjectId = Number(
        req.body?.[subjectIdParam] ?? req.params?.[subjectIdParam] ?? req.query?.[subjectIdParam]
      );
      if (!Number.isFinite(subjectId)) throw forbidden('subjectId is required for this action');
      where.subjectId = subjectId;
    }

    const assignment = await prisma.teacherAssignment.findFirst({ where });
    if (!assignment) {
      throw forbidden('You are not assigned to this class' + (subjectIdParam ? '/subject' : ''));
    }

    next();
  });
}
