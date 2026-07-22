/**
 * Keep one TeacherAssignment per (classId, subjectId) before applying
 * @@unique([classId, subjectId]). Prefer the lowest id (oldest) row.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.teacherAssignment.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, classId: true, subjectId: true, teacherId: true },
  });

  const seen = new Set();
  const duplicateIds = [];
  for (const row of rows) {
    const key = `${row.classId}:${row.subjectId}`;
    if (seen.has(key)) {
      duplicateIds.push(row.id);
    } else {
      seen.add(key);
    }
  }

  if (duplicateIds.length === 0) {
    console.log('[dedupe-assignments] no duplicates');
    return;
  }

  await prisma.teacherAssignment.deleteMany({ where: { id: { in: duplicateIds } } });
  console.log(`[dedupe-assignments] removed ${duplicateIds.length} duplicate assignment(s)`);
}

main()
  .catch((err) => {
    console.error('[dedupe-assignments]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
