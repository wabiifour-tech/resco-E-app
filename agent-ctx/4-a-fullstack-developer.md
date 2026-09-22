# Task 4-a — Dashboards (Principal + Teacher)

- **Agent**: full-stack-developer (Z.ai Code)
- **Task**: Build the Principal and Teacher dashboards — summary APIs + the two dashboard views rendered by the shells.

## Files created (owned by this task — do not modify without coordination)

### API routes (App Router `route.ts`)
| File | Method | Auth | Returns |
|---|---|---|---|
| `src/app/api/dashboard/principal/route.ts` | GET | `requirePrincipal()` (403 otherwise) | `{ counts, current, results }` |
| `src/app/api/dashboard/teacher/route.ts` | GET | teacher session (401 unauth, 403 for principal) | `{ teacher, current, assignments, classArms, subjects, results }` |

### View files (overwrote stubs, kept named exports)
| File | Named export |
|---|---|
| `src/components/views/principal/dashboard.tsx` | `PrincipalDashboard` |
| `src/components/views/teacher/dashboard.tsx` | `TeacherDashboard` |

## API surface (for downstream agents)
- `GET /api/dashboard/principal` — principal-only summary:
  - `counts`: `{ teachers, teachersActive, students, studentsActive, classes, classArms, subjects }`
  - `current`: `{ sessionName, termName, sessionId, termId }` — `null`s when no active period
  - `results`: `{ saved, submitted, approved, needsCorrection, total }` — scoped to active session+term; all `0` when no active period
- `GET /api/dashboard/teacher` — teacher-only summary:
  - `teacher`: `{ name, email }`
  - `current`: same shape as principal route
  - `assignments`: `[{ classArmId, classArmName, subjectId, subjectName }]`
  - `classArms`: distinct `[{ id, fullName }]`
  - `subjects`: distinct `[{ id, name }]`
  - `results`: `{ saved, submitted, approved, needsCorrection }` — scoped to the teacher's `subjectId IN [...]` AND `classArmId IN [...]` AND active session+term; all `0` when teacher has no assignments or no active period

## Key implementation notes
- No schema changes; no `db:push`; no shell edits; no other agents' files touched.
- Empty `in: []` is guarded — if the teacher has no assignments, the result counts short-circuit to `0` instead of issuing a Prisma query.
- The `Result` model's `classArmId` is a plain String with NO `classArm` relation (per task 3-a's note). The dashboard route uses it directly inside `db.result.count({ where: { ..., classArmId: { in: [...] } } })`.
- Dashboards are read-only — `useQuery` only (no mutations, no invalidations). `staleTime: 30_000` so a tab-switch back to dashboard does not refetch instantly.
- The teacher dashboard shows the SAME test SUBMITTED Mathematics result (JSS1A — First Term — 2026/2027) as the principal dashboard's `submitted:1`. This is intentional — the principal sees it among all results, the teacher sees it among their own assignments.

## Lint status
`bun run lint` exits 0 (no errors, no warnings in any of my four files). Dev log shows clean compiles for the new routes and view modules.
