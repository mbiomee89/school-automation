# Build plan — School Automation Platform

Stack: **React** (frontend) + **Node.js/Express** (backend) + **SQLite via Prisma** (database), already scaffolded in `prisma/schema.prisma`.

---

## 1. Architecture overview

```
school-automation/
├── prisma/                  # done — schema.prisma, seed.js
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── middleware/      # auth, role guard, error handler
│   │   ├── routes/          # one file per resource
│   │   ├── services/        # whatsapp.js, notifications.js, otp.js
│   │   ├── jobs/            # cron: homework digest, weekly plan
│   │   └── utils/           # dates.js (toUtcMidnight), phone.js (E.164)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── i18n/             # react-i18next, ar.json / en.json
    │   ├── pages/
    │   │   ├── admin/
    │   │   ├── teacher/
    │   │   ├── counselor/
    │   │   └── parent/
    │   ├── components/
    │   └── api/               # fetch wrappers per resource
    └── package.json
```

Two frontends worth considering: one responsive React app with role-based routing (simplest — one deploy, one codebase) vs. a separate lightweight parent-facing PWA (better mobile experience for parents, more to maintain). **Recommendation: start with one app, role-based routing** — split later only if parent usage patterns demand it.

---

## 2. Backend build order

### Phase 1 — Foundation
- Express server + Prisma client singleton
- Auth middleware: JWT for staff (`ADMIN`/`TEACHER`/`COUNSELOR`), OTP-session for parents
- Role-guard middleware (e.g. `requireRole('ADMIN')`, `requireRole('COUNSELOR')`)
- Assignment-guard middleware for teachers: verify the requesting teacher has a `TeacherAssignment` for the class before allowing writes. Note the check differs by resource: `Homework` and `WeeklyPlan` carry a `subjectId`, so the guard can check the exact teacher+class+subject combination; `Attendance` and `LateReport` are homeroom/daily-level and carry no `subjectId`, so the guard can only confirm the teacher is assigned to that class in *some* subject — not that this specific submission matches a specific period
- Baseline security: `helmet`, rate limiting on auth/OTP endpoints, input validation (e.g. `zod`) on every write route
- Central error handler + request logging
- Shared helpers (required early — every daily write depends on them):
  - `toUtcMidnight(date)` — strip time; use for `Attendance.date`, `LateReport.date`, `Homework.date`, `WeeklyPlan.weekStart`, `Notification.forDate`
  - `normalizePhone(phone)` — force E.164 (`+966…`); reject anything else
  - Map Prisma `P2002` (unique violation) → HTTP 409 with a clear message

