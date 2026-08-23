import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, validateQuery, idParam } from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/errors.js';

const SAUDI_MOBILE_STRICT = /^\+9665\d{8}$/;

function requireSaudiMobile(value, label) {
  const v = String(value ?? '').trim();
  if (!SAUDI_MOBILE_STRICT.test(v)) {
    throw badRequest(`${label} يجب أن يكون بالصيغة +9665XXXXXXXX فقط`);
  }
  return v;
}

function optionalSaudiMobile(value, label) {
  if (value == null || String(value).trim() === '') return null;
  return requireSaudiMobile(value, label);
}

const router = Router();

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];
const HOUSING = ['OWNED', 'RENT', 'OTHER'];
const RELATION = ['FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'UNCLE_P', 'UNCLE_M', 'GUARDIAN', 'OTHER'];
const ID_TYPE = ['NATIONAL', 'IQAMA', 'VISIT'];

const payloadSchema = z.object({
  stage: z.literal('الابتدائية').optional(),
  classId: z.number().int().positive().nullable().optional(),
  className: z.string().optional(),
  nameAr: z.string().min(1),
  nameEnFirst: z.string().min(1),
  nameEnFather: z.string().min(1),
  nameEnGrand: z.string().min(1),
  nameEnFamily: z.string().min(1),
  nationality: z.string().min(1),
  civilId: z.string().min(1),
  idIssueDate: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  birthDate: z.string().min(1),
  birthCountry: z.string().min(1),
  birthCity: z.string().min(1),
  bloodType: z.enum(BLOOD).optional().nullable(),
  housing: z.enum(HOUSING).optional().nullable(),
  adminRegion: z.string().min(1),
  city: z.string().min(1),
  district: z.string().min(1),
  streetMain: z.string().min(1),
  streetSub: z.string().optional().nullable(),
  houseNumber: z.string().min(1),
  email: z.string().email(),
  postalCode: z.string().optional().nullable(),
  poBox: z.string().optional().nullable(),
  guardianName: z.string().min(1),
  guardianNationality: z.string().min(1),
  guardianRelation: z.enum(RELATION),
  guardianIdType: z.enum(ID_TYPE),
  guardianIdNumber: z.string().min(1),
  guardianIdIssueDate: z.string().min(1),
  guardianIdSource: z.string().min(1),
  guardianIdExpiry: z.string().min(1),
  guardianHomePhone: z.string().optional().nullable(),
  guardianMobile: z.string().min(1),
  guardianWhatsappSame: z.boolean().default(true),
  guardianWhatsapp: z.string().optional().nullable(),
  guardianWorkPhone: z.string().optional().nullable(),
  relativeName: z.string().min(1),
  relativePhone: z.string().min(1),
  relativeAddress: z.string().optional().nullable(),
  hasMedicalConditions: z.boolean(),
  medicalDetails: z.string().optional().nullable(),
  attested: z.literal(true),
}).superRefine((data, ctx) => {
  if (data.guardianWhatsappSame) return;
  if (!data.guardianWhatsapp || !String(data.guardianWhatsapp).trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'رقم واتساب مطلوب',
      path: ['guardianWhatsapp'],
    });
  }
});

