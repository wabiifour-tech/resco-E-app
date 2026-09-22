# Task 2-b — Principal Classes/Subjects/Sessions/Terms/Assignments

Task ID: 2-b
Agent: full-stack-developer
Task: Build five principal-side management modules (Classes & Arms, Subjects, Academic Sessions, Terms, Teacher Assignments) — API routes + React views — for the RESCO eCard application.

## Files created/overwritten

### API routes (App Router)
- `src/app/api/classes/route.ts` — `GET` (list with arms + counts), `POST` (create class; auto-uppercasing name).
- `src/app/api/classes/[id]/route.ts` — `GET` (single), `PUT` (rename / level), `DELETE` (blocked if students exist).
- `src/app/api/classes/[id]/arms/route.ts` — `POST` (add arm; auto-generates `${className}${armName}` fullName).
- `src/app/api/classes/[id]/arms/[armId]/route.ts` — `DELETE` (blocked if students attached to arm).
- `src/app/api/subjects/route.ts` — `GET` (list with assignment/result counts), `POST` (create).
- `src/app/api/subjects/[id]/route.ts` — `PUT` (rename/code), `DELETE` (blocked if results exist; cascade removes assignments).
- `src/app/api/sessions/route.ts` — `GET` (list with terms + counts + currentSessionId/TermId), `POST` (create session AND its three terms in a transaction).
- `src/app/api/sessions/[id]/route.ts` — `PUT` (rename), `DELETE` (blocked if active or has results).
- `src/app/api/sessions/[id]/activate/route.ts` — `POST` (deactivate others, activate this one, setCurrentSessionAndTerm(id, null)).
- `src/app/api/terms/route.ts` — `GET` (`?sessionId=` optional; falls back to current/active session) → `{ session, terms, currentSessionId, currentTermId }`.
- `src/app/api/terms/[id]/activate/route.ts` — `POST` (deactivate sibling terms, activate this one, ensure parent session active, setCurrentSessionAndTerm(sessionId, id)).
- `src/app/api/assignments/route.ts` — `GET` (principal: all with joins; teacher: own only, scoped shape), `POST` (create with FK validation + duplicate guard).
- `src/app/api/assignments/[id]/route.ts` — `DELETE` (with friendly error).
- `src/app/api/assignments/options/route.ts` — `GET` (teachers, classArms, subjects lists for the create form).

### View files (real, not placeholders — overwrote stubs, kept SAME named export)
- `src/components/views/principal/classes.tsx` → `export function PrincipalClasses()`
- `src/components/views/principal/subjects.tsx` → `export function PrincipalSubjects()`
- `src/components/views/principal/sessions.tsx` → `export function PrincipalSessions()`
- `src/components/views/principal/terms.tsx` → `export function PrincipalTerms()`
- `src/components/views/principal/assignments.tsx` → `export function PrincipalAssignments()`

## Endpoints + HTTP methods
- `GET /api/classes` (list), `POST /api/classes` (create)
- `GET /api/classes/{id}`, `PUT /api/classes/{id}` (rename/level), `DELETE /api/classes/{id}` (cascade arms; blocked by students)
- `POST /api/classes/{id}/arms` (add arm; auto fullName)
- `DELETE /api/classes/{id}/arms/{armId}` (blocked by students)
- `GET /api/subjects`, `POST /api/subjects`
- `PUT /api/subjects/{id}`, `DELETE /api/subjects/{id}`
- `GET /api/sessions`, `POST /api/sessions` (auto-creates 3 terms)
- `PUT /api/sessions/{id}`, `DELETE /api/sessions/{id}`
- `POST /api/sessions/{id}/activate`
- `GET /api/terms?sessionId=` (falls back to current/active), 
- `POST /api/terms/{id}/activate`
- `GET /api/assignments` (principal: all; teacher: own), `POST /api/assignments`
- `DELETE /api/assignments/{id}`
- `GET /api/assignments/options` (teachers + classArms + subjects for the form)

