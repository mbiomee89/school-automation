/**
 * Seed demo data for local development.
 * Run: npm run db:seed
 *
 * Default staff password for all seeded users: Password123!
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
    update: { passwordHash, isActive: true },
    create: {
      name: 'School Admin',
      email: 'admin@school.local',
      phone: '+966500000001',
      passwordHash,
      role: 'ADMIN',
      langPref: 'AR',
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@school.local' },
    update: { passwordHash, isActive: true },
    create: {
      name: 'Ahmed Teacher',
      email: 'teacher@school.local',
      phone: '+966500000002',
      passwordHash,
      role: 'TEACHER',
      langPref: 'AR',
    },
  });

  const counselor = await prisma.user.upsert({
    where: { email: 'counselor@school.local' },
    update: { passwordHash, isActive: true },
    create: {
      name: 'Sara Counselor',
      email: 'counselor@school.local',
      phone: '+966500000003',
      passwordHash,
      role: 'COUNSELOR',
      langPref: 'AR',
    },
  });

  let mathSubject = await prisma.subject.findFirst({ where: { nameEn: 'Mathematics' } });
  if (!mathSubject) {
    mathSubject = await prisma.subject.create({
      data: { nameAr: 'رياضيات', nameEn: 'Mathematics' },
    });
  }

  let arabicSubject = await prisma.subject.findFirst({ where: { nameEn: 'Arabic' } });
  if (!arabicSubject) {
    arabicSubject = await prisma.subject.create({
      data: { nameAr: 'لغة عربية', nameEn: 'Arabic' },
    });
  }

  let cls = await prisma.class.findFirst({
    where: { gradeLevel: '5', section: 'B', academicYear: YEAR },
  });
  if (!cls) {
    cls = await prisma.class.create({
      data: {
        name: 'Grade 5 - B',
        gradeLevel: '5',
        section: 'B',
        academicYear: YEAR,
      },
    });
  }

  await prisma.teacherAssignment.upsert({
    where: {
      classId_subjectId: {
        classId: cls.id,
        subjectId: mathSubject.id,
      },
    },
    update: { teacherId: teacher.id },
    create: {
      teacherId: teacher.id,
      classId: cls.id,
      subjectId: mathSubject.id,
    },
  });

  await prisma.teacherAssignment.upsert({
    where: {
      classId_subjectId: {
        classId: cls.id,
        subjectId: arabicSubject.id,
      },
    },
    update: { teacherId: teacher.id },
    create: {
      teacherId: teacher.id,
      classId: cls.id,
      subjectId: arabicSubject.id,
    },
  });

  const students = [
    {
      id: '1099000001',
      nameAr: 'محمد العتيبي',
      nameEn: 'Mohammed Al-Otaibi',
      parentPhone: '+966512345678',
    },
    {
      id: '1099000002',
      nameAr: 'عبدالله القحطاني',
      nameEn: 'Abdullah Al-Qahtani',
      parentPhone: '+966512345679',
    },
    {
      id: '1099000003',
      nameAr: 'فيصل الدوسري',
      nameEn: 'Faisal Al-Dosari',
      parentPhone: '+966512345678',
    },
  ];

  for (const s of students) {
    const existing = await prisma.student.findUnique({ where: { id: s.id } });
    if (existing) continue;

    await prisma.student.create({
      data: {
        id: s.id,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        classId: cls.id,
        parentPhone: s.parentPhone,
        waOptedIn: true,
      },
    });
    await prisma.classEnrollment.create({
      data: {
        studentId: s.id,
        classId: cls.id,
        academicYear: YEAR,
        changedBy: admin.id,
      },
    });
  }

  const parentPhone = '+966512345678';
  await prisma.parentAccount.upsert({
    where: { phone: parentPhone },
    update: { passwordHash, isActive: true },
    create: { phone: parentPhone, passwordHash },
  });

  console.log('Seed complete.');
  console.log('Staff password for all seeded users:', PASSWORD);
  console.log('Parent demo:', { phone: parentPhone, password: PASSWORD });
  console.log({
    admin: admin.email,
    teacher: teacher.email,
    counselor: counselor.email,
    class: cls.name,
    subjects: [mathSubject.nameEn, arabicSubject.nameEn],
    parentPhoneDemo: parentPhone,
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
