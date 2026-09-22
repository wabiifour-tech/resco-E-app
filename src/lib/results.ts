import { db } from '@/lib/db'

// ─── Result calculation rules (RES CO eCard spec) ────────────────────────────
// CA / 30, Examination / 70, Total / 100.
// Cumulative 2nd Term = (1st Total + 2nd Total) / 2
// Cumulative 3rd Term = (1st Total + 2nd Total + 3rd Total) / 3
// All three terms carry equal weight. NO cumulative CA.

export const CA_MAX = 30
export const EXAM_MAX = 70
export const TOTAL_MAX = 100

/** Validate a single CA/Exam entry. Returns error string or null. */
export function validateScore(ca: number, exam: number): string | null {
  if (!Number.isFinite(ca) || !Number.isFinite(exam)) return 'Scores must be valid numbers'
  if (ca < 0 || ca > CA_MAX) return `CA must be between 0 and ${CA_MAX}`
  if (exam < 0 || exam > EXAM_MAX) return `Examination must be between 0 and ${EXAM_MAX}`
  return null
}

/** Compute term total. */
export function computeTotal(ca: number, exam: number): number {
  return ca + exam
}

/** Round to 2 decimals (for cumulative display). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Look up the grade for a given total using configured GradeBoundary rows.
 * Falls back to default scale if none configured.
 */
export function gradeForTotal(total: number, boundaries?: { min: number; max: number; grade: string }[]): string {
  const b = boundaries && boundaries.length > 0 ? boundaries : DEFAULT_GRADE_BOUNDARIES
  for (const row of b) {
    if (total >= row.min && total <= row.max) return row.grade
  }
  // Fallback: lowest grade
  return b[b.length - 1]?.grade ?? 'F'
}

export const DEFAULT_GRADE_BOUNDARIES = [
  { min: 80, max: 100, grade: 'A', order: 0 },
  { min: 70, max: 79, grade: 'B', order: 1 },
  { min: 60, max: 69, grade: 'C', order: 2 },
  { min: 50, max: 59, grade: 'D', order: 3 },
  { min: 40, max: 49, grade: 'E', order: 4 },
  { min: 0, max: 39, grade: 'F', order: 5 },
]

export async function loadGradeBoundaries() {
  const rows = await db.gradeBoundary.findMany({ orderBy: { order: 'asc' } })
  return rows.length > 0 ? rows : DEFAULT_GRADE_BOUNDARIES
}

/**
 * Recompute positions for a subject + classArm + session + term.
 * Tie-rank method (standard competition ranking "1224"): equal totals share a rank,
 * next rank skips. e.g. 90→1, 85→2, 85→2, 78→4
 */
export async function recomputePositions(opts: {
  subjectId: string
  classArmId: string
  sessionId: string
  termId: string
}): Promise<void> {
  const results = await db.result.findMany({
    where: {
      subjectId: opts.subjectId,
      classArmId: opts.classArmId,
      sessionId: opts.sessionId,
      termId: opts.termId,
      total: { not: null },
    },
    orderBy: { total: 'desc' },
  })

  // Assign positions with tie handling
  let pos = 0
  let prevTotal: number | null = null
  let sameCount = 0
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const t = r.total as number
    if (prevTotal === null || t !== prevTotal) {
      pos = i + 1
      sameCount = 1
    } else {
      sameCount++
    }
    prevTotal = t
    await db.result.update({
      where: { id: r.id },
      data: { position: pos },
    })
  }
}

/**
 * Fetch a student's term-total for a subject/session/term (used for carry-over).
 */
export async function getTermTotal(opts: {
  studentId: string
  subjectId: string
  sessionId: string
  termOrder: number // 1, 2, or 3
}): Promise<number | null> {
  const term = await db.term.findFirst({
    where: { sessionId: opts.sessionId, order: opts.termOrder },
  })
  if (!term) return null
  const r = await db.result.findUnique({
    where: {
      studentId_subjectId_sessionId_termId: {
        studentId: opts.studentId,
        subjectId: opts.subjectId,
        sessionId: opts.sessionId,
        termId: term.id,
      },
    },
  })
  return r?.total ?? null
}

/**
 * Compute cumulative for a given term based on prior term totals.
 * - 1st term: just the term total (no cumulative)
 * - 2nd term: (T1 + T2) / 2
 * - 3rd term: (T1 + T2 + T3) / 3
 * Returns null if any required prior term is missing.
 */
export function computeCumulative(
  termOrder: number,
  termTotal: number,
  priorTotals: number[], // [T1, T2, ...] up to termOrder-1
): number | null {
  if (termOrder === 1) return termTotal
  if (priorTotals.length !== termOrder - 1) return null
  if (priorTotals.some((t) => t == null || !Number.isFinite(t))) return null
  const sum = priorTotals.reduce((a, b) => a + b, 0) + termTotal
  return round2(sum / termOrder)
}

export function ordinal(n: number): string {
  if (!n || n <= 0) return '-'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
