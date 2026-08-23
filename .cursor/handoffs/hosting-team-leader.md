## Handoff

**Goal:** Hand the school-automation app to a team leader for new hosting/domain with a **fresh empty database** (no migration of current live data).

**Done:**
- Role `STUDENT_AFFAIRS` + شؤون الطلاب inbox, campaign public form, absence-days report, staff role edit
- Parent form: country selects, WhatsApp toggle, phones **only** `+9665XXXXXXXX`
- Print: per-student profile sheet with homework-style header; equal columns; one EN name; no signatures/parent note; قائد المدرسة footer
- Live on GitHub `main` through `10edd17` (print polish); prior commits include form/affairs hardening
- Confirmed: custom domain does not undo print/logo fixes; new DB host needs new `DATABASE_URL` (fresh DB OK)

**Current state:**
- Branch / key files: `main` — `backend/src/routes/studentProfile.js`, `frontend/src/pages/affairs/*`, `frontend/src/pages/public/StudentProfilePublicPage.tsx`, `frontend/src/shared/countriesAr.ts`, `frontend/src/shared/saudiPhone.ts`, `scripts/start.js`, `render.yaml`, `prisma/seed.js`, `docs/ops-hosting.md`
- Blockers: none for handoff; leader owns hosting
- Decisions already made:
  - Do **not** migrate Neon/current data — re-seed/import for the school
  - Logo is DB-backed (`/api/school-settings/logo`); form link uses `window.location.origin`
  - Production start = `node scripts/start.js` (db push + seed + API)
  - Default seed admin: `admin@school.local` / `Password123!` (change immediately)

**Next steps:**
1. Send repo + the hosting checklist (env, Postgres, Node 20+, pymupdf, CORS, smoke tests) to the team leader
2. After their go-live: smoke login → school settings/logo → import classes/students → copy شؤون الطلاب form link on **new domain** → print one submission

**Suggested prompt:**
```
Continue school-automation handoff for NEW hosting (fresh empty Postgres — do not migrate old Neon data).

Repo: mbiomee89/school-automation, branch main.
Deploy like render.yaml: postgres DATABASE_URL, JWT_SECRET, build frontend, start with `node scripts/start.js` (prisma db push + seed).
Seed admin: admin@school.local / Password123! — must change on first login.
Features already shipped: STUDENT_AFFAIRS, parent profile form (+9665 only phones, country lists, WhatsApp toggle), per-student print sheets.
Help with: env checklist, domain/CORS, first-boot smoke (logo on print, form link, import Noor/timetable). See docs/ops-hosting.md and render.yaml.
```

---

## Hosting checklist for team leader (fresh install)

### Env
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://...` (external URL)
- `JWT_SECRET` (new strong secret — never use example value)
- `CORS_ORIGIN=https://your-domain.com` (production)
- `JWT_EXPIRES_IN=8h`
- `PARENT_JWT_EXPIRES_IN=2h`
- `UPLOAD_DIR=./backend/uploads` (disk only; **not** publicly served)

### Security (student PII)
- `/uploads` is not public; logo via `/api/school-settings/logo`; backups via base64 in admin API
- Public form rate-limited; lookup returns name/class only
- Staff with `mustChangePassword` blocked from APIs until password change
- Optional: `CORS_ORIGIN=https://your-domain` if API and SPA are split

### Build / start
- Node ≥ 20, Python 3 + pymupdf (aSc PDF import)
- Prisma provider must be **postgresql** in production (see `render.yaml` sed)
- Start: `node scripts/start.js` → db push + seed + API
- Health: `/health`

### First login
- `admin@school.local` / `Password123!` — change immediately
- Configure school settings + logo, then import classes/teachers/students
- Copy parent form link from شؤون الطلاب (uses new domain automatically)

### No need
- Migrating old Neon/live data
