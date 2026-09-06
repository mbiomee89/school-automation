/**
 * Smoke: Noor re-import decision table.
 * Usage: node scripts/smoke-noor-reimport.js
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  applyNoorStudentRow,
  buildPhoneReview,
  fileHasPhone,
  confirmNoorDeactivations,
  listYearScopedMissingStudents,
  phonesEqual,
  resolveNoorPhoneDecision,
  serializeImportedIds,
} from '../backend/src/services/noorReimport.js';
import {
  classDisplayName,
  fileClassKey,
  legacyDigitSection,
  normalizeNoorClass,
  parseNoorSpreadsheet,
  rawNoorClass,
} from '../backend/src/services/noorImport.js';
import XLSX from 'xlsx';
import {
  buildNoorClassPreview,
  leftoverClassIdsFromSchool,
  retireLeftoverEmptyClasses,
} from '../backend/src/services/noorClassMatch.js';

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
  ok('Noor section 2 becomes ب', normalizeNoorClass('أول', '2').section === 'ب');
  ok('Noor أول-2 display is أول ب', classDisplayName('أول', '2') === 'أول ب');
  ok('Arabic-Indic ٢ becomes ب', normalizeNoorClass('أول', '٢').section === 'ب');
  ok('ثاني grade folds to ثان', normalizeNoorClass('ثاني', '1').gradeLevel === 'ثان');
  ok('legacy letter ب is digit 2', legacyDigitSection('ب') === '2');

  ok('05 and +966 phones equal', phonesEqual('0512345678', '+966512345678'));
  ok('different mobiles not equal', !phonesEqual('0512345678', '+966598765432'));

  ok('raw Noor class keeps digit 2', rawNoorClass('أول', '2').section === '2');
  ok('file class key is grade||section', fileClassKey('أول', '2') === 'أول||2');

  const previewLetter = buildNoorClassPreview(
    [{ gradeLevel: 'أول', section: '2' }, { gradeLevel: 'أول', section: '2' }],
    [{ id: 11, name: 'أول ب', gradeLevel: 'أول', section: 'ب', retiredAt: null, _count: { students: 4 } }]
  );
  ok(
    'letter equivalent is recommended',
    previewLetter.mappings[0]?.suggestedAction === 'use' &&
      previewLetter.mappings[0]?.suggestedClassId === 11
  );

  const previewDigit = buildNoorClassPreview(
    [{ gradeLevel: 'أول', section: '2' }],
    [{ id: 12, name: 'أول - 2', gradeLevel: 'أول', section: '2', retiredAt: null, _count: { students: 3 } }]
  );
  ok(
    'digit-only class stays and offers rename',
    previewDigit.mappings[0]?.suggestedAction === 'use' &&
      previewDigit.mappings[0]?.canRename === true &&
      previewDigit.mappings[0]?.renameClassId === 12
  );

  const previewBoth = buildNoorClassPreview(
    [{ gradeLevel: 'أول', section: '2' }],
    [
      { id: 12, name: 'أول - 2', gradeLevel: 'أول', section: '2', retiredAt: null, _count: { students: 0 } },
      { id: 11, name: 'أول ب', gradeLevel: 'أول', section: 'ب', retiredAt: null, _count: { students: 5 } },
    ]
  );
  ok(
    'both digit and letter: recommend the one with students, no merge',
    previewBoth.mappings[0]?.suggestedClassId === 11 &&
      String(previewBoth.mappings[0]?.warning || '').includes('لن يُدمجا')
  );

  const previewCreate = buildNoorClassPreview([{ gradeLevel: 'أول', section: '2' }], []);
  ok('no school class recommends create letter', previewCreate.mappings[0]?.suggestedAction === 'createLetter');

  ok('empty file phone is missing', !fileHasPhone({ parentPhone: '' }));
  ok('present file phone is set', fileHasPhone({ parentPhone: '+966512345678' }));

  const review = buildPhoneReview(
    [
      { id: '1', nameAr: 'أ', phoneReviewReason: 'missing', gradeLevel: 'أول', section: '2' },
      { id: '2', nameAr: 'ب', phoneReviewReason: 'invalid', rawPhone: '123', gradeLevel: 'أول', section: '2' },
      { id: '3', nameAr: 'ج', parentPhone: '+966512345678' },
    ],
    () => 'أول ب'
  );
  ok(
    'phone review lists missing and invalid only',
    review.length === 2 &&
      review[0].reason === 'missing' &&
      review[1].reason === 'invalid' &&
      review[1].rawPhone === '123'
  );
  ok(
    'phone review drops rows that did not land',
    buildPhoneReview(
      [{ id: '1', nameAr: 'أ', phoneReviewReason: 'missing' }],
      { landedIds: [] }
    ).length === 0
  );
  ok(
    'phone review drops student who kept a valid phone',
    buildPhoneReview(
      [{ id: '1', nameAr: 'أ', phoneReviewReason: 'missing' }],
      { landedIds: ['1'], storedPhoneById: new Map([['1', '+966512345678']]) }
    ).length === 0
  );
  ok(
    'phone review dedupes student id and prefers invalid',
    buildPhoneReview(
      [
        { id: '1', nameAr: 'أ', phoneReviewReason: 'missing' },
        { id: '1', nameAr: 'أ', phoneReviewReason: 'invalid', rawPhone: '00' },
      ],
      { landedIds: ['1'], storedPhoneById: new Map([['1', '']]) }
    ).length === 1 &&
      buildPhoneReview(
        [
          { id: '1', nameAr: 'أ', phoneReviewReason: 'missing' },
          { id: '1', nameAr: 'أ', phoneReviewReason: 'invalid', rawPhone: '00' },
        ],
        { landedIds: ['1'], storedPhoneById: new Map([['1', '']]) }
      )[0].reason === 'invalid'
  );

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['رقم الطالب', 'اسم الطالب', 'الجوال', 'رقم الصف', 'الفصل'],
    [`P${stamp}1`, 'بلا جوال', '', 'أول', '2'],
    [`P${stamp}2`, 'جوال خطأ', '12345', 'أول', '2'],
    [`P${stamp}3`, 'جوال صحيح', '0512345678', 'أول', '2'],
  ]);
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  const parsed = parseNoorSpreadsheet(Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })));
  const missingRow = parsed.rows.find((r) => r.id === `P${stamp}1`);
  const invalidRow = parsed.rows.find((r) => r.id === `P${stamp}2`);
  const validRow = parsed.rows.find((r) => r.id === `P${stamp}3`);
  ok(
    'parse empty phone is missing review',
    missingRow?.phoneReviewReason === 'missing' && missingRow.parentPhone === ''
  );
  ok(
    'parse invalid phone is imported not skipped',
    invalidRow?.phoneReviewReason === 'invalid' &&
      invalidRow.parentPhone === '' &&
      invalidRow.rawPhone === '12345' &&
      parsed.errors.length === 0
  );
  ok('parse valid phone is not a review row', !validRow?.phoneReviewReason && !!validRow?.parentPhone);

  ok(
    'leftover ids skip mapping targets',
    leftoverClassIdsFromSchool(
      [
        { id: 1, retiredAt: null },
        { id: 2, retiredAt: null },
        { id: 3, retiredAt: new Date() },
      ],
      [1]
    ).join() === '2'
  );

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

    const idNoPhone = `N${stamp}9`;
    const createdEmpty = await prisma.$transaction((tx) =>
      applyNoorStudentRow(tx, {
        row: { id: idNoPhone, nameAr: 'بلا جوال', nameEn: 'NoPhone', parentPhone: '' },
        cls: clsA,
        batchId: batch.id,
        changedBy: admin.id,
      })
    );
    const emptyRow = await prisma.student.findUnique({ where: { id: idNoPhone } });
    ok(
      'empty-phone row is created in class',
      createdEmpty.kind === 'created' && emptyRow?.classId === clsA.id && emptyRow.parentPhone === ''
    );

    const keepPhone = await prisma.$transaction((tx) =>
      applyNoorStudentRow(tx, {
        row: {
          id: idActive,
          nameAr: 'طالب قديم',
          nameEn: 'Old',
          parentPhone: '',
        },
        cls: clsA,
        batchId: batch.id,
        changedBy: admin.id,
      })
    );
    const kept = await prisma.student.findUnique({ where: { id: idActive } });
    ok(
      'blank file phone does not wipe existing',
      !keepPhone.phoneConflict && kept?.parentPhone === '+966512345678'
    );

    const invalidWipe = await prisma.$transaction((tx) =>
      applyNoorStudentRow(tx, {
        row: {
          id: idActive,
          nameAr: 'طالب قديم',
          nameEn: 'Old',
          parentPhone: '',
          phoneReviewReason: 'invalid',
          rawPhone: '12345',
        },
        cls: clsA,
        batchId: batch.id,
        changedBy: admin.id,
      })
    );
    const afterInvalid = await prisma.student.findUnique({ where: { id: idActive } });
    ok(
      'invalid file phone does not wipe existing',
      !invalidWipe.phoneConflict && afterInvalid?.parentPhone === '+966512345678'
    );
    ok(
      'kept phone is omitted from confirm review',
      buildPhoneReview(
        [
          {
            id: idActive,
            nameAr: 'طالب قديم',
            phoneReviewReason: 'invalid',
            rawPhone: '12345',
          },
        ],
        {
          landedIds: [idActive],
          storedPhoneById: new Map([[idActive, afterInvalid.parentPhone]]),
        }
      ).length === 0
    );
    ok(
      'empty stored phone stays on confirm review',
      buildPhoneReview(
        [{ id: idNoPhone, nameAr: 'بلا جوال', phoneReviewReason: 'missing' }],
        {
          landedIds: [idNoPhone],
          storedPhoneById: new Map([[idNoPhone, emptyRow.parentPhone]]),
        }
      ).some((r) => r.studentId === idNoPhone && r.reason === 'missing')
    );

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

    const leftoverEmpty = await prisma.class.create({
      data: {
        name: `reimp-empty-${stamp}`,
        gradeLevel: '5',
        section: `E${String(stamp).slice(-4)}`,
        academicYear: YEAR,
      },
    });
    const leftoverBusy = await prisma.class.create({
      data: {
        name: `reimp-busy-${stamp}`,
        gradeLevel: '5',
        section: `F${String(stamp).slice(-4)}`,
        academicYear: YEAR,
      },
    });
    const idBusy = `N${stamp}8`;
    await prisma.student.create({
      data: { id: idBusy, nameAr: 'مشغول', nameEn: 'Busy', parentPhone: '+966500000008', classId: leftoverBusy.id },
    });
    const retired = await retireLeftoverEmptyClasses(prisma, {
      leftoverClassIds: [leftoverEmpty.id, leftoverBusy.id],
      protectedClassIds: [clsB.id],
    });
    const emptyAfter = await prisma.class.findUnique({ where: { id: leftoverEmpty.id } });
    const busyAfter = await prisma.class.findUnique({ where: { id: leftoverBusy.id } });
    ok(
      'retire leftover empty class only',
      retired.some((r) => r.id === leftoverEmpty.id) && !!emptyAfter?.retiredAt
    );
    ok('class with students is not retired', !busyAfter?.retiredAt);
    await prisma.student.delete({ where: { id: idBusy } });
    await prisma.class.deleteMany({ where: { id: { in: [leftoverEmpty.id, leftoverBusy.id] } } });
  } finally {
    const ids = [idNew, idActive, idPhone, idInactive, idMissing, idUnassignedOther, idInFileFail, `N${stamp}9`];
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