### Phase 2 — Core structure APIs (admin-only mostly)
| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/login` (staff), `POST /auth/otp/request`, `POST /auth/otp/verify` (parent) |
| Users | Create/update/list staff accounts, role assignment. **No hard delete** — historical Attendance/Homework/LateReport/WeeklyPlan records reference staff and would block it. Use `PATCH /users/:id/deactivate` instead (sets the existing `User.isActive` to `false`) |
| Classes | CRUD, scoped by `academicYear`. Deleting a class is blocked once it has any students/records (same `Restrict` pattern as staff) — in practice classes are never deleted, only superseded by next year's class row. `POST /classes/:id/remove-all-students` bulk-unassigns every student currently pointing at this class (`Student.classId = null`, closes their open `ClassEnrollment`) without deleting anyone — use this before retrying a class delete, or to reset a roster. Note: historical records (attendance/homework/etc.) still block deletion even after this |
| Subjects | CRUD |
| TeacherAssignments | assign/remove teacher↔class↔subject |
| Students | CRUD, `POST /students/import` (Noor sheet upload → `StudentImportBatch`), `GET /students/import-batches` (audit log of past imports), `DELETE /students/:id` (soft delete only), `POST /students/:id/promote` (closes current `ClassEnrollment`, opens new one, updates `Student.classId` — **must run in one `prisma.$transaction`**, see schema note), `POST /students/:id/unassign` (closes current `ClassEnrollment` if any, sets `Student.classId = null` — no new enrollment opened; student falls into the unassigned bucket until re-assigned via promote), `GET /students?unassigned=true` (roster filter for students with no current class), `GET /students/:id/enrollments` (full class history), `PATCH /students/:id/wa-opt-in` (admin or parent sets `waOptedIn`). `Student.classId` is **nullable** — a student can be created or left without a class; daily-workflow writes (attendance/late reports) naturally exclude unassigned students since those routes require `student.classId` to match the submission's `classId` |
| SchoolSettings | Singleton row: `GET /school-settings`, `PATCH /school-settings` (ADMIN only) — school name, logo (upload via `multer` to `/uploads`, same validation pattern as parent absence attachments: image MIME allowlist + size cap + random server filename), current academic year, principal name, address. Used to stamp every printed report (roster, attendance, etc.) with a consistent header |

**Student import rules (avoid silent corruption):**
- Upsert on `Student.id` (national ID / Iqama). Existing active student → update name/class/phone; never create a duplicate.
- If national ID belongs to a soft-deleted student → reactivate (`isActive=true`, clear `deletedAt`) and update fields, or reject with an explicit “reactivate?” path — pick one and stick to it.
- Invalid rows (missing ID, bad phone) → skip + return a per-row error list; do not abort the whole batch mid-way without a report.
- On class change during import, close/open `ClassEnrollment` inside the same transaction as the student update.

### Phase 3 — Daily workflow APIs (teacher-facing)
| Resource | Endpoints | Notification behavior |
|---|---|---|
| Attendance | `POST /attendance` (bulk per class/period) | Fires WhatsApp instantly per **new** `ABSENT` only (see correction rules below) |
| LateReport | `POST /late-reports` | Fires WhatsApp instantly (one per student per day — unique on `studentId+date`) |
| Homework | `POST /homework` | No immediate send — collected for daily digest job |
| WeeklyPlan | `POST /weekly-plans` | No immediate send — collected for Saturday digest job |

**Attendance write rules:**
- Normalize `date` with `toUtcMidnight`; `period` is **required** (e.g. `"1"` / `"DAY"`) — never null.
- Bulk upsert: if `(studentId, date, period)` exists, update `status` instead of inserting.
- Only enqueue WhatsApp when status **becomes** `ABSENT` and no `Notification` already exists for that `attendanceId`.
- If status changes from `ABSENT` → `PRESENT`/`EXCUSED` after a message was already sent: do **not** send a second message in MVP; optionally mark a note in admin UI. (Void/correction templates can come later.)
- Reject writes for students where `isActive=false` or `student.classId !== body.classId`.

**LateReport write rules:**
- Set both `date` (UTC midnight) and `time` (actual clock). Unique `(studentId, date)` → 409 on double-submit.

### Phase 4 — WhatsApp integration
- `services/whatsapp.js` — thin wrapper around the Cloud API (or your chosen BSP), one function per approved template
- On `Attendance`/`LateReport` create: call WhatsApp send inline (fire-and-forget, non-blocking), write a `Notification` row **first** (status `QUEUED`) inside the same request transaction when possible, then send; store returned `wamid` in `Notification.providerMessageId`
- Guard every send with: `Student.waOptedIn === true`, `Student.isActive === true`, valid E.164 phone
- Unique constraints stop retries from double-sending; on `P2002` skip send silently (already notified)
- `POST /webhooks/whatsapp` — receives delivery status callbacks (sent/delivered/read/failed), look up by `providerMessageId`, update `Notification.status`. Verify webhook signature. Ignore unknown ids.
- `jobs/homeworkDigest.js` — cron, once daily (e.g. 16:00): for each **active** student, collect same-day `Homework` for `student.classId`, build one message per student/parent, set `forDate = toUtcMidnight(today)`, respect `@@unique([studentId, eventType, forDate])`
- `jobs/weeklyPlanDigest.js` — cron, every Saturday: same pattern; `forDate = weekStart` (that Saturday, UTC midnight); one message per active student listing all subjects’ plans for their class that week
- Scheduling mechanism: use `node-cron` inside the running Express process (simplest — one deploy, no extra moving parts). Only switch to system cron hitting an internal endpoint if you later run multiple server instances, where an in-process scheduler could fire the job twice.
- Failed sends: set `status=FAILED` + `errorMessage`; do not delete the row (unique key still blocks a naive retry storm — add an admin “retry failed” endpoint later if needed)

### Phase 5 — Counselor workflow
- `GET /absence-reasons?status=PENDING_REVIEW` — counselor's queue (optionally also `requireRole('ADMIN')` as override)
- `PATCH /attendance/:id/reason-review` — approve/reject, `requireRole('COUNSELOR')` (and optionally ADMIN), stamps `reasonReviewedBy` + `reasonReviewedAt`
- On **APPROVED**: set `reasonStatus=APPROVED` and set `status=EXCUSED` in the **same** transaction (schema allows it; product rule is explicit — approval excuses the absence)
- On **REJECTED**: set `reasonStatus=REJECTED`; leave `status` as `ABSENT`
- Reject review if current `reasonStatus !== PENDING_REVIEW` (idempotent double-click → 409)

### Phase 6 — Parent-facing APIs
- `GET /parent/students` — **active** students matching the verified phone’s session (`parentPhone` + `isActive=true`)
- `GET /parent/students/:id/attendance` / `/homework` / `/weekly-plans` — authorize: student must belong to session phone
- `POST /parent/attendance/:id/reason` — submit reason + optional attachment, sets `reasonStatus = PENDING_REVIEW`
- Reason submission guards:
  - Attendance must be `ABSENT` (not `PRESENT` / already `EXCUSED`)
  - `reasonStatus` must be `NONE` or `REJECTED` (allow resubmit after reject); block if `PENDING_REVIEW` or `APPROVED`
  - Student must be linked to session phone
- File uploads: use `multer` to handle the attachment, store on local disk under `/uploads` (fine at this scale — back it up alongside the SQLite file) or a cloud bucket if you later move off a single server. Validate file type/size server-side (images/PDF only, small size cap) before saving. Store a safe relative path only (no client-supplied path segments).
- `PATCH /parent/wa-opt-in` — parent confirms WhatsApp consent for all their linked students (sets `waOptedIn=true`)

---

## 3. Error handling & invariants (do not skip)

### Auth / OTP
| Case | Behavior |
|---|---|
| Staff login, wrong password or inactive user | 401 same generic message (no user enumeration) |
| OTP request for phone with no active students | 200 generic “if registered, code sent” (no enumeration) + do not send |
| OTP verify wrong code | increment `ParentOtp.attempts`; after 5 failures invalidate that OTP |
| OTP expired | 401; require new request |
| New OTP requested | invalidate all previous unverified OTPs for that phone |
| Rate limit | strict limiter on `/auth/otp/*` and `/auth/login` (per IP + per phone) |

### Parent session
- Short-lived signed JWT (or server session) after OTP verify; payload = normalized phone only (not student ids — resolve students on each request)
- Every `/parent/*` route re-checks student ownership via `parentPhone`
- Soft-deleted students never appear in parent lists

### Data integrity
| Case | Behavior |
|---|---|
| Unique constraint hit (`P2002`) | 409 Conflict, human-readable field hint |
| FK / Restrict delete blocked | 409 explaining record is in use |
| Promote with no open enrollment | 400; do not open a second “current” class |
| Promote target class wrong/missing year | copy `academicYear` from target `Class` only |
| Teacher writes outside assignment | 403 |
| Inactive teacher JWT | 401/403 on every request (`isActive` check in auth middleware) |
| Bulk attendance partial failure | run bulk in one transaction; all-or-nothing |

### Notifications
| Case | Behavior |
|---|---|
| `waOptedIn=false` | skip send; optionally leave no Notification row (or QUEUED never sent — prefer **skip entirely** so digests can send later after opt-in) |
| Provider timeout / 5xx | set FAILED + errorMessage; do not throw away the Attendance/LateReport |
| Webhook for unknown `providerMessageId` | 200 ack, no-op (prevents Meta retries looping on 404) |
| Cron re-run same day | unique on `(studentId, eventType, forDate)` → skip |

### Validation (zod on every write)
- Phones: E.164
- Dates: parseable → stored as UTC midnight where required
- `period`: non-empty string
- `weekStart`: must be a Saturday (reject otherwise)
- Uploads: MIME allowlist + size cap + random server filename

---

## 4. Frontend build order

1. **Shell**: routing, auth context (staff JWT vs parent OTP session), `react-i18next` with AR (default, RTL) and EN, a language toggle
2. **Admin pages**: dashboard, student roster (add/import/promote/remove), class & subject management, staff management, notification delivery log
3. **Teacher pages**: today's attendance (per class/period, checkbox grid), homework entry, late-arrival entry, weekly plan form — show 409/403 errors inline (duplicate period, not assigned)
4. **Counselor pages**: absence-reason review queue with approve/reject
5. **Parent pages**: login (phone + OTP), per-child view of attendance/homework/weekly plans, absence-reason submission with file upload, WhatsApp opt-in
6. **Print views**: simple `@media print` CSS on the existing report pages (daily absence, late report, homework log, weekly plan, student history) — no PDF library, no backend work needed. Admin clicks Print, browser handles it.

Use `dir="rtl"` at the app root when `langPref/session language = AR`, flip to `ltr` for EN — test both directions on every page, not just text alignment (icons, form layouts, tables all need mirroring).

---

## 5. Deployment

| Concern | Recommendation |
|---|---|
| Hosting | Small VPS in a KSA-region datacenter, or on-premise school server on the local network — keep student data inside Saudi jurisdiction (PDPL) |
| Database | SQLite file is fine at this scale; back it up daily (simple file copy + off-site sync) |
| HTTPS | Required — WhatsApp webhooks and parent OTP both need TLS |
| Secrets | `.env`, never committed — `JWT_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` (webhook verify), etc. |
| Backups | Automated daily DB file backup + `/uploads` folder, retained at least 30 days |

---

## 6. Suggested build order (milestones)

1. Backend Phase 1 + 2 (auth + core CRUD + date/phone helpers) → test with Prisma Studio / Postman
2. Backend Phase 3 (daily workflow + upsert/409 behavior) → confirm data flows correctly before adding WhatsApp
3. Backend Phase 4 (WhatsApp + webhook by `providerMessageId`) → test with your own phone number first, before real parents
4. Backend Phase 5 + 6 (counselor + parent APIs, including EXCUSED-on-approve and opt-in)
5. Frontend shell + Admin pages → get real data in
6. Frontend Teacher pages → pilot with 1–2 teachers
7. Frontend Counselor + Parent pages → pilot with a small group of parents before full rollout
8. Print views (can slot in anytime after the relevant report pages exist — low effort, no dependency on other milestones)

---

## 7. Schema ↔ plan checklist (keep in sync)

| Rule | Where enforced |
|---|---|
| No hard-delete staff/students | API + soft flags in schema |
| One open `ClassEnrollment` per student | `$transaction` in promote/import (not DB) |
| Date-only midnight for unique keys | `toUtcMidnight` helper |
| `period` always set | schema `String` + zod |
| One late report / student / day | `LateReport @@unique([studentId, date])` |
| No double WhatsApp for same absence/late | `Notification.attendanceId` / `lateReportId` `@unique` |
| No double digest same day/week | `Notification @@unique([studentId, eventType, forDate])` |
| Webhook can update the right row | `Notification.providerMessageId` |
| Counselor-only reason review | role guard + optional ADMIN override |
| Approve → EXCUSED | Phase 5 transaction |
| WhatsApp only if opted in + active | send service guard |
| Parent sees only own children | session phone vs `Student.parentPhone` |
