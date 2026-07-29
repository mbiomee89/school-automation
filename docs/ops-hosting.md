# Operator runbook — Render hosting

Short checklist for the school-automation web service + Postgres on Render.

## Before QA / after env changes

- `NODE_ENV=production`
- `DATABASE_URL` = **External** Postgres URL (not the internal `dpg-…-a` host if regions differ)
- Web service and Postgres in the **same region**
- `JWT_SECRET` set (non-empty)
- `UPLOAD_DIR` set (e.g. `./backend/uploads`)
- Build log shows Prisma provider switched to PostgreSQL
- Health: `GET /health` (and `/api/health` if used) returns 200 after deploy

## Ephemeral disk (accepted on free Render)

Uploaded files live on the web service disk and are **lost on every redeploy**:

- School logo
- Parent absence attachments
- Server-side `/uploads/backups/*` copies

**Ops rules:**

1. After every redeploy, open Settings and **re-upload the school logo** if missing.
2. Treat the **browser-downloaded ZIP** as the real backup — keep it outside Render (local drive / cloud). Prefer **Settings → تنزيل نسخة احتياطية ZIP** (`POST /api/users/backup-data`) for a backup **without** wiping; use reset only when you intend to wipe.
3. Parent excuse attachments may need re-submit after a redeploy if the file is gone.

## Passwords

- **Boot seed** creates `admin@school.local` only when missing; it does **not** reset an existing admin password.
- After **ZIP restore** or **Noor/staff import**, default passwords may be `Password123!` — change them before handing accounts to staff.

## Schema apply on start

`scripts/start.js` runs `prisma db push` **without** `--accept-data-loss`, after the assignment dedupe script.

A full `prisma migrate deploy` baseline is deferred: local uses SQLite and Render sed-switches the schema to PostgreSQL at build time, so a single migration history for both providers is non-trivial mid-flight. When adding a baseline later, mark the live DB as applied (`prisma migrate resolve`) before relying on `migrate deploy`.

## Cold start

Free web services sleep after ~15 minutes idle; the first request can take ~30–60s. That is expected, not a data outage.
