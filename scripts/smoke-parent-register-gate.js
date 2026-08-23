/**
 * Smoke: parent register student-ID gate.
 * Usage: node scripts/smoke-parent-register-gate.js
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env' });
const BASE = `http://127.0.0.1:${process.env.PORT || 3001}`;
const prisma = new PrismaClient();

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail ?? '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, urlPath, body) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
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

async function main() {
  const phoneLocal = '0598765432';
  const phoneE164 = '+966598765432';
  const password = 'TestPass99!';
  const wrongId = '9999999999';

  const smokeClass = await prisma.class.create({
    data: {
      name: `gate-class-${Date.now()}`,
      gradeLevel: '4',
      section: `G${String(Date.now()).slice(-4)}`,
      academicYear: '2099-2100',
    },
  });
  const student = await prisma.student.create({
    data: {
      id: `GATE${Date.now()}`,
      nameAr: 'طالب بوابة',
      nameEn: 'Gate Student',
      classId: smokeClass.id,
      parentPhone: phoneE164,
      isActive: true,
    },
  });

  // Ensure no leftover parent account for this phone
  await prisma.parentAccount.deleteMany({ where: { phone: phoneE164 } });

  try {
    const noId = await req('POST', '/api/auth/parent/register', {
      phone: phoneLocal,
      password,
    });
    ok('register without studentId → 400', noId.status === 400, `status=${noId.status}`);

    const wrong = await req('POST', '/api/auth/parent/register', {
      phone: phoneLocal,
      password,
      studentId: wrongId,
    });
    ok(
      'register wrong studentId → 400',
      wrong.status === 400,
      `status=${wrong.status} msg=${wrong.json?.error || ''}`
    );
    const afterWrong = await prisma.parentAccount.findUnique({ where: { phone: phoneE164 } });
    ok('no account after wrong ID', !afterWrong, afterWrong ? 'account created' : 'none');

    const okReg = await req('POST', '/api/auth/parent/register', {
      phone: phoneLocal,
      password,
      studentId: student.id,
    });
    ok(
      'register matching phone+ID → 201',
      okReg.status === 201 && !!okReg.json?.token,
      `status=${okReg.status}`
    );

    const second = await req('POST', '/api/auth/parent/register', {
      phone: phoneLocal,
      password: 'AnotherPass99!',
      studentId: student.id,
    });
    ok('second register blocked → 400', second.status === 400, `status=${second.status}`);

    const login = await req('POST', '/api/auth/parent/login', {
      phone: phoneLocal,
      password,
    });
    ok(
      'login phone+password unchanged → 200',
      login.status === 200 && !!login.json?.token,
      `status=${login.status}`
    );

    // login must not require studentId
    const loginBodyKeys = Object.keys(
      (await req('POST', '/api/auth/parent/login', { phone: phoneLocal, password })).json || {}
    );
    ok('login response has token', loginBodyKeys.includes('token') || !!login.json?.token, '');
  } finally {
    await prisma.parentAccount.deleteMany({ where: { phone: phoneE164 } });
    await prisma.student.delete({ where: { id: student.id } }).catch(() => {});
    await prisma.class.delete({ where: { id: smokeClass.id } }).catch(() => {});
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n--- SUMMARY: ${results.length - failed.length}/${results.length} passed ---`);
  if (failed.length) {
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