## Audit actions used
- `CLASS_CREATED` — POST /api/classes
- `CLASS_EDITED` — PUT /api/classes/{id}, DELETE /api/classes/{id}, add/remove arms
- `SUBJECT_CREATED` — POST /api/subjects
- `SUBJECT_EDITED` — PUT /api/subjects/{id}, DELETE /api/subjects/{id}
- `SESSION_CREATED` — POST /api/sessions, PUT /api/sessions/{id}, DELETE /api/sessions/{id}
- `SESSION_ACTIVATED` — POST /api/sessions/{id}/activate
- `TERM_ACTIVATED` — POST /api/terms/{id}/activate
- `TEACHER_ASSIGNMENT_CHANGED` — POST /api/assignments (ASSIGN) + DELETE /api/assignments/{id} (UNASSIGN); context includes teacher/classArm/subject names for audit readability.

## Key design choices / deviations
- **No `useEffect` setState pattern** — to comply with the React 19 `react-hooks/set-state-in-effect` lint rule, every form dialog (`CreateClassDialog`, `ManageArmsDialog`, `SubjectFormDialog`, `SessionFormDialog`) is split into a thin "gate" wrapper that returns `null` when closed, plus an inner component that initializes its state from props via `useState(() => initial)`. The inner component is given a `key` based on `subject?.id | session?.id | cls.id | 'create'` so it remounts fresh whenever the parent passes new props — eliminating the cascading-render pattern.
- **Classes & Arms**: list renders class rows with arm badges; a "Manage" dialog per class allows editing class name/level inline AND adding/removing arms. Removing an arm with attached students is blocked at the API. Deleting a class is blocked when it has students. Cascade-deleting a class removes its arms (and the arms' teacher assignments) per the schema.
- **Subjects**: searchable table (by name or code), counts of assignments and results, edit-in-dialog, delete blocked when results exist.
- **Sessions**: emerald "Current:" banner summarizing current session+term from `SchoolSetting`. Creating a session auto-creates First/Second/Third terms inside a `$transaction`. Activating a session calls `setCurrentSessionAndTerm(id, null)` (term defaults elsewhere). Deletion blocked when active or has results.
- **Terms**: explicit session dropdown (defaults to current/active). Emerald current banner. Activate action sets `isActive` for the term (and deactivates siblings), force-activates parent session, and calls `setCurrentSessionAndTerm(sessionId, id)`.
- **Assignments**: principal sees all (with teacher name + email, class arm fullName badge, subject). Search filter. Bonus compact "Subjects by Class Arm" grid view summarizing each arm's covered subjects + responsible teacher. Create dialog uses `/api/assignments/options` for teacher/arm/subject dropdowns, validates all three selected, and surfaces friendly errors (incl. unique-constraint duplicates via the API's pre-check). For the teacher-side GET path, returns only that teacher's own assignments with a stripped shape (no other teachers' data).
- **Auditing** for `TEACHER_ASSIGNMENT_CHANGED` includes the human-readable `teacherName`, `classArmName`, `subjectName` in the context JSON for easy audit-log reading.
- No indigo/blue; emerald for active/current banners, default `primary` for buttons. All interactive elements ≥44px, tables in `overflow-x-auto`, dialogs use the shadcn Dialog/AlertDialog primitives.
- Lint-clean exit (no errors, no warnings).

## Lint status
- `bun run lint` → exit 0 (no errors, no warnings). All 5 view files + 12 API route files pass cleanly.

## Stage Summary
- Principal can now: create/edit/delete classes; manage arms per class (auto fullName JSS1A etc.); CRUD subjects; create academic sessions with auto-generated terms; activate a session or term (which propagates to the singleton); assign teachers to class-arm + subject combos with friendly duplicate errors and a compact matrix view of arms × subjects.
- These five modules wire directly into `PrincipalShell` (which switches on `view` from `useAppStore`); no shell or store changes were required.
- Teacher-side GET `/api/assignments` returns only the requesting teacher's own assignments — ready to be consumed by the teacher's results-entry view in a later phase.
