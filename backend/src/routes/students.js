import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  studentIdParam,
} from '../middleware/validate.js';
import { requireStaff, requireRole } from '../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { normalizePhone } from '../utils/phone.js';
import { uploadNoorSpreadsheet } from '../middleware/upload.js';
import { classDisplayName, parseNoorSpreadsheet } from '../services/noorImport.js';

const router = Router();

router.use(requireStaff);

async function teacherAssignedClassIds(teacherId) {
  const rows = await prisma.teacherAssignment.findMany({
    where: { teacherId },
    select: { classId: true },
  });
  return [...new Set(rows.map((r) => r.classId))];
}

/** Teachers only see students in their assigned classes; admin/counselor see all. */
async function applyStaffStudentScope(user, where) {
  if (user.role === 'ADMIN' || user.role === 'COUNSELOR') return where;
  if (user.role !== 'TEACHER') throw forbidden('غير مصرح');

  const classIds = await teacherAssignedClassIds(user.id);

  // Teachers cannot browse school-wide unassigned students.
  if (Object.prototype.hasOwnProperty.call(where, 'classId') && where.classId === null) {
    return { ...where, classId: { in: [] } };
  }
  if (typeof where.classId === 'number') {
    if (!classIds.includes(where.classId)) {
      return { ...where, classId: { in: [] } };
    }
    return where;
  }
  return { ...where, classId: { in: classIds } };
}

async function assertStaffCanViewStudent(user, student) {
  if (user.role === 'ADMIN' || user.role === 'COUNSELOR') return;
  if (user.role !== 'TEACHER') throw forbidden('غير مصرح');
  const classIds = await teacherAssignedClassIds(user.id);
  if (student.classId == null || !classIds.includes(student.classId)) {
    throw notFound('الطالب غير موجود');
  }
}

const studentSelect = {
  id: true,
  nameAr: true,
  nameEn: true,
  classId: true,
  parentPhone: true,
  parentEmail: true,
  waOptedIn: true,
  isActive: true,
  deletedAt: true,
  importBatchId: true,
  createdAt: true,
  updatedAt: true,
  class: { select: { id: true, name: true, academicYear: true, gradeLevel: true, section: true } },
};

const createStudentSchema = z.object({
  id: z.string().min(1),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  // Optional/nullable: a student can be created without a class ("بدون فصل")
  // and assigned later via promote.
  classId: z.number().int().positive().optional().nullable(),
  parentPhone: z.string().min(1),
  parentEmail: z.string().email().optional().nullable(),
  waOptedIn: z.boolean().optional(),
});

const updateStudentSchema = z.object({
  nameAr: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  parentPhone: z.string().min(1).optional(),
  parentEmail: z.string().email().optional().nullable(),
  waOptedIn: z.boolean().optional(),
});

const promoteSchema = z.object({
  classId: z.number().int().positive(),
});

const importSchema = z.object({
  classId: z.number().int().positive(),
  fileName: z.string().optional(),
  rows: z
    .array(
      z.object({
        id: z.string().min(1),
        nameAr: z.string().min(1),
        nameEn: z.string().min(1),
        parentPhone: z.string().min(1),
        parentEmail: z.string().email().optional().nullable(),
      })
    )
    .min(1),
});

const listQuery = z.object({
  classId: z.coerce.number().int().positive().optional(),
  // Filter to students with no current class (classId = null).
  unassigned: z.enum(['true']).optional(),
  active: z.enum(['true', 'false']).optional(),
  q: z.string().optional(),
});

router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.unassigned === 'true') {
      where.classId = null;
    } else if (req.query.classId) {
      where.classId = req.query.classId;
    }
    if (req.query.active === 'false') {
      where.isActive = false;
    } else {
      where.isActive = true;
    }
    if (req.query.q) {
      const q = req.query.q.trim();
      where.OR = [
        { id: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
        { parentPhone: { contains: q } },
      ];
    }

    const scoped = await applyStaffStudentScope(req.user, where);

    const students = await prisma.student.findMany({
      where: scoped,
      select: studentSelect,
      orderBy: { nameAr: 'asc' },
    });
    res.json({ students });
  })
);

router.get(
  '/import-batches',
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const batches = await prisma.studentImportBatch.findMany({
      orderBy: { importedAt: 'desc' },
      include: {
        importer: { select: { id: true, name: true, email: true } },
        _count: { select: { students: true } },
      },
    });
    res.json({ batches });
  })
);

router.get(
  '/:id',
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: studentSelect,
    });
    if (!student) throw notFound('الطالب غير موجود');
    await assertStaffCanViewStudent(req.user, student);
    res.json({ student });
  })
);

