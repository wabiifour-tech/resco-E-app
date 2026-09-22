# Task 4-b — Report Card generation

**Agent:** full-stack-developer (Z.ai Code)
**Task ID:** 4-b
**Task:** Build the Report Card generation for RESCO eCard — printable / PDF-downloadable professional report card per the spec, with term-specific cumulative columns (1st = total, 2nd = (T1+T2)/2, 3rd = (T1+T2+T3)/3), principal + teacher views, a shared document component, two API endpoints, and print CSS.

## Files created
- `src/app/api/report-card/route.ts` — `GET ?studentId=&sessionId=&termId=`
- `src/app/api/report-card/bulk/route.ts` — `GET ?classArmId=&sessionId=&termId=` (principal only)
- `src/components/views/shared/report-card-document.tsx` — `export function ReportCardDocument({ studentId, sessionId, termId, preloaded? })`
- `src/components/views/principal/report-cards.tsx` — `export function PrincipalReportCards()`
- `src/components/views/teacher/report-cards.tsx` — `export function TeacherReportCards()`

## Files modified (append-only)
- `src/app/globals.css` — appended `@media print { ... }` + `@page { margin: 12mm; }` rules.

## API surface
- `GET /api/report-card?studentId=&sessionId=&termId=` — principal sees any; teacher must have ANY assignment in the student's class arm. Returns `{ settings, session, term, student, subjects[], classAverage, termOrder, generatedAt }`. Each subject has `firstTerm`, `secondTerm`, `thirdTerm` (full {ca, exam, total, grade, position} each, null if missing), `currentTerm` (with remarkText/remarkCategory), `cumulative` (computed via `computeCumulative`), `position`.
- `GET /api/report-card/bulk?classArmId=&sessionId=&termId=` — principal only. Returns `{ classArm, session, term, students: [{ studentId, admissionNumber, fullName }] }`.

## Spec compliance (cumulative columns)
Verified via curl with the test student John Doe (RES/2026/001, JSS1A) who has Mathematics results across all three terms of 2026/2027:
- 1st Term (CA=25, Exam=60): total=85, cumulative=85 (term total IS the cumulative) ✓
- 2nd Term (CA=24, Exam=54): 1st=85, 2nd CA=24, 2nd Exam=54, 2nd Total=78, Cumulative=81.5 → `(85+78)/2 = 81.5` ✓ (matches spec example exactly)
- 3rd Term (CA=26, Exam=56): 1st=85, 2nd=78, 3rd CA=26, 3rd Exam=56, 3rd Total=82, Cumulative=81.67 → `(85+78+82)/3 = 245/3 ≈ 81.67` ✓ (matches spec example exactly)

## Print + PDF
- Print button: `window.print()`.
- Download PDF button: opens a toast instructing "Choose Save as PDF", then `window.print()` after 200ms.
- `@media print` rules in globals.css: hide `.no-print` (selectors, buttons, banners, student picker), absolute-position `.print-area` so it fills the page, force `color: black` / `background: white` so dark-mode tokens don't bleed, and `break-after: page` on `.rc-bulk-card` so each student's card is on its own page.
- `@page { margin: 12mm; }`.

## Auth checks
- Teacher can GET a report card only if they have an assignment in the student's `classArmId` (verified: Mr. Ade Demo can access John Doe in JSS1A, but gets 403 for a JSS1B test student).
- Bulk endpoint is principal-only (403 for teachers).
- Unauthenticated requests get 401.

## Lint
- `bun run lint` exits 0 — no errors, no warnings in any file I created or modified.

## Deviations
- Used a `<School>` lucide icon as the logo fallback when `settings.logoDataUrl` is null (instead of `/logo.svg` literal). The icon is rendered in a bordered box and is print-friendly.
- Did not install `jspdf` + `html2canvas` — the spec said it's optional and print-to-PDF satisfies the requirement. Keeps the bundle lean and avoids html2canvas's known issues with oklch color tokens.
- The "Class Teacher's Remark" block shows the remark text of the first subject that has a current-term remark (defensive — the spec doesn't say which subject's remark to display when several subjects have different ones; a single card-level remark is the conventional school report card UX).
- The bulk endpoint returns only the list of student ids (no full report data per student). The frontend fetches each card's data via `useQueries` against `/api/report-card`. This keeps the bulk endpoint's payload tiny and lets each card query run in parallel with its own caching.

## Smoke test endpoints
```
curl -b cookies.txt http://localhost:3000/api/report-card?studentId=...&sessionId=...&termId=...
curl -b cookies.txt http://localhost:3000/api/report-card/bulk?classArmId=...&sessionId=...&termId=...
curl -b cookies.txt http://localhost:3000/api/audit?action=REPORT_CARD_GENERATED&pageSize=5
```
