# Task 11 — full-stack-developer

## Task
Fix two issues in RESCO eCard (Next.js 16 App Router + TS + Prisma + Turso):
1. Newly-added library subjects don't appear in the Teacher-Assignment workflow (root cause: bulk workflow showed only ClassSubject-offered subjects; newly-added library subjects weren't offered for any class).
2. The principal is also a teacher and needs teacher-dashboard features (Enter Results, My Students, Report Cards) scoped to her own assignments, in addition to her principal capabilities.

## Work Log
Read `/home/z/my-project/worklog.md` (Tasks 1–10) to absorb the full context: flat class structure (KG → Nursery → Primary → JSS → SS, NO arms), multi-class multi-subject teacher assignments + ClassSubject curriculum config + ClassTeacher model, the principal account, the ~42-subject library, the Turso libSQL adapter, the seeded default password "affordables", the deployed Vercel site, and the `requireTeacherAuthorized` principal auto-pass behaviour.

### Files read before editing
- `prisma/schema.prisma` (User↔Teacher 1:1 already present; TeacherAssignment @@unique([teacherId,classId,subjectId]); ClassSubject @@unique([classId,subjectId])).
- `src/lib/auth.ts`, `src/lib/curriculum.ts`, `src/lib/api-client.ts`, `src/lib/audit.ts`.
- `src/app/api/dashboard/teacher/route.ts`, `src/app/api/results/{route,bootstrap,students,submit,carryover,[id]}/route.ts`, `src/app/api/assignments/{route,options,bulk}/route.ts`, `src/app/api/report-card/route.ts`, `src/app/api/teachers/route.ts`.
- `src/components/views/principal/{assignments,subjects,results,approvals}.tsx`, `src/components/views/teacher/{results-entry,my-students,report-cards,dashboard}.tsx`.
- `src/components/shell/{principal-shell,teacher-shell,shell-layout}.tsx`.

### Issue 1 fixes
- `src/app/api/assignments/bulk/route.ts`: when creating a `(teacher, class, subject)` TeacherAssignment, auto-creates the `ClassSubject` row if it doesn't already exist (so the subject becomes "offered" for the class as a side-effect of assigning a teacher to it). Counts `autoOfferedSubjects` and includes it in the audit context + response payload. Removed the now-unused `klass` local. Idempotent (still `findFirst` before each `create`).
- `src/components/views/principal/assignments.tsx`: rewrote the per-class sub-panel of the bulk workflow:
  - `allLibrarySubjects()` returns ALL active library subjects (was `offeredSubjectsFor(classId)` which returned only `options.classSubjects[classId]`).
  - Added a derived `assignedByTeacherClass` map (teacherId|classId → Set<subjectId>) and `offeredByClass` map (classId → Set<subjectId>) using `useMemo`.
  - When a class is toggled ON, pre-populates `perClass[classId]` with the subjects already ASSIGNED to (teacherId, classId) + the class-teacher flag from `classTeachers`. So pre-checked = already-assigned; offered-but-not-assigned shows an emerald "Offered" badge but unchecked; newly-added Accounting/Commerce appear unchecked with no badge and are checkable.
  - `changeTeacher(id)` replaces `setTeacherId` for the Select onValueChange — resets `perClass`, `selectedClasses`, `perClassSearch` so the pre-checks re-derive for the new teacher.
  - Added a per-class subject search Input (`perClassSearch` state + `perClassSearchFor` / `setPerClassSearchFor` helpers) that filters the chip list by name/code. Chip list wraps in a `max-h-72 overflow-y-auto` so a 42-subject library doesn't blow up the form height.
  - `selectAllClass` now selects ALL library subjects (was: only offered).
  - Counts updated: "X of Y library subjects selected · Z offered for <Class>".
  - Added `autoOfferedSubjects` to the `BulkResponse` type and to the success toast.
  - `bulkMutation.onSuccess` now also invalidates `['assignments-options']` and `['class-subjects']` so the workflow reflects the new ClassSubject rows.
  - Removed the now-unused `subjectMap` useMemo.
- `src/components/views/principal/subjects.tsx`: subject-library create/edit/delete mutations now invalidate `['assignments-options']` (in addition to `['principal', 'subjects']` and `['class-subjects']`) so the Teacher Assignments form sees newly-created/edited/deleted subjects without a manual refresh.

