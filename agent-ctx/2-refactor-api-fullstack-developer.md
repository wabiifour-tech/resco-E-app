# Task ID: 2-refactor-api
# Agent: full-stack-developer (Z.ai Code)
# Task: Refactor ALL RESCO eCard API routes to remove class arms entirely (flat class structure)

## Summary
Refactored 21 API route files in `src/app/api/**` to remove every `classArm` / `ClassArm` / `classArmId` / `armId` / `ClassArm.fullName` reference. The school structure is now flat — classes only — and all API routes consistently use `classId` as the request param / body field and return `class: { id, name }` in JSON responses. The `Result` model now has a `class` relation that's included directly (no separate fetch needed).

## Naming convention applied (must match frontend agent's contract)
- Request query params: `classId` (NEVER `classArmId`, `armId`, `arm`)
- Request body fields: `classId`
- Response JSON: `class: { id, name }` (NOT `classArm: { id, fullName }`)
- Filter param rename: `?armId=` → `?classId=`; `?classArmId=` → `?classId=`
- Position is per CLASS — `recomputePositions({ subjectId, classId, sessionId, termId })`
- Auth: `requireTeacherAuthorized(classId, subjectId)`

## Files edited (21 total)
1. `src/app/api/classes/route.ts` — rewrote GET (flat list with `_count.students`) + added POST (create class with `{ name, level, category }`; name unique). Removed `arms` include.
2. `src/app/api/classes/[id]/route.ts` — rewrote GET/PUT/DELETE. Removed `arms` include; PUT now edits `name`/`level`/`category`; DELETE blocks if class has students; cascades assignments + results via the Class → relations.
3. `src/app/api/students/route.ts` — GET filter `?q=&classId=&active=` (replaced `armId`). POST body `{ admissionNumber, firstName, lastName, otherNames?, gender?, classId, active? }`. Returns student with `class: { id, name }`.
4. `src/app/api/students/[id]/route.ts` — GET/PUT/PATCH. Removed `classArmId` validation; uses `classId` only. Returns `class: { id, name }`.
5. `src/app/api/assignments/route.ts` — POST body `{ teacherId, classId, subjectId }`. Unique key is now `teacherId_classId_subjectId`. Returns `{ id, teacherId, teacherName, classId, className, classLevel, subjectId, subjectName, subjectCode }`.
6. `src/app/api/assignments/[id]/route.ts` — DELETE only. Includes `class` relation for audit context (className).
7. `src/app/api/assignments/options/route.ts` — Returns `{ teachers[], classes: [{ id, name, level, category }], subjects[] }` (classes instead of classArms).
8. `src/app/api/results/route.ts` — GET filter `?sessionId=&termId=&classId=&subjectId=&studentId=&status=`. POST body `{ studentId, subjectId, sessionId, termId, classId, ca, exam, remarkId? }`. Auth via `requireTeacherAuthorized(classId, subjectId)`. After save, calls `recomputePositions({ subjectId, classId, sessionId, termId })`. Each row includes `class: { id, name }` (read directly from the Result.class relation, no extra fetch needed) + `priorTotals` + `cumulative`.
9. `src/app/api/results/[id]/route.ts` — GET/PUT/PATCH. classId-based auth + `recomputePositions({ subjectId, classId, sessionId, termId })`. Each serializer returns `class: { id, name }`.
10. `src/app/api/results/submit/route.ts` — POST body uses `classId` (not classArmId). Per-row `requireTeacherAuthorized(classId, subjectId)` for teachers. Audits with `classId` context.
11. `src/app/api/results/carryover/route.ts` — GET unchanged logic; teacher auth now `requireTeacherAuthorized(student.classId, subjectId)` (was `student.classArmId`). Returns `{ firstTerm, secondTerm, firstTermExists, secondTermExists }`.
12. `src/app/api/results/bootstrap/route.ts` — GET returns assignments with `classId`, `className`, `classLevel`, `classCategory` (no classArm). Principal gets all; teacher gets own.
13. `src/app/api/results/students/route.ts` — GET `?classId=&active=&q=` (was `?armId=`). Teacher auth: `db.teacherAssignment.findFirst({ where: { teacherId, classId } })`.
14. `src/app/api/approvals/route.ts` — GET filter `?sessionId=&termId=&classId=&subjectId=`. Each row carries `student`, `subject`, `term`, `session`, `class: { id, name, classId }`, `remark`, `enteredBy`. Includes `priorTotals` for cumulative. Summary `{ pending, approved, needsCorrection, saved }`.
15. `src/app/api/approvals/approve/route.ts` — POST `{ resultIds: string[] }`. Now uses the `Result.class` relation directly (no separate fetch of `db.classArm.findMany`). Audits with `classId` + `className`. Lock = APPROVED + approvedById + approvedAt + lockedAt.
16. `src/app/api/approvals/[id]/unlock/route.ts` — POST. Now includes `class` relation on the result row directly. Audits RESULT_UNLOCKED + RESULT_REOPENED with `classId`/`className`. `recomputePositions({ subjectId, classId, sessionId, termId })`.
17. `src/app/api/approvals/[id]/return/route.ts` — POST `{ reason }`. Includes `class` relation. Audits RESULT_RETURNED_FOR_CORRECTION with `classId`/`className`.
18. `src/app/api/dashboard/principal/route.ts` — Removed the `classArms` count entirely. Returns `{ counts: { teachers, teachersActive, students, studentsActive, classes, subjects }, current, results }` (NO classArms field).
19. `src/app/api/dashboard/teacher/route.ts` — Renamed `classArms` distinct list → `classes: [{ id, name }]`. Assignments include `classId` + `className` (not classArm).
20. `src/app/api/report-card/route.ts` — GET `?studentId=&sessionId=&termId=`. Returns `{ settings, session, term, student: { id, admissionNumber, fullName, className, gender }, subjects[], classAverage, termOrder, generatedAt }` (REMOVED `classArmName`). Teacher auth: `db.teacherAssignment.findFirst({ where: { teacherId, classId: student.classId } })`. Class average aggregates on `classId` (not classArmId). Audit `REPORT_CARD_GENERATED`.
21. `src/app/api/report-card/bulk/route.ts` — GET `?classId=&sessionId=&termId=` (was `?classArmId=`). Returns `{ class: { id, name }, session, term, students: [{ studentId, admissionNumber, fullName }] }`.

