import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { requireStaff } from '../middleware/auth.js';
import {
  verifyPassword,
  signStaffToken,
  loginParent,
  registerParent,
} from '../services/auth.js';
import { unauthorized } from '../utils/errors.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة، حاول لاحقاً' },
  validate: { keyGeneratorIpFallback: false },
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
 * POST /auth/parent/register — first-time password for a phone that already
 * appears on active student records.
 */
router.post(
  '/parent/register',
  authLimiter,
  validateBody(parentRegisterSchema),
  asyncHandler(async (req, res) => {
    const result = await registerParent(req.body.phone, req.body.password);
    res.status(201).json(result);
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

export default router;