### Issue 2 fixes
- `src/scripts/seed.ts`: principal upsert now ensures a 1:1 linked Teacher record. `db.user.create({ data: { ..., teacher: { create: {} } }, include: { teacher: true } })` for the create branch; for the update branch, re-fetches the existing principal WITH `include: { teacher: true }` and — if no Teacher row is linked — `db.teacher.create({ data: { userId: principalId } })`. This is idempotent and handles a prod DB that was originally seeded WITHOUT a principal Teacher record (re-running `bun run db:seed` against prod will create the missing Teacher row). Default credentials unchanged (`principal@resco.edu.ng` / `affordables`, role `PRINCIPAL`). Not run against prod (per task rule); the user will re-run `bun run db:seed` after this is pushed.
- `src/lib/auth.ts` → `requireTeacherAuthorized(classId, subjectId)`: rewrote so BOTH a teacher AND the principal (with a Teacher record) must have a `(teacherId, classId, subjectId)` TeacherAssignment to be authorized. If the caller has no `teacherId` (principal-without-Teacher OR non-teacher) → returns null (not authorized for result entry). Principal-only operations (approval/manage) use `requirePrincipal()` elsewhere and stay full-access.
- `src/app/api/dashboard/teacher/route.ts`: changed the auth gate from `u.role !== 'TEACHER' || !u.teacherId` to `!u.teacherId` — so a principal WITH a Teacher record is allowed (scoped to her own assignments by the existing `where: { teacherId }` queries); a principal without a Teacher record gets 403 (same as before).
- `src/app/api/results/bootstrap/route.ts`: rewritten to scope the principal (with `teacherId`) to HER own assignments — same `where: { teacherId: u.teacherId }` query path as a teacher. A principal WITHOUT a Teacher record still gets the full list (unchanged behaviour, kept as a safety net). Added clarifying comments.
- `src/app/api/results/students/route.ts`: changed the per-class authz check from `if (u.role === 'TEACHER')` to `if (u.teacherId)` — so a principal-with-Teacher-record must have at least one assignment for the class (same as a teacher). A principal without a Teacher record still passes (full-school access — used by principal views that may call this endpoint).
- `src/app/api/results/submit/route.ts`: removed the `if (u.role === 'TEACHER')` guard around `requireTeacherAuthorized` — now always calls it per row. After the auth.ts change, this scopes BOTH teachers AND principals-with-Teacher to their own assignments; a principal without a Teacher record returns null → row rejected.
- `src/app/api/assignments/options/route.ts`: the `teachers` dropdown list now ALSO includes the principal's own Teacher record (when `u.teacherId` is set), so the principal can be assigned to classes/subjects like any teacher. Dedupes by `teacher.id` (in case the active-teachers query already returned her) and re-sorts by name. `u.teacherId` is fetched via the `requirePrincipal()`-authenticated session. `/api/teachers` (teacher-MANAGEMENT list) is UNCHANGED — still filters `role: 'TEACHER'` only.
- `src/components/shell/shell-layout.tsx`: added `divider?: boolean` and `heading?: string` fields to `NavItem`; `NavList` renders a small section divider + uppercase heading label above the item when `divider` is true. Wrapped each item in a `<div className="contents">` so the divider/heading render alongside the button.
- `src/components/shell/principal-shell.tsx`: added three teacher nav items to `PRINCIPAL_NAV` in a new "Teacher Tools" group (after the principal items, with a `divider: true, heading: 'Teacher Tools'` on the first item):
  - `t-results-entry` → `<TeacherResultsEntry />`
  - `t-my-students` → `<TeacherMyStudents />`
  - `t-report-cards` → `<TeacherReportCards />`
  Imported these teacher view components into the principal shell + added them to the `views` switch. Used distinct `t-` prefixed keys so they don't collide with the principal's `results`/`report-cards` keys.
- Verified the teacher views (`TeacherResultsEntry`, `TeacherMyStudents`, `TeacherReportCards`, `TeacherDashboard`) do NOT hard-check `role === 'TEACHER'` (grep returned no matches), so no relaxation was needed.

### Lint & dev server
- `bun run lint` → EXIT 0 (0 errors, 0 warnings) after all edits.
- Dev server log shows clean compilations (`✓ Compiled in Xms`) after the edits — no runtime errors. The `themeColor` metadata warning is pre-existing and unrelated.

