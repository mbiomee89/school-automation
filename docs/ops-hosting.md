# Operator runbook — Render hosting

Short checklist for the school-automation web service + Postgres on Render.

## Before QA / after env changes

- `NODE_ENV=production`
- `DATABASE_URL` = **External** Postgres URL (not the internal `dpg-…-a` host if regions differ)
- Web service and Postgres in the **same region**
- `JWT_SECRET` = long random secret (**never** leave empty or use `.env.example` value)
- `CORS_ORIGIN` = your public HTTPS origin(s), comma-separated (e.g. `https://school.example.com`) — **required in production** when the browser origin must be locked down
- `UPLOAD_DIR` set (e.g. `./backend/uploads`) — used for server-side files only; **not** publicly served
- Build log shows Prisma provider switched to PostgreSQL
- Health: `GET /health` (and `/api/health` if used) returns 200 after deploy
- Change seed admin password immediately (`admin@school.local` / default from seed) — API blocks staff until password change when `mustChangePassword` is set

## Security notes (student PII)

- `/uploads` is **not** mounted as public static (backups/absence files are not world-readable)
- School logo: `GET /api/school-settings/logo`
- Absence attachments: authenticated parent/counselor download APIs only
- Backups: download via admin UI using **base64 ZIP** in the API response — do not rely on `/uploads/backups/...` URLs
- Public student-profile form: rate-limited; lookup returns name/class only (no prior medical/phones)

## Ephemeral disk (accepted on free Render)

Uploaded files on the web service disk are **lost on every redeploy**.

**School logo** is stored in **Postgres** (`SchoolSettings.logoData`) and served from `GET /api/school-settings/logo` — it **survives redeploy**. Re-upload only when changing the logo, not after every deploy.

Still ephemeral on disk only:

- Parent absence attachments (DB bytes are preferred when present; older disk-only files may need re-submit)
- Server-side `/uploads/backups/*` copies

**Ops rules:**

1. Treat the **browser-downloaded ZIP** as the real backup — keep it outside Render (local drive / cloud). Prefer **Settings → تنزيل نسخة احتياطية ZIP** (`POST /api/users/backup-data`) for a backup **without** wiping; use reset only when you intend to wipe.
2. Parent excuse attachments may need re-submit after a redeploy if only the disk copy existed.

## Passwords

- **Boot seed** creates `admin@school.local` only when missing; it does **not** reset an existing admin password.
- After **ZIP restore** or **Noor/staff import**, default passwords may be `Password123!` — change them before handing accounts to staff.

## Schema apply on start

`scripts/start.js` runs `prisma db push` **without** `--accept-data-loss`, after the assignment dedupe script.

A full `prisma migrate deploy` baseline is deferred: local uses SQLite and Render sed-switches the schema to PostgreSQL at build time, so a single migration history for both providers is non-trivial mid-flight. When adding a baseline later, mark the live DB as applied (`prisma migrate resolve`) before relying on `migrate deploy`.

## Cold start

Free web services sleep after ~15 minutes idle; the first request can take ~30–60s. That is expected, not a data outage.
