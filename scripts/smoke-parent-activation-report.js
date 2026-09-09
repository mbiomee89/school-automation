/**
 * Smoke: parent portal activation report (summary card + detail filters).
 * Usage: node scripts/smoke-parent-activation-report.js
 * Requires API listening (default http://127.0.0.1:3001).
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env' });
const BASE = `http://127.0.0.1:${process.env.PORT || 3001}`;
const prisma = new PrismaClient();

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

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

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  const stamp = Date.now();
  const password = 'SmokeParentAct123!';
  const hash = await bcrypt.hash(password, 10);
  const phoneActive = `+9665${String(stamp).slice(-8)}`;
  const phoneInactive = `+9665${String(stamp + 1).slice(-8)}`;
  const phoneDisabled = `+9665${String(stamp + 2).slice(-8)}`;

  const admin = await prisma.user.create({
    data: {
      name: `Smoke ParentAct Admin ${stamp}`,
      email: `smoke-parent-act-admin-${stamp}@example.com`,
      passwordHash: hash,
      role: 'ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  const cls = await prisma.class.create({
    data: {
      name: `parent-act-class-${stamp}`,
      gradeLevel: '5',
      section: `P${String(stamp).slice(-3)}`,
      academicYear: '2097-2098',
    },
  });

  const sActive = await prisma.student.create({
    data: {
      id: `9${String(stamp).slice(-9)}`,
      nameAr: `طالب مفعّل ${stamp}`,
      nameEn: `Active Parent ${stamp}`,
      classId: cls.id,
      parentPhone: phoneActive,
      isActive: true,
    },
  });
  const sSibling = await prisma.student.create({
    data: {
      id: `8${String(stamp).slice(-9)}`,
      nameAr: `أخ مفعّل ${stamp}`,
      nameEn: `Sibling ${stamp}`,
      classId: cls.id,
      parentPhone: phoneActive,
      isActive: true,
    },
  });
  const sNotAct = await prisma.student.create({
    data: {
      id: `7${String(stamp).slice(-9)}`,
      nameAr: `طالب غير مفعّل ${stamp}`,
      nameEn: `Not Act ${stamp}`,
      classId: cls.id,
      parentPhone: phoneInactive,
      isActive: true,
    },
  });
  const sDisabled = await prisma.student.create({
    data: {
      id: `6${String(stamp).slice(-9)}`,
      nameAr: `طالب حساب معطّل ${stamp}`,
      nameEn: `Disabled Acc ${stamp}`,
      classId: cls.id,
      parentPhone: phoneDisabled,
      isActive: true,
    },
  });
  const sNoPhone = await prisma.student.create({
    data: {
      id: `5${String(stamp).slice(-9)}`,
      nameAr: `طالب بدون جوال ${stamp}`,
      nameEn: `No Phone ${stamp}`,
      classId: cls.id,
      parentPhone: '   ',
      isActive: true,
    },
  });

  await prisma.parentAccount.create({
    data: { phone: phoneActive, passwordHash: hash, isActive: true },
  });
  await prisma.parentAccount.create({
    data: { phone: phoneDisabled, passwordHash: hash, isActive: false },
  });

  try {
    const login = await req('POST', '/api/auth/login', {
      body: { email: admin.email, password },
    });
    const token = login.json?.token;
    ok('admin login', Boolean(token), `status=${login.status}`);
    if (!token) return;

    const today = new Date().toISOString().slice(0, 10);
    const summary = await req('GET', `/api/reports/summary?date=${today}`, {
      headers: auth(token),
    });
    const card = summary.json?.reports?.find((r) => r.type === 'PARENT_ACTIVATION');
    ok('summary has PARENT_ACTIVATION', Boolean(card), `status=${summary.status}`);
    ok('card iconHint USERS', card?.iconHint === 'USERS');
    ok('card count is number', typeof card?.count === 'number');

    const all = await req('GET', '/api/reports/parent-activation', {
      headers: auth(token),
    });
    ok('detail 200', all.status === 200, `status=${all.status}`);
    const sum = all.json?.summary;
    ok(
      'summary math',
      sum &&
        sum.activated + sum.notActivated + sum.noPhone === sum.totalPhones,
      JSON.stringify(sum)
    );
    ok(
      'card count matches notActivated',
      card?.count === sum?.notActivated,
      `card=${card?.count} detail=${sum?.notActivated}`
    );

    const rowActive = all.json?.parents?.find((p) => p.phone === phoneActive);
    ok('active phone present', Boolean(rowActive?.activated));
    ok('siblings merged', rowActive?.studentCount === 2, `count=${rowActive?.studentCount}`);

    const rowDisabled = all.json?.parents?.find((p) => p.phone === phoneDisabled);
    ok(
      'disabled account = not activated + flag',
      rowDisabled && !rowDisabled.activated && rowDisabled.accountDisabled
    );

    const notAct = await req('GET', '/api/reports/parent-activation?status=NOT_ACTIVATED', {
      headers: auth(token),
    });
    const notRows = notAct.json?.parents ?? [];
    ok(
      'NOT_ACTIVATED filter',
      notRows.every((p) => !p.activated && !p.noPhone) &&
        notRows.some((p) => p.phone === phoneInactive) &&
        notRows.some((p) => p.phone === phoneDisabled) &&
        !notRows.some((p) => p.phone === phoneActive)
    );
    ok(
      'NOT_ACTIVATED summary stable',
      notAct.json?.summary?.totalPhones === sum?.totalPhones
    );

    const noPhone = await req('GET', '/api/reports/parent-activation?status=NO_PHONE', {
      headers: auth(token),
    });
    const noRows = noPhone.json?.parents ?? [];
    ok(
      'NO_PHONE filter',
      noRows.length >= 1 && noRows.every((p) => p.noPhone) &&
        noRows.some((p) => p.students.some((s) => s.id === sNoPhone.id))
    );

    const activated = await req('GET', '/api/reports/parent-activation?status=ACTIVATED', {
      headers: auth(token),
    });
    ok(
      'ACTIVATED filter',
      (activated.json?.parents ?? []).every((p) => p.activated && !p.noPhone) &&
        (activated.json?.parents ?? []).some((p) => p.phone === phoneActive)
    );

    const byClass = await req(
      'GET',
      `/api/reports/parent-activation?classId=${cls.id}`,
      { headers: auth(token) }
    );
    ok('class filter 200', byClass.status === 200, `status=${byClass.status}`);
    ok('classId echoed', byClass.json?.classId === cls.id);
    ok(
      'class filter scopes students',
      (byClass.json?.parents ?? []).every((p) =>
        p.students.every((s) => s.id === sActive.id || s.id === sSibling.id || s.id === sNotAct.id || s.id === sDisabled.id || s.id === sNoPhone.id)
      ) &&
        (byClass.json?.summary?.totalPhones ?? 0) >= 1
    );
    ok(
      'classes list present',
      Array.isArray(byClass.json?.classes) &&
        byClass.json.classes.some((c) => c.id === cls.id)
    );

    const otherClass = await prisma.class.create({
      data: {
        name: `parent-act-other-${stamp}`,
        gradeLevel: '4',
        section: `O${String(stamp).slice(-3)}`,
        academicYear: '2097-2098',
      },
    });
    const emptyClass = await req(
      'GET',
      `/api/reports/parent-activation?classId=${otherClass.id}`,
      { headers: auth(token) }
    );
    ok(
      'empty class has zero parents',
      emptyClass.json?.summary?.totalPhones === 0 &&
        (emptyClass.json?.parents ?? []).length === 0
    );
    await prisma.class.delete({ where: { id: otherClass.id } }).catch(() => {});

    const teacher = await prisma.user.create({
      data: {
        name: `Smoke ParentAct Teacher ${stamp}`,
        email: `smoke-parent-act-teacher-${stamp}@example.com`,
        passwordHash: hash,
        role: 'TEACHER',
        isActive: true,
        mustChangePassword: false,
      },
    });
    const tLogin = await req('POST', '/api/auth/login', {
      body: { email: teacher.email, password },
    });
    const tToken = tLogin.json?.token;
    const forbidden = await req('GET', '/api/reports/parent-activation', {
      headers: auth(tToken),
    });
    ok('teacher forbidden', forbidden.status === 403, `status=${forbidden.status}`);

    void sActive;
    void sSibling;
    void sNotAct;
    void sDisabled;
  } finally {
    await prisma.parentAccount.deleteMany({
      where: { phone: { in: [phoneActive, phoneDisabled] } },
    });
    await prisma.student.deleteMany({
      where: {
        id: {
          in: [
            `9${String(stamp).slice(-9)}`,
            `8${String(stamp).slice(-9)}`,
            `7${String(stamp).slice(-9)}`,
            `6${String(stamp).slice(-9)}`,
            `5${String(stamp).slice(-9)}`,
          ],
        },
      },
    });
    await prisma.class.delete({ where: { id: cls.id } }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            admin.email,
            `smoke-parent-act-teacher-${stamp}@example.com`,
          ],
        },
      },
    });
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
