import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { getActiveSessionAndTerm } from '@/lib/session'

export const dynamic = 'force-dynamic'

// GET /api/dashboard/principal
// Principal-only summary: counts of teachers/students/classes/subjects,
// current session+term, and results-by-status for the active session+term.
// (NO classArms count — the school structure is FLAT.)
export async function GET() {
  const u = await requirePrincipal()
  if (!u) {
    return Response.json({ error: 'Principal access required' }, { status: 403 })
  }

  const { session, term } = await getActiveSessionAndTerm()

  // ── Entity counts ─────────────────────────────────────────────────────────
  const [teachers, teachersActive, students, studentsActive, classes, subjects] =
    await Promise.all([
      db.user.count({ where: { role: 'TEACHER' } }),
      db.user.count({ where: { role: 'TEACHER', active: true } }),
      db.student.count(),
      db.student.count({ where: { active: true } }),
      db.class.count(),
      db.subject.count(),
    ])

  // ── Results by status for the current session+term ────────────────────────
  let saved = 0
  let submitted = 0
  let approved = 0
  let needsCorrection = 0
  let total = 0

  if (session && term) {
    const baseWhere = { sessionId: session.id, termId: term.id }
    ;[saved, submitted, approved, needsCorrection, total] = await Promise.all([
      db.result.count({ where: { ...baseWhere, status: 'SAVED' } }),
      db.result.count({ where: { ...baseWhere, status: 'SUBMITTED' } }),
      db.result.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      db.result.count({ where: { ...baseWhere, status: 'NEEDS_CORRECTION' } }),
      db.result.count({ where: baseWhere }),
    ])
  }

  return Response.json({
    counts: {
      teachers,
      teachersActive,
      students,
      studentsActive,
      classes,
      subjects,
    },
    current: {
      sessionName: session?.name ?? null,
      termName: term?.name ?? null,
      sessionId: session?.id ?? null,
      termId: term?.id ?? null,
    },
    results: {
      saved,
      submitted,
      approved,
      needsCorrection,
      total,
    },
  })
}
