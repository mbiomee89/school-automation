/**
 * Smoke: first submit free; resubmit → PENDING; approve applies.
 * Usage: node scripts/smoke-profile-change-requests.js
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

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

function basePayload(overrides = {}) {
  return {
    nameAr: 'طالب تجريبي',
    nameEnFirst: 'Test',
    nameEnFather: 'F',
    nameEnGrand: 'G',
    nameEnFamily: 'Fam',
    nationality: 'سعودي',
    civilId: 'x',
    birthDate: '2015-01-01',
    birthCountry: 'السعودية',
    birthCity: 'الرياض',
    adminRegion: 'الرياض',
    city: 'الرياض',
    district: 'حي',
    streetMain: 'شارع',
    houseNumber: '1',
    email: 'a@b.com',
    guardianName: 'ولي',
    guardianNationality: 'سعودي',
    guardianRelation: 'FATHER',
    guardianIdType: 'NATIONAL',
    guardianIdNumber: '123',
    guardianIdIssueDate: '2020-01-01',
    guardianIdSource: 'أحوال',
    guardianIdExpiry: '2030-01-01',
    guardianMobile: '+966512345678',
    guardianWhatsappSame: true,
    relativeName: 'قريب',
    relativePhone: '+966512345679',
    hasMedicalConditions: false,
    attested: true,
    ...overrides,
  };
}

async function main() {
  const token = `smoke-cr-${Date.now()}`;
  const enteredId = `CR${Date.now()}`;
  const campaign = await prisma.studentProfileCampaign.create({
    data: { token, title: 'smoke-cr', isActive: true },
  });
  const smokeClass = await prisma.class.create({
    data: {
      name: `cr-class-${Date.now()}`,
      gradeLevel: '4',
      section: `C${String(Date.now()).slice(-4)}`,
      academicYear: '2099-2100',
    },
  });

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
  if (!admin) throw new Error('need admin');
  const staffJwt = jwt.sign(
    { kind: 'staff', sub: String(admin.id) },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const auth = { Authorization: `Bearer ${staffJwt}` };

  try {
    const first = await req('POST', `/api/student-profile/public/${token}/submit`, {
      body: {
        enteredStudentId: enteredId,
        payload: basePayload({
          civilId: enteredId,
          classId: smokeClass.id,
          guardianMobile: '+966511111111',
          medicalDetails: null,
        }),
      },
    });
    ok('first submit 200', first.status === 200, `status=${first.status}`);
    ok('first not pending', first.json?.pending === false, JSON.stringify(first.json));
    ok('first no PII in response', !first.text.includes('11111111') && !first.text.includes('guardianMobile'), '');

    const live1 = await prisma.studentProfileSubmission.findFirst({
      where: { campaignId: campaign.id, enteredStudentId: enteredId },
    });
    const livePayload1 = JSON.parse(live1.payload);
    ok('live has first phone', livePayload1.guardianMobile === '+966511111111', livePayload1.guardianMobile);

    const second = await req('POST', `/api/student-profile/public/${token}/submit`, {
      body: {
        enteredStudentId: enteredId,
        payload: basePayload({
          civilId: enteredId,
          classId: smokeClass.id,
          guardianMobile: '+966522222222',
          hasMedicalConditions: true,
          medicalDetails: 'ربو',
        }),
      },
    });
    ok('second submit pending', second.status === 200 && second.json?.pending === true, JSON.stringify(second.json));

    const live2 = await prisma.studentProfileSubmission.findFirst({
      where: { campaignId: campaign.id, enteredStudentId: enteredId },
    });
    const livePayload2 = JSON.parse(live2.payload);
    ok('live unchanged after second', livePayload2.guardianMobile === '+966511111111', livePayload2.guardianMobile);

    const lookup = await req(
      'GET',
      `/api/student-profile/public/${token}/lookup?studentId=${encodeURIComponent(enteredId)}`
    );
    ok(
      'lookup hasPending',
      lookup.json?.hasPriorSubmission === true && lookup.json?.hasPendingChangeRequest === true,
      JSON.stringify(lookup.json)
    );

    const list = await req('GET', '/api/student-profile/staff/change-requests?status=PENDING', {
      headers: auth,
    });
    ok('staff lists pending', list.status === 200 && (list.json?.changeRequests?.length ?? 0) >= 1, `status=${list.status}`);
    const crId = second.json.changeRequestId;
    const found = (list.json?.changeRequests || []).find((r) => r.id === crId);
    ok('listed request has proposed', found?.proposedPayload?.guardianMobile === '+966522222222', '');

    const approve = await req('POST', `/api/student-profile/staff/change-requests/${crId}/approve`, {
      headers: auth,
      body: {},
    });
    ok('approve 200', approve.status === 200 && approve.json?.changeRequest?.status === 'APPROVED', `status=${approve.status}`);

    const live3 = await prisma.studentProfileSubmission.findFirst({
      where: { campaignId: campaign.id, enteredStudentId: enteredId },
    });
    const livePayload3 = JSON.parse(live3.payload);
    ok('live updated after approve', livePayload3.guardianMobile === '+966522222222', livePayload3.guardianMobile);
    ok('live medical after approve', live3.hasMedical === true, String(live3.hasMedical));
  } finally {
    await prisma.studentProfileChangeRequest.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.studentProfileSubmission.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.studentProfileCampaign.delete({ where: { id: campaign.id } }).catch(() => {});
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