router.get(
  '/:id/enrollments',
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) throw notFound('الطالب غير موجود');
    await assertStaffCanViewStudent(req.user, student);

    const enrollments = await prisma.classEnrollment.findMany({
      where: { studentId: req.params.id },
      include: {
        class: true,
        changer: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    res.json({ enrollments });
  })
);

router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createStudentSchema),
  asyncHandler(async (req, res) => {
    const classId = req.body.classId ?? null;
    let cls = null;
    if (classId != null) {
      cls = await prisma.class.findUnique({ where: { id: classId } });
      if (!cls) throw badRequest('classId not found');
    }

    let parentPhone;
    try {
      parentPhone = normalizePhone(req.body.parentPhone);
    } catch (e) {
      throw badRequest(e.message);
    }

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          id: req.body.id.trim(),
          nameAr: req.body.nameAr.trim(),
          nameEn: req.body.nameEn.trim(),
          classId,
          parentPhone,
          parentEmail: req.body.parentEmail ?? null,
          waOptedIn: req.body.waOptedIn ?? false,
        },
        select: studentSelect,
      });

      // Only open an enrollment when the student actually has a class —
      // unassigned students deliberately have no open ClassEnrollment.
      if (classId != null) {
        await tx.classEnrollment.create({
          data: {
            studentId: created.id,
            classId,
            academicYear: cls.academicYear,
            changedBy: req.user.id,
          },
        });
      }

      return created;
    });

    res.status(201).json({ student });
  })
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateParams(studentIdParam),
  validateBody(updateStudentSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Student not found');

    const data = {};
    if (req.body.nameAr !== undefined) data.nameAr = req.body.nameAr.trim();
    if (req.body.nameEn !== undefined) data.nameEn = req.body.nameEn.trim();
    if (req.body.parentEmail !== undefined) data.parentEmail = req.body.parentEmail;
    if (req.body.waOptedIn !== undefined) data.waOptedIn = req.body.waOptedIn;
    if (req.body.parentPhone !== undefined) {
      try {
        data.parentPhone = normalizePhone(req.body.parentPhone);
      } catch (e) {
        throw badRequest(e.message);
      }
    }

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data,
      select: studentSelect,
    });
    res.json({ student });
  })
);

/** Soft delete */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const existing = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Student not found');

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { isActive: false, deletedAt: new Date() },
      select: studentSelect,
    });
    res.json({ student });
  })
);

router.patch(
  '/:id/wa-opt-in',
  requireRole('ADMIN'),
  validateParams(studentIdParam),
  validateBody(z.object({ waOptedIn: z.boolean() })),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { waOptedIn: req.body.waOptedIn },
      select: studentSelect,
    });
    res.json({ student });
  })
);

/**
 * Promote / move student to another class.
 * Closes open enrollment, opens new one, updates Student.classId — one transaction.
 */
router.post(
  '/:id/promote',
  requireRole('ADMIN'),
  validateParams(studentIdParam),
  validateBody(promoteSchema),
  asyncHandler(async (req, res) => {
    const studentId = req.params.id;
    const targetClassId = req.body.classId;

    const [student, targetClass] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId } }),
      prisma.class.findUnique({ where: { id: targetClassId } }),
    ]);

    if (!student || !student.isActive) throw notFound('Student not found');
    if (!targetClass) throw badRequest('Target class not found');
    if (student.classId === targetClassId) {
      throw badRequest('Student is already in this class');
    }

    const studentUpdated = await prisma.$transaction(async (tx) => {
      const open = await tx.classEnrollment.findMany({
        where: { studentId, endDate: null },
      });

      // A student with classId = null (unassigned) is expected to have zero open
      // enrollments — nothing to close before opening the new one. A student who
      // DOES have a current class must have exactly one open enrollment; zero or
      // multiple in that case means the enrollment history is out of sync.
      if (student.classId != null) {
        if (open.length === 0) {
          throw badRequest('Student has no open enrollment — fix data before promoting');
        }
        if (open.length > 1) {
          throw badRequest('Student has multiple open enrollments — fix data before promoting');
        }
      } else if (open.length > 0) {
        throw badRequest('Unassigned student has a stale open enrollment — fix data before promoting');
      }

      const now = new Date();
      if (open.length === 1) {
        await tx.classEnrollment.update({
          where: { id: open[0].id },
          data: { endDate: now },
        });
      }

      await tx.classEnrollment.create({
        data: {
          studentId,
          classId: targetClassId,
          academicYear: targetClass.academicYear,
          startDate: now,
          changedBy: req.user.id,
        },
      });

      return tx.student.update({
        where: { id: studentId },
        data: { classId: targetClassId },
        select: studentSelect,
      });
    });

    res.json({ student: studentUpdated });
  })
);

