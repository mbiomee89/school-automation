/**
 * Render start: validate DATABASE_URL, push schema, seed, then boot API.
 * Avoids cryptic Prisma P1001 when DATABASE_URL is missing/malformed.
 *
 * Schema apply: prefer `prisma migrate deploy` once a baseline migration exists
 * for both sqlite (local) and postgres (Render sed in render-build.sh). Until
 * then, `db push` WITHOUT `--accept-data-loss` to avoid silent drops.
 * See docs/ops-hosting.md.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`\n[start] ${msg}\n`);
  process.exit(1);
}

/**
 * Prefer External DB URL and short timeouts so a bad host fails in seconds
 * instead of hanging forever on Render's "Application loading" screen.
 */
function hardenDatabaseUrl(raw) {
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

  // Internal hosts look like "dpg-xxxxx-a" with no public DNS — unreachable after wake.
  if (/^dpg-[\w-]+-a$/i.test(host) || host.endsWith('.internal')) {
    fail(
      `DATABASE_URL host "${host}" looks like Render Internal DNS. Open school-db → Info → copy External Database URL (must contain oregon-postgres.render.com or similar) and set it on the web service.`
    );
  }

  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '10');
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '10');
  }

  process.env.DATABASE_URL = url.toString();
  console.log(`[start] Database host: ${host}:${url.port || '5432'} (connect_timeout=${url.searchParams.get('connect_timeout')}s)`);
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

hardenDatabaseUrl(process.env.DATABASE_URL);

console.log('[start] database ping…');
run('node', ['scripts/db-ping.js']);

// Dedupe against the live DB *before* db push applies new unique constraints.
console.log('[start] dedupe teacher assignments…');
run('node', ['scripts/dedupe-teacher-assignments.js']);

console.log('[start] dedupe subjects (nameAr)…');
run('node', ['scripts/dedupe-subjects.js']);

// No --accept-data-loss: refuse destructive schema drift rather than wipe data.
console.log('[start] prisma db push…');
run('npx', ['prisma', 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate']);

console.log('[start] seed…');
run('node', ['prisma/seed.js']);

console.log('[start] API…');
run('node', ['backend/src/server.js']);
