import { prisma } from '../backend/src/utils/prisma.js';
import { backfillOpenMarkers } from '../backend/src/services/enrollment.js';

const result = await backfillOpenMarkers(prisma);
console.log(result);
await prisma.$disconnect();
