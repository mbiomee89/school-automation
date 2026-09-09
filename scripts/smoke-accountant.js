/**
 * Smoke: ACCOUNTANT student directory — read OK, mutations and assignments denied.
 * Usage: node scripts/smoke-accountant.js
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
  const password = 'SmokeAcct123!';
  const hash = await bcrypt.hash(password, 10);
  const phoneE164 = `+9665${String(stamp).slice(-8)}`;

  const accountant = await prisma.user.create({
    data: {
      name: `Smoke Accountant ${stamp}`,
      email: `smoke-accountant-${stamp}@example.com`,
      passwordHash: hash,
      role: 'ACCOUNTANT',
      isActive: true,
      mustChangePassword: false,
    },
  });

  const cls = await prisma.class.create({
    data: {
      name: `acct-class-${stamp}`,
      gradeLevel: '4',
      section: `A${String(stamp).slice(-3)}`,
      academicYear: '2098-2099',
    },
  });

  const student = await prisma.student.create({
    data: {
      id: `ACCT${stamp}`,
      nameAr: `طالب محاسب ${stamp}`,
      nameEn: `Acct Student ${stamp}`,
      classId: cls.id,
      parentPhone: phoneE164,
      isActive: true,
    },
  });

  try {
    const login = await req('POST', '/api/auth/login', {
      body: { email: accountant.email, password },
    });
    const token = login.json?.token;
    ok('accountant login', login.status === 200 && Boolean(token), `status=${login.status}`);

    if (!token) {
      throw new Error('No accountant token — aborting remaining checks');
    }

    const list = await req('GET', '/api/students', { headers: auth(token) });
    const listed = Array.isArray(list.json?.students)
      ? list.json.students.some((s) => s.id === student.id)
      : false;
    ok(
      'GET /students 200 includes smoke student',
      list.status === 200 && listed,
      `status=${list.status} listed=${listed}`
    );

    const detail = await req('GET', `/api/students/${student.id}`, { headers: auth(token) });
    ok(
      'GET /students/:id 200',
      detail.status === 200 && detail.json?.student?.id === student.id,
      `status=${detail.status}`
    );

    const enrollments = await req('GET', `/api/students/${student.id}/enrollments`, {
      headers: auth(token),
    });
    ok(
      'GET /students/:id/enrollments 200',
      enrollments.status === 200 && Array.isArray(enrollments.json?.enrollments),
      `status=${enrollments.status}`
    );

    const create = await req('POST', '/api/students', {
      headers: auth(token),
      body: {
        id: `ACCTX${stamp}`,
        nameAr: 'ممنوع',
        nameEn: 'Forbidden',
        parentPhone: phoneE164,
      },
    });
    ok('POST /students 403', create.status === 403, `status=${create.status}`);

    const reset = await req('POST', `/api/students/${student.id}/reset-parent-password`, {
      headers: auth(token),
    });
    ok('POST reset-parent-password 403', reset.status === 403, `status=${reset.status}`);

    const assignments = await req('GET', '/api/teacher-assignments', { headers: auth(token) });
    ok(
      'GET /teacher-assignments 403',
      assignments.status === 403,
      `status=${assignments.status}`
    );
  } finally {
    await prisma.student.deleteMany({ where: { id: { in: [student.id, `ACCTX${stamp}`] } } });
    await prisma.class.delete({ where: { id: cls.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: accountant.id } }).catch(() => {});
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
