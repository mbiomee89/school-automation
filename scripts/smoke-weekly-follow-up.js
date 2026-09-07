/**
 * Smoke: weekly follow-up PE filter + totals (no server required).
 * Optional: node scripts/smoke-weekly-follow-up.js --api
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { addDaysToDateOnlyStr } from '../backend/src/utils/dates.js';
import {
  currentSchoolWeekSunday,
  followUpTotal,
  isBlankFollowUpRow,
  isPeSubject,
  parseScore,
  parseWeekStartParam,
} from '../backend/src/services/weeklyFollowUp.js';

dotenv.config({ path: '.env' });

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

ok('pe full name', isPeSubject('التربية البدنية والدفاع عن النفس') === true);
ok('pe بدنية', isPeSubject('بدنية') === true);
ok('quran included', isPeSubject('القرآن الكريم') === false);
ok('art included', isPeSubject('التربية الفنية') === false);
ok('life skills included', isPeSubject('المهارات الحياتية') === false);
ok('math included', isPeSubject('الرياضيات') === false);

ok('total skips empty', followUpTotal({ participation: 5, homeworkScore: 4 }) === 9);
ok('total all empty is null', followUpTotal({}) === null);
ok('blank row', isBlankFollowUpRow({ notes: '  ' }) === true);
ok('not blank with score', isBlankFollowUpRow({ participation: 3, notes: '' }) === false);

const wed = parseWeekStartParam('2026-09-09');
ok('normalize wednesday', wed.sundayStr === '2026-09-06', wed.sundayStr);

ok('parseScore number 5', parseScore(5) === 5);
ok('parseScore string 5', parseScore('5') === 5);
ok('parseScore empty is null', parseScore('') === null);
ok('parseScore blank string is null', parseScore('  ') === null);
try {
  parseScore(6);
  ok('parseScore 6 throws', false);
} catch {
  ok('parseScore 6 throws', true);
}

if (process.argv.includes('--api')) {
  await runApi();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);

async function runApi() {
  const BASE = `http://127.0.0.1:${process.env.PORT || 3001}`;
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const password = 'SmokeFu123!';
  const hash = await bcrypt.hash(password, 10);
  const year = '2098-2099';
  const week = currentSchoolWeekSunday();
  const future = addDaysToDateOnlyStr(week, 7);
  const phoneLocal = `05${String(stamp).slice(-8)}`;
  const phoneE164 = `+9665${String(stamp).slice(-8)}`;

  const teacherA = await prisma.user.create({
    data: {
      name: `Smoke FU A ${stamp}`,
      email: `smoke-fu-a-${stamp}@example.com`,
      passwordHash: hash,
      role: 'TEACHER',
      isActive: true,
      mustChangePassword: false,
    },
  });
  const teacherB = await prisma.user.create({
    data: {
      name: `Smoke FU B ${stamp}`,
      email: `smoke-fu-b-${stamp}@example.com`,
      passwordHash: hash,
      role: 'TEACHER',
      isActive: true,
      mustChangePassword: false,
    },
  });
  let admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    orderBy: { id: 'asc' },
  });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: `Smoke FU Admin ${stamp}`,
        email: `smoke-fu-admin-${stamp}@example.com`,
        passwordHash: hash,
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: hash, mustChangePassword: false, isActive: true },
    });
  }

  const classA = await prisma.class.create({
    data: { name: `fu-a-${stamp}`, gradeLevel: '5', section: `A${String(stamp).slice(-3)}`, academicYear: year },
  });
  const classB = await prisma.class.create({
    data: { name: `fu-b-${stamp}`, gradeLevel: '5', section: `B${String(stamp).slice(-3)}`, academicYear: year },
  });
  const classEmpty = await prisma.class.create({
    data: { name: `fu-e-${stamp}`, gradeLevel: '5', section: `E${String(stamp).slice(-3)}`, academicYear: year },
  });
  const math = await prisma.subject.create({
    data: { nameAr: `رياضيات-fu-${stamp}`, nameEn: `Math FU ${stamp}` },
  });
  const pe = await prisma.subject.create({
    data: { nameAr: `تربية بدنية fu ${stamp}`, nameEn: `PE FU ${stamp}` },
  });

  const student1 = await prisma.student.create({
    data: {
      id: `FU${stamp}A`,
      nameAr: `طالب متابعة ${stamp}`,
      nameEn: `FU Student ${stamp}`,
      classId: classA.id,
      parentPhone: phoneE164,
      isActive: true,
    },
  });
  const student2 = await prisma.student.create({
    data: {
      id: `FU${stamp}B`,
      nameAr: `زميل متابعة ${stamp}`,
      nameEn: `FU Mate ${stamp}`,
      classId: classA.id,
      parentPhone: `+9665${String(stamp + 1).slice(-8)}`,
      isActive: true,
    },
  });

  const asgA = await prisma.teacherAssignment.create({
    data: { teacherId: teacherA.id, classId: classA.id, subjectId: math.id },
  });
  const asgB = await prisma.teacherAssignment.create({
    data: { teacherId: teacherA.id, classId: classB.id, subjectId: math.id },
  });
  const asgPe = await prisma.teacherAssignment.create({
    data: { teacherId: teacherA.id, classId: classA.id, subjectId: pe.id },
  });
  const asgEmpty = await prisma.teacherAssignment.create({
    data: { teacherId: teacherA.id, classId: classEmpty.id, subjectId: math.id },
  });

  async function req(method, urlPath, { headers = {}, body } = {}) {
    const res = await fetch(BASE + urlPath, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return { status: res.status, text, json };
  }
  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  try {
    const loginA = await req('POST', '/api/auth/login', { body: { email: teacherA.email, password } });
    const tokenA = loginA.json?.token;
    ok('teacher A login', loginA.status === 200 && Boolean(tokenA), `status=${loginA.status}`);

    const loginB = await req('POST', '/api/auth/login', { body: { email: teacherB.email, password } });
    const tokenB = loginB.json?.token;
    ok('teacher B login', Boolean(tokenB), `status=${loginB.status}`);

    const loginAdmin = await req('POST', '/api/auth/login', { body: { email: admin.email, password } });
    const tokenAdmin = loginAdmin.json?.token;
    ok('admin login', Boolean(tokenAdmin), `status=${loginAdmin.status}`);

    const list = await req('GET', '/api/weekly-follow-up/me/assignments', { headers: auth(tokenA) });
    const listedIds = (list.json?.assignments || []).map((a) => a.id);
    ok(
      'assignments exclude PE',
      list.status === 200 && listedIds.includes(asgA.id) && !listedIds.includes(asgPe.id),
      `status=${list.status}`
    );

    const peGet = await req('GET', `/api/weekly-follow-up/me?assignmentId=${asgPe.id}&weekStart=${week}`, {
      headers: auth(tokenA),
    });
    ok('PE GET 400', peGet.status === 400, `status=${peGet.status}`);

    const futureGet = await req('GET', `/api/weekly-follow-up/me?assignmentId=${asgA.id}&weekStart=${future}`, {
      headers: auth(tokenA),
    });
    ok('future week GET 400', futureGet.status === 400, `status=${futureGet.status}`);

    const steal = await req('PUT', '/api/weekly-follow-up/me', {
      headers: auth(tokenB),
      body: {
        assignmentId: asgA.id,
        weekStart: week,
        rows: [{ studentId: student1.id, participation: 5 }],
      },
    });
    ok('other teacher PUT 403', steal.status === 403, `status=${steal.status}`);

    const foreign = await req('PUT', '/api/weekly-follow-up/me', {
      headers: auth(tokenA),
      body: {
        assignmentId: asgB.id,
        weekStart: week,
        rows: [{ studentId: student1.id, participation: 4 }],
      },
    });
    ok('foreign student 400', foreign.status === 400, `status=${foreign.status}`);

    const emptyPut = await req('PUT', '/api/weekly-follow-up/me', {
      headers: auth(tokenA),
      body: { assignmentId: asgEmpty.id, weekStart: week, rows: [] },
    });
    ok('empty class PUT 200', emptyPut.status === 200 && emptyPut.json?.ok === true, `status=${emptyPut.status}`);

    const blankNever = await req('PUT', '/api/weekly-follow-up/me', {
      headers: auth(tokenA),
      body: {
        assignmentId: asgA.id,
        weekStart: week,
        rows: [{ studentId: student1.id, notes: '  ' }],
      },
    });
    ok(
      'blank unsaved deleted=0',
      blankNever.status === 200 && blankNever.json?.deleted === 0,
      `deleted=${blankNever.json?.deleted}`
    );

    const saveStr = await req('PUT', '/api/weekly-follow-up/me', {
      headers: auth(tokenA),
      body: {
        assignmentId: asgA.id,
        weekStart: week,
        rows: [{ studentId: student1.id, participation: '5', homeworkScore: 4 }],
      },
    });
    const row1 = saveStr.json?.rows?.find((r) => r.studentId === student1.id);
    ok(
      'string score saved',
      saveStr.status === 200 && row1?.participation === 5 && row1?.total === 9,
      `status=${saveStr.status} p=${row1?.participation} total=${row1?.total}`
    );

    const clear = await req('PUT', '/api/weekly-follow-up/me', {
      headers: auth(tokenA),
      body: {
        assignmentId: asgA.id,
        weekStart: week,
        rows: [{ studentId: student1.id }],
      },
    });
    ok('empty-row delete count', clear.status === 200 && clear.json?.deleted === 1, `deleted=${clear.json?.deleted}`);

    const saveA = await req('PUT', '/api/weekly-follow-up/me', {
      headers: auth(tokenA),
      body: {
        assignmentId: asgA.id,
        weekStart: week,
        rows: [{ studentId: student1.id, participation: 3, understanding: 4 }],
      },
    });
    ok('save in class A', saveA.status === 200 && saveA.json?.saved === 1, `status=${saveA.status}`);

    await prisma.student.update({ where: { id: student1.id }, data: { classId: classB.id } });
    const getB = await req('GET', `/api/weekly-follow-up/me?assignmentId=${asgB.id}&weekStart=${week}`, {
      headers: auth(tokenA),
    });
    const moved = getB.json?.rows?.find((r) => r.studentId === student1.id);
    ok(
      'scores follow student to new class',
      getB.status === 200 && moved?.participation === 3 && moved?.understanding === 4,
      `status=${getB.status} p=${moved?.participation}`
    );

    const saveB = await req('PUT', '/api/weekly-follow-up/me', {
      headers: auth(tokenA),
      body: {
        assignmentId: asgB.id,
        weekStart: week,
        rows: [{ studentId: student1.id, participation: 2, understanding: 2 }],
      },
    });
    ok('overwrite in class B', saveB.status === 200, `status=${saveB.status}`);

    await prisma.student.update({ where: { id: student1.id }, data: { classId: classA.id } });
    const getA = await req('GET', `/api/weekly-follow-up/me?assignmentId=${asgA.id}&weekStart=${week}`, {
      headers: auth(tokenA),
    });
    const back = getA.json?.rows?.find((r) => r.studentId === student1.id);
    ok(
      'return to A still shows latest scores',
      getA.status === 200 && back?.participation === 2 && back?.understanding === 2,
      `p=${back?.participation}`
    );

    const adminReport = await req(
      'GET',
      `/api/reports/weekly-follow-up?classId=${classA.id}&subjectId=${math.id}&weekStart=${week}`,
      { headers: auth(tokenAdmin) }
    );
    const adminRow = adminReport.json?.rows?.find((r) => r.studentId === student1.id);
    ok(
      'admin report matches unique key',
      adminReport.status === 200 && adminRow?.participation === 2,
      `status=${adminReport.status} p=${adminRow?.participation}`
    );

    const opts = await req('GET', '/api/reports/weekly-follow-up/options', { headers: auth(tokenAdmin) });
    const optClass = opts.json?.classes?.find((c) => c.id === classA.id);
    ok(
      'admin options subjects scoped to class',
      opts.status === 200 &&
        Array.isArray(optClass?.subjects) &&
        optClass.subjects.some((s) => s.id === math.id) &&
        !optClass.subjects.some((s) => s.id === pe.id),
      `status=${opts.status}`
    );

    await prisma.parentAccount.deleteMany({ where: { phone: phoneE164 } });
    const reg = await req('POST', '/api/auth/parent/register', {
      body: { phone: phoneLocal, password, studentId: student1.id },
    });
    const parentToken = reg.json?.token;
    ok('parent register', (reg.status === 201 || reg.status === 200) && Boolean(parentToken), `status=${reg.status}`);

    const parentSheet = await req('GET', `/api/parent/students/${student1.id}/weekly-follow-up`, {
      headers: auth(parentToken),
    });
    const parentMath = parentSheet.json?.subjects?.find((s) => s.subjectId === math.id);
    ok(
      'parent sees same scores',
      parentSheet.status === 200 && parentMath?.participation === 2 && parentMath?.understanding === 2,
      `status=${parentSheet.status} p=${parentMath?.participation}`
    );
    ok(
      'parent does not leak classmate',
      parentSheet.status === 200 && !parentSheet.text.includes(student2.nameAr),
      ''
    );
  } finally {
    await prisma.weeklyFollowUp.deleteMany({
      where: { studentId: { in: [student1.id, student2.id] } },
    });
    await prisma.teacherAssignment.deleteMany({
      where: { id: { in: [asgA.id, asgB.id, asgPe.id, asgEmpty.id] } },
    });
    await prisma.parentAccount.deleteMany({ where: { phone: phoneE164 } });
    await prisma.student.deleteMany({ where: { id: { in: [student1.id, student2.id] } } });
    await prisma.class.deleteMany({ where: { id: { in: [classA.id, classB.id, classEmpty.id] } } });
    await prisma.subject.deleteMany({ where: { id: { in: [math.id, pe.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [teacherA.id, teacherB.id] } } });
    await prisma.$disconnect();
  }
}