/**
 * Remove a student from their current class without assigning a new one.
 * Closes the open ClassEnrollment (if any) and sets Student.classId = null.
 * The student then falls into the "unassigned" bucket (GET /students?unassigned=true)
 * until re-assigned via promote. One transaction — mirrors the promote guard rules.
 */
router.post(
  '/:id/unassign',
  requireRole('ADMIN'),
  validateParams(studentIdParam),
  asyncHandler(async (req, res) => {
    const studentId = req.params.id;
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw notFound('Student not found');
    if (student.classId == null) {
      throw badRequest('Student already has no class');
    }

    const studentUpdated = await prisma.$transaction(async (tx) => {
      const open = await tx.classEnrollment.findMany({
        where: { studentId, endDate: null },
      });
      if (open.length > 1) {
        throw badRequest('Student has multiple open enrollments — fix data before unassigning');
      }
      if (open.length === 1) {
        await tx.classEnrollment.update({
          where: { id: open[0].id },
          data: { endDate: new Date() },
        });
      }

      return tx.student.update({
        where: { id: studentId },
        data: { classId: null },
        select: studentSelect,
      });
    });

    res.json({ student: studentUpdated });
  })
);

/**
 * POST /students/import-noor
 * Upload a Noor StudentGuidance .xlsx — auto-creates classes from
 * (رقم الصف + الفصل) and upserts students into those classes.
 * Multipart field: file
 * Optional body field: academicYear (defaults to SchoolSettings.academicYear)
 */
router.post(
  '/import-noor',
  requireRole('ADMIN'),
  (req, res, next) => uploadNoorSpreadsheet(req, res, next),
  asyncHandler(async (req, res) => {
    if (!req.file?.buffer) throw badRequest('No spreadsheet file was uploaded');

    const settings = await prisma.schoolSettings.findUnique({ where: { id: 1 } });
    const academicYear =
      (typeof req.body?.academicYear === 'string' && req.body.academicYear.trim()) ||
      settings?.academicYear ||
      '2026-2027';

    const parsed = parseNoorSpreadsheet(req.file.buffer);
    if (parsed.rows.length === 0 && parsed.errors.length > 0) {
      return res.status(400).json({
        error: parsed.errors[0]?.error || 'Failed to parse spreadsheet',
        errors: parsed.errors,
      });
    }

    const errors = [...parsed.errors];
    const fileName = req.file.originalname || 'noor-import.xlsx';

    // Create import batch + ensure classes (short transaction)
    const { batch, classByKey, classesCreated, classesReused } = await prisma.$transaction(
      async (tx) => {
        const batchRow = await tx.studentImportBatch.create({
          data: {
            importedBy: req.user.id,
            fileName,
            rowCount: parsed.rows.length,
          },
        });

        const classKey = (grade, section) => `${grade}||${section}`;
        const uniqueClasses = new Map();
        for (const row of parsed.rows) {
          uniqueClasses.set(classKey(row.gradeLevel, row.section), {
            gradeLevel: row.gradeLevel,
            section: row.section,
          });
        }

        const byKey = new Map();
        let createdCount = 0;
        let reusedCount = 0;

        for (const { gradeLevel, section } of uniqueClasses.values()) {
          const existing = await tx.class.findUnique({
            where: {
              gradeLevel_section_academicYear: {
                gradeLevel,
                section,
                academicYear,
              },
            },
          });

          if (existing) {
            byKey.set(classKey(gradeLevel, section), existing);
            reusedCount += 1;
            continue;
          }

          const createdClass = await tx.class.create({
            data: {
              name: classDisplayName(gradeLevel, section),
              gradeLevel,
              section,
              academicYear,
            },
          });
          byKey.set(classKey(gradeLevel, section), createdClass);
          createdCount += 1;
        }

        return {
          batch: batchRow,
          classByKey: byKey,
          classesCreated: createdCount,
          classesReused: reusedCount,
        };
      },
      { timeout: 60_000 }
    );

    // Upsert students in small batches — one giant interactive transaction
    // often times out / drops on free Render Postgres with 300+ rows.
    const classKey = (grade, section) => `${grade}||${section}`;
    let created = 0;
    let updated = 0;
    let reactivated = 0;
    const BATCH = 40;

    for (let offset = 0; offset < parsed.rows.length; offset += BATCH) {
      const slice = parsed.rows.slice(offset, offset + BATCH);
      const counts = await prisma.$transaction(
        async (tx) => {
          let c = 0;
          let u = 0;
          let r = 0;

          for (const row of slice) {
            const cls = classByKey.get(classKey(row.gradeLevel, row.section));
            if (!cls) {
              errors.push({ index: row.index, id: row.id, error: 'Class resolution failed' });
              continue;
            }

            const existing = await tx.student.findUnique({ where: { id: row.id } });

            if (!existing) {
              await tx.student.create({
                data: {
                  id: row.id,
                  nameAr: row.nameAr,
                  nameEn: row.nameEn,
                  classId: cls.id,
                  parentPhone: row.parentPhone,
                  importBatchId: batch.id,
                },
              });
              await tx.classEnrollment.create({
                data: {
                  studentId: row.id,
                  classId: cls.id,
                  academicYear: cls.academicYear,
                  changedBy: req.user.id,
                },
              });
              c += 1;
              continue;
            }

            const data = {
              nameAr: row.nameAr,
              nameEn: row.nameEn,
              parentPhone: row.parentPhone,
              importBatchId: batch.id,
            };

            if (!existing.isActive) {
              data.isActive = true;
              data.deletedAt = null;
              r += 1;
            } else {
              u += 1;
            }

            if (existing.classId !== cls.id) {
              const open = await tx.classEnrollment.findMany({
                where: { studentId: row.id, endDate: null },
              });
              const now = new Date();
              for (const enr of open) {
                await tx.classEnrollment.update({
                  where: { id: enr.id },
                  data: { endDate: now },
                });
              }
              await tx.classEnrollment.create({
                data: {
                  studentId: row.id,
                  classId: cls.id,
                  academicYear: cls.academicYear,
                  startDate: now,
                  changedBy: req.user.id,
                },
              });
              data.classId = cls.id;
            }

            await tx.student.update({ where: { id: row.id }, data });
          }

          return { c, u, r };
        },
        { timeout: 60_000 }
      );

      created += counts.c;
      updated += counts.u;
      reactivated += counts.r;
    }

    res.status(201).json({
      fileName,
      academicYear,
      created,
      updated,
      reactivated,
      skipped: errors.length,
      classesCreated,
      classesReused,
      errors,
      batch,
    });
  })
);

