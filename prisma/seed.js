/**
 * Ensure a working ADMIN login exists. Does NOT create demo classes/students.
 * Demo fixtures: npm run db:seed:demo (prisma/seed-demo.js)
 *
 * Default admin password: Password123!
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Password123!';
const YEAR = '2026-2027';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@school.local' },
    update: { passwordHash, isActive: true, role: 'ADMIN' },
    create: {
      name: 'School Admin',
      email: 'admin@school.local',
      phone: '+966500000001',
      passwordHash,
      role: 'ADMIN',
      langPref: 'AR',
    },
  });

  await prisma.schoolSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'المدرسة',
      academicYear: YEAR,
      principalName: null,
      address: null,
    },
  });

  console.log('Seed complete (admin only).');
  console.log({ admin: admin.email, password: PASSWORD });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
