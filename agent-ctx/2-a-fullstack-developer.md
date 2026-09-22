Task ID: 2-a
Agent: full-stack-developer (Z.ai Code)
Task: Build the **Teachers** and **Students** principal-side modules for RESCO eCard — CRUD APIs (App Router route.ts), TanStack Query-powered list/filter UI, and Dialog-based create/edit/change-password forms. Teacher accounts are created with a hashed password + linked Teacher profile; Students carry a stable admission number plus class/arm.

Work Log:
- Read `worklog.md`, `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/audit.ts`, `src/lib/db.ts`, `src/lib/password.ts`, `src/lib/api-client.ts`, `src/store/app-store.ts`, `src/components/shell/principal-shell.tsx`, and the shadcn `dialog`, `select`, `table`, `card`, `button`, `badge`, `switch`, `label`, `input`, `skeleton` primitives to align with the foundation. Confirmed the named exports required by the shell are `PrincipalTeachers` and `PrincipalStudents`.
- API routes built (all principal-only via `requirePrincipal()`):
  - `src/app/api/teachers/route.ts` — `GET` list (filters: `?q=&active=true|false`) and `POST` create (zod-validated: name ≥2, valid email, password ≥6; creates User + Teacher in `$transaction`; rejects duplicate email with 409).
  - `src/app/api/teachers/[id]/route.ts` — `GET` one (with assignment count), `PUT` edit (name/email/active; unique-email check; emits `TEACHER_EDITED`), `PATCH` toggle active (emits `TEACHER_ACTIVATED` / `TEACHER_DEACTIVATED` with `{ teacherId, teacherName }` context).
  - `src/app/api/teachers/[id]/password/route.ts` — `POST` change password (zod ≥6, hashed via `hashPassword`, emits `PASSWORD_CHANGED` with `{ teacherId, teacherName, email }`). Never returns the stored hash.
  - `src/app/api/students/route.ts` — `GET` list with filters (`?q=&classId=&armId=&active=`), `POST` create (zod-validated; checks class exists, validates arm belongs to class, rejects duplicate admission number with 409; emits `STUDENT_CREATED`).
  - `src/app/api/students/[id]/route.ts` — `GET` one (with results count), `PUT` edit (all fields optional; re-validates arm/class consistency and admission-number uniqueness; emits `STUDENT_EDITED`), `PATCH` toggle active (emits `STUDENT_EDITED` with active-change context).
- Added `src/app/api/classes/route.ts` — read-only `GET` returning all classes with their arms embedded, so the student form can filter the arm dropdown client-side without an extra round-trip. (Coexists cleanly alongside another agent's `/api/classes/[id]` routes.)
- Frontend views (overwrite stubs, keep named exports):
  - `src/components/views/principal/students.tsx` → `export function PrincipalStudents`
  - `src/components/views/principal/teachers.tsx` → `export function PrincipalTeachers`
  Both views share the same architecture: header with title + Add button; filter card (search input + Select filters + Search button); list Card with overflow-x-auto Table, count chip, Skeleton loaders, empty-state; Dialog forms.
  - Dialog form state lives in a **child component mounted inside DialogContent** (`TeacherFormBody`, `PasswordFormBody`, `StudentFormBody`), so when Radix closes/unmounts the dialog the form remounts fresh on each open — useState's initialiser reads the current row prop directly. **No `useEffect`-based reset needed** (avoids the project's `react-hooks/set-state-in-effect` lint rule entirely).
  - TanStack Query: `useQuery` for list + classes; `useMutation` for create/edit/toggle/password; optimistic updates via `onMutate` cache writes for the active toggle Switch; invalidation on success. Toasts via `sonner`.
  - Responsive: tables wrap in `overflow-x-auto`; forms stack on mobile via `grid-cols-1 sm:grid-cols-2`; minimum 44px touch targets via shadcn Button/Switch sizes.
  - A11y: every interactive icon button has an `aria-label` and an `sr-only` text label; every form field has a `<Label htmlFor>`; the status Switch has a descriptive `aria-label`.
  - Color: default `primary` for primary actions; emerald accent (`bg-emerald-100 text-emerald-700`) for the "Active" badge only. No indigo/blue.
- Smoke-tested every endpoint end-to-end with curl after logging in as `principal@resco.edu.ng`:
  - Teachers: create (201), duplicate email (409), weak password (400), GET one (200), PATCH toggle (200), POST password (200), PUT edit (200).
  - Students: create with class+arm (201), duplicate admission number (409), arm-mismatched-class (400), `?q=` search (200, 1 match), PATCH toggle (200), PUT edit (200).
  - Verified all 7 audit actions landed in the AuditLog table (`TEACHER_CREATED`, `TEACHER_DEACTIVATED`, `PASSWORD_CHANGED`, `TEACHER_EDITED`, `STUDENT_CREATED`, `STUDENT_EDITED` ×2) with the expected context JSON.
  - Cleaned up the test teacher (`testteacher@resco.edu.ng`) and test student (`RES/2026/001`) afterwards so the DB is back to its seeded state (1 demo teacher, 0 students).
- Lint: `bun run lint` exits 0 — no errors or warnings in any of my files (and as of this writing, the parallel sessions.tsx error from another agent has also been resolved, so the whole project is lint-clean).

Stage Summary:
- Teachers module complete: principal can create/edit/activate-deactivate teachers, change their password, search/filter by name/email and active status, see # of assignments per teacher. Secure password hashing via the provided `hashPassword()`. Full audit trail.
- Students module complete: principal can create/edit/activate-deactivate students, search by name or admission number, filter by class/arm/active status, see live count. Stable admission numbers enforced unique; class/arm consistency validated server-side. Full audit trail.
- API surface added (all principal-only, all return JSON with `{ error }` on failure):
  - `GET/POST /api/teachers`
  - `GET/PUT/PATCH /api/teachers/[id]`
  - `POST /api/teachers/[id]/password`
  - `GET/POST /api/students`
  - `GET/PUT/PATCH /api/students/[id]`
  - `GET /api/classes` (read-only, returns classes + arms for the student form)
- Views (`PrincipalTeachers`, `PrincipalStudents`) are real, fully wired into the existing `PrincipalShell`, mobile-responsive, accessible, and use only shadcn/ui + Tailwind defaults. No dev-server or build errors.
- No deviations from the spec. The only files I touched outside my two view files were the new API route files I was instructed to create, plus the read-only `GET /api/classes` route used by the student form (it does not collide with another agent's existing `/api/classes/[id]` routes).