/**
 * Bulk import / upsert from a parsed Noor sheet (JSON rows).
 * Multipart file parsing can wrap this later; for now accept JSON rows.
 */
router.post(
  '/import',
  requireRole('ADMIN'),
  validateBody(importSchema),
  asyncHandler(async (req, res) => {
    const { classId, fileName, rows } = req.body;
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw badRequest('classId not found');

    const errors = [];
    const prepared = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const parentPhone = normalizePhone(row.parentPhone);
        prepared.push({
          index: i,
          id: row.id.trim(),
          nameAr: row.nameAr.trim(),
          nameEn: row.nameEn.trim(),
          parentPhone,
          parentEmail: row.parentEmail ?? null,
        });
      } catch (e) {
        errors.push({ index: i, id: row.id, error: e.message });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.studentImportBatch.create({
        data: {
          importedBy: req.user.id,
          fileName: fileName ?? null,
          rowCount: prepared.length,
        },
      });

      let created = 0;
      let updated = 0;
      let reactivated = 0;

      for (const row of prepared) {
        const existing = await tx.student.findUnique({ where: { id: row.id } });

        if (!existing) {
          await tx.student.create({
            data: {
              id: row.id,
              nameAr: row.nameAr,
              nameEn: row.nameEn,
              classId,
              parentPhone: row.parentPhone,
              parentEmail: row.parentEmail,
              importBatchId: batch.id,
            },
          });
          await tx.classEnrollment.create({
            data: {
              studentId: row.id,
              classId,
              academicYear: cls.academicYear,
              changedBy: req.user.id,
            },
          });
          created += 1;
          continue;
        }

        const data = {
          nameAr: row.nameAr,
          nameEn: row.nameEn,
          parentPhone: row.parentPhone,
          parentEmail: row.parentEmail,
          importBatchId: batch.id,
        };

        if (!existing.isActive) {
          data.isActive = true;
          data.deletedAt = null;
          reactivated += 1;
        } else {
          updated += 1;
        }

        if (existing.classId !== classId) {
          const open = await tx.classEnrollment.findMany({
            where: { studentId: row.id, endDate: null },
          });
          const now = new Date();
          for (const enr of open) {
            await tx.classEnrollment.update({
              where: { id: enr.id },
              data: { endDate: now },
            });
          }
          await tx.classEnrollment.create({
            data: {
              studentId: row.id,
              classId,
              academicYear: cls.academicYear,
              startDate: now,
              changedBy: req.user.id,
            },
          });
          data.classId = classId;
        }

        await tx.student.update({ where: { id: row.id }, data });
      }

      return { batch, created, updated, reactivated };
    });

    res.status(201).json({
      batch: result.batch,
      created: result.created,
      updated: result.updated,
      reactivated: result.reactivated,
      skipped: errors.length,
      errors,
    });
  })
);

export default router;
