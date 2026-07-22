import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, idParam } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../services/auth.js';
import { badRequest, notFound } from '../utils/errors.js';
import { tryNormalizePhone } from '../utils/phone.js';

const router = Router();

router.use(requireStaff, requireRole('ADMIN'));

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'TEACHER', 'COUNSELOR']),
  langPref: z.enum(['AR', 'EN']).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'TEACHER', 'COUNSELOR']).optional(),
  langPref: z.enum(['AR', 'EN']).optional(),
});

const staffSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  langPref: true,
  isActive: true,
  createdAt: true,
};

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: staffSelect,
      orderBy: { name: 'asc' },
    });
    res.json({ users });
  })
);

router.post(
  '/',
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    let phone = req.body.phone ?? null;
    if (phone) {
      phone = tryNormalizePhone(phone);
      if (!phone) throw badRequest('Invalid phone number');
    }

    const passwordHash = await hashPassword(req.body.password);
    const user = await prisma.user.create({
      data: {
        name: req.body.name.trim(),
        email,
        phone,
        passwordHash,
        role: req.body.role,
        langPref: req.body.langPref ?? 'AR',
      },
      select: staffSelect,
    });
    res.status(201).json({ user });
  })
);

router.patch(
  '/:id',
  validateParams(idParam),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound('User not found');

    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.email !== undefined) data.email = req.body.email.trim().toLowerCase();
    if (req.body.role !== undefined) data.role = req.body.role;
    if (req.body.langPref !== undefined) data.langPref = req.body.langPref;
    if (req.body.phone !== undefined) {
      if (req.body.phone === null || req.body.phone === '') {
        data.phone = null;
      } else {
        const phone = tryNormalizePhone(req.body.phone);
        if (!phone) throw badRequest('Invalid phone number');
        data.phone = phone;
      }
    }
    if (req.body.password) {
      data.passwordHash = await hashPassword(req.body.password);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: staffSelect,
    });
    res.json({ user });
  })
);

router.patch(
  '/:id/deactivate',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (id === req.user.id) {
      throw badRequest('You cannot deactivate your own account');
    }
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: staffSelect,
    });
    res.json({ user });
  })
);

router.patch(
  '/:id/activate',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: true },
      select: staffSelect,
    });
    res.json({ user });
  })
);

export default router;