function serializeSubmission(row) {
  let payload = {};
  try {
    payload = JSON.parse(row.payload || '{}');
  } catch {
    payload = {};
  }
  if (payload.guardianWhatsappSame == null) {
    payload.guardianWhatsappSame = true;
  }
  if (!payload.guardianWhatsapp && payload.guardianMobile) {
    payload.guardianWhatsapp = payload.guardianMobile;
  }
  return {
    id: row.id,
    campaignId: row.campaignId,
    enteredStudentId: row.enteredStudentId,
    studentId: row.studentId,
    classId: row.classId,
    className: row.class?.name ?? payload.className ?? null,
    studentNameAr: row.student?.nameAr ?? payload.nameAr ?? null,
    hasMedical: row.hasMedical,
    linked: Boolean(row.studentId),
    payload,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Prefer the active campaign; otherwise reuse the oldest campaign (even if paused). Never spawn a second school-wide link on pause. */
async function ensureActiveCampaign() {
  let campaign = await prisma.studentProfileCampaign.findFirst({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });
  if (!campaign) {
    campaign = await prisma.studentProfileCampaign.findFirst({
      orderBy: { id: 'asc' },
    });
  }
  if (!campaign) {
    campaign = await prisma.studentProfileCampaign.create({
      data: {
        token: crypto.randomBytes(16).toString('hex'),
        title: 'استمارة البيانات الشخصية للطالب',
        isActive: true,
      },
    });
  }
  return campaign;
}

/** Staff: list/manage campaigns + submissions */
const staffRouter = Router();
staffRouter.use(requireStaff, requireRole('ADMIN', 'STUDENT_AFFAIRS'));

staffRouter.get(
  '/campaign',
  asyncHandler(async (_req, res) => {
    const campaign = await ensureActiveCampaign();
    const count = await prisma.studentProfileSubmission.count({
      where: { campaignId: campaign.id },
    });
    res.json({
      campaign: {
        id: campaign.id,
        token: campaign.token,
        title: campaign.title,
        isActive: campaign.isActive,
        publicPath: `/student-profile/${campaign.token}`,
        submissionCount: count,
      },
    });
  })
);

staffRouter.patch(
  '/campaign',
  validateBody(
    z.object({
      isActive: z.boolean().optional(),
      title: z.string().min(1).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const campaign = await ensureActiveCampaign();
    const data = {};
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive;
    if (req.body.title !== undefined) data.title = req.body.title.trim();
    const updated = await prisma.studentProfileCampaign.update({
      where: { id: campaign.id },
      data,
    });
    res.json({
      campaign: {
        id: updated.id,
        token: updated.token,
        title: updated.title,
        isActive: updated.isActive,
        publicPath: `/student-profile/${updated.token}`,
      },
    });
  })
);

staffRouter.get(
  '/submissions',
  validateQuery(
    z.object({
      classId: z.coerce.number().int().positive().optional(),
      unlinkedOnly: z
        .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
        .optional(),
      medicalOnly: z
        .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
        .optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const campaign = await ensureActiveCampaign();
    const where = { campaignId: campaign.id };
    if (req.query.classId) where.classId = req.query.classId;
    if (req.query.unlinkedOnly === '1' || req.query.unlinkedOnly === 'true') {
      where.studentId = null;
    }
    if (req.query.medicalOnly === '1' || req.query.medicalOnly === 'true') {
      where.hasMedical = true;
    }
    const rows = await prisma.studentProfileSubmission.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        student: { select: { id: true, nameAr: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.json({ submissions: rows.map(serializeSubmission) });
  })
);

staffRouter.patch(
  '/submissions/:id/link',
  validateParams(idParam),
  validateBody(z.object({ studentId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.studentProfileSubmission.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw notFound('الاستمارة غير موجودة');
    const student = await prisma.student.findFirst({
      where: { id: req.body.studentId.trim(), isActive: true },
    });
    if (!student) throw notFound('الطالب غير موجود');
    const row = await prisma.studentProfileSubmission.update({
      where: { id: existing.id },
      data: {
        studentId: student.id,
        classId: student.classId,
        // Keep parent-entered key; rewriting enteredStudentId risks unique clashes.
      },
      include: {
        class: { select: { id: true, name: true } },
        student: { select: { id: true, nameAr: true } },
      },
    });
    res.json({ submission: serializeSubmission(row) });
  })
);

/** Public form API (no staff auth) */
const publicRouter = Router();

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة على الاستمارة، حاول لاحقاً' },
  keyGenerator: (req) => `${req.ip}:${req.params?.token || 'anon'}`,
});

publicRouter.use(publicFormLimiter);

publicRouter.get(
  '/:token/meta',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.studentProfileCampaign.findUnique({
      where: { token: req.params.token },
    });
    if (!campaign || !campaign.isActive) throw notFound('الاستمارة غير متاحة');
    const classes = await prisma.class.findMany({
      orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, gradeLevel: true, section: true },
    });
    res.json({
      title: campaign.title,
      token: campaign.token,
      classes,
    });
  })
);

publicRouter.get(
  '/:token/lookup',
  validateQuery(z.object({ studentId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const campaign = await prisma.studentProfileCampaign.findUnique({
      where: { token: req.params.token },
    });
    if (!campaign || !campaign.isActive) throw notFound('الاستمارة غير متاحة');

    const enteredId = String(req.query.studentId).trim();
    const student = await prisma.student.findFirst({
      where: { id: enteredId, isActive: true },
      include: { class: { select: { id: true, name: true } } },
    });

    const priorCount = await prisma.studentProfileSubmission.count({
      where: {
        campaignId: campaign.id,
        enteredStudentId: enteredId,
      },
    });

    // Do not return prior PII to anonymous clients — name/class only when found.
    res.json({
      found: Boolean(student),
      student: student
        ? {
            id: student.id,
            nameAr: student.nameAr,
            classId: student.classId,
            className: student.class?.name ?? null,
          }
        : null,
      hasPriorSubmission: priorCount > 0,
    });
  })
);

publicRouter.post(
  '/:token/submit',
  validateBody(
    z.object({
      enteredStudentId: z.string().min(1),
      payload: payloadSchema,
    })
  ),
  asyncHandler(async (req, res) => {
    const campaign = await prisma.studentProfileCampaign.findUnique({
      where: { token: req.params.token },
    });
    if (!campaign || !campaign.isActive) throw notFound('الاستمارة غير متاحة');

    const enteredStudentId = req.body.enteredStudentId.trim();
    const payload = req.body.payload;

    if (payload.hasMedicalConditions) {
      if (!payload.medicalDetails || !String(payload.medicalDetails).trim()) {
        throw badRequest('يرجى كتابة تفاصيل الحالات المرضية');
      }
    } else {
      payload.medicalDetails = null;
    }

    if (payload.guardianWhatsappSame !== false) {
      payload.guardianWhatsappSame = true;
      payload.guardianWhatsapp = payload.guardianMobile;
    } else {
      payload.guardianWhatsappSame = false;
      payload.guardianWhatsapp = String(payload.guardianWhatsapp || '').trim();
      if (!payload.guardianWhatsapp) throw badRequest('رقم واتساب مطلوب');
    }

    payload.guardianMobile = requireSaudiMobile(payload.guardianMobile, 'الجوال');
    payload.guardianWhatsapp = requireSaudiMobile(payload.guardianWhatsapp, 'واتساب');
    payload.relativePhone = requireSaudiMobile(payload.relativePhone, 'هاتف القريب');
    payload.guardianHomePhone = optionalSaudiMobile(payload.guardianHomePhone, 'هاتف المنزل');
    payload.guardianWorkPhone = optionalSaudiMobile(payload.guardianWorkPhone, 'هاتف العمل');

    const student = await prisma.student.findFirst({
      where: { id: enteredStudentId, isActive: true },
    });

    let classId = payload.classId ?? null;
    if (student?.classId) classId = student.classId;
    if (!student && !classId) throw badRequest('اختر الصف / الفصل');

    if (classId) {
      const cls = await prisma.class.findUnique({ where: { id: classId } });
      if (!cls) throw badRequest('الفصل غير صالح');
      payload.className = cls.name;
      payload.classId = classId;
    }

    if (student) {
      payload.nameAr = student.nameAr;
    } else if (!payload.nameAr?.trim()) {
      throw badRequest('الاسم العربي مطلوب');
    }

    payload.stage = 'الابتدائية';
    payload.attested = true;

    const data = {
      studentId: student?.id ?? null,
      classId,
      payload: JSON.stringify(payload),
      hasMedical: Boolean(payload.hasMedicalConditions),
      submittedAt: new Date(),
    };

    const row = await prisma.studentProfileSubmission.upsert({
      where: {
        campaignId_enteredStudentId: {
          campaignId: campaign.id,
          enteredStudentId,
        },
      },
      create: {
        campaignId: campaign.id,
        enteredStudentId,
        ...data,
      },
      update: data,
      include: {
        class: { select: { id: true, name: true } },
        student: { select: { id: true, nameAr: true } },
      },
    });

    res.status(200).json({ submission: serializeSubmission(row) });
  })
);

router.use('/staff', staffRouter);
router.use('/public', publicRouter);

export default router;
