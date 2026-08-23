/**
 * Smoke checks for student-data security harden (uploads / lookup / mustChangePassword).
 * Usage: node scripts/smoke-security-harden.js
 * Requires API listening (default http://127.0.0.1:3001).
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env' });
const BASE = `http://127.0.0.1:${process.env.PORT || 3001}`;
const prisma = new PrismaClient();

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail ?? '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, urlPath, { headers = {}, body } = {}) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, text, json, headers: Object.fromEntries(res.headers) };
}

async function main() {
  // --- 1) Uploads locked ---
  const logoRel = 'logos/417f9e675c1f2be96d42d82004c1bdf8.jpg';
  const absenceRel = 'absence-reasons/898d5b9fe3eaa0b36355cf8e6fdc88de.pdf';
  for (const p of [
    `/uploads/${logoRel}`,
    `/api/uploads/${logoRel}`,
    '/uploads/backups/does-not-exist.zip',
    '/api/uploads/backups/does-not-exist.zip',
    `/uploads/${absenceRel}`,
    `/api/uploads/${absenceRel}`,
  ]) {
    const r = await req('GET', p);
    const ct = r.headers['content-type'] || '';
    const looksLikeFile =
      ct.includes('image/') ||
      ct.includes('application/pdf') ||
      ct.includes('application/zip') ||
      ct.includes('octet-stream');
    const blocked =
      r.status === 404 ||
      r.status === 401 ||
      r.status === 403 ||
      (r.status === 200 && !looksLikeFile);
    ok(`uploads blocked ${p}`, blocked, `status=${r.status} ct=${ct.split(';')[0]}`);
  }

  const logoApi = await req('GET', '/api/school-settings/logo');
  ok(
    'logo API reachable (not static uploads)',
    logoApi.status === 200 || logoApi.status === 404,
    `status=${logoApi.status}`
  );

  // --- 2) Public lookup shrink ---
  // Isolated campaign + student so empty local DBs still verify the harden path.
  const smokeClass = await prisma.class.create({
    data: {
      name: `smoke-class-${Date.now()}`,
      gradeLevel: '4',
      section: `S${String(Date.now()).slice(-4)}`,
      academicYear: '2099-2100',
    },
  });
  const student = await prisma.student.create({
    data: {
      id: `SMOKE${Date.now()}`,
      nameAr: 'طالب اختبار الدخان',
      nameEn: 'Smoke Test Student',
      classId: smokeClass.id,
      parentPhone: '+966500000099',
      isActive: true,
    },
    include: { class: true },
  });
  const campaign = await prisma.studentProfileCampaign.create({
    data: {
      token: `smoke-${Date.now()}`,
      title: 'smoke-security-harden',
      isActive: true,
    },
  });
  try {
    await prisma.studentProfileSubmission.create({
      data: {
        campaignId: campaign.id,
        enteredStudentId: student.id,
        studentId: student.id,
        classId: student.classId,
        payload: JSON.stringify({
          nameAr: student.nameAr,
          guardianMobile: '+966512345678',
          medicalDetails: 'SECRET_MEDICAL_SHOULD_NOT_LEAK',
          guardianWhatsapp: '+966512345678',
        }),
        hasMedical: true,
      },
    });

    const lookup = await req(
      'GET',
      `/api/student-profile/public/${encodeURIComponent(campaign.token)}/lookup?studentId=${encodeURIComponent(student.id)}`
    );
    const body = lookup.json || {};
    const keys = body.student ? Object.keys(body.student).sort() : [];
    const allowed = ['id', 'nameAr', 'classId', 'className'];
    const extra = keys.filter((k) => !allowed.includes(k));
    const text = lookup.text || '';
    const leaked =
      text.includes('SECRET_MEDICAL') ||
      text.includes('guardianMobile') ||
      text.includes('medicalDetails') ||
      text.includes('+966');
    ok('lookup status 200', lookup.status === 200, `status=${lookup.status}`);
    ok(
      'lookup has found + hasPriorSubmission',
      body.found === true && body.hasPriorSubmission === true,
      JSON.stringify({ found: body.found, hasPriorSubmission: body.hasPriorSubmission })
    );
    ok(
      'lookup student keys name/class only',
      extra.length === 0 && keys.includes('nameAr'),
      `keys=${keys.join(',')}`
    );
    ok('lookup does not leak PII', !leaked, leaked ? 'LEAK in body' : 'clean');
  } finally {
    await prisma.studentProfileSubmission.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.studentProfileCampaign.delete({ where: { id: campaign.id } });
    await prisma.student.delete({ where: { id: student.id } });
    await prisma.class.delete({ where: { id: smokeClass.id } });
  }

  // --- 3) mustChangePassword gate ---
  const gateUser = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
  if (!gateUser) {
    ok('auth gate setup', false, 'no admin user');
  } else {
    const before = gateUser.mustChangePassword;
    await prisma.user.update({ where: { id: gateUser.id }, data: { mustChangePassword: true } });
    const token = jwt.sign(
      { kind: 'staff', sub: String(gateUser.id) },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const auth = { Authorization: `Bearer ${token}` };

    try {
      const me = await req('GET', '/api/auth/me', { headers: auth });
      ok('mustChange: GET /auth/me allowed', me.status === 200, `status=${me.status}`);

      const students = await req('GET', '/api/students', { headers: auth });
      ok(
        'mustChange: GET /students blocked',
        students.status === 403,
        `status=${students.status} msg=${students.json?.error || students.json?.message || ''}`
      );

      const chg = await req('POST', '/api/auth/change-password', {
        headers: auth,
        body: { currentPassword: 'definitely-wrong-password', newPassword: 'NewPass123!' },
      });
      ok(
        'mustChange: POST /change-password not blocked by gate',
        chg.status !== 403,
        `status=${chg.status}`
      );
    } finally {
      await prisma.user.update({
        where: { id: gateUser.id },
        data: { mustChangePassword: before },
      });
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n--- SUMMARY: ${results.length - failed.length}/${results.length} passed ---`);
  if (failed.length) {
    console.log('FAILED:');
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
