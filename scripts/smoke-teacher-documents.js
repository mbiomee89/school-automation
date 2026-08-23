/**
 * Smoke checks for teacher employment PDF dossier.
 * Usage: node scripts/smoke-teacher-documents.js
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
  results.push({ name, pass: !!pass, detail: detail ?? '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, urlPath, { headers = {}, body, rawBody, formData } = {}) {
  const h = { ...headers };
  let payload = undefined;
  if (formData) {
    payload = formData;
  } else if (rawBody !== undefined) {
    payload = rawBody;
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + urlPath, { method, headers: h, body: payload });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString('utf8');
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return {
    status: res.status,
    text,
    json,
    buf,
    headers: Object.fromEntries(res.headers),
  };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  return r;
}

async function main() {
  const stamp = Date.now();
  const password = 'SmokePdf123!';
  const hash = await bcrypt.hash(password, 10);

  const teacherA = await prisma.user.create({
    data: {
      name: `Smoke Teacher A ${stamp}`,
      email: `smoke-teacher-a-${stamp}@example.com`,
      passwordHash: hash,
      role: 'TEACHER',
      isActive: true,
      mustChangePassword: false,
    },
  });
  const teacherB = await prisma.user.create({
    data: {
      name: `Smoke Teacher B ${stamp}`,
      email: `smoke-teacher-b-${stamp}@example.com`,
      passwordHash: hash,
      role: 'TEACHER',
      isActive: true,
      mustChangePassword: false,
    },
  });
  const affairs = await prisma.user.create({
    data: {
      name: `Smoke Affairs ${stamp}`,
      email: `smoke-affairs-${stamp}@example.com`,
      passwordHash: hash,
      role: 'STUDENT_AFFAIRS',
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
        name: `Smoke Admin ${stamp}`,
        email: `smoke-admin-${stamp}@example.com`,
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

  try {
    const loginA = await login(teacherA.email, password);
    ok('teacher A login', loginA.status === 200 && loginA.json?.token, `status=${loginA.status}`);
    const tokenA = loginA.json?.token;

    const loginB = await login(teacherB.email, password);
    const tokenB = loginB.json?.token;
    ok('teacher B login', Boolean(tokenB), `status=${loginB.status}`);

    const loginAdmin = await login(admin.email, password);
    const tokenAdmin = loginAdmin.json?.token;
    ok('admin login', Boolean(tokenAdmin), `status=${loginAdmin.status}`);

    const loginAffairs = await login(affairs.email, password);
    const tokenAffairs = loginAffairs.json?.token;
    ok('affairs login', Boolean(tokenAffairs), `status=${loginAffairs.status}`);

    const listEmpty = await req('GET', '/api/teacher-documents/me', { headers: auth(tokenA) });
    ok(
      'teacher list empty slots',
      listEmpty.status === 200 &&
        listEmpty.json?.totalCount === 10 &&
        listEmpty.json?.uploadedCount === 0 &&
        Array.isArray(listEmpty.json?.documents) &&
        listEmpty.json.documents.length === 10,
      `status=${listEmpty.status} count=${listEmpty.json?.uploadedCount}`
    );

    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8');
    const form = new FormData();
    form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'id-card.pdf');

    const up1 = await req('POST', '/api/teacher-documents/me/NATIONAL_ID', {
      headers: auth(tokenA),
      formData: form,
    });
    ok(
      'teacher upload PDF',
      up1.status === 200 && up1.json?.uploaded === true && up1.json?.fileName,
      `status=${up1.status} file=${up1.json?.fileName}`
    );

    const form2 = new FormData();
    form2.append(
      'file',
      new Blob([Buffer.from('%PDF-1.4\nreplaced\n%%EOF\n')], { type: 'application/pdf' }),
      'id-card-v2.pdf'
    );
    const up2 = await req('POST', '/api/teacher-documents/me/NATIONAL_ID', {
      headers: auth(tokenA),
      formData: form2,
    });
    ok(
      're-upload replaces',
      up2.status === 200 && up2.json?.fileName?.includes('id-card-v2'),
      `file=${up2.json?.fileName}`
    );
    const countRows = await prisma.teacherDocument.count({
      where: { teacherId: teacherA.id, docType: 'NATIONAL_ID' },
    });
    ok('unique one row per type', countRows === 1, `rows=${countRows}`);

    const badForm = new FormData();
    badForm.append(
      'file',
      new Blob([Buffer.from('not-a-pdf')], { type: 'application/pdf' }),
      'fake.pdf'
    );
    const bad = await req('POST', '/api/teacher-documents/me/MEDICAL_EXAM', {
      headers: auth(tokenA),
      formData: badForm,
    });
    ok('non-PDF rejected', bad.status === 400, `status=${bad.status}`);

    const steal = await req('GET', `/api/teacher-documents/me/NATIONAL_ID/file`, {
      headers: auth(tokenB),
    });
    ok(
      'other teacher cannot download (own slot empty)',
      steal.status === 404,
      `status=${steal.status}`
    );

    const ownFile = await req('GET', '/api/teacher-documents/me/NATIONAL_ID/file', {
      headers: auth(tokenA),
    });
    ok(
      'teacher downloads own PDF',
      ownFile.status === 200 &&
        (ownFile.headers['content-type'] || '').includes('pdf') &&
        ownFile.buf.slice(0, 4).toString() === '%PDF',
      `status=${ownFile.status} ct=${ownFile.headers['content-type']}`
    );

    const adminList = await req('GET', '/api/teacher-documents/admin', {
      headers: auth(tokenAdmin),
    });
    const rowA = adminList.json?.teachers?.find((t) => t.id === teacherA.id);
    ok(
      'admin lists teacher completion',
      adminList.status === 200 && rowA?.uploadedCount >= 1,
      `status=${adminList.status} uploaded=${rowA?.uploadedCount}`
    );

    const adminDl = await req(
      'GET',
      `/api/teacher-documents/admin/${teacherA.id}/NATIONAL_ID/file`,
      { headers: auth(tokenAdmin) }
    );
    ok(
      'admin downloads teacher PDF',
      adminDl.status === 200 && adminDl.buf.slice(0, 4).toString() === '%PDF',
      `status=${adminDl.status}`
    );

    const teacherAdmin = await req('GET', '/api/teacher-documents/admin', {
      headers: auth(tokenA),
    });
    ok('teacher forbidden on admin list', teacherAdmin.status === 403, `status=${teacherAdmin.status}`);

    const affairsAdmin = await req(
      'GET',
      `/api/teacher-documents/admin/${teacherA.id}/NATIONAL_ID/file`,
      { headers: auth(tokenAffairs) }
    );
    ok(
      'student affairs forbidden on admin download',
      affairsAdmin.status === 403,
      `status=${affairsAdmin.status}`
    );
  } finally {
    await prisma.teacherDocument.deleteMany({
      where: { teacherId: { in: [teacherA.id, teacherB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [teacherA.id, teacherB.id, affairs.id] } },
    });
    if (admin.email?.startsWith(`smoke-admin-${stamp}`)) {
      await prisma.user.delete({ where: { id: admin.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
