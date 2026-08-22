/**
 * Rename duplicate Subject.nameAr values before applying @unique.
 * Keeps the lowest id; others become "Name (id)".
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.subject.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, nameAr: true },
  });

  const seen = new Set();
  let renamed = 0;
  for (const row of rows) {
    const key = (row.nameAr || '').trim();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    const next = `${key} (${row.id})`;
    await prisma.subject.update({
      where: { id: row.id },
      data: { nameAr: next },
    });
    renamed += 1;
    console.log(`[dedupe-subjects] id=${row.id} -> ${JSON.stringify(next)}`);
  }

  if (renamed === 0) {
    console.log('[dedupe-subjects] no duplicates');
  } else {
    console.log(`[dedupe-subjects] renamed ${renamed} duplicate subject(s)`);
  }
}

main()
  .catch((err) => {
    console.error('[dedupe-subjects]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
