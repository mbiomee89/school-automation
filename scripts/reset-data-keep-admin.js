/**
 * CLI: backup then delete all data except ADMIN users.
 *   node scripts/reset-data-keep-admin.js
 *
 * Uses DATABASE_URL from the environment (.env locally, Render env in shell).
 */
import { PrismaClient } from '@prisma/client';
import { backupAndResetData } from '../backend/src/services/resetData.js';

const prisma = new PrismaClient();

async function main() {
  console.log('[reset] backing up then wiping all data except ADMIN users…');
  const { stored, summary } = await backupAndResetData(prisma);
  console.log('[reset] backup file:', stored.fileName, stored.downloadUrl);
  console.log('[reset] done:', JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error('[reset]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
