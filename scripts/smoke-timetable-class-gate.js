/**
 * Smoke: weekly-table class-set gate + leftover-subject pairing.
 * Usage: node scripts/smoke-timetable-class-gate.js
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  assertImportReadyToSave,
  leftoverUnmatchedTeacherNames,
  diffClassSets,
  matchClassStrict,
  pickImportAcademicYear,
  resolveImportAcademicYear,
  schoolClassesWithoutMatchedSlots,
  summarizeTimetableImportImpact,
} from '../backend/src/services/timetableImport.js';

dotenv.config({ path: '.env' });
const prisma = new PrismaClient();

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail ?? '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

const stamp = Date.now();
const YEAR = `2097-${String(stamp).slice(-4)}`;

const school = [
  { id: 1, name: 'أول أ', gradeLevel: 'أول', section: 'أ' },
  { id: 2, name: 'أول ب', gradeLevel: 'أول', section: 'ب' },
];

async function main() {
  ok(
    'request year override is ignored',
    pickImportAcademicYear({ academicYear: '2026-2027' }, '2090-2091') === '2026-2027'
  );
  ok('missing settings year is null even with override', pickImportAcademicYear({}, '2090-2091') == null);

  const settings = await prisma.schoolSettings.findFirst();
  if (settings?.academicYear) {
    const lockedYear = await resolveImportAcademicYear('2090-2091');
    ok(
      'resolveImportAcademicYear uses settings not override',
      lockedYear === settings.academicYear && lockedYear !== '2090-2091',
      lockedYear
    );
  }

  const twoLabels = diffClassSets(school, ['أول-1', 'أول-2']);
  ok('أول-1 and أول-2 match أول أ / أول ب', twoLabels.ok, JSON.stringify(twoLabels.resolvedIds));

  const swapped = diffClassSets(school, ['أول-1', 'أول-2'], { 'أول-1': 2, 'أول-2': 1 });
  ok(
    'admin classMap can swap أول-1 onto أول ب',
    swapped.ok && swapped.resolvedByLabel['أول-1'] === 2 && swapped.resolvedByLabel['أول-2'] === 1,
    JSON.stringify(swapped.resolvedByLabel)
  );
  const collapsed = diffClassSets(school, ['أول-1', 'أول-2'], { 'أول-1': 1, 'أول-2': 1 });
  ok(
    'two labels to one class leaves a school class unused',
    !collapsed.ok && collapsed.inSchoolNotInFile.some((c) => c.id === 2)
  );

  const sameClassTwice = diffClassSets([{ id: 1, name: 'أول أ', gradeLevel: 'أول', section: 'أ' }], [
    'أول-1',
    'أول أ',
  ]);
  ok('two labels one class is ok', sameClassTwice.ok && sameClassTwice.resolvedIds.length === 1);

  const extraFile = diffClassSets(school, ['أول-1', 'أول-2', 'ثان أ']);
  ok(
    'file class not in school fails',
    !extraFile.ok && extraFile.inFileNotInSchool.includes('ثان أ'),
    extraFile.inFileNotInSchool.join(',')
  );

  const missingSchool = diffClassSets(school, ['أول-1']);
  ok(
    'school class missing from file fails',
    !missingSchool.ok && missingSchool.inSchoolNotInFile.some((c) => c.name === 'أول ب')
  );

  const loose = matchClassStrict('أول', school);
  ok('loose substring أول does not match', loose == null);

  const emptySchool = diffClassSets([], ['أول-1']);
  ok('empty school fails', !emptySchool.ok);

  const missingCovered = schoolClassesWithoutMatchedSlots(school, [{ classId: 1 }]);
  ok(
    'class with zero matched slots is listed',
    missingCovered.length === 1 && missingCovered[0].id === 2
  );
  ok(
    'all classes covered when both have slots',
    schoolClassesWithoutMatchedSlots(school, [{ classId: 1 }, { classId: 2 }]).length === 0
  );

  let blockedUnresolved = false;
  try {
    assertImportReadyToSave(
      {
        unresolved: 2,
        unmatchedTeachers: [{ name: 'خالد', count: 2 }],
        matchedSlots: [{ classId: 1 }, { classId: 2 }],
      },
      school
    );
  } catch {
    blockedUnresolved = true;
  }
  ok('save blocked when lessons still unresolved', blockedUnresolved);

  let blockedEmptyClass = false;
  try {
    assertImportReadyToSave(
      { unresolved: 0, matchedSlots: [{ classId: 1 }] },
      school
    );
  } catch {
    blockedEmptyClass = true;
  }
  ok('save blocked when a school class has no matched slot', blockedEmptyClass);

  let saveOk = true;
  try {
    assertImportReadyToSave(
      { unresolved: 0, matchedSlots: [{ classId: 1 }, { classId: 2 }] },
      school
    );
  } catch {
    saveOk = false;
  }
  ok('save allowed when every class has a matched slot and unresolved is 0', saveOk);

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('Need an ADMIN user');

  const teacher = await prisma.user.create({
    data: {
      name: `tt-gate-${stamp}`,
      email: `tt-gate-${stamp}@timetable.local`,
      passwordHash: admin.passwordHash,
      role: 'TEACHER',
      langPref: 'AR',
      isActive: true,
    },
  });
  const cls = await prisma.class.create({
    data: { name: `gate-a-${stamp}`, gradeLevel: 'أول', section: `G${String(stamp).slice(-3)}`, academicYear: YEAR },
  });
  const math =
    (await prisma.subject.findFirst({ where: { nameAr: 'رياضيات' } })) ||
    (await prisma.subject.create({ data: { nameAr: `رياضيات-${stamp}`, nameEn: 'MathGate' } }));
  const science =
    (await prisma.subject.findFirst({ where: { nameAr: 'علوم' } })) ||
    (await prisma.subject.create({ data: { nameAr: `علوم-${stamp}`, nameEn: 'SciGate' } }));

  const leftoverAsg = await prisma.teacherAssignment.create({
    data: { teacherId: teacher.id, classId: cls.id, subjectId: science.id },
  });
  await prisma.teacherAssignment.create({
    data: { teacherId: teacher.id, classId: cls.id, subjectId: math.id },
  });

  const hw = await prisma.homework.create({
    data: {
      classId: cls.id,
      subjectId: math.id,
      teacherId: teacher.id,
      date: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
      period: '3',
      description: 'gate leftover homework',
    },
  });

  const impact = await summarizeTimetableImportImpact(YEAR, [
    { classId: cls.id, subjectId: math.id },
  ]);
  ok(
    'leftover is science only',
    impact.leftoverSubjects.length === 1 && impact.leftoverSubjects[0].id === leftoverAsg.id,
    JSON.stringify(impact.leftoverSubjects.map((r) => r.subjectNameAr))
  );
  const impactNoTeacher = await summarizeTimetableImportImpact(YEAR, [
    { classId: cls.id, subjectId: math.id },
  ]);
  ok(
    'missing teacher does not create a false leftover',
    impactNoTeacher.leftoverSubjects.length === 1 &&
      impactNoTeacher.leftoverSubjects[0].id === leftoverAsg.id &&
      !impactNoTeacher.leftoverSubjects.some((r) => r.subjectId === math.id)
  );
  ok('homework count includes saved row', impact.homeworkThisYear >= 1);

  const stillHw = await prisma.homework.findUnique({ where: { id: hw.id } });
  ok('homework row still present after impact read', Boolean(stillHw));

  const otherYear = await prisma.class.create({
    data: {
      name: `gate-old-${stamp}`,
      gradeLevel: 'ثان',
      section: `O${String(stamp).slice(-3)}`,
      academicYear: '2090-2091',
    },
  });
  const otherAsg = await prisma.teacherAssignment.create({
    data: { teacherId: teacher.id, classId: otherYear.id, subjectId: math.id },
  });
  const impact2 = await summarizeTimetableImportImpact(YEAR, [
    { classId: cls.id, subjectId: math.id },
  ]);
  ok(
    'other-year assignment not leftover',
    !impact2.leftoverSubjects.some((r) => r.id === otherAsg.id)
  );

  ok(
    'leftover unmatched teachers are unique leftover names only',
    leftoverUnmatchedTeacherNames([
      { name: 'خالد' },
      { name: 'خالد' },
      { name: '  سارة  ' },
    ]).join('|') === 'خالد|سارة'
  );
  ok(
    'mapped teachers are not leftover names',
    leftoverUnmatchedTeacherNames([]).length === 0
  );

  await prisma.homework.delete({ where: { id: hw.id } }).catch(() => {});
  await prisma.teacherAssignment.deleteMany({
    where: { id: { in: [leftoverAsg.id, otherAsg.id] } },
  });
  await prisma.teacherAssignment.deleteMany({
    where: { teacherId: teacher.id, classId: cls.id },
  });
  await prisma.class.deleteMany({ where: { id: { in: [cls.id, otherYear.id] } } });
  await prisma.user.delete({ where: { id: teacher.id } }).catch(() => {});
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    await prisma.$disconnect();
    if (failed.length) process.exitCode = 1;
  });
