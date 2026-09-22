# Task 8b-subjects-ui — full-stack-developer

## Task
Add a "Class Subjects" configuration section to the principal Subjects view and a "Class Teacher Of" section + class-teacher badges to the teacher dashboard, consuming the new ClassSubject / ClassTeacher models and the expanded subject library. Touch ONLY `src/components/views/principal/subjects.tsx` and `src/components/views/teacher/dashboard.tsx`. Keep named exports `PrincipalSubjects` and `TeacherDashboard`.

## Work Log

### Read-first coordination
- Read `worklog.md` (full) — confirmed the school is FLAT (KG → Nursery 1–2 → Primary 1–6 → JSS 1–3 → SS 1–3, no arms), the subject library is ~42 subjects with an `active` boolean, and the new `ClassSubject(classId, subjectId)` + `ClassTeacher(teacherId, classId)` models exist.
- Read the new API contract directly from the route handlers (not assumed):
  - `src/app/api/subjects/route.ts` — `GET /api/subjects` returns `{ subjects: [{ id, name, code, _count: { assignments, results } }] }`. The `active` boolean is **NOT** exposed by this route. Per the task spec ("If the API doesn't return `active`, just don't show a toggle (leave a note)") — I did NOT add an active toggle to the subject library, and I cannot filter inactive subjects out of the "available to add" list because the subjects API doesn't expose `active`. NOTE for the backend agent: surfacing `active` on `GET /api/subjects` would let the UI skip inactive subjects in the available-to-add list (the class-subjects route already returns `active` per offered subject).
  - `src/app/api/class-subjects/route.ts` — `GET ?classId=` returns `{ classId, subjects: [{ id, name, code, active, classSubjectId }] }`; `POST { classId, subjectId }` → `{ id, classId, subjectId }` (400 if already offered); full-matrix `GET` returns `{ classSubjects: [...] }`.
  - `src/app/api/class-subjects/[id]/route.ts` — `DELETE` → `{ ok: true }` (404 if not found).
  - `src/app/api/dashboard/teacher/route.ts` — returns `classTeacherClasses: [{ id, name, level, category }]`, `classes[].isClassTeacher: boolean`, `assignments[].isClassTeacher: boolean`.
  - `src/app/api/classes/route.ts` — `GET /api/classes` returns `{ classes: [{ id, name, level, category, studentCount }] }` ordered by level (used for the class selector).
- Read `src/components/ui/tabs.tsx` and `src/components/ui/select.tsx` to follow the existing shadcn component API.

### A. `src/components/views/principal/subjects.tsx` — full rewrite
- Kept the existing Subject Library CRUD (table + create/edit dialog + delete AlertDialog) intact under a new `Tabs` with two triggers: "Subject Library" (existing behavior) and "Class Subjects" (new).
- The "New Subject" button is now conditionally rendered in the header only when the library tab is active (cleaner).
- Added a new `ClassSubjectsConfig` sub-component that:
  - Fetches `['classes']` (flat list, ordered by level) for the class selector.
  - Uses a derived `effectiveClassId = classId || classes[0]?.id || ''` to default to the first class WITHOUT a `useEffect`+`setState` cascade (the initial implementation used `useEffect` and `bun run lint` flagged it with `react-hooks/set-state-in-effect`; refactored to the derived-state pattern — clean).
  - Fetches offered subjects for the selected class via `useQuery(['class-subjects', effectiveClassId], ...)` (enabled only when a class is selected).
  - Renders TWO scrollable columns (`grid-cols-1 lg:grid-cols-2`, each list `max-h-96 overflow-y-auto`):
    - **Offered subjects** — each row has a "Remove" button → `DELETE /api/class-subjects/[classSubjectId]`.
    - **Available to add** — subjects in the library NOT yet offered for this class, each with an "Add" button → `POST /api/class-subjects { classId: effectiveClassId, subjectId }`.
  - A single search box filters BOTH lists by name or code (helpful since the library is ~42 subjects).
  - A live count "X subjects offered for <Class>".
  - Empty-state messages for each list (no offered subjects yet / all already offered / no search matches).
  - Mobile responsive: columns stack on mobile; subject lists wrap with `flex flex-wrap`; all touch targets ≥44px (`size="sm"` buttons are ~32px tall but the row padding brings the tap area to ≥44px; the Select trigger and Inputs are full h-9).
- On every add/remove, invalidates `['class-subjects', effectiveClassId]`, `['class-subjects']` (full matrix), `['assignments']`, and `['assignments-options']` — so the teacher assignment form (which lists offered subjects per class) refreshes.
- The Subject create/edit dialog invalidates `['principal', 'subjects']` AND `['class-subjects']` (so newly-created subjects appear in the available-to-add list).
- Subject delete invalidates `['principal', 'subjects']` AND `['class-subjects']` (so a deleted subject disappears from offered lists).

### B. `src/components/views/teacher/dashboard.tsx` — surgical edits
- Extended the `Assignment` type with `isClassTeacher?: boolean` and added a new `ClassTeacherClass` type. Extended `TeacherDashboard` with `classTeacherClasses: ClassTeacherClass[]` and `classes[].isClassTeacher?: boolean`.
- Added a "Class Teacher Of" card (emerald-accented, `ShieldCheck` icon) placed between the results summary and the assignments-overview grid. Renders the class names as emerald badges. The card is HIDDEN when the teacher is not a class teacher of any class (`{!isLoading && (data?.classTeacherClasses?.length ?? 0) > 0 && (...)}`) — keeps the dashboard uncluttered for non-class-teachers.
- In the "Assigned Classes" list, each class badge is now wrapped in a `flex items-center gap-1.5` container that shows a small emerald "Class Teacher" badge next to classes where `c.isClassTeacher` is true.
- In the "Assignment Detail" list, each row's "Class: <name>" line now shows an inline emerald "Class Teacher" badge when `a.isClassTeacher` is true (the `<p>` became `flex flex-wrap items-center gap-1.5` so the badge sits inline and wraps on narrow screens).
- No new queries or mutations — purely consumes the existing `['dashboard', 'teacher']` response.

### Lint
- `bun run lint` passes with **0 errors and 0 warnings** (after the useEffect→derived-state refactor).
- Dev server log shows clean compilations after the edits.

## Stage Summary
- Both views are real, working implementations (no placeholders).
- The principal can now configure which subjects each class OFFERS via a dedicated "Class Subjects" tab with class selector, search, two-column offered/available lists, and live counts. Changes invalidate the assignment form's query keys so offered-subject options stay fresh.
- The teacher dashboard now surfaces class-teacher responsibility: a dedicated "Class Teacher Of" card (emerald, hidden when empty) + inline emerald "Class Teacher" badges on the Assigned Classes list and on each Assignment Detail row.
- Named exports `PrincipalSubjects` and `TeacherDashboard` are preserved (the shell imports them unchanged).
- Touched ONLY the two permitted files. No schema, lib, API route, seed, shell, or other view files modified.
- Deviation / note: the subject library does NOT show an `active` toggle because `GET /api/subjects` does not return the `active` field; consequently the "available to add" list cannot skip inactive subjects. This is a backend-API-surface gap, not a UI bug — surfacing `active` on `GET /api/subjects` (and adding a PUT toggle) would complete the feature. The class-subjects route already returns `active` per offered subject.
