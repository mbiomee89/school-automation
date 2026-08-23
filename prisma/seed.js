/**
 * Ensure a working ADMIN login exists. Does NOT create demo classes/students.
 * Demo fixtures: npm run db:seed:demo (prisma/seed-demo.js)
 *
 * Creates admin@school.local only when missing. Never overwrites passwordHash
 * for an existing admin (keeps isActive + role correct).
 *
 * Default admin password (new installs only): Password123!
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@school.local';
const PASSWORD = 'Password123!';
const YEAR = '2026-2027';

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  let admin;
  if (existing) {
    // Do not touch passwordHash — operators may have changed it after first boot.
    admin = await prisma.user.update({
      where: { id: existing.id },
      data: { isActive: true, role: 'ADMIN' },
    });
    console.log('Seed complete (admin already existed; password unchanged).');
    console.log({ admin: admin.email });
  } else {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    admin = await prisma.user.create({
      data: {
        name: 'School Admin',
        email: ADMIN_EMAIL,
        phone: '+966500000001',
        passwordHash,
        role: 'ADMIN',
        langPref: 'AR',
        mustChangePassword: true,
      },
    });
    console.log('Seed complete (admin created).');
    console.log({
      admin: admin.email,
      mustChangePassword: true,
      note: 'Use the documented default password from ops-hosting.md, then change it on first login.',
    });
  }

  await prisma.schoolSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'المدرسة',
      academicYear: YEAR,
      principalName: null,
      educationAdminName: null,
      address: null,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
