# Task 2-c — Principal Remarks/Grading/Settings

Task ID: 2-c
Agent: full-stack-developer
Task: Build three principal-side modules (Remarks, Grading, School Settings) — API routes + React views — for the RESCO eCard application.

## Files created/overwritten

### API routes (App Router)
- `src/app/api/remarks/route.ts` — `GET` (all remarks, grouped by category + flat list), `POST` (create).
- `src/app/api/remarks/[id]/route.ts` — `PUT` (edit category/text/active), `PATCH` (toggle active), `DELETE` (with in-use guard).
- `src/app/api/grading/route.ts` — `GET` (ordered boundaries, defaults fallback), `PUT` (replace-all in a transaction).
- `src/app/api/settings/route.ts` — `GET` (singleton + sessions/terms for dropdowns), `PUT` (update text fields + image data URLs + currentSessionId/currentTermId via `setCurrentSessionAndTerm`).

### View files (real, not placeholders — overwrote stubs, kept SAME named export)
- `src/components/views/principal/remarks.tsx` — `export function PrincipalRemarks()`
- `src/components/views/principal/grading.tsx` — `export function PrincipalGrading()`
- `src/components/views/principal/settings.tsx` — `export function PrincipalSettings()`

## Endpoints + HTTP methods
- `GET /api/remarks`, `POST /api/remarks`  → `{ grouped: [{category, items[]}][], items: [...] }`
- `PUT /api/remarks/{id}`, `PATCH /api/remarks/{id}` (toggle active), `DELETE /api/remarks/{id}`
- `GET /api/grading`, `PUT /api/grading` (body: `{ items: [{min, max, grade, order}] }` → `{ ok, items, warnings }`)
- `GET /api/settings`, `PUT /api/settings` (body fields: `schoolName`, `address`, `phone`, `motto`, `principalName`, `logoDataUrl`, `principalSignatureDataUrl`, `currentSessionId`, `currentTermId`)

## Audit actions used
- `REMARK_CREATED` — on POST /api/remarks
- `REMARK_EDITED` — on PUT/PATCH/DELETE of /api/remarks/[id]
- `GRADING_UPDATED` — on PUT /api/grading (context includes boundaries summary + warnings)
- `SETTINGS_UPDATED` — on PUT /api/settings (context lists changed fields + current session/term ids)

## Key design choices / deviations
- Remarks module: 5 fixed categories exported as `REMARK_CATEGORIES` const. Display is a 2-column grid of Cards, each Card contains a scrollable list (`max-h-96 overflow-y-auto`) with toggle switch, edit, and delete buttons per remark.
- Delete on a remark that is in use by any Result is blocked by the API (returns 400 with count) — UI surfaces this in the delete dialog text. This is because the schema's `Result.remark` relation has no `onDelete` (defaults to restrict).
- Grading PUT deletes all rows then re-creates them in a single transaction. Validation is strict (numbers, ranges 0–100, grade non-empty, no duplicate exact ranges); overlaps and gaps are reported as warnings but do not block save (per spec). Server also surfaces its own warnings back to the UI.
- Settings view uses an in-form pending state for logo/signature image uploads: file → `FileReader.readAsDataURL` → `string` held in state until the user clicks "Save Identity & Branding". Image validation: type ∈ {png, jpeg, svg, webp}, file size ≤ 1MB; server enforces data-URL prefix and ~1.5MB encoded length cap.
- Settings PUT also handles `currentSessionId`/`currentTermId` updates by delegating to `setCurrentSessionAndTerm()` from `src/lib/session.ts`. If the session changes and the previously-set term no longer belongs to the new session, the term is cleared automatically.
- Avoided React 19 `set-state-in-effect` lint rule by extracting the editable table (Grading) and the editable form (Settings) into child components keyed by TanStack Query's `dataUpdatedAt`, so they remount cleanly with `useState(() => initial)` initialisers when server data changes — no `useEffect` setState.
- No indigo/blue; uses `primary` + amber accents for warnings.
- All buttons ≥44px touch targets; tables wrapped in `overflow-x-auto`; forms are responsive grids.

## Lint status
- All four NEW files (`remarks.tsx`, `grading.tsx`, `settings.tsx`, three API routes) pass `bunx eslint` cleanly (exit 0).
- Pre-existing `react-hooks/set-state-in-effect` errors in OTHER agents' files (classes.tsx, sessions.tsx, subjects.tsx, teachers.tsx, students.tsx) remain — those are not mine to fix.

## Stage Summary
- Principal can now: define/edit/toggle/delete predefined teacher remarks grouped by category; configure the 0–100 grade-boundary scale with live validation + preview; set the school's identity, logo, principal name + signature, and choose the active academic session/term.
- All changes are audit-logged. The Settings PUT additionally invalidates the `['active-session-term']` TanStack Query key on session/term change, so any component downstream that uses that key will refresh.
- These modules wire directly into the existing `PrincipalShell` (which switches on the `view` string from `useAppStore`); no shell or store changes were required.
