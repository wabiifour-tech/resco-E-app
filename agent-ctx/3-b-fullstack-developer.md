# Task 3-b — Approval workflow + Audit log viewer

**Agent:** full-stack-developer (Z.ai Code)
**Task:** Build principal-side Approvals + Audit Log modules (API + views) for RESCO eCard.

## Scope of ownership

Files I created / overwrote (kept the SAME named exports required by `principal-shell.tsx`):

- `src/app/api/approvals/route.ts` — `GET` (list SUBMITTED results with filters + summary + priorTotals + cumulative)
- `src/app/api/approvals/approve/route.ts` — `POST` body `{ resultIds: string[] }` (batch approve in transaction)
- `src/app/api/approvals/[id]/unlock/route.ts` — `POST` (reopen APPROVED → SUBMITTED, keeps approvedAt/ById historical)
- `src/app/api/approvals/[id]/return/route.ts` — `POST` body `{ reason: string }` (SUBMITTED → NEEDS_CORRECTION)
- `src/app/api/audit/route.ts` — `GET` with `?action=&userId=&q=&from=&to=&page=&pageSize=`
- `src/components/views/principal/approvals.tsx` → `export function PrincipalApprovals`
- `src/components/views/principal/audit.tsx` → `export function PrincipalAudit`

## What I deliberately did NOT touch

- `prisma/schema.prisma` — no schema changes, no `db:push`.
- The `/api/results/*` namespace (Task 3-a owns those).
- Shell files, store, other agents' views.
- The audit-logging of `RESULT_MODIFIED_AFTER_REOPEN` — that's done by the results API (Task 3-a) on edits after reopen; my audit viewer correctly displays it (it's just another `AuditLog` row).

## Key implementation note for downstream agents

**Result has no `classArm` relation** — only `classArmId` (a string snapshot). My approval/unlock/return routes therefore load `ClassArm` rows in a separate `db.classArm.findMany({ where: { id: { in: [...] } } })` query and join them by id at the API layer. If you're building a view that needs the class-arm name alongside a `Result`, do the same — don't `include: { classArm: { ... } }` on the Result query, it will raise a `PrismaClientValidationError`.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/approvals` | List results to review (default: SUBMITTED, active session/term). Returns `results[]`, `summary: { pending, approved, needsCorrection, saved }`, `filters`. |
| POST | `/api/approvals/approve` | Batch approve `{ resultIds: string[] }`. Race-safe per-row, transactional. Returns `{ approved, skipped, missing, totalRequested }`. 409 if none are SUBMITTED. |
| POST | `/api/approvals/[id]/unlock` | Reopen APPROVED → SUBMITTED, clear `lockedAt`, keep `approvedById`/`approvedAt` historical. Audits `RESULT_UNLOCKED` + `RESULT_REOPENED`. |
| POST | `/api/approvals/[id]/return` | SUBMITTED → NEEDS_CORRECTION with `{ reason }`. Audits `RESULT_RETURNED_FOR_CORRECTION` with the reason in context. |
| GET | `/api/audit` | Paginated audit log. Returns `{ items, total, page, pageSize, actions: [], users: [] }`. |

## Audit actions this module emits

- `RESULT_APPROVED` (per row, on approve)
- `RESULT_UNLOCKED` + `RESULT_REOPENED` (both, on reopen)
- `RESULT_RETURNED_FOR_CORRECTION` (with reason, on return)

Each audit context includes: resultId, studentId, studentName, admissionNumber, subjectId, subjectName, classArmId, classArmName, termName, sessionName, enteredByTeacherId, enteredByTeacherName. Approve also includes total/grade/position. Unlock also includes previousApprovedById/At. Return also includes the reason.

## Smoke-test results (all passing)

- GET /api/approvals → 200, `{results:[], summary:{...}, filters:{...}}`
- GET /api/audit?page=1&pageSize=3 → 200, paginated + distinct actions/users lists
- GET /api/audit?action=LOGIN → 200, all items have action=LOGIN, total=5
- GET /api/audit?q=Student → 200, total=3 (substring search across context/userName/action)
- GET /api/audit?from=2026-09-21&to=2026-09-21 → 200, total=12
- POST /api/approvals/approve `{resultIds:[]}` → 400 (`Select at least one result`)
- POST /api/approvals/approve `{resultIds:["fake-id"]}` → 409 with `{approved:0, skipped:0, missing:1, totalRequested:1}`
- POST /api/approvals/nonexistent-id/unlock → 404 (`Result not found`)
- POST /api/approvals/nonexistent-id/return `{reason:"test"}` → 404; with `{reason:""}` → 400
- Teacher login → GET /api/audit, GET /api/approvals, POST /api/approvals/approve all 403 (`Principal access required`)

## Lint status

`bun run lint` — 0 errors, 0 warnings in all files I touched (the only project-level warning is in `results.tsx`, owned by Task 3-a).
