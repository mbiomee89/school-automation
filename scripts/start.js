/**
 * Render start: validate DATABASE_URL, push schema, seed, then boot API.
 * Avoids cryptic Prisma P1001 when DATABASE_URL is missing/malformed.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`\n[start] ${msg}\n`);
  process.exit(1);
}

function describeDatabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    fail(
      'DATABASE_URL is missing. In Render → school-db → Info, copy the External Database URL and set it on school-automation → Environment → DATABASE_URL.'
    );
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(
      `DATABASE_URL is not a valid URL (got: ${JSON.stringify(raw.slice(0, 40))}…). Paste the full External Database URL from Render (starts with postgresql://).`
    );
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    fail(`DATABASE_URL must start with postgresql:// (got protocol ${url.protocol})`);
  }

  const host = url.hostname;
  if (!host || host === 'postgresql' || host === 'postgres' || host === 'localhost') {
    fail(
      `DATABASE_URL hostname looks wrong: "${host}". Use Render’s External Database URL, e.g. postgresql://USER:PASS@dpg-xxxx.oregon-postgres.render.com/DBNAME`
    );
  }

  console.log(`[start] Database host: ${host}:${url.port || '5432'}`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

describeDatabaseUrl(process.env.DATABASE_URL);

console.log('[start] prisma db push…');
run('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--schema=prisma/schema.prisma']);

console.log('[start] seed…');
run('node', ['prisma/seed.js']);

console.log('[start] API…');
run('node', ['backend/src/server.js']);
