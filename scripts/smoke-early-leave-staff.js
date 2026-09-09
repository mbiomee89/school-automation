/**
 * Smoke: staff early-leave create, conflict, guard review deny, parent cancel rules.
 * Usage: node scripts/smoke-early-leave-staff.js
 * Requires API listening (default http://127.0.0.1:3001).
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { schoolDateOnlyStr, toUtcMidnight, weekdayUtcFromDateOnly } from '../backend/src/utils/dates.js';

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
  const password = 'SmokeEl123!';
  const hash = await bcrypt.hash(password, 10);
  const today = schoolDateOnlyStr();
  const dow = weekdayUtcFromDateOnly(today);
  const isSchoolDay = dow >= 0 && dow <= 4;
  const phoneLocal = `05${String(stamp).slice(-8)}`;
  const phoneE164 = `+9665${String(stamp).slice(-8)}`;

  const guard = await prisma.user.create({
    data: {
      name: `Smoke Guard ${stamp}`,
      email: `smoke-guard-${stamp}@example.com`,
      passwordHash: hash,
      role: 'SECURITY_GUARD',
      isActive: true,
      mustChangePassword: false,
    },
  });
  const affairs = await prisma.user.create({
    data: {
      name: `Smoke Affairs EL ${stamp}`,
      email: `smoke-affairs-el-${stamp}@example.com`,
      passwordHash: hash,
      role: 'STUDENT_AFFAIRS',
      isActive: true,
      mustChangePassword: false,
    },
  });

  const cls = await prisma.class.create({
    data: {
      name: `el-class-${stamp}`,
      gradeLevel: '5',
      section: `E${String(stamp).slice(-3)}`,
      academicYear: '2098-2099',
    },
  });
  const student = await prisma.student.create({
    data: {
      id: `EL${stamp}`,
      nameAr: `طالب استئذان ${stamp}`,
      nameEn: `EL Student ${stamp}`,
      classId: cls.id,
      parentPhone: phoneE164,
      isActive: true,
    },
  });
  const studentParentOwn = await prisma.student.create({
    data: {
      id: `ELP${stamp}`,
      nameAr: `ولي استئذان ${stamp}`,
      nameEn: `EL ParentOwn ${stamp}`,
      classId: cls.id,
      parentPhone: phoneE164,
      isActive: true,
    },
  });

  await prisma.parentAccount.deleteMany({ where: { phone: phoneE164 } });

  let staffRowId = null;
  let parentPendingId = null;

  try {
    const loginGuard = await req('POST', '/api/auth/login', {
      body: { email: guard.email, password },
    });
    const tokenGuard = loginGuard.json?.token;
    ok('guard login', loginGuard.status === 200 && Boolean(tokenGuard), `status=${loginGuard.status}`);

    const loginAffairs = await req('POST', '/api/auth/login', {
      body: { email: affairs.email, password },
    });
    const tokenAffairs = loginAffairs.json?.token;
    ok('affairs login', Boolean(tokenAffairs), `status=${loginAffairs.status}`);

    const createBody = {
      studentId: student.id,
      leaveTime: '10:30',
      reason: 'موعد طبي دخان',
      pickupName: 'ولي',
      pickupRelation: 'أب',
      pickupPhone: phoneLocal,
    };

    if (isSchoolDay) {
      const created = await req('POST', '/api/early-leave', {
        headers: auth(tokenGuard),
        body: createBody,
      });
      ok(
        'guard create APPROVED',
        created.status === 201 &&
          created.json?.item?.status === 'APPROVED' &&
          created.json?.item?.createdByStaff === true,
        `status=${created.status} st=${created.json?.item?.status}`
      );
      staffRowId = created.json?.item?.id ?? null;

      const dup = await req('POST', '/api/early-leave', {
        headers: auth(tokenAffairs),
        body: createBody,
      });
      ok(
        'duplicate create 409 with item',
        dup.status === 409 && Boolean(dup.json?.details?.item?.id),
        `status=${dup.status} hasItem=${Boolean(dup.json?.details?.item)}`
      );
    } else {
      const weekend = await req('POST', '/api/early-leave', {
        headers: auth(tokenGuard),
        body: createBody,
      });
      ok('weekend create rejected 400', weekend.status === 400, `status=${weekend.status}`);

      const date = toUtcMidnight(today);
      const inserted = await prisma.earlyLeaveRequest.create({
        data: {
          studentId: student.id,
          classId: cls.id,
          date,
          leaveTime: new Date(Date.UTC(...today.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)), 10, 30)),
          reason: 'تسجيل يدوي للاختبار',
          pickupName: 'ولي',
          pickupRelation: 'أب',
          pickupPhone: phoneE164,
          status: 'APPROVED',
          createdById: guard.id,
          reviewedBy: guard.id,
          reviewedAt: new Date(),
          reviewNote: 'تسجيل من المدرسة',
          activeSlotKey: `${student.id}|${today}`,
        },
      });
      staffRowId = inserted.id;
      ok('seed staff APPROVED for weekend path', Boolean(staffRowId));
    }

    const pending = await prisma.earlyLeaveRequest.create({
      data: {
        studentId: studentParentOwn.id,
        classId: cls.id,
        date: toUtcMidnight(today),
        leaveTime: new Date(
          Date.UTC(...today.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)), 11, 0)
        ),
        reason: 'طلب ولي للاختبار',
        pickupName: 'أم',
        pickupRelation: 'أم',
        pickupPhone: phoneE164,
        status: 'PENDING',
        activeSlotKey: `${studentParentOwn.id}|${today}`,
      },
    });
    parentPendingId = pending.id;

    const guardReview = await req('PATCH', `/api/early-leave/${parentPendingId}/review`, {
      headers: auth(tokenGuard),
      body: { decision: 'APPROVED' },
    });
    ok('guard review 403', guardReview.status === 403, `status=${guardReview.status}`);

    const reg = await req('POST', '/api/auth/parent/register', {
      body: { phone: phoneLocal, password, studentId: student.id },
    });
    let parentToken = reg.json?.token;
    if (!parentToken && (reg.status === 400 || reg.status === 409)) {
      const loginP = await req('POST', '/api/auth/parent/login', {
        body: { phone: phoneLocal, password },
      });
      parentToken = loginP.json?.token;
    }
    ok('parent auth', Boolean(parentToken), `reg=${reg.status}`);

    if (parentToken && staffRowId) {
      const cancelStaff = await req('POST', `/api/parent/early-leave/${staffRowId}/cancel`, {
        headers: auth(parentToken),
      });
      ok(
        'parent cannot cancel school row',
        cancelStaff.status === 403 || cancelStaff.status === 409,
        `status=${cancelStaff.status}`
      );
      const stillActive = await prisma.earlyLeaveRequest.findUnique({ where: { id: staffRowId } });
      ok(
        'school row still APPROVED',
        stillActive?.status === 'APPROVED' && stillActive?.activeSlotKey != null,
        `status=${stillActive?.status}`
      );
    }

    if (parentToken && parentPendingId) {
      const cancelOwn = await req('POST', `/api/parent/early-leave/${parentPendingId}/cancel`, {
        headers: auth(parentToken),
      });
      ok(
        'parent can cancel own PENDING',
        cancelOwn.status === 200 && cancelOwn.json?.earlyLeaveRequest?.status === 'CANCELLED',
        `status=${cancelOwn.status}`
      );
    }
  } finally {
    await prisma.earlyLeaveRequest.deleteMany({
      where: { studentId: { in: [student.id, studentParentOwn.id] } },
    });
    await prisma.parentAccount.deleteMany({ where: { phone: phoneE164 } });
    await prisma.student.deleteMany({ where: { id: { in: [student.id, studentParentOwn.id] } } });
    await prisma.class.delete({ where: { id: cls.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [guard.id, affairs.id] } } });
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