## Skipped
- `src/app/api/audit/route.ts` — already clean (no class-arm references in `where`/context parsing; just returns `items` from `db.auditLog.findMany()` whose `context` is an opaque JSON string).

## Verification
- `bun run lint` → EXIT CODE 0 (0 errors, 0 warnings across the entire repo).
- Grep for `db\.classArm` / `classArm:` / `classArmId` / `armId` / `classArmName` / `classArm\?` / `\.fullName` / `classArms` / `ClassArm\b` / `teacherId_classArmId_subjectId` in `src/app/api/**` → ZERO code matches (only instructional comments mention "NOT classArm").
- Dev server log shows clean compiles after every file write — no TS errors, no runtime errors, no Turbopack failures.

## Conventions respected
- Schema NOT touched (DO NOT modify `prisma/schema.prisma` or run `db:push`).
- No view files (`src/components/**`), shell, lib helpers, or seed script touched.
- Frontend contract: `classId` query param, `{ class: { id, name } }` in responses, no class-arm fields.

## Stage Summary
The entire RESCO eCard API surface is now flat-class-only. Every endpoint that previously referenced `classArmId` / `armId` / `classArm.fullName` now uses `classId` + `class.name`. The `Result` model's new `class` relation is used directly (no extra `db.classArm.findUnique` round-trips needed in serializers). Position recomputation is keyed on `(subjectId, classId, sessionId, termId)`. The frontend agent can now apply the SAME naming convention and the API contract will match exactly.
