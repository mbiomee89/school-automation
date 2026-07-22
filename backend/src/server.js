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

const app = createApp();
const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`School Automation API listening on http://localhost:${port}`);
});
