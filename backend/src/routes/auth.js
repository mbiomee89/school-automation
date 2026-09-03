import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { requireStaff } from '../middleware/auth.js';
import {
  verifyPassword,
  hashPassword,
  signStaffToken,
  loginParent,
  registerParent,
  resetParentPassword,
} from '../services/auth.js';
import { unauthorized, badRequest } from '../utils/errors.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة، حاول لاحقاً' },
  // Custom key: IP + email/phone. Do not set removed validate flags
  // (e.g. keyGeneratorIpFallback) — newer express-rate-limit rejects them.
  keyGenerator: (req) => {
    const id =
      (typeof req.body?.phone === 'string' && req.body.phone.trim()) ||
      (typeof req.body?.email === 'string' && req.body.email.trim().toLowerCase()) ||
      'anon';
    return `${req.ip}:${id}`;
  },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const parentAuthSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

const parentRegisterSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(8),
  /** National / iqama id — must match an active student with this parentPhone. */
  studentId: z.string().min(1),
});

/** POST /auth/login — staff */
router.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    // Generic message — no enumeration
    if (!user || !user.isActive) {
      throw unauthorized('Invalid email or password');
    }

    const ok = await verifyPassword(req.body.password, user.passwordHash);
    if (!ok) throw unauthorized('Invalid email or password');

    const token = signStaffToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        langPref: user.langPref,
        mustChangePassword: !!user.mustChangePassword,
      },
    });
  })
);

/** POST /auth/parent/login — parent phone + password */
router.post(
  '/parent/login',
  authLimiter,
  validateBody(parentAuthSchema),
  asyncHandler(async (req, res) => {
    const result = await loginParent(req.body.phone, req.body.password);
    res.json(result);
  })
);

/**
 * POST /auth/parent/register — first-time password. Requires phone + studentId
 * matching an active Student (parentPhone + id); blocks phone-only takeover.
 */
router.post(
  '/parent/register',
  authLimiter,
  validateBody(parentRegisterSchema),
  asyncHandler(async (req, res) => {
    const result = await registerParent(req.body.phone, req.body.password, req.body.studentId);
    res.status(201).json(result);
  })
);

/**
 * POST /auth/parent/reset-password — forgot password. Same proof as register
 * (phone + studentId) but updates an existing ParentAccount.
 */
router.post(
  '/parent/reset-password',
  authLimiter,
  validateBody(parentRegisterSchema),
  asyncHandler(async (req, res) => {
    const result = await resetParentPassword(req.body.phone, req.body.password, req.body.studentId);
    res.json(result);
  })
);

/** GET /auth/me — staff session check */
router.get(
  '/me',
  requireStaff,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/** POST /auth/change-password — staff must know current password */
router.post(
  '/change-password',
  requireStaff,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const full = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!full || !full.isActive) throw unauthorized('Invalid session');

    const ok = await verifyPassword(req.body.currentPassword, full.passwordHash);
    if (!ok) throw badRequest('كلمة المرور الحالية غير صحيحة');

    if (req.body.newPassword === req.body.currentPassword) {
      throw badRequest('اختر كلمة مرور جديدة مختلفة');
    }

    const passwordHash = await hashPassword(req.body.newPassword);
    const user = await prisma.user.update({
      where: { id: full.id },
      data: { passwordHash, mustChangePassword: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        langPref: true,
        mustChangePassword: true,
      },
    });
    res.json({ user });
  })
);

export default router;
