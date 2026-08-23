import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root (one level above backend/)
const PROJECT_ROOT = path.resolve(__dirname, '../../');
dotenv.config({ path: path.resolve(PROJECT_ROOT, '.env') });

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required in .env');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  let corsOrigin = process.env.CORS_ORIGIN?.trim();
  // Render injects RENDER_EXTERNAL_URL (e.g. https://….onrender.com). Use it when
  // the dashboard env was never set so the process can still listen for health checks.
  if (!corsOrigin && process.env.RENDER_EXTERNAL_URL?.trim()) {
    corsOrigin = process.env.RENDER_EXTERNAL_URL.trim().replace(/\/$/, '');
    process.env.CORS_ORIGIN = corsOrigin;
    console.warn(`[boot] CORS_ORIGIN unset; defaulting to RENDER_EXTERNAL_URL=${corsOrigin}`);
  }
  if (!corsOrigin) {
    console.error(
      'CORS_ORIGIN is required in production (comma-separated HTTPS origins, e.g. https://school.example.com)'
    );
    process.exit(1);
  }
}

// Prisma's SQLite engine resolves a relative `file:` datasource URL against the
// process's current working directory, which differs depending on how the
// server is started (e.g. `cd backend && npm run dev` vs. `npm run backend:dev`
// from the project root). Rewrite it to an absolute path — resolved the same
// way Prisma CLI resolves it (relative to prisma/schema.prisma's directory,
// per the DATABASE_URL comment in .env) — once here so every startup path
// opens the same dev.db regardless of cwd.
if (process.env.DATABASE_URL?.startsWith('file:')) {
  const relative = process.env.DATABASE_URL.slice('file:'.length);
  if (!path.isAbsolute(relative)) {
    process.env.DATABASE_URL = `file:${path.resolve(PROJECT_ROOT, 'prisma', relative)}`;
  }
}

const { createApp } = await import('./app.js');
const { prisma } = await import('./utils/prisma.js');
const { backfillOpenMarkers } = await import('./services/enrollment.js');

try {
  const result = await backfillOpenMarkers(prisma);
  if (result.scanned > 0) {
    console.log(
      `[enrollment] openMarker backfill: fixed=${result.fixed} conflicts=${result.conflicts}`
    );
  }
} catch (err) {
  console.warn('[enrollment] openMarker backfill skipped:', err?.message || err);
}

const app = createApp();
const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`School Automation API listening on http://localhost:${port}`);
});
