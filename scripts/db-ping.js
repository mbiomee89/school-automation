/** Fail fast if DATABASE_URL cannot be reached (avoids endless Render wake). */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log('[start] database ping ok');
} catch (e) {
  console.error('[start] database ping failed:', e?.message || e);
  console.error(
    '[start] Fix: Render → school-db → Info → External Database URL → set as DATABASE_URL on the web service. If the free DB expired (~30 days), create a new Postgres and update DATABASE_URL.'
  );
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
