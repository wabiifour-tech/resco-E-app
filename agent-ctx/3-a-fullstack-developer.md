# Task 3-a — Result system (CORE)

- **Agent**: full-stack-developer (Z.ai Code)
- **Task**: Build the result entry & calculation system for RESCO eCard — APIs (POST/PUT/PATCH/GET/submit/carryover/bootstrap/students) + three views (TeacherResultsEntry, TeacherMyStudents, PrincipalResults).

## Files created (all owned by this task — do not modify without coordination)

### API routes (App Router `route.ts`)
| File | Methods | Purpose |
|---|---|---|
| `src/app/api/results/route.ts` | GET, POST | List results w/ filters + auth scoping; save (upsert) one row with validation + lock-check + recompute positions + audit |
| `src/app/api/results/[id]/route.ts` | GET, PUT, PATCH | One row: fetch, full-edit, partial-edit (e.g. set remark only) |
| `src/app/api/results/submit/route.ts` | POST | Batch submit by `{resultIds}` OR `{studentIds, subjectId, classArmId, sessionId, termId}` |
| `src/app/api/results/carryover/route.ts` | GET | `{firstTerm, secondTerm, firstTermExists, secondTermExists}` for live cumulative |
| `src/app/api/results/bootstrap/route.ts` | GET | One-call: assignments + activeSession/term + remarks + gradeBoundaries (avoids touching other agents' files) |
| `src/app/api/results/students/route.ts` | GET | Arm-scoped student list; teacher must be assigned to ANY subject of that arm |

### View files (overwrote stubs, kept named exports)
| File | Named export |
|---|---|
| `src/components/views/teacher/results-entry.tsx` | `TeacherResultsEntry` |
| `src/components/views/teacher/my-students.tsx` | `TeacherMyStudents` |
| `src/components/views/principal/results.tsx` | `PrincipalResults` |

## API surface (for downstream agents)
- `GET /api/results?sessionId=&termId=&classArmId=&subjectId=&studentId=&status=` — list. Auth: teacher sees only their assigned (classArm, subject) combos; principal sees all. Each row carries `priorTotals: {firstTerm, secondTerm}` + `cumulative`.
- `POST /api/results` — body `{studentId, subjectId, sessionId, termId, classArmId, ca, exam, remarkId?}`. Validates CA 0–30 / Exam 0–70. Authorizes via `requireTeacherAuthorized`. Lock-checks (409 if SUBMITTED/APPROVED). Computes total + grade. Upserts. Calls `recomputePositions`. Audits `RESULT_CREATED`/`RESULT_EDITED` + `RESULT_SAVED`.
- `GET /api/results/[id]` — one row (auth: teacher must own the (classArm, subject)).
- `PUT /api/results/[id]` — full-edit `{ca, exam, remarkId?}`. Same validation + auth + lock + recompute + audit.
- `PATCH /api/results/[id]` — partial (e.g. `{ca}` or `{remarkId}` only). Recomputes total/grade/position when any score changes.
- `POST /api/results/submit` — batch submit. Body: `{resultIds: []}` OR `{studentIds, subjectId, classArmId, sessionId, termId}`. Returns `{submitted, rejected, submittedCount, rejectedCount}`. Per-row auth + lock check.
- `GET /api/results/carryover?studentId=&subjectId=&sessionId=` — `{firstTerm, secondTerm, firstTermExists, secondTermExists}`.
- `GET /api/results/bootstrap` — `{activeSession, activeTerm, assignments, remarks, gradeBoundaries}`. Principal gets all assignments; teacher gets only their own (stripped of other teachers' data).
- `GET /api/results/students?armId=&active=&q=` — students in an arm. Principal: any arm. Teacher: must have ANY assignment to that arm.

## Key implementation notes
- The `Result` model has `classArmId` (plain String) but NO `classArm` relation. My serializers fetch the `ClassArm` separately by ID. Do NOT add `classArm: {...}` to the `include` clause.
- Per-row audit calls are slow (~500ms each on this disk). I AVOID wrapping submit in a single `db.$transaction` because the interactive-transaction timeout (5s) is exceeded. Instead I do per-row updates sequentially with per-row audit inserts OUTSIDE any transaction wrapper.
- Teacher auth scoping uses `requireTeacherAuthorized(classArmId, subjectId)` — principal always passes; teacher must have an assignment record.
- `recomputePositions` is called after every POST/PUT/score-PATCH to keep positions consistent with tie-ranking (90→1, 85→2, 85→2, 78→4).
- The mandatory calculation test passes:
  - First Term CA=25, Exam=60 → total=85, cumulative=85 ✓
  - Second Term CA=24, Exam=54 → total=78, cumulative=81.5 ✓ (matches (85+78)/2)
  - Third Term CA=26, Exam=56 → total=82, cumulative=81.67 ✓ (matches (85+78+82)/3)

## DB test data left behind (for approvals agent convenience)
- Student `RES/2026/001` John Doe in JSS1A
- Teacher assignment: Mr. Ade Demo → JSS1A — Mathematics
- Three results for Mathematics in 2026/2027:
  - First Term: CA=25, Exam=60, Total=85, Grade=A, status=SUBMITTED, position=1
  - Second Term: CA=24, Exam=54, Total=78, Grade=B, status=SAVED, position=1, priorTotals.firstTerm=85, cumulative=81.5
  - Third Term: CA=26, Exam=56, Total=82, Grade=A, status=SAVED, position=1, priorTotals.firstTerm=85 + secondTerm=78, cumulative=81.67, remarkId="Excellent performance. Keep it up."

The approvals agent can use the First Term SUBMITTED result to test the approval workflow. If you want to start clean, delete the student (cascade-deletes the 3 results) and the teacher assignment.

## Lint status
`bun run lint` exits 0 (no errors, no warnings in any of my files). Pre-existing errors in `approvals.tsx` / `audit.tsx` are owned by their respective agents.