## Stage Summary
- Issue 1 fixed: a newly-added library subject (e.g. Accounting, Commerce) appears in the Teacher Assignments per-class subject list (the list shows ALL active library subjects, not just offered ones). Pre-checked = already-assigned; offered-but-not-assigned shows an emerald "Offered" badge; newly-added shows unchecked. Saving auto-creates the ClassSubject (so result-entry authorization `isSubjectOfferedForClass` keeps working without a separate Subject Management step). The bulk POST returns + audits `autoOfferedSubjects`. Subject-library create/edit/delete mutations invalidate `['assignments-options']` so the new subjects appear immediately in the workflow.
- Issue 2 fixed: the principal can be assigned to classes/subjects (she appears in the assignments-options teachers dropdown; the bulk workflow pre-checks her existing assignments). She can access Enter Results / My Students / Report Cards in her shell (under a "Teacher Tools" group with a divider+heading). She is scoped to HER own assignments for result entry (`requireTeacherAuthorized` + bootstrap + students + submit all scope her to her TeacherAssignment rows). Her principal capabilities (principal dashboard, Results view, Approvals, etc.) are unaffected — those use `requirePrincipal()` and stay full-access.
- All existing features preserved (auth, dashboards, students, classes, results CA/30+Exam/70=Total/100, cumulative, grading, positions, remarks, submit/approve/lock/reopen, audit, report cards, PDF, bulk, settings, mobile, logo, branding).
- Schema NOT modified (the User↔Teacher 1:1 already existed in the schema). No `db:push` run.
- Did NOT seed against the production Turso DB (per task rule). The user will re-run `bun run db:seed` against prod after this is pushed — the seed's idempotent principal-upsert will create the missing Teacher record on the existing prod DB.

## Deviations
1. **`/api/results` GET (the teacher-scoped path) was intentionally NOT modified** to scope the principal to her own assignments. Reason: the principal's `PrincipalResults` view (`src/components/views/principal/results.tsx`) calls `/api/results` GET for full-school browsing ("Browse every result row in the school") — the task explicitly says this view stays full-access. Scoping `/api/results` GET for principal-with-teacherId would break that view (the principal would only see her own assignments' results, not the full school). The principal-in-teacher-mode (`TeacherResultsEntry` calling `/api/results?classId=X&subjectId=Y&sessionId=S&termId=T`) is already correctly scoped by:
   - Bootstrap (scoped to her assignments) → her (classId, subjectId) list.
   - The UI only lets her pick from her assignments.
   - `/api/results` GET's explicit `where` clause (`classId=X, subjectId=Y`) narrows the result set to (X,Y) — which is one of her own assignments.
   So the principal-in-teacher-mode can ONLY query results for her own (classId, subjectId) combos, even without scoping at the `/api/results` GET endpoint. The other three teacher-facing endpoints (bootstrap, students, submit) WERE scoped per the task instruction.
2. **`/api/results/carryover` GET and `/api/results/[id]` GET were NOT modified** (not listed in the task). The carryover endpoint keeps its `if (u.role === 'TEACHER')` guard — the principal auto-passes (which is fine because she only calls it for her own assignments' students via the teacher workflow). The `[id]` GET endpoint is not used by the UI (verified by grep — no view calls it directly; the report-card preview uses `/api/report-card` instead).

## Files edited (12 total)
1. `src/scripts/seed.ts` — principal 1:1 Teacher record (idempotent upsert).
2. `src/lib/auth.ts` — `requireTeacherAuthorized` scopes principal to her own assignments.
3. `src/app/api/dashboard/teacher/route.ts` — allow principal-with-teacherId.
4. `src/app/api/results/bootstrap/route.ts` — scope principal-with-teacherId to her assignments.
5. `src/app/api/results/students/route.ts` — scope principal-with-teacherId to her assigned classes.
6. `src/app/api/results/submit/route.ts` — always call `requireTeacherAuthorized` per row.
7. `src/app/api/assignments/options/route.ts` — include principal's Teacher record in dropdown.
8. `src/app/api/assignments/bulk/route.ts` — auto-create ClassSubject + audit `autoOfferedSubjects`.
9. `src/components/views/principal/assignments.tsx` — show ALL library subjects + per-class search + pre-check assigned + Offered badge.
10. `src/components/views/principal/subjects.tsx` — invalidate `['assignments-options']` on create/edit/delete.
11. `src/components/shell/shell-layout.tsx` — `divider` + `heading` fields on `NavItem`.
12. `src/components/shell/principal-shell.tsx` — add Teacher Tools nav group + view switch entries.
