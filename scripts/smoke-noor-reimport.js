/**
 * Smoke: Noor re-import decision table.
 * Usage: node scripts/smoke-noor-reimport.js
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  applyNoorStudentRow,
  confirmNoorDeactivations,
  listYearScopedMissingStudents,
  phonesEqual,
  resolveNoorPhoneDecision,
  serializeImportedIds,
} from '../backend/src/services/noorReimport.js';

dotenv.config({ path: '.env' });
const prisma = new PrismaClient();

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail ?? '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

const YEAR = '2098-2099';
const stamp = Date.now();

async function main() {
  ok('05 and +966 phones equal', phonesEqual('0512345678', '+966512345678'));
  ok('different mobiles not equal', !phonesEqual('0512345678', '+966598765432'));

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('Need an ADMIN user');

  const clsA = await prisma.class.create({
    data: {
      name: `reimp-a-${stamp}`,
      gradeLevel: '5',
      section: `A${String(stamp).slice(-4)}`,
      academicYear: YEAR,
    },
  });
  const clsB = await prisma.class.create({
    data: {
      name: `reimp-b-${stamp}`,
      gradeLevel: '5',
      section: `B${String(stamp).slice(-4)}`,
      academicYear: YEAR,
    },
  });
  const otherYear = await prisma.class.create({
    data: {
      name: `reimp-old-${stamp}`,
      gradeLevel: '4',
      section: `O${String(stamp).slice(-4)}`,
      academicYear: '2090-2091',
    },
  });

  const idNew = `N${stamp}1`;
  const idActive = `N${stamp}2`;
  const idPhone = `N${stamp}3`;
  const idInactive = `N${stamp}4`;
  const idMissing = `N${stamp}5`;
  const idUnassignedOther = `N${stamp}6`;
  const idInFileFail = `N${stamp}7`;

  await prisma.student.create({
    data: {
      id: idActive,
      nameAr: 'طالب قديم',
      nameEn: 'Old',
      classId: clsA.id,
      parentPhone: '+966512345678',
      isActive: true,
    },
  });
  await prisma.student.create({
    data: {
      id: idPhone,
      nameAr: 'طالب جوال',
      nameEn: 'Phone',
      classId: clsA.id,
      parentPhone: '0511111111',
      isActive: true,
    },
  });
  await prisma.student.create({
    data: {
      id: idInactive,
      nameAr: 'طالب موقوف',
      nameEn: 'Inactive',
      classId: null,
      parentPhone: '+966522222222',
      isActive: false,
      deletedAt: new Date(),
    },
  });
  await prisma.student.create({
    data: {
      id: idMissing,
      nameAr: 'طالب غائب عن الملف',
      nameEn: 'Missing',
      classId: clsB.id,
      parentPhone: '+966533333333',
      isActive: true,
    },
  });
  await prisma.student.create({
    data: {
      id: idUnassignedOther,
      nameAr: 'بدون فصل سنة أخرى',
      nameEn: 'Other year unassigned',
      classId: null,
      parentPhone: '+966544444444',
      isActive: true,
    },
  });
  await prisma.classEnrollment.create({
    data: {
      studentId: idUnassignedOther,
      classId: otherYear.id,
      academicYear: '2090-2091',
      startDate: new Date(),
      endDate: new Date(),
      openMarker: null,
    },
  });
  await prisma.student.create({
    data: {
      id: idInFileFail,
      nameAr: 'في الملف فشل الصف',
      nameEn: 'In file',
      classId: clsA.id,
      parentPhone: '+966555555555',
      isActive: true,
    },
  });

  const batch = await prisma.studentImportBatch.create({
    data: {
      importedBy: admin.id,
      fileName: 'smoke-noor.xlsx',
      academicYear: YEAR,
      importedIdsJson: serializeImportedIds([idNew, idActive, idPhone, idInactive, idInFileFail]),
      rowCount: 5,
    },
  });

  try {
    const created = await prisma.$transaction((tx) =>
      applyNoorStudentRow(tx, {
        row: {
          id: idNew,
          nameAr: 'طالب جديد',
          nameEn: 'New',
          parentPhone: '+966566666666',
        },
        cls: clsA,
        batchId: batch.id,
        changedBy: admin.id,
      })
    );
    ok('create new student', created.kind === 'created');
    const createdRow = await prisma.student.findUnique({ where: { id: idNew } });
    ok('created has class + phone', createdRow?.classId === clsA.id && createdRow.parentPhone === '+966566666666');

    const updated = await prisma.$transaction((tx) =>
      applyNoorStudentRow(tx, {
        row: {
          id: idActive,
          nameAr: 'طالب محدّث',
          nameEn: 'Updated',
          parentPhone: '+966512345678',
        },
        cls: clsB,
        batchId: batch.id,
        changedBy: admin.id,
      })
    );
    ok('active same phone → updated', updated.kind === 'updated' && !updated.phoneConflict);
    const updatedRow = await prisma.student.findUnique({ where: { id: idActive } });
    ok(
      'name and class applied, phone kept',
      updatedRow?.nameAr === 'طالب محدّث' &&
        updatedRow.classId === clsB.id &&
        updatedRow.parentPhone === '+966512345678'
    );

    const phoneRow = await prisma.$transaction((tx) =>
      applyNoorStudentRow(tx, {
        row: {
          id: idPhone,
          nameAr: 'طالب جوال',
          nameEn: 'Phone',
          parentPhone: '+966511111111',
        },
        cls: clsA,
        batchId: batch.id,
        changedBy: admin.id,
      })
    );
    const afterPhone = await prisma.student.findUnique({ where: { id: idPhone } });
    ok(
      'normalized 05 vs +966 is not a conflict',
      phoneRow.kind === 'unchanged' && !phoneRow.phoneConflict && afterPhone?.parentPhone === '0511111111'
    );

    const realConflict = await prisma.$transaction((tx) =>
      applyNoorStudentRow(tx, {
        row: {
          id: idPhone,
          nameAr: 'طالب جوال',
          nameEn: 'Phone',
          parentPhone: '+966577777777',
        },
        cls: clsA,
        batchId: batch.id,
        changedBy: admin.id,
      })
    );
    const stillOldPhone = await prisma.student.findUnique({ where: { id: idPhone } });
    ok(
      'different phone queued and not overwritten',
      !!realConflict.phoneConflict && stillOldPhone?.parentPhone === '0511111111'
    );

    const reactivated = await prisma.$transaction((tx) =>
      applyNoorStudentRow(tx, {
        row: {
          id: idInactive,
          nameAr: 'طالب مُعاد',
          nameEn: 'Back',
          parentPhone: '+966588888888',
        },
        cls: clsA,
        batchId: batch.id,
        changedBy: admin.id,
      })
    );
    const back = await prisma.student.findUnique({ where: { id: idInactive } });
    const openEnroll = await prisma.classEnrollment.findFirst({
      where: { studentId: idInactive, endDate: null },
    });
    ok('inactive reactivated', reactivated.kind === 'reactivated' && back?.isActive === true);
    ok('reactivate always opens enrollment', openEnroll?.classId === clsA.id);

    const missing = await listYearScopedMissingStudents(prisma, {
      academicYear: YEAR,
      importedIds: [idNew, idActive, idPhone, idInactive, idInFileFail],
    });
    const missingIds = missing.map((s) => s.id);
    ok('missing includes student not in file', missingIds.includes(idMissing));
    ok('in-file failed class is not missing', !missingIds.includes(idInFileFail));
    ok('other-year unassigned is not missing', !missingIds.includes(idUnassignedOther));

    const keep = await resolveNoorPhoneDecision(prisma, {
      id: realConflict.phoneConflict.id,
      action: 'keep',
      decidedBy: admin.id,
    });
    ok('keep leaves student phone', keep.status === 'KEPT');
    const afterKeep = await prisma.student.findUnique({ where: { id: idPhone } });
    ok('keep did not change phone', afterKeep?.parentPhone === '0511111111');

    const emptyMissing = await listYearScopedMissingStudents(prisma, {
      academicYear: YEAR,
      importedIds: [],
    });
    ok('empty file ids → no missing candidates', emptyMissing.length === 0);

    const acceptConflict = await prisma.$transaction((tx) =>
      applyNoorStudentRow(tx, {
        row: {
          id: idPhone,
          nameAr: 'طالب جوال',
          nameEn: 'Phone',
          parentPhone: '+966599999999',
        },
        cls: clsA,
        batchId: batch.id,
        changedBy: admin.id,
      })
    );
    await prisma.parentAccount.deleteMany({
      where: { phone: { in: ['+966511111111', '+966599999999'] } },
    });
    await prisma.parentAccount.create({
      data: { phone: '+966511111111', passwordHash: 'smoke-hash', isActive: true },
    });
    const accepted = await resolveNoorPhoneDecision(prisma, {
      id: acceptConflict.phoneConflict.id,
      action: 'accept',
      decidedBy: admin.id,
    });
    const afterAccept = await prisma.student.findUnique({ where: { id: idPhone } });
    const oldAccount = await prisma.parentAccount.findUnique({ where: { phone: '+966511111111' } });
    const newAccount = await prisma.parentAccount.findUnique({ where: { phone: '+966599999999' } });
    ok('accept writes Noor phone', accepted.status === 'ACCEPTED' && afterAccept?.parentPhone === '+966599999999');
    ok('accept migrates parent account', !oldAccount && !!newAccount);

    const otherYearBatch = await prisma.studentImportBatch.create({
      data: {
        importedBy: admin.id,
        fileName: 'other-year.xlsx',
        academicYear: '2090-2091',
        importedIdsJson: serializeImportedIds([idUnassignedOther]),
        rowCount: 1,
      },
    });
    const newer = await prisma.studentImportBatch.create({
      data: {
        importedBy: admin.id,
        fileName: 'newer.xlsx',
        academicYear: YEAR,
        importedIdsJson: serializeImportedIds([idNew]),
        rowCount: 1,
      },
    });
    let newerBlocked = false;
    try {
      await confirmNoorDeactivations(prisma, { batchId: batch.id, studentIds: [idMissing] });
    } catch (err) {
      newerBlocked = String(err.message || '').includes('أحدث');
    }
    ok('confirm rejects newer batch in the same year', newerBlocked);
    await prisma.studentImportBatch.delete({ where: { id: newer.id } });

    let otherYearBlocked = false;
    let confirmed = null;
    try {
      confirmed = await confirmNoorDeactivations(prisma, {
        batchId: batch.id,
        studentIds: [idMissing, idMissing, idInFileFail],
      });
    } catch (err) {
      otherYearBlocked = String(err.message || '').includes('أحدث');
    }
    ok('newer batch in another year does not block confirm', !otherYearBlocked && !!confirmed);
    const missingAfter = await prisma.student.findUnique({ where: { id: idMissing } });
    const inFileAfter = await prisma.student.findUnique({ where: { id: idInFileFail } });
    ok('confirm deactivates only allowed ids', confirmed?.deactivated === 1 && missingAfter?.isActive === false);
    ok('in-file id cannot be deactivated', inFileAfter?.isActive === true);
    ok('skipped uses unique requested', confirmed?.skipped === 1);
  } finally {
    const ids = [idNew, idActive, idPhone, idInactive, idMissing, idUnassignedOther, idInFileFail];
    await prisma.noorParentPhoneDecision.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.parentAccount.deleteMany({
      where: { phone: { in: ['+966511111111', '+966599999999'] } },
    });
    await prisma.classEnrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
    await prisma.studentImportBatch.deleteMany({
      where: { fileName: { in: ['smoke-noor.xlsx', 'newer.xlsx', 'other-year.xlsx'] } },
    });
    await prisma.class.deleteMany({ where: { id: { in: [clsA.id, clsB.id, otherYear.id] } } });
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error(`\n${failed.length} failed`);
    process.exit(1);
  }
  console.log(`\n${results.length} passed`);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
