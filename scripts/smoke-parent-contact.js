/**
 * Smoke: parent contact → principal reply/close, cancel, open-limit, role gate.
 * Usage: node scripts/smoke-parent-contact.js
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
  const password = 'SmokeContact123!';
  const hash = await bcrypt.hash(password, 10);
  const phoneLocal = `05${String(stamp).slice(-8)}`;
  const phoneE164 = `+9665${String(stamp).slice(-8)}`;

  const admin = await prisma.user.create({
    data: {
      name: `Smoke Contact Admin ${stamp}`,
      email: `smoke-contact-admin-${stamp}@example.com`,
      passwordHash: hash,
      role: 'ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });
  const teacher = await prisma.user.create({
    data: {
      name: `Smoke Contact Teacher ${stamp}`,
      email: `smoke-contact-teacher-${stamp}@example.com`,
      passwordHash: hash,
      role: 'TEACHER',
      isActive: true,
      mustChangePassword: false,
    },
  });

  const cls = await prisma.class.create({
    data: {
      name: `contact-class-${stamp}`,
      gradeLevel: '6',
      section: `C${String(stamp).slice(-3)}`,
      academicYear: '2098-2099',
    },
  });
  const student = await prisma.student.create({
    data: {
      id: `CNT${stamp}`,
      nameAr: `طالب تواصل ${stamp}`,
      nameEn: `Contact Student ${stamp}`,
      classId: cls.id,
      parentPhone: phoneE164,
      isActive: true,
    },
  });
  const studentB = await prisma.student.create({
    data: {
      id: `CNTB${stamp}`,
      nameAr: `طالب تواصل ب ${stamp}`,
      nameEn: `Contact Student B ${stamp}`,
      classId: cls.id,
      parentPhone: phoneE164,
      isActive: true,
    },
  });

  await prisma.parentAccount.deleteMany({ where: { phone: phoneE164 } });
  await prisma.parentAccount.create({
    data: {
      phone: phoneE164,
      passwordHash: hash,
      isActive: true,
    },
  });

  let messageId = null;

  try {
    const loginParent = await req('POST', '/api/auth/parent/login', {
      body: { phone: phoneLocal, password },
    });
    const parentToken = loginParent.json?.token;
    ok('parent login', loginParent.status === 200 && Boolean(parentToken), `status=${loginParent.status}`);

    const loginAdmin = await req('POST', '/api/auth/login', {
      body: { email: admin.email, password },
    });
    const adminToken = loginAdmin.json?.token;
    ok('admin login', Boolean(adminToken), `status=${loginAdmin.status}`);

    const loginTeacher = await req('POST', '/api/auth/login', {
      body: { email: teacher.email, password },
    });
    const teacherToken = loginTeacher.json?.token;
    ok('teacher login', Boolean(teacherToken), `status=${loginTeacher.status}`);

    if (!parentToken || !adminToken) throw new Error('missing tokens');

    const created = await req('POST', `/api/parent/students/${student.id}/contact-messages`, {
      headers: auth(parentToken),
      body: { kind: 'SUGGESTION', body: 'اقتراح دخان للاختبار' },
    });
    ok(
      'parent create OPEN',
      created.status === 201 && created.json?.item?.status === 'OPEN',
      `status=${created.status}`
    );
    messageId = created.json?.item?.id ?? null;

    const dup = await req('POST', `/api/parent/students/${student.id}/contact-messages`, {
      headers: auth(parentToken),
      body: { kind: 'COMPLAINT', body: 'يجب أن يُرفض' },
    });
    ok('second OPEN blocked 409', dup.status === 409, `status=${dup.status}`);

    const cancel = await req('POST', `/api/parent/contact-messages/${messageId}/cancel`, {
      headers: auth(parentToken),
    });
    ok(
      'parent cancel OPEN',
      cancel.status === 200 && cancel.json?.item?.status === 'CANCELLED',
      `status=${cancel.status}`
    );

    const adminAllAfterCancel = await req('GET', '/api/parent-contact?status=all', {
      headers: auth(adminToken),
    });
    const cancelledLeaked = Array.isArray(adminAllAfterCancel.json?.items)
      ? adminAllAfterCancel.json.items.some((i) => i.id === messageId || i.status === 'CANCELLED')
      : true;
    ok(
      'admin all excludes CANCELLED',
      adminAllAfterCancel.status === 200 && !cancelledLeaked,
      `status=${adminAllAfterCancel.status} leaked=${cancelledLeaked}`
    );

    const cancelAgain = await req('POST', `/api/parent/contact-messages/${messageId}/cancel`, {
      headers: auth(parentToken),
    });
    ok('cancel non-OPEN 409', cancelAgain.status === 409, `status=${cancelAgain.status}`);

    const created2 = await req('POST', `/api/parent/students/${student.id}/contact-messages`, {
      headers: auth(parentToken),
      body: { kind: 'COMPLAINT', body: 'شكوى بعد الإلغاء' },
    });
    ok(
      'create after cancel OPEN',
      created2.status === 201 && created2.json?.item?.status === 'OPEN',
      `status=${created2.status}`
    );
    messageId = created2.json?.item?.id ?? null;

    const pending = await req('GET', '/api/parent-contact/pending-count', {
      headers: auth(adminToken),
    });
    ok(
      'pending-count includes OPEN',
      pending.status === 200 && pending.json?.count >= 1,
      `status=${pending.status} count=${pending.json?.count}`
    );

    const siblingOpen = await req('POST', `/api/parent/students/${studentB.id}/contact-messages`, {
      headers: auth(parentToken),
      body: { kind: 'OTHER', body: 'رسالة للابن الآخر' },
    });
    ok(
      'sibling student can OPEN independently',
      siblingOpen.status === 201 && siblingOpen.json?.item?.status === 'OPEN',
      `status=${siblingOpen.status}`
    );

    const teacherList = await req('GET', '/api/parent-contact', {
      headers: auth(teacherToken),
    });
    ok('teacher list 403', teacherList.status === 403, `status=${teacherList.status}`);

    const emptyReply = await req('PATCH', `/api/parent-contact/${messageId}/reply`, {
      headers: auth(adminToken),
      body: { replyBody: '   ' },
    });
    ok('empty reply rejected', emptyReply.status === 400, `status=${emptyReply.status}`);

    const adminList = await req('GET', '/api/parent-contact?status=OPEN', {
      headers: auth(adminToken),
    });
    const found = Array.isArray(adminList.json?.items)
      ? adminList.json.items.some((i) => i.id === messageId)
      : false;
    ok(
      'admin sees OPEN with student',
      adminList.status === 200 && found,
      `status=${adminList.status} found=${found}`
    );

    const reply = await req('PATCH', `/api/parent-contact/${messageId}/reply`, {
      headers: auth(adminToken),
      body: { replyBody: 'تم الاطلاع والرد' },
    });
    ok(
      'admin reply closes',
      reply.status === 200 && reply.json?.item?.status === 'CLOSED',
      `status=${reply.status}`
    );

    const closedFilter = await req('GET', '/api/parent-contact?status=CLOSED', {
      headers: auth(adminToken),
    });
    const inClosed = Array.isArray(closedFilter.json?.items)
      ? closedFilter.json.items.some((i) => i.id === messageId)
      : false;
    ok('CLOSED filter includes replied', closedFilter.status === 200 && inClosed);

    const reply2 = await req('PATCH', `/api/parent-contact/${messageId}/reply`, {
      headers: auth(adminToken),
      body: { replyBody: 'مرة أخرى' },
    });
    ok('second reply 409', reply2.status === 409, `status=${reply2.status}`);

    const parentList = await req('GET', `/api/parent/students/${student.id}/contact-messages`, {
      headers: auth(parentToken),
    });
    const closed = Array.isArray(parentList.json?.items)
      ? parentList.json.items.find((i) => i.id === messageId)
      : null;
    ok(
      'parent sees reply',
      parentList.status === 200 &&
        closed?.status === 'CLOSED' &&
        closed?.replyBody === 'تم الاطلاع والرد',
      `status=${parentList.status}`
    );
  } finally {
    await prisma.parentContactMessage.deleteMany({
      where: { studentId: { in: [student.id, studentB.id] } },
    });
    await prisma.parentAccount.deleteMany({ where: { phone: phoneE164 } });
    await prisma.student.deleteMany({ where: { id: { in: [student.id, studentB.id] } } });
    await prisma.class.delete({ where: { id: cls.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, teacher.id] } } });
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
